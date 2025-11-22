import fs from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { z } from "zod";
import type { EndServerConfig, EndServerData, EndServerEnvVariable } from "./endServer/types.js";
import { EndServerTransportType } from "./endServer/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const appRoot = resolve(__dirname, "../.."); // apps/mcp

const DEFAULT_CONFIG_PATH = resolve(appRoot, "servers", "config.yml");

const sourceConfigSchema = z.object({
  path: z.string(),
  category: z.string().optional(),
  optional: z.boolean().default(false)
});

const envVarSchema = z.object({
  key: z.string().min(1),
  name: z.string().optional(),
  description: z.string().optional(),
  required: z.boolean().default(false),
  value: z.string().optional(),
  valueFromEnv: z.string().optional()
});

const stdioConfigSchema = z.object({
  transport: z.literal("stdio"),
  command: z.string().min(1),
  args: z.array(z.string()).default([]),
  env: z.record(z.string()).optional()
});

const httpConfigSchema = z.object({
  transport: z.literal("streamable-http"),
  url: z.string().min(1)
});

const serverConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  sourceUrl: z.string().optional(),
  category: z.string().optional(),
  logoUrl: z.string().optional(),
  installedOn: z.string().optional(),
  requiresAuth: z.boolean().default(false),
  accessToken: z.string().optional(),
  accessTokenFromEnv: z.string().optional(),
  accessTokenExpiresAt: z.string().nullable().optional(),
  env: z.array(envVarSchema).default([]),
  config: z.union([stdioConfigSchema, httpConfigSchema])
});

const globalConfigSchema = z.object({
  sources: z
    .array(sourceConfigSchema)
    .default([
      { path: "./default", category: "official" },
      { path: "./custom", category: "custom", optional: true }
    ])
});

type SourceConfig = z.infer<typeof sourceConfigSchema>;
type ServerConfig = z.infer<typeof serverConfigSchema>;

function resolveConfigPath(): { configPath: string; configDir: string } {
  const configuredPath = process.env.MCP_SERVERS_CONFIG;
  const configPath = configuredPath
    ? resolve(appRoot, configuredPath)
    : DEFAULT_CONFIG_PATH;

  return { configPath, configDir: dirname(configPath) };
}

function readYamlFile(path: string): unknown {
  const raw = fs.readFileSync(path, "utf8");
  return YAML.parse(raw) ?? {};
}

function loadGlobalConfig(): { configDir: string; configPath: string; sources: SourceConfig[] } {
  const { configPath, configDir } = resolveConfigPath();

  if (!fs.existsSync(configPath)) {
    console.log(
      `\x1B[90m[Config] No config.yml found at ${configPath}, using default sources.\x1B[0m`
    );
    return { configDir, configPath, sources: globalConfigSchema.parse({}).sources };
  }

  try {
    const parsed = globalConfigSchema.safeParse(readYamlFile(configPath));
    if (!parsed.success) {
      console.warn(
        `\x1B[93m[Config] Invalid config.yml at ${configPath}, falling back to defaults: ${parsed.error.message}\x1B[0m`
      );
      return { configDir, configPath, sources: globalConfigSchema.parse({}).sources };
    }
    return { configDir, configPath, sources: parsed.data.sources };
  } catch (error) {
    console.warn(
      `\x1B[93m[Config] Failed to read config.yml at ${configPath}, falling back to defaults: ${
        error instanceof Error ? error.message : String(error)
      }\x1B[0m`
    );
    return { configDir, configPath, sources: globalConfigSchema.parse({}).sources };
  }
}

function resolveEnvValue(envVar: z.infer<typeof envVarSchema>): string | null {
  if (envVar.value !== undefined) {
    return envVar.value;
  }
  if (envVar.valueFromEnv) {
    return process.env[envVar.valueFromEnv] ?? null;
  }
  return null;
}

function normalizeEnvVars(envVars: z.infer<typeof envVarSchema>[]): EndServerEnvVariable[] {
  return envVars.map((envVar) => ({
    name: envVar.name ?? envVar.key,
    key: envVar.key,
    description: envVar.description,
    required: envVar.required,
    value: resolveEnvValue(envVar)
  }));
}

