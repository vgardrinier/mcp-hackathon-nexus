import type { ToolIndex, ToolMetadata } from "./toolIndexer.js";
import { normalizeQuery } from "./toolIndexer.js";
import { expandQuery } from "./synonyms.js";

export interface ToolRoutingRequest {
  userQuery: string;
  _intent?: string; // Explicit tool name if known
}

export interface ToolRoutingResult {
  selectedTool: string;
  confidence: "high" | "medium" | "low";
  reason: string;
  // For medium/low confidence - return candidates for outer LLM to resolve
  needsClarification?: boolean;
  candidates?: Array<{
    tool: string;
    server: string;
    description?: string;
  }>;
}

/**
 * ToolRouter implements the A→B→C→D pipeline:
 * A. Check explicit intent
 * B. Fast keyword match
 * C. LLM resolver (ambiguous)
 * D. Cache result
 */
/**
 * Server hint keywords for domain-specific routing
 * These keywords strongly suggest which server to use
 */
const SERVER_HINTS: Record<string, string[]> = {
  "GitHub": ["repo", "repository", "pull", "merge", "branch", "commit", "fork", "clone"],
  "Linear": ["ticket", "cycle", "sprint", "assignee", "priority", "backlog"],
  "Notion": ["page", "database", "block", "workspace"],
  "Firecrawl": ["scrape", "crawl", "extract", "website", "url", "html"],
  "Supabase": ["database", "table", "row", "auth", "storage", "bucket"],
  "n8n": ["workflow", "automation", "node", "execution", "trigger", "webhook", "integrate"]
};

export class ToolRouter {
  constructor(private toolIndex: ToolIndex) {}

