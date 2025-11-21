import type { EndServerData } from "./endServer/types.js";
import { verifyEnvironmentVariables } from "./endServer/utils.js";

/**
 * Validates that all required environment variables are present for a server.
 */
export function hasValidEnv(endServer: EndServerData): boolean {
  return verifyEnvironmentVariables(endServer.environmentVariables);
}

/**
 * Extracts the Nexus namespace ID and original tool name from a namespaced tool.
 *
 * Names are shaped as: `${toolName}_${nexusId}_nxs`
 */
export function parseNamespacedToolName(name: string): { nexusId: string; toolName: string } {
  if (!name.endsWith("_nxs")) {
    throw new Error(`Invalid namespaced tool name: ${name}`);
  }

  const withoutSuffix = name.slice(0, -"_nxs".length);
  const lastUnderscoreIndex = withoutSuffix.lastIndexOf("_");

  if (lastUnderscoreIndex === -1) {
    throw new Error(`Unable to parse namespaced tool name: ${name}`);
  }

  const toolName = withoutSuffix.slice(0, lastUnderscoreIndex);
  const nexusId = withoutSuffix.slice(lastUnderscoreIndex + 1);

  return { nexusId, toolName };
}


