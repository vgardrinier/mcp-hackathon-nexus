/**
 * Manual test suite for tool routing
 * Run with: pnpm tsx apps/mcp/src/lib/toolRouter.manual-test.ts
 *
 * Tests keyword extraction effectiveness against actual MCP servers
 * Measures: accuracy, latency, token reduction
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
      { name: "list_commits", description: "List commits in a GitHub repository" }
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
      { name: "list_projects", description: "List all projects in Linear workspace" }
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
      { name: "delete_row", description: "Delete a row from a Supabase table" }
    ]
  } as any
};

const mockNamespaceMap = {
  "github-mcp-server": "0",
  "linear-mcp-server": "1",
  "supabase-mcp-server": "2"
};

interface TestCase {
  query: string;
  expectedTool: string | RegExp;
  expectedServer: string;
  description: string;
}

// Real-world user queries - what people actually type
const testCases: TestCase[] = [
  // ===== CLEAR INTENT (should be HIGH confidence) =====
  { query: "search github repos", expectedTool: "search_repositories_0_nxs", expectedServer: "GitHub", description: "Clear server + action" },
  { query: "find code in my github repos", expectedTool: "search_code_0_nxs", expectedServer: "GitHub", description: "Natural language with server" },
  { query: "list my linear issues", expectedTool: "search_issues_1_nxs", expectedServer: "Linear", description: "Linear issues request" },
  { query: "show supabase tables", expectedTool: "list_tables_2_nxs", expectedServer: "Supabase", description: "Database tables" },
  { query: "create a github issue", expectedTool: "create_issue_0_nxs", expectedServer: "GitHub", description: "Create with server context" },
  { query: "query the database", expectedTool: "query_table_2_nxs", expectedServer: "Supabase", description: "Database query" },
  
  // ===== SYNONYMS (tests synonym mapping) =====
  { query: "find my repos", expectedTool: "search_repositories_0_nxs", expectedServer: "GitHub", description: "Synonym: find → search" },
  { query: "get my PRs", expectedTool: "get_pull_request_0_nxs", expectedServer: "GitHub", description: "Synonym: PR → pull request" },
  { query: "create a ticket in linear", expectedTool: "create_issue_1_nxs", expectedServer: "Linear", description: "Synonym: ticket → issue" },
  { query: "show me the code review", expectedTool: "get_pull_request_0_nxs", expectedServer: "GitHub", description: "Synonym: code review → PR" },
  
  // ===== AMBIGUOUS (should trigger clarification) =====
  { query: "search issues", expectedTool: /search_issues_(0|1)_nxs/, expectedServer: "GitHub|Linear", description: "Ambiguous: GitHub or Linear?" },
  { query: "create an issue", expectedTool: /create_issue_(0|1)_nxs/, expectedServer: "GitHub|Linear", description: "Ambiguous: which service?" },
  
  // ===== NATURAL LANGUAGE (verbose queries) =====
  { query: "I want to find all repositories related to machine learning", expectedTool: "search_repositories_0_nxs", expectedServer: "GitHub", description: "Verbose natural language" },
  { query: "can you please search for issues in github", expectedTool: "search_issues_0_nxs", expectedServer: "GitHub", description: "Polite verbose query" },
  { query: "what tables do I have in my database", expectedTool: "list_tables_2_nxs", expectedServer: "Supabase", description: "Question format" },
  
  // ===== EXACT TOOL NAMES =====
  { query: "search_repositories", expectedTool: "search_repositories_0_nxs", expectedServer: "GitHub", description: "Exact tool name" },
  { query: "list_tables", expectedTool: "list_tables_2_nxs", expectedServer: "Supabase", description: "Exact tool name" },
];

// Estimate tokens for a tool (name + description + schema overhead)
function estimateToolTokens(tool: { name: string; description?: string }): number {
  const nameTokens = Math.ceil(tool.name.length / 4);
  const descTokens = Math.ceil((tool.description?.length || 0) / 4);
  return nameTokens + descTokens + 15; // +15 for JSON structure
}

async function runTests() {
  console.log("🚀 Starting Tool Router Tests\n");
  console.log("🧪 Building tool index...\n");
  
  const toolIndex = await buildToolIndex(mockEndServers, mockNamespaceMap);
  const router = new ToolRouter(toolIndex);
  const allTools = router.getAllTools();

  console.log(`📊 Index Stats:`);
  console.log(`   Total tools: ${toolIndex.byName.size}`);
  console.log(`   Unique keywords: ${toolIndex.byKeyword.size}`);
  console.log(`\n${"=".repeat(70)}\n`);

  // Calculate baseline token cost (all tools)
  const totalTokensAllTools = allTools.reduce((sum, t) => sum + estimateToolTokens(t), 0);

  // Run tests and collect metrics
  let passed = 0;
  let failed = 0;
  let clarificationRequests = 0;
  const latencies: number[] = [];
  const tokenSavings: number[] = [];

  console.log("📝 ROUTING TESTS\n");

  for (const test of testCases) {
    const start = performance.now();
    const result = await router.route({ userQuery: test.query });
    const latency = performance.now() - start;
    latencies.push(latency);

    // Check if result matches expected
    let testPassed: boolean;
    if (typeof test.expectedTool === "string") {
      testPassed = result.selectedTool === test.expectedTool;
    } else {
      testPassed = test.expectedTool.test(result.selectedTool);
    }

    // Calculate token savings for this query
    const filtered = router.searchTools(test.query, 5);
    const filteredTokens = filtered.reduce((sum, t) => sum + estimateToolTokens(t), 0);
    const savings = ((totalTokensAllTools - filteredTokens) / totalTokensAllTools) * 100;
    tokenSavings.push(savings);

    // Track clarification requests
    if (result.needsClarification) {
      clarificationRequests++;
    }

    // Display result
    const icon = testPassed ? "✅" : "❌";
    const confIcon = result.confidence === "high" ? "🟢" : result.confidence === "medium" ? "🟡" : "🔴";
    const clarifyNote = result.needsClarification ? " [asks for clarification]" : "";
    
    console.log(`${icon} "${test.query}"`);
    console.log(`   ${confIcon} ${result.confidence} → ${result.selectedTool.replace(/_\d+_nxs$/, '')} (${test.expectedServer})`);
    console.log(`   ⚡ ${latency.toFixed(2)}ms | 💾 ${savings.toFixed(0)}% token reduction${clarifyNote}`);
    
    if (!testPassed) {
      console.log(`   ❗ Expected: ${test.expectedTool}`);
      failed++;
    } else {
      passed++;
    }
    console.log();
  }

  // Summary
  console.log(`${"=".repeat(70)}\n`);
  console.log(`📈 RESULTS SUMMARY\n`);
  
  const passRate = (passed / testCases.length * 100).toFixed(1);
  console.log(`🎯 Accuracy: ${passed}/${testCases.length} (${passRate}%)`);
  console.log(`🔀 Clarification requests: ${clarificationRequests}/${testCases.length}`);
  
  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const maxLatency = Math.max(...latencies);
  const minLatency = Math.min(...latencies);
  console.log(`\n⚡ LATENCY:`);
  console.log(`   Average: ${avgLatency.toFixed(2)}ms`);
  console.log(`   Min: ${minLatency.toFixed(2)}ms`);
  console.log(`   Max: ${maxLatency.toFixed(2)}ms`);
  
  const avgTokenSavings = tokenSavings.reduce((a, b) => a + b, 0) / tokenSavings.length;
  console.log(`\n💾 TOKEN REDUCTION:`);
  console.log(`   Baseline (all tools): ~${totalTokensAllTools} tokens`);
  console.log(`   After filtering: ~${Math.round(totalTokensAllTools * (1 - avgTokenSavings / 100))} tokens avg`);
  console.log(`   Average savings: ${avgTokenSavings.toFixed(1)}%`);

  // Cost impact
  const costPer1MTokens = 3; // Claude Haiku pricing
  const queriesPerMonth = 10000;
  const oldCost = (totalTokensAllTools * queriesPerMonth / 1_000_000) * costPer1MTokens;
  const newCost = (totalTokensAllTools * (1 - avgTokenSavings / 100) * queriesPerMonth / 1_000_000) * costPer1MTokens;
  console.log(`\n💰 COST IMPACT (10K queries/month):`);
  console.log(`   Without filtering: $${oldCost.toFixed(2)}`);
  console.log(`   With filtering: $${newCost.toFixed(2)}`);
  console.log(`   Savings: $${(oldCost - newCost).toFixed(2)}/month`);

  console.log(`\n${"=".repeat(70)}`);
  
  if (failed === 0) {
    console.log(`\n🎉 All tests passed!`);
  } else {
    console.log(`\n⚠️  ${failed} test(s) need attention.`);
  }
}

runTests().catch(console.error);
