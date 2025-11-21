export type TransportKind = "stdio" | "streamable-http";

export interface UserRow {
  id: string;
  email: string | null;
  api_key: string;
}

export interface McpServerRow {
  id: string;
  name: string;
  description: string;
  transport: TransportKind;
  command: string | null;
  args: string[] | null;
  url: string | null;
  logo_url: string | null;
  source_url: string | null;
  requires_auth: boolean;
}

export interface McpServerUserRow {
  user_id: string;
  server_id: string;
  installed_at: string;
}

export interface McpServerUserAuthTokenRow {
  user_id: string;
  server_id: string;
  access_token: string;
  access_token_expires_at: string | null;
}

export interface McpServerEnvironmentVarRow {
  id: string;
  server_id: string;
  name: string;
  key: string;
  description: string | null;
  required: boolean;
}

export interface McpServerEnvironmentVarUserValueRow {
  user_id: string;
  environment_var_id: string;
  value: string | null;
}



