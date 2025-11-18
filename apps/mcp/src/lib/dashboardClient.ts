import type { EndServerData } from "./endServer/types.js";
import { env } from "./env.js";

/**
 * Fetches the list of end servers installed for the API key associated with this MCP instance.
 *
 * This calls the dashboard's external API:
 *   GET /api/external/user/mcp/servers
 */
export async function getUserEndServers(): Promise<EndServerData[]> {
  const url = new URL("/api/external/user/mcp/servers", env.DASHBOARD_URL);

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${env.API_KEY}`,
      "Content-Type": "application/json"
    }
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch end servers: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as { servers: EndServerData[] } | EndServerData[];
  if (Array.isArray(data)) {
    return data;
  }

  return data.servers;
}


