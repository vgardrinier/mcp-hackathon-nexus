import fs from "fs";
import path from "path";
import os from "os";
import YAML from "yaml";

/**
 * Get the user's Nexus config directory
 * ~/.config/nexus on Mac/Linux
 * %APPDATA%/nexus on Windows
 */
function getUserConfigDir(): string {
  if (process.env.MCP_USER_CONFIG_DIR) {
    return path.resolve(process.env.MCP_USER_CONFIG_DIR);
  }

  if (process.platform === "win32") {
    const appData = process.env.APPDATA || path.resolve(os.homedir(), "AppData", "Roaming");
    return path.resolve(appData, "nexus");
  }

  return path.resolve(os.homedir(), ".config", "nexus");
}

function getUserServersDir(): string {
  if (process.env.MCP_USER_SERVERS_DIR) {
    return path.resolve(process.env.MCP_USER_SERVERS_DIR);
  }
  return path.resolve(getUserConfigDir(), "servers", "custom");
}

const USER_SERVERS_DIR = getUserServersDir();

export interface ServerEnvVar {
  key: string;
  name?: string;
  description?: string;
  required?: boolean;
  value?: string;
  valueFromEnv?: string;
  valueFromFile?: string;
}

export interface ServerConfig {
  id: string;
  name: string;
  description?: string;
  sourceUrl?: string;
  category?: string;
  logoUrl?: string;
  installedOn?: string;
  requiresAuth?: boolean;
  accessToken?: string;
  accessTokenFromEnv?: string;
  accessTokenExpiresAt?: string | null;
  env?: ServerEnvVar[];
  config: {
    transport: "stdio" | "streamable-http";
    command?: string;
    args?: string[];
    url?: string;
    env?: Record<string, string>;
  };
}

/**
 * List all available MCP servers from ~/.config/nexus/servers/custom
 */
export function listAvailableServers(): ServerConfig[] {
  if (!fs.existsSync(USER_SERVERS_DIR)) {
    console.log(`[YAML] Servers directory does not exist: ${USER_SERVERS_DIR}`);
    return [];
  }

  const servers: ServerConfig[] = [];
  const entries = fs.readdirSync(USER_SERVERS_DIR, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const serverDir = path.join(USER_SERVERS_DIR, entry.name);
    const configPath = path.join(serverDir, "config.yml");

    if (!fs.existsSync(configPath)) {
      console.warn(`[YAML] No config.yml found in ${serverDir}`);
      continue;
    }

    try {
      const rawYaml = fs.readFileSync(configPath, "utf-8");
      const config = YAML.parse(rawYaml) as ServerConfig;
      servers.push(config);
    } catch (error) {
      console.error(`[YAML] Failed to parse ${configPath}:`, error);
    }
  }

  return servers;
}

/**
 * Get a specific server config by ID
 */
export function getServerConfig(serverId: string): ServerConfig | null {
  const serverDir = path.join(USER_SERVERS_DIR, serverId.replace("mcp-server", "").replace(/-$/, ""));
  const configPath = path.join(serverDir, "config.yml");

  if (!fs.existsSync(configPath)) {
    console.warn(`[YAML] Config not found for server ${serverId} at ${configPath}`);
    return null;
  }

  try {
    const rawYaml = fs.readFileSync(configPath, "utf-8");
    return YAML.parse(rawYaml) as ServerConfig;
  } catch (error) {
    console.error(`[YAML] Failed to parse config for ${serverId}:`, error);
    return null;
  }
}

/**
 * Check if a server is configured (has all required env vars with actual values)
 * A server is considered configured if the user has provided actual token/credential values,
 * not just the template with valueFromEnv placeholders.
 */
export function isServerConfigured(config: ServerConfig): boolean {
  if (!config.env || config.env.length === 0) {
    // No env vars required
    if (config.config.transport === "streamable-http") {
      // HTTP servers might need auth token
      return config.requiresAuth ? Boolean(config.accessToken) : true;
    }
    return true;
  }

  // Check if all required env vars have actual values provided by the user
  const requiredVars = config.env.filter((v) => v.required);
  return requiredVars.every((v) => {
    // Only consider it configured if there's an actual value set
    // (not just valueFromEnv template)
    return Boolean(v.value);
  });
}

