import type { EndServerData } from './endServer/types.js';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import os from 'os';

// Known untrusted servers (external content, user-generated)
const UNTRUSTED_SERVERS = new Set([
  'github', 'gitlab', 'bitbucket',
  'notion', 'confluence',
  'firecrawl', 'web-search', 'brave-search',
  'slack', 'discord', 'twitter', 'reddit',
  'stackoverflow', 'hackernews'
]);

// Private data servers (company internal)
const PRIVATE_DATA_SERVERS = new Set([
  'linear', 'jira', 'asana', 'trello',
  'airtable', 'coda',
  'salesforce', 'hubspot',
  'intercom', 'zendesk'
]);

// Secret servers (infrastructure, credentials)
const SECRET_SERVERS = new Set([
  'filesystem',
  'supabase', 'postgres', 'mysql', 'mongodb', 'redis',
  'aws', 'gcp', 'azure',
  'docker', 'kubernetes',
  'vault', 'secrets-manager'
]);

export interface ServerClassification {
  trustLevel: 'TRUSTED' | 'UNTRUSTED';
  securityLevel: 'PUBLIC' | 'PRIVATE' | 'SECRET';
  reasoning: string;
}

export function classifyServer(server: EndServerData): ServerClassification {
  const serverId = server.id.toLowerCase();
  const serverName = server.name.toLowerCase();

  // Check against known patterns - most restrictive first
  if (SECRET_SERVERS.has(serverId) || SECRET_SERVERS.has(serverName)) {
    return {
      trustLevel: 'TRUSTED',
      securityLevel: 'SECRET',
      reasoning: 'Infrastructure/secrets access - highest security level'
    };
  }

  if (UNTRUSTED_SERVERS.has(serverId) || UNTRUSTED_SERVERS.has(serverName)) {
    return {
      trustLevel: 'UNTRUSTED',
      securityLevel: 'PUBLIC',
      reasoning: 'External service with user-generated content'
    };
  }

  if (PRIVATE_DATA_SERVERS.has(serverId) || PRIVATE_DATA_SERVERS.has(serverName)) {
    return {
      trustLevel: 'TRUSTED',
      securityLevel: 'PRIVATE',
      reasoning: 'Company data and internal systems'
    };
  }

  // Fallback: Look at category from YAML
  if (server.category === 'external' || server.category === 'public') {
    return {
      trustLevel: 'UNTRUSTED',
      securityLevel: 'PUBLIC',
      reasoning: 'Categorized as external/public service'
    };
  }

  if (server.category === 'database' || server.category === 'storage') {
    return {
      trustLevel: 'TRUSTED',
      securityLevel: 'PRIVATE',
      reasoning: 'Database or storage service'
    };
  }

  // Look for filesystem patterns
  if (serverId.includes('file') || serverName.includes('file')) {
    return {
      trustLevel: 'TRUSTED',
      securityLevel: 'SECRET',
      reasoning: 'Filesystem access detected'
    };
  }

  // Look for database patterns
  if (serverId.includes('db') || serverId.includes('sql') ||
      serverName.includes('db') || serverName.includes('sql')) {
    return {
      trustLevel: 'TRUSTED',
      securityLevel: 'PRIVATE',
      reasoning: 'Database pattern detected'
    };
  }

  // Default: Assume untrusted for safety
  return {
    trustLevel: 'UNTRUSTED',
    securityLevel: 'PUBLIC',
    reasoning: 'Unknown server type - defaulting to untrusted for safety'
  };
}

interface EdisonConfig {
  server: {
    host: string;
    port: number;
    api_key: string;
    ssl_cert_file: null;
    ssl_key_file: null;
  };
  logging: {
    level: string;
    database_path: null;
  };
  mcp_servers: Array<{
    name: string;
    command: string;
    args: string[];
    env: Record<string, string>;
    enabled: boolean;
  }>;
  telemetry: {
    enabled: boolean;
  };
  _nexus_metadata?: {
    auto_generated: boolean;
    generated_at: string;
    source: string;
    classifications: Record<string, ServerClassification>;
  };
}