function buildTransportConfig(
  config: ServerConfig["config"],
  envVars: EndServerEnvVariable[]
): EndServerConfig {
  if (config.transport === "stdio") {
    const envFromVars = envVars.reduce<Record<string, string>>((acc, envVar) => {
      if (envVar.value != null) {
        acc[envVar.key] = envVar.value;
      }
      return acc;
    }, {});

    return {
      transport: EndServerTransportType.STDIO,
      command: config.command,
      args: config.args ?? [],
      env: { ...(config.env ?? {}), ...envFromVars }
    };
  }

  return {
    transport: EndServerTransportType.STREAMABLE_HTTP,
    url: config.url
  };
}

function findConfigFile(dirPath: string): string | null {
  const ymlPath = join(dirPath, "config.yml");
  const yamlPath = join(dirPath, "config.yaml");

  if (fs.existsSync(ymlPath)) return ymlPath;
  if (fs.existsSync(yamlPath)) return yamlPath;
  return null;
}

function parseServerConfig(filePath: string, categoryFromSource?: string): EndServerData | null {
  const raw = readYamlFile(filePath);
  const parsed = serverConfigSchema.safeParse(raw);

  if (!parsed.success) {
    console.warn(
      `\x1B[93m[Config] Skipping ${filePath}: ${parsed.error.message}\x1B[0m`
    );
    return null;
  }

  const envVars = normalizeEnvVars(parsed.data.env);

  const accessToken =
    parsed.data.accessToken ??
    (parsed.data.accessTokenFromEnv ? process.env[parsed.data.accessTokenFromEnv] : undefined);

  const stats = fs.statSync(filePath);

  return {
    id: parsed.data.id,
    name: parsed.data.name,
    description: parsed.data.description,
    sourceUrl: parsed.data.sourceUrl,
    category: parsed.data.category ?? categoryFromSource,
    installedOn: parsed.data.installedOn ?? stats.mtime.toISOString(),
    logoUrl: parsed.data.logoUrl,
    requiresAuth: parsed.data.requiresAuth,
    config: buildTransportConfig(parsed.data.config, envVars),
    environmentVariables: envVars,
    accessToken,
    accessTokenExpiresAt: parsed.data.accessTokenExpiresAt ?? null
  };
}

function resolveSourcePath(source: SourceConfig, baseDir: string): string {
  if (isAbsolute(source.path)) {
    return source.path;
  }
  return resolve(baseDir, source.path);
}

function loadSourceConfigs(
  sources: SourceConfig[],
  baseDir: string
): EndServerData[] {
  const seenServerIds = new Set<string>();
  const endServers: EndServerData[] = [];

  for (const source of sources) {
    const resolvedPath = resolveSourcePath(source, baseDir);

    if (!fs.existsSync(resolvedPath)) {
      if (source.optional) {
        console.log(`\x1B[90m[Config] Optional source missing, skipping: ${resolvedPath}\x1B[0m`);
      } else {
        console.warn(`\x1B[93m[Config] Source not found: ${resolvedPath}\x1B[0m`);
      }
      continue;
    }

    const entries = fs.readdirSync(resolvedPath, { withFileTypes: true });
    const serverDirs = entries.filter((entry) => entry.isDirectory());

    for (const dir of serverDirs) {
      const serverDirPath = join(resolvedPath, dir.name);
      const configPath = findConfigFile(serverDirPath);

      if (!configPath) {
        console.warn(`\x1B[93m[Config] No config.yml found in ${serverDirPath}, skipping.\x1B[0m`);
        continue;
      }

      const server = parseServerConfig(configPath, source.category);
      if (!server) continue;

      if (seenServerIds.has(server.id)) {
        console.warn(`\x1B[93m[Config] Duplicate server id '${server.id}', skipping ${configPath}.\x1B[0m`);
        continue;
      }

      seenServerIds.add(server.id);
      endServers.push(server);
    }
  }

  return endServers;
}

export async function loadConfiguredEndServers(): Promise<EndServerData[]> {
  const { configDir, configPath, sources } = loadGlobalConfig();
  console.log(`\x1B[90m[Config] Loading MCP servers from ${configPath}...\x1B[0m`);

  return loadSourceConfigs(sources, configDir);
}
