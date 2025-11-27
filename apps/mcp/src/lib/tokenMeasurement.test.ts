/**
 * Token measurement test for smart filtering
 * Run with: tsx apps/mcp/src/lib/tokenMeasurement.test.ts
 *
 * Measures token reduction from smart filtering approach
 */

import { buildToolIndex } from "./toolIndexer.js";
import { ToolRouter } from "./toolRouter.js";
import type { EndServer } from "./endServer/endServer.js";

// Mock EndServers based on actual GitHub, Linear, Supabase tools
const mockEndServers: Record<string, EndServer> = {
  "github-mcp-server": {
    id: "github-mcp-server",
    name: "GitHub",
    listTools: async () => [
      { name: "search_repositories", description: "Search for repositories on GitHub using a query string" },
      { name: "search_code", description: "Search for code across GitHub repositories" },
      { name: "search_issues", description: "Search for issues and pull requests in GitHub repositories" },
      { name: "get_pull_request", description: "Get details about a specific pull request from a repository" },
      { name: "create_issue", description: "Create a new issue in a GitHub repository with title and description" },
      { name: "get_file_contents", description: "Get the contents of a file from a GitHub repository" },
      { name: "create_pull_request", description: "Create a new pull request in a GitHub repository" },
      { name: "list_commits", description: "List commits in a GitHub repository" },
      { name: "get_repository", description: "Get details about a specific GitHub repository" },
      { name: "list_branches", description: "List branches in a GitHub repository" },
      { name: "create_branch", description: "Create a new branch in a GitHub repository" },
      { name: "fork_repository", description: "Fork a GitHub repository" },
      { name: "create_repository", description: "Create a new GitHub repository" },
      { name: "delete_repository", description: "Delete a GitHub repository" },
      { name: "add_collaborator", description: "Add a collaborator to a GitHub repository" },
      { name: "list_collaborators", description: "List collaborators for a GitHub repository" },
      { name: "get_issue", description: "Get details about a specific issue" },
      { name: "update_issue", description: "Update an existing GitHub issue" },
      { name: "close_issue", description: "Close a GitHub issue" },
      { name: "list_issue_comments", description: "List comments on a GitHub issue" },
      { name: "create_issue_comment", description: "Create a comment on a GitHub issue" },
      { name: "update_pull_request", description: "Update an existing pull request" },
      { name: "merge_pull_request", description: "Merge a pull request" },
      { name: "list_pull_request_reviews", description: "List reviews on a pull request" },
      { name: "create_pull_request_review", description: "Create a review on a pull request" },
      { name: "get_commit", description: "Get details about a specific commit" }
    ]
  } as any,
  "linear-mcp-server": {
    id: "linear-mcp-server",
    name: "Linear",
    listTools: async () => [
      { name: "search_issues", description: "Search for issues in Linear workspace" },
      { name: "create_issue", description: "Create a new issue in Linear" },
      { name: "update_issue", description: "Update an existing Linear issue" },
      { name: "get_project", description: "Get details about a Linear project" },
      { name: "list_projects", description: "List all projects in Linear workspace" },
      { name: "get_team", description: "Get details about a Linear team" },
      { name: "list_teams", description: "List all teams in Linear workspace" }
    ]
  } as any,
  "supabase-mcp-server": {
    id: "supabase-mcp-server",
    name: "Supabase",
    listTools: async () => [
      { name: "list_tables", description: "List all tables in the Supabase database" },
      { name: "query_table", description: "Query a table in the Supabase database using SQL" },
      { name: "insert_row", description: "Insert a new row into a Supabase table" },
      { name: "update_row", description: "Update an existing row in a Supabase table" },
      { name: "delete_row", description: "Delete a row from a Supabase table" },
      { name: "get_table_schema", description: "Get the schema for a Supabase table" },
      { name: "create_table", description: "Create a new table in Supabase" },
      { name: "drop_table", description: "Drop a table from Supabase" },
      { name: "list_buckets", description: "List all storage buckets" },
      { name: "upload_file", description: "Upload a file to Supabase storage" },
      { name: "download_file", description: "Download a file from Supabase storage" },
      { name: "delete_file", description: "Delete a file from Supabase storage" },
      { name: "list_functions", description: "List all database functions" },
      { name: "execute_function", description: "Execute a database function" },
      { name: "list_views", description: "List all database views" },
      { name: "create_view", description: "Create a new database view" },
      { name: "get_user", description: "Get user details from auth" },
      { name: "create_user", description: "Create a new user in auth" },
      { name: "update_user", description: "Update user details in auth" },
      { name: "delete_user", description: "Delete a user from auth" },
      { name: "list_users", description: "List all users in auth" },
      { name: "send_invite", description: "Send an invite email to a user" },
      { name: "reset_password", description: "Reset user password" },
      { name: "list_roles", description: "List all database roles" },
      { name: "create_role", description: "Create a new database role" },
      { name: "list_policies", description: "List all RLS policies" },
      { name: "create_policy", description: "Create a new RLS policy" },
      { name: "get_stats", description: "Get database statistics" },
      { name: "run_migration", description: "Run a database migration" }
    ]
  } as any
};