  /**
   * Main routing entry point
   * 
   * 3-tier strategy:
   * - HIGH confidence → Execute immediately
   * - MEDIUM confidence → Use Haiku LLM to disambiguate
   * - LOW confidence → Return candidates, ask user to clarify
   */
  async route(request: ToolRoutingRequest): Promise<ToolRoutingResult> {
    // Step A: Check for explicit intent
    let serverFilter: string | undefined;

    if (request._intent) {
      const explicit = this.handleExplicitIntent(request._intent);
      if (explicit) {
        return {
          selectedTool: explicit,
          confidence: "high",
          reason: "Explicit tool name provided"
        };
      }

      // Check if _intent is a server name for filtering
      serverFilter = this.getServerFilter(request._intent);
    }

    // Step B: Fast keyword match (with optional server filter)
    const keywordMatches = this.matchByKeywords(request.userQuery, serverFilter);

    if (keywordMatches.length === 0) {
      throw new Error(
        `No matching tools found for query: "${request.userQuery}"${serverFilter ? ` in server: ${serverFilter}` : ''}`
      );
    }

    if (keywordMatches.length === 1) {
      return {
        selectedTool: keywordMatches[0].namespacedName,
        confidence: "high",
        reason: `Single keyword match with score ${keywordMatches[0].score}`
      };
    }

    // Multiple matches - check if top match is significantly better
    const topMatch = keywordMatches[0];
    const secondMatch = keywordMatches[1];
    const topScore = topMatch.score;
    const secondScore = secondMatch?.score || 0;

    // Debug logging for ambiguous routing
    if (keywordMatches.length > 1) {
      console.log(`\x1B[93m[ToolRouter] Top 3 matches for "${request.userQuery}":\x1B[0m`);
      keywordMatches.slice(0, 3).forEach((match, i) => {
        console.log(`  ${i + 1}. ${match.serverName}:${match.name} (score: ${match.score}, nameHits: ${match.nameKeywordHits})`);
      });
    }

    // High confidence if:
    // 1. Top match has 2x the score of second best, OR
    // 2. Top match has exact name match AND second doesn't (or is same server), OR
    // 3. Top match has 50% more name keyword hits than second
    const scoreRatio = secondScore > 0 ? topScore / secondScore : Infinity;
    const nameHitAdvantage = topMatch.nameKeywordHits - (secondMatch?.nameKeywordHits || 0);
    const bothExactMatch = topMatch.exactMatch && secondMatch?.exactMatch;
    const isCrossServer = topMatch.serverName !== secondMatch?.serverName;

    // If both top matches have exact name match AND are from different servers, it's ambiguous!
    if (bothExactMatch && isCrossServer) {
      const topCandidates = keywordMatches.slice(0, 4);
      return {
        selectedTool: topMatch.namespacedName,
        confidence: "medium",
        reason: `Multiple servers have "${topMatch.name}". Please specify which service.`,
        needsClarification: true,
        candidates: topCandidates.map(c => ({
          tool: c.name,
          server: c.serverName,
          description: c.description
        }))
      };
    }

    if (
      topMatch.exactMatch ||
      scoreRatio >= 2 ||
      (topMatch.nameKeywordHits > 0 && nameHitAdvantage >= 1)
    ) {
      return {
        selectedTool: topMatch.namespacedName,
        confidence: "high",
        reason: topMatch.exactMatch
          ? `Exact name match (score: ${topScore})`
          : scoreRatio >= 2
          ? `Clear winner with score ${topScore} vs ${secondScore}`
          : `Strong name keyword match (${topMatch.nameKeywordHits} hits vs ${secondMatch?.nameKeywordHits || 0})`
      };
    }

    // Medium confidence - close race, let outer LLM help disambiguate
    if (topScore >= 3) {
      const topCandidates = keywordMatches.slice(0, 4);
      const isCrossServer = topMatch.serverName !== secondMatch?.serverName;
      
      // If it's a cross-server ambiguity with tight scores, ask for clarification
      if (isCrossServer && scoreRatio < 1.5) {
        return {
          selectedTool: topMatch.namespacedName,
          confidence: "medium",
          reason: `Ambiguous between ${topMatch.serverName} and ${secondMatch.serverName}. Please specify.`,
          needsClarification: true,
          candidates: topCandidates.map(c => ({
            tool: c.name,
            server: c.serverName,
            description: c.description
          }))
        };
      }
      
      // Otherwise just proceed with top match
      return {
        selectedTool: topMatch.namespacedName,
        confidence: "medium",
        reason: `Top match among ${keywordMatches.length} candidates (score: ${topScore})`
      };
    }

    // Low confidence - definitely ask for clarification
    const topCandidates = keywordMatches.slice(0, 4);
    return {
      selectedTool: topMatch.namespacedName,
      confidence: "low",
      reason: `Multiple possible matches. Please be more specific.`,
      needsClarification: true,
      candidates: topCandidates.map(c => ({
        tool: c.name,
        server: c.serverName,
        description: c.description
      }))
    };
  }

  /**
   * Check if intent is a server name and return it for filtering
   */
  private getServerFilter(intent: string): string | undefined {
    const normalizedIntent = intent.toLowerCase();

    for (const metadata of this.toolIndex.byName.values()) {
      if (metadata.serverName.toLowerCase() === normalizedIntent) {
        return metadata.serverName;
      }
    }

    return undefined;
  }

  /**
   * Step A: Handle explicit tool intent
   * Supports tool names only (server names handled via filtering)
   */
  private handleExplicitIntent(intent: string): string | null {
    // Check if it's a valid namespaced tool name
    if (this.toolIndex.byName.has(intent)) {
      return intent;
    }

    // Check if it's a tool name without namespace - find first match
    for (const [namespacedName, metadata] of this.toolIndex.byName.entries()) {
      if (metadata.name === intent) {
        return namespacedName;
      }
    }

    return null;
  }