export function generateEdisonMCPServers(servers: EndServerData[]): {
  mcp_servers: any[];
  classifications: Record<string, ServerClassification>;
} {
  const mcp_servers = [];
  const classifications: Record<string, ServerClassification> = {};

  for (const server of servers) {
    const classification = classifyServer(server);

    // Only include stdio servers (Edison doesn't support http servers yet)
    if (server.config.transport === 'stdio') {
      const edisonServerConfig: any = {
        name: server.name,
        command: server.config.command,
        args: server.config.args || [],
        env: { ...(server.config.env || {}) },
        enabled: true
      };

      // Add environment variables from Nexus config
      for (const envVar of server.environmentVariables) {
        if (envVar.value) {
          edisonServerConfig.env[envVar.key] = envVar.value;
        }
      }

      mcp_servers.push(edisonServerConfig);
    }

    // Store classification for all servers (for logging)
    classifications[server.name] = classification;
  }

  return { mcp_servers, classifications };
}

export async function syncNexusConfigToEdison(
  servers: EndServerData[],
  edisonConfigDir: string
): Promise<void> {
  // Ensure directory exists
  if (!existsSync(edisonConfigDir)) {
    console.log(`\x1B[90m[Edison] Creating config directory: ${edisonConfigDir}\x1B[0m`);
    require('fs').mkdirSync(edisonConfigDir, { recursive: true });
  }

  const configPath = resolve(edisonConfigDir, 'config.json');

  // Check if user has manual overrides
  let hasManualOverrides = false;
  if (existsSync(configPath)) {
    try {
      const existing = JSON.parse(readFileSync(configPath, 'utf8'));
      hasManualOverrides = existing._nexus_metadata?.manual_overrides === true;
    } catch {
      // Invalid JSON, will regenerate
    }
  }

  if (hasManualOverrides) {
    console.log('\x1B[93m[Edison] Manual overrides detected, skipping auto-generation\x1B[0m');
    return;
  }

  const { mcp_servers, classifications } = generateEdisonMCPServers(servers);

  // Generate Edison's config.json
  const edisonConfig: EdisonConfig = {
    server: {
      host: '0.0.0.0',
      port: 4000,
      api_key: 'dev-api-key-change-me',
      ssl_cert_file: null,
      ssl_key_file: null
    },
    logging: {
      level: 'INFO',
      database_path: null
    },
    mcp_servers: mcp_servers,
    telemetry: {
      enabled: false
    },
    _nexus_metadata: {
      auto_generated: true,
      generated_at: new Date().toISOString(),
      source: 'nexus_yaml_configs',
      classifications: classifications
    }
  };

  writeFileSync(configPath, JSON.stringify(edisonConfig, null, 2));

  console.log(`\x1B[92m[Edison] ✅ Generated config for ${servers.length} MCP servers (${mcp_servers.length} stdio-based)\x1B[0m`);

  // Log classifications for user visibility
  const grouped = {
    untrusted: [] as string[],
    private: [] as string[],
    secret: [] as string[]
  };

  for (const [name, classification] of Object.entries(classifications)) {
    if (classification.trustLevel === 'UNTRUSTED') {
      grouped.untrusted.push(name);
    } else if (classification.securityLevel === 'SECRET') {
      grouped.secret.push(name);
    } else {
      grouped.private.push(name);
    }
  }

  if (grouped.untrusted.length > 0) {
    console.log(`\x1B[93m[Edison]   ⚠️  Untrusted sources: ${grouped.untrusted.join(', ')}\x1B[0m`);
  }
  if (grouped.secret.length > 0) {
    console.log(`\x1B[91m[Edison]   🔐 Secret access: ${grouped.secret.join(', ')}\x1B[0m`);
  }
  if (grouped.private.length > 0) {
    console.log(`\x1B[96m[Edison]   🔒 Private data: ${grouped.private.join(', ')}\x1B[0m`);
  }

  console.log('\x1B[90m[Edison]   💡 Edison will block: UNTRUSTED + SECRET/PRIVATE + EXTERNAL_WRITE (lethal trifecta)\x1B[0m');

  // Also ensure permission files exist (empty = allow all)
  const toolPermsPath = resolve(edisonConfigDir, 'tool_permissions.json');
  if (!existsSync(toolPermsPath)) {
    writeFileSync(toolPermsPath, JSON.stringify({ "_metadata": {} }, null, 2));
  }

  const resourcePermsPath = resolve(edisonConfigDir, 'resource_permissions.json');
  if (!existsSync(resourcePermsPath)) {
    writeFileSync(resourcePermsPath, JSON.stringify({ "_metadata": {} }, null, 2));
  }

  const promptPermsPath = resolve(edisonConfigDir, 'prompt_permissions.json');
  if (!existsSync(promptPermsPath)) {
    writeFileSync(promptPermsPath, JSON.stringify({ "_metadata": {} }, null, 2));
  }
}
