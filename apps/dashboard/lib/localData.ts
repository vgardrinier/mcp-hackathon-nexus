import fs from "fs";
import path from "path";
import {
  McpServerEnvironmentVarRow,
  McpServerEnvironmentVarUserValueRow,
  McpServerRow,
  McpServerUserAuthTokenRow,
  McpServerUserRow,
  UserRow
} from "./db/schema";

type LocalState = {
  user: UserRow;
  servers: McpServerRow[];
  serverUsers: McpServerUserRow[];
  authTokens: McpServerUserAuthTokenRow[];
  envVars: McpServerEnvironmentVarRow[];
  envValues: McpServerEnvironmentVarUserValueRow[];
};

const DATA_PATH =
  process.env.NEXUS_LOCAL_STATE_PATH ||
  path.join(process.cwd(), ".nexus", "local-state.json");

const LOCAL_USER = {
  id: "local-user",
  email: null
};

const DEFAULT_SERVERS: McpServerRow[] = [
  {
    id: "github-mcp-server",
    name: "GitHub",
    description: "Access GitHub repositories, issues, PRs via MCP",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    url: null,
    logo_url: "https://github.githubassets.com/favicons/favicon.svg",
    source_url: "https://github.com/modelcontextprotocol/servers",
    requires_auth: true
  },
  {
    id: "linear-mcp-server",
    name: "Linear",
    description: "Manage Linear issues, projects, and teams",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@mseep/linear-mcp"],
    url: null,
    logo_url: "https://linear.app/favicon.ico",
    source_url: null,
    requires_auth: true
  }
];

const DEFAULT_ENV_VARS: McpServerEnvironmentVarRow[] = [
  {
    id: "github-mcp-server-GITHUB_TOKEN",
    server_id: "github-mcp-server",
    name: "GitHub Personal Access Token",
    key: "GITHUB_TOKEN",
    description: "Token with repo access",
    required: true
  },
  {
    id: "linear-mcp-server-LINEAR_API_KEY",
    server_id: "linear-mcp-server",
    name: "Linear API Key",
    key: "LINEAR_API_KEY",
    description: "Personal API key from Linear settings",
    required: true
  }
];

function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadState(): LocalState {
  ensureDir(DATA_PATH);
  if (!fs.existsSync(DATA_PATH)) {
    const initial: LocalState = {
      user: LOCAL_USER,
      servers: DEFAULT_SERVERS,
      serverUsers: [],
      authTokens: [],
      envVars: DEFAULT_ENV_VARS,
      envValues: []
    };
    fs.writeFileSync(DATA_PATH, JSON.stringify(initial, null, 2), "utf-8");
    return initial;
  }

  const raw = fs.readFileSync(DATA_PATH, "utf-8");
  try {
    const parsed = JSON.parse(raw) as LocalState;
    // Ensure required fields exist
    return {
      user: parsed.user || LOCAL_USER,
      servers: parsed.servers || DEFAULT_SERVERS,
      serverUsers: parsed.serverUsers || [],
      authTokens: parsed.authTokens || [],
      envVars: parsed.envVars || DEFAULT_ENV_VARS,
      envValues: parsed.envValues || []
    };
  } catch {
    const fallback: LocalState = {
      user: LOCAL_USER,
      servers: DEFAULT_SERVERS,
      serverUsers: [],
      authTokens: [],
      envVars: DEFAULT_ENV_VARS,
      envValues: []
    };
    fs.writeFileSync(DATA_PATH, JSON.stringify(fallback, null, 2), "utf-8");
    return fallback;
  }
}

function saveState(state: LocalState) {
  ensureDir(DATA_PATH);
  fs.writeFileSync(DATA_PATH, JSON.stringify(state, null, 2), "utf-8");
}

export function getLocalUser(): UserRow {
  const state = loadState();
  return state.user;
}

export function listServers(): McpServerRow[] {
  const state = loadState();
  return state.servers;
}

export function getServerById(serverId: string): McpServerRow | undefined {
  return listServers().find((s) => s.id === serverId);
}

export function getInstalledServerIds(userId: string): Set<string> {
  const state = loadState();
  return new Set(state.serverUsers.filter((s) => s.user_id === userId).map((s) => s.server_id));
}

export function installServer(userId: string, serverId: string) {
  const state = loadState();
  const exists = state.serverUsers.some(
    (entry) => entry.user_id === userId && entry.server_id === serverId
  );
  if (!exists) {
    state.serverUsers.push({
      user_id: userId,
      server_id: serverId,
      installed_at: new Date().toISOString()
    });
    saveState(state);
  }
}

export function uninstallServer(userId: string, serverId: string) {
  const state = loadState();
  state.serverUsers = state.serverUsers.filter(
    (entry) => !(entry.user_id === userId && entry.server_id === serverId)
  );
  state.authTokens = state.authTokens.filter(
    (entry) => !(entry.user_id === userId && entry.server_id === serverId)
  );
  const envVarIds = state.envVars.filter((ev) => ev.server_id === serverId).map((ev) => ev.id);
  if (envVarIds.length) {
    state.envValues = state.envValues.filter(
      (val) => !(val.user_id === userId && envVarIds.includes(val.environment_var_id))
    );
  }
  saveState(state);
}

export function getEnvVarDefs(serverId: string): McpServerEnvironmentVarRow[] {
  const state = loadState();
  return state.envVars.filter((ev) => ev.server_id === serverId);
}

export function getEnvVarValues(
  userId: string,
  serverId: string
): McpServerEnvironmentVarUserValueRow[] {
  const defs = getEnvVarDefs(serverId).map((def) => def.id);
  const state = loadState();
  return state.envValues.filter(
    (val) => val.user_id === userId && defs.includes(val.environment_var_id)
  );
}

export function upsertEnvVarValues(
  userId: string,
  serverId: string,
  values: Record<string, string | null>
) {
  const state = loadState();
  const defs = getEnvVarDefs(serverId);
  const defByKey = new Map(defs.map((d) => [d.key, d]));
  const updatedValues = state.envValues.filter((val) => {
    const def = defs.find((d) => d.id === val.environment_var_id);
    return !(val.user_id === userId && def);
  });

  Object.entries(values).forEach(([key, value]) => {
    const def = defByKey.get(key);
    if (!def) return;
    updatedValues.push({
      user_id: userId,
      environment_var_id: def.id,
      value: value ?? null
    });
  });

  state.envValues = updatedValues;
  saveState(state);
}

export function getAuthToken(
  userId: string,
  serverId: string
): McpServerUserAuthTokenRow | null {
  const state = loadState();
  return (
    state.authTokens.find((entry) => entry.user_id === userId && entry.server_id === serverId) ||
    null
  );
}

export function saveAuthToken(userId: string, serverId: string, accessToken: string) {
  const state = loadState();
  const withoutExisting = state.authTokens.filter(
    (entry) => !(entry.user_id === userId && entry.server_id === serverId)
  );
  withoutExisting.push({
    user_id: userId,
    server_id: serverId,
    access_token: accessToken,
    access_token_expires_at: null
  });
  state.authTokens = withoutExisting;
  saveState(state);
}
