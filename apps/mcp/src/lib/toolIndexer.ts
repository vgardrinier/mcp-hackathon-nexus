import type { EndServer } from "./endServer/endServer.js";

export interface ToolMetadata {
  name: string;
  namespacedName: string;
  description?: string;
  keywords: string[];
  serverId: string;
  serverName: string;
}

export interface ToolIndex {
  byName: Map<string, ToolMetadata>;
  byKeyword: Map<string, string[]>;
  byCategory: Map<string, string[]>;
}

/**
 * Extended stopwords list to filter out noise from verbose descriptions
 */
const STOPWORDS = new Set([
  // Common articles/prepositions
  "the",
  "a",
  "an",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "from",
  "by",
  "about",
  "as",
  "is",
  "was",
  "are",
  "be",
  "been",
  "being",
  // Verbose description noise words
  "using",
  "string",
  "details",
  "specific",
  "new",
  "fetch",
  "get",
  "set",
  "create",
  "update",
  "delete",
  "this",
  "that",
  "these",
  "those"
]);

/**
 * Extract keywords from text, with separate handling for name vs description
 * @param name - Tool name (higher semantic value)
 * @param description - Tool description (may be verbose)
 * @returns Object with nameKeywords (boosted) and descriptionKeywords
 */
export function extractKeywords(
  name: string,
  description?: string
): { nameKeywords: string[]; descriptionKeywords: string[] } {
  const processText = (text: string): string[] => {
    return (
      text
        .toLowerCase()
        // Split camelCase: searchCode -> search code
        .replace(/([A-Z])/g, " $1")
        // Split on whitespace, underscore, dash, comma, period
        .split(/[\s_\-.,()]+/)
        .map((w) => w.trim())
        // Keep words > 2 chars
        .filter((w) => w.length > 2)
        // Remove stopwords
        .filter((w) => !STOPWORDS.has(w))
        // Deduplicate
        .filter((v, i, arr) => arr.indexOf(v) === i)
    );
  };

  const nameKeywords = processText(name);
  const descriptionKeywords = description
    ? processText(description).filter((kw) => !nameKeywords.includes(kw))
    : [];

  return { nameKeywords, descriptionKeywords };
}

/**
 * Build a searchable index from all registered EndServers
 * @param endServers - Map of registered MCP servers
 * @param serverIdToNamespace - Mapping from server ID to numeric namespace
 * @returns ToolIndex with name, keyword, and category lookups
 */
export async function buildToolIndex(
  endServers: Record<string, EndServer>,
  serverIdToNamespace: Record<string, string>
): Promise<ToolIndex> {
  const index: ToolIndex = {
    byName: new Map(),
    byKeyword: new Map(),
    byCategory: new Map()
  };

  for (const [serverId, server] of Object.entries(endServers)) {
    try {
      // Get actual tools from the MCP server
      const tools = await server.listTools();

      // Get the numeric namespace for this server
      const namespace = serverIdToNamespace[serverId];
      if (!namespace) {
        console.warn(`\x1B[93m[ToolIndexer] No namespace found for server ${serverId}, skipping\x1B[0m`);
        continue;
      }

      for (const tool of tools) {
        const namespacedName = `${tool.name}_${namespace}_nxs`;

        // Extract keywords with name boosting
        const { nameKeywords, descriptionKeywords } = extractKeywords(
          tool.name,
          tool.description
        );

        // All keywords for this tool
        const allKeywords = [...nameKeywords, ...descriptionKeywords];

        // Store metadata
        const metadata: ToolMetadata = {
          name: tool.name,
          namespacedName,
          description: tool.description,
          keywords: allKeywords,
          serverId,
          serverName: server.name
        };

        index.byName.set(namespacedName, metadata);

        // Index by keyword with name keywords getting priority
        // Name keywords get indexed twice for boosting in search
        for (const keyword of nameKeywords) {
          if (!index.byKeyword.has(keyword)) {
            index.byKeyword.set(keyword, []);
          }
          // Add twice for boosting (will be scored higher in matching)
          index.byKeyword.get(keyword)!.push(namespacedName);
          index.byKeyword.get(keyword)!.push(namespacedName);
        }

        // Description keywords added once
        for (const keyword of descriptionKeywords) {
          if (!index.byKeyword.has(keyword)) {
            index.byKeyword.set(keyword, []);
          }
          index.byKeyword.get(keyword)!.push(namespacedName);
        }

        // Index by category (server name as category for now)
        const category = server.name.toLowerCase();
        if (!index.byCategory.has(category)) {
          index.byCategory.set(category, []);
        }
        index.byCategory.get(category)!.push(namespacedName);
      }

      console.log(
        `\x1B[90m[ToolIndexer] Indexed ${tools.length} tools from ${server.name}\x1B[0m`
      );
    } catch (error) {
      console.warn(
        `\x1B[93m[ToolIndexer] Failed to index tools from ${server.name}: ${
          error instanceof Error ? error.message : String(error)
        }\x1B[0m`
      );
    }
  }

  const totalTools = index.byName.size;
  const totalKeywords = index.byKeyword.size;
  console.log(
    `\x1B[90m[ToolIndexer] Built index: ${totalTools} tools, ${totalKeywords} unique keywords\x1B[0m`
  );

  return index;
}

/**
 * Normalize user query for keyword extraction
 * Handles camelCase splitting like tool name extraction
 */
export function normalizeQuery(query: string): string[] {
  return (
    query
      // Split camelCase BEFORE lowercasing: searchCode -> search Code
      .replace(/([A-Z])/g, " $1")
      .toLowerCase()
      // Split on whitespace, underscore, dash, comma, period, parens
      .split(/[\s_\-.,()]+/)
      .map((w) => w.trim())
      .filter((w) => w.length > 2)
      .filter((w) => !STOPWORDS.has(w))
      // Deduplicate
      .filter((v, i, arr) => arr.indexOf(v) === i)
  );
}
