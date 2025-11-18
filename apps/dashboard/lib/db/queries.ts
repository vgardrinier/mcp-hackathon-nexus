import type {
  McpServerEnvironmentVarRow,
  McpServerEnvironmentVarUserValueRow,
  McpServerRow,
  McpServerUserAuthTokenRow,
  UserRow
} from "./schema";
import { supabaseAdmin } from "./supabaseClient";

export async function findUserByApiKey(apiKey: string): Promise<UserRow | null> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("api_key", apiKey)
    .maybeSingle<UserRow>();

  if (error) throw error;
  return data ?? null;
}

export async function getInstalledServersForUser(userId: string): Promise<McpServerRow[]> {
  const { data, error } = await supabaseAdmin
    .from("mcp_servers")
    .select("*, mcp_server_users!inner(user_id)")
    .eq("mcp_server_users.user_id", userId);

  if (error) throw error;
  return (data as unknown as McpServerRow[]) ?? [];
}

export async function getEnvVarsForServer(serverId: string): Promise<McpServerEnvironmentVarRow[]> {
  const { data, error } = await supabaseAdmin
    .from("mcp_server_environment_vars")
    .select("*")
    .eq("server_id", serverId);

  if (error) throw error;
  return (data as McpServerEnvironmentVarRow[]) ?? [];
}

export async function getEnvVarUserValuesForUser(
  userId: string
): Promise<McpServerEnvironmentVarUserValueRow[]> {
  const { data, error } = await supabaseAdmin
    .from("mcp_server_environment_var_values")
    .select("*")
    .eq("user_id", userId);

  if (error) throw error;
  return (data as McpServerEnvironmentVarUserValueRow[]) ?? [];
}

export async function getAuthTokenForUserServer(
  userId: string,
  serverId: string
): Promise<McpServerUserAuthTokenRow | null> {
  const { data, error } = await supabaseAdmin
    .from("mcp_server_user_auth_tokens")
    .select("*")
    .eq("user_id", userId)
    .eq("server_id", serverId)
    .maybeSingle<McpServerUserAuthTokenRow>();

  if (error) throw error;
  return data ?? null;
}