/**
 * Update environment variable values in a server's config
 */
export function updateServerEnvVars(serverId: string, envValues: Record<string, string>): boolean {
  const serverDir = path.join(USER_SERVERS_DIR, serverId.replace("mcp-server", "").replace(/-$/, ""));
  const configPath = path.join(serverDir, "config.yml");

  if (!fs.existsSync(configPath)) {
    console.error(`[YAML] Config not found for server ${serverId}`);
    return false;
  }

  try {
    const rawYaml = fs.readFileSync(configPath, "utf-8");
    const config = YAML.parse(rawYaml) as ServerConfig;

    if (!config.env) {
      config.env = [];
    }

    // Update each env var with the provided value
    for (const [key, value] of Object.entries(envValues)) {
      const envVar = config.env.find((v) => v.key === key);
      if (envVar) {
        // Update existing env var
        if (value && value.trim() !== "") {
          envVar.value = value;
          // Remove valueFromEnv if we're setting a direct value
          delete envVar.valueFromEnv;
        } else {
          // Clear the value if empty
          delete envVar.value;
        }
      } else {
        // Add new env var if it doesn't exist
        if (value && value.trim() !== "") {
          config.env.push({ key, value });
        }
      }
    }

    // Write back to YAML
    const newYaml = YAML.stringify(config);
    fs.writeFileSync(configPath, newYaml, "utf-8");
    console.log(`[YAML] Updated env vars for ${serverId}`);
    return true;
  } catch (error) {
    console.error(`[YAML] Failed to update env vars for ${serverId}:`, error);
    return false;
  }
}

/**
 * Update access token for HTTP servers
 */
export function updateServerAccessToken(serverId: string, accessToken: string): boolean {
  const serverDir = path.join(USER_SERVERS_DIR, serverId.replace("mcp-server", "").replace(/-$/, ""));
  const configPath = path.join(serverDir, "config.yml");

  if (!fs.existsSync(configPath)) {
    console.error(`[YAML] Config not found for server ${serverId}`);
    return false;
  }

  try {
    const rawYaml = fs.readFileSync(configPath, "utf-8");
    const config = YAML.parse(rawYaml) as ServerConfig;

    if (accessToken && accessToken.trim() !== "") {
      config.accessToken = accessToken;
      // Remove accessTokenFromEnv if we're setting a direct value
      delete config.accessTokenFromEnv;
    } else {
      delete config.accessToken;
    }

    // Write back to YAML
    const newYaml = YAML.stringify(config);
    fs.writeFileSync(configPath, newYaml, "utf-8");
    console.log(`[YAML] Updated access token for ${serverId}`);
    return true;
  } catch (error) {
    console.error(`[YAML] Failed to update access token for ${serverId}:`, error);
    return false;
  }
}

/**
 * Get resolved env var values for display (reads from env if valueFromEnv is set)
 */
export function getResolvedEnvVars(config: ServerConfig): Record<string, string | null> {
  if (!config.env) return {};

  const resolved: Record<string, string | null> = {};

  for (const envVar of config.env) {
    if (envVar.value) {
      resolved[envVar.key] = envVar.value;
    } else if (envVar.valueFromEnv && process.env[envVar.valueFromEnv]) {
      resolved[envVar.key] = process.env[envVar.valueFromEnv] || null;
    } else if (envVar.valueFromFile) {
      // Try to read from file
      try {
        const filePath = path.isAbsolute(envVar.valueFromFile)
          ? envVar.valueFromFile
          : path.resolve(getUserConfigDir(), envVar.valueFromFile);
        if (fs.existsSync(filePath)) {
          resolved[envVar.key] = fs.readFileSync(filePath, "utf-8").trim();
        } else {
          resolved[envVar.key] = null;
        }
      } catch {
        resolved[envVar.key] = null;
      }
    } else {
      resolved[envVar.key] = null;
    }
  }

  return resolved;
}
