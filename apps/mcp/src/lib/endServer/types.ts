import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { AuthenticatedStreamableHTTPClientTransport } from "./transport.js";

export interface EndServerOptions {
  handleToolsListChanged: () => Promise<void>;
}

export interface EndServerSummary {
  id: string;
  name: string;
  description?: string;
  sourceUrl?: string;
  category?: string;
  installedOn?: Date | string;
}

export enum EndServerTransportType {
  STDIO = "stdio",
  STREAMABLE_HTTP = "streamable-http"
}

export type EndServerTransport =
  | StdioClientTransport
  | StreamableHTTPClientTransport
  | AuthenticatedStreamableHTTPClientTransport;

interface EndServerStdioConfig {
  transport: EndServerTransportType.STDIO;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

interface EndServerStreamableHttpConfig {
  transport: EndServerTransportType.STREAMABLE_HTTP;
  url: string | URL;
}

export type EndServerConfig = EndServerStdioConfig | EndServerStreamableHttpConfig;

export interface EndServerEnvVariable {
  name: string;
  key: string;
  description?: string;
  required: boolean;
  value: string | null;
  createdAt?: Date;
}

export interface EndServerData {
  id: string;
  name: string;
  description?: string;
  sourceUrl?: string;
  category?: string;
  installedOn?: Date | string;
  config: EndServerConfig;
  environmentVariables: EndServerEnvVariable[];
  logoUrl?: string;
  requiresAuth: boolean;
  accessToken?: string;
  accessTokenExpiresAt?: string | null;
}