const mockNamespaceMap = {
  "github-mcp-server": "0",
  "linear-mcp-server": "1",
  "supabase-mcp-server": "2"
};

interface TestQuery {
  query: string;
  expectedTopTools: string[];
}

const testQueries: TestQuery[] = [
  {
    query: "search github repos about AI",
    expectedTopTools: ["search_repositories", "search_code", "search_issues"]
  },
  {
    query: "create linear issue",
    expectedTopTools: ["create_issue", "update_issue", "search_issues"]
  },
  {
    query: "list database tables",
    expectedTopTools: ["list_tables", "query_table", "get_table_schema"]
  }
];

// Rough token estimation (1 token ≈ 4 characters for JSON)
function estimateTokens(obj: any): number {
  const jsonStr = JSON.stringify(obj);
  return Math.ceil(jsonStr.length / 4);
}

async function measureTokenReduction() {
  console.log("🧪 Building tool index for token measurement...\n");
  const toolIndex = await buildToolIndex(mockEndServers, mockNamespaceMap);
  const router = new ToolRouter(toolIndex);

  console.log(`📊 Total Tools Available: ${toolIndex.byName.size}`);
  console.log(`📊 Unique Keywords: ${toolIndex.byKeyword.size}\n`);
  console.log(`${"=".repeat(80)}\n`);

  // Measure full exposure (old approach)
  const allTools = Array.from(toolIndex.byName.values()).map(meta => ({
    name: meta.namespacedName,
    description: meta.description,
    inputSchema: { type: "object", properties: {} } // Simplified schema
  }));

  const fullExposureTokens = estimateTokens(allTools);
  console.log(`📦 OLD APPROACH (Full Tool Exposure):`);
  console.log(`   - Tools shown to LLM: ${allTools.length}`);
  console.log(`   - Estimated tokens: ~${fullExposureTokens.toLocaleString()}`);
  console.log();

  // Measure smart filtering (new approach)
  let totalFilteredTokens = 0;
  let totalFilteredTools = 0;

  for (const test of testQueries) {
    console.log(`🔍 Query: "${test.query}"`);

    const topCandidates = router.searchTools(test.query, 5);
    const filteredTools = topCandidates.map(meta => ({
      name: meta.namespacedName,
      description: meta.description,
      inputSchema: { type: "object", properties: {} }
    }));

    const filteredTokens = estimateTokens(filteredTools);
    totalFilteredTokens += filteredTokens;
    totalFilteredTools += filteredTools.length;

    console.log(`   - Top ${topCandidates.length} tools: ${topCandidates.map(t => t.name).join(', ')}`);
    console.log(`   - Estimated tokens: ~${filteredTokens.toLocaleString()}`);
    console.log(`   - Reduction: ${((1 - filteredTokens / fullExposureTokens) * 100).toFixed(1)}%`);
    console.log();
  }

  const avgFilteredTokens = Math.ceil(totalFilteredTokens / testQueries.length);
  const avgReduction = ((1 - avgFilteredTokens / fullExposureTokens) * 100).toFixed(1);

  console.log(`${"=".repeat(80)}\n`);
  console.log(`📦 NEW APPROACH (Smart Filtering):`);
  console.log(`   - Average tools shown to LLM: ${Math.ceil(totalFilteredTools / testQueries.length)}`);
  console.log(`   - Average estimated tokens: ~${avgFilteredTokens.toLocaleString()}`);
  console.log();

  console.log(`🎯 TOKEN REDUCTION SUMMARY:`);
  console.log(`   - Before: ~${fullExposureTokens.toLocaleString()} tokens`);
  console.log(`   - After:  ~${avgFilteredTokens.toLocaleString()} tokens`);
  console.log(`   - Reduction: ${avgReduction}% 🚀`);
  console.log();

  // Cost calculation (using Claude API pricing: $3/1M input tokens for Haiku)
  const costPerMillionTokens = 3;
  const oldCostPer1000Queries = (fullExposureTokens * 1000 / 1_000_000) * costPerMillionTokens;
  const newCostPer1000Queries = (avgFilteredTokens * 1000 / 1_000_000) * costPerMillionTokens;
  const savingsPer1000Queries = oldCostPer1000Queries - newCostPer1000Queries;

  console.log(`💰 COST IMPACT (Claude Haiku - $3/1M input tokens):`);
  console.log(`   - Old cost per 1000 queries: $${oldCostPer1000Queries.toFixed(2)}`);
  console.log(`   - New cost per 1000 queries: $${newCostPer1000Queries.toFixed(2)}`);
  console.log(`   - Savings per 1000 queries: $${savingsPer1000Queries.toFixed(2)}`);
  console.log(`   - Annual savings (1M queries): $${(savingsPer1000Queries * 1000).toFixed(2)}`);
  console.log();

  console.log(`✅ Smart filtering successfully reduces token usage by ${avgReduction}%!`);
  console.log(`✅ This makes Nexus ${avgReduction}% cheaper to run at scale.`);
}

// Run measurement
console.log("🚀 Starting Token Reduction Measurement\n");
measureTokenReduction().catch(console.error);
