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

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${env.API_KEY}`,
        "Content-Type": "application/json"
      }
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => res.statusText);
      throw new Error(
        `Failed to fetch end servers: ${res.status} ${res.statusText}. URL: ${url.toString()}. Response: ${errorText}`
      );
    }

    const data = (await res.json()) as { servers: EndServerData[] } | EndServerData[];
    if (Array.isArray(data)) {
      return data;
    }

    return data.servers;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes("fetch")) {
      // Network error (connection refused, DNS failure, etc.)
      throw new Error(
        `Network error fetching end servers from ${url.toString()}. ` +
        `Is the dashboard running at ${env.DASHBOARD_URL}? ` +
        `Original error: ${error.message}`
      );
    }
    // Re-throw other errors as-is
    throw error;
  }
}