  /**
   * Step B: Fast keyword matching with scoring
   * @param query - User query
   * @param serverFilter - Optional server name to filter results
   */
  private matchByKeywords(
    query: string,
    serverFilter?: string
  ): Array<ToolMetadata & { score: number; nameKeywordHits: number; exactMatch: boolean }> {
    let queryKeywords = normalizeQuery(query);

    if (queryKeywords.length === 0) {
      return [];
    }

    // Expand query with synonyms
    queryKeywords = expandQuery(queryKeywords);

    // Check for server hints to boost relevant servers
    const queryLower = query.toLowerCase();
    const serverBoosts = new Map<string, number>();

    for (const [serverName, hints] of Object.entries(SERVER_HINTS)) {
      for (const hint of hints) {
        if (queryLower.includes(hint)) {
          serverBoosts.set(serverName, (serverBoosts.get(serverName) || 0) + 5);
        }
      }
    }

    if (serverBoosts.size > 0) {
      console.log(`\x1B[96m[ToolRouter] Server hints detected: ${Array.from(serverBoosts.entries()).map(([s, b]) => `${s}(+${b})`).join(', ')}\x1B[0m`);
    }

    // Score each tool based on keyword matches
    const scores = new Map<string, { score: number; nameKeywordHits: number; exactMatch: boolean }>();

    for (const keyword of queryKeywords) {
      const matchingTools = this.toolIndex.byKeyword.get(keyword) || [];

      for (const toolName of matchingTools) {
        // Apply server filter if provided
        if (serverFilter) {
          const metadata = this.toolIndex.byName.get(toolName);
          if (metadata && metadata.serverName !== serverFilter) {
            continue; // Skip tools not from the specified server
          }
        }

        if (!scores.has(toolName)) {
          scores.set(toolName, { score: 0, nameKeywordHits: 0, exactMatch: false });
        }

        const toolScore = scores.get(toolName)!;
        toolScore.score += 1;

        // Track if this keyword came from the tool name
        const metadata = this.toolIndex.byName.get(toolName);
        if (metadata?.keywords.includes(keyword)) {
          // Check if it's from nameKeywords (these appear twice in index, so they'll score 2x)
          const nameKeywords = metadata.name.toLowerCase()
            .replace(/([A-Z])/g, ' $1')
            .split(/[\s_\-.,()]+/)
            .filter(w => w.length > 2);

          if (nameKeywords.includes(keyword)) {
            toolScore.nameKeywordHits += 1;
          }
        }
      }
    }

    // Check for exact name matches
    for (const [toolName, toolScore] of scores.entries()) {
      const metadata = this.toolIndex.byName.get(toolName);
      if (metadata) {
        const normalizedToolName = metadata.name.toLowerCase().replace(/[_\-]/g, '');
        const normalizedQuery = query.toLowerCase().replace(/[_\-\s]/g, '');

        if (normalizedToolName === normalizedQuery || metadata.name.toLowerCase() === query.toLowerCase()) {
          toolScore.exactMatch = true;
          toolScore.score += 100; // Huge boost for exact matches
        }
      }
    }

    // Convert to array with metadata and apply server boosts
    const results = Array.from(scores.entries())
      .map(([namespacedName, scoreData]) => {
        const metadata = this.toolIndex.byName.get(namespacedName);
        if (!metadata) {
          throw new Error(`Tool metadata not found: ${namespacedName}`);
        }

        // Apply server hint boost if applicable
        let finalScore = scoreData.score;
        const serverBoost = serverBoosts.get(metadata.serverName);
        if (serverBoost) {
          finalScore += serverBoost;
        }

        return {
          ...metadata,
          score: finalScore,
          nameKeywordHits: scoreData.nameKeywordHits,
          exactMatch: scoreData.exactMatch
        };
      })
      .sort((a, b) => {
        // Primary: score
        if (a.score !== b.score) return b.score - a.score;

        // Tie-breaker 1: exact match
        if (a.exactMatch !== b.exactMatch) return a.exactMatch ? -1 : 1;

        // Tie-breaker 2: more name keyword hits
        if (a.nameKeywordHits !== b.nameKeywordHits) return b.nameKeywordHits - a.nameKeywordHits;

        // Tie-breaker 3: shorter name (more specific)
        return a.name.length - b.name.length;
      });

    return results;
  }


  /**
   * Get all available tools (for debugging/listing)
   */
  getAllTools(): ToolMetadata[] {
    return Array.from(this.toolIndex.byName.values());
  }

  /**
   * Search tools by query (for debugging)
   */
  searchTools(query: string, limit = 5): ToolMetadata[] {
    const matches = this.matchByKeywords(query);
    return matches.slice(0, limit);
  }
}
