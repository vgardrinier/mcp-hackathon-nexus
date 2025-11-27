/**
 * Manual test suite for tool routing
 * Run with: tsx apps/mcp/src/lib/toolRouter.manual-test.ts
 *
 * Tests keyword extraction effectiveness against actual MCP servers
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
  name: string;
  query: string;
  expectedTool: string | RegExp;
  expectedConfidence?: "high" | "medium" | "low";
  shouldPass: boolean;
}

const testCases: TestCase[] = [
  // ===== GITHUB TESTS =====
  { name: "GitHub: exact tool name", query: "search_repositories", expectedTool: "search_repositories_0_nxs", expectedConfidence: "high", shouldPass: true },
  { name: "GitHub: camelCase query", query: "searchRepositories", expectedTool: "search_repositories_0_nxs", expectedConfidence: "high", shouldPass: true },
  { name: "GitHub: natural language", query: "search github repos", expectedTool: "search_repositories_0_nxs", expectedConfidence: "high", shouldPass: true },
  { name: "GitHub: with noise words", query: "can you search for code in github", expectedTool: "search_code_0_nxs", expectedConfidence: "high", shouldPass: true },
  { name: "GitHub: complex query", query: "find my repos about AI and resume", expectedTool: /search_(repositories|issues)_0_nxs/, shouldPass: true },
  { name: "GitHub: search issues", query: "search github issues", expectedTool: "search_issues_0_nxs", expectedConfidence: "high", shouldPass: true },

  // ===== LINEAR TESTS =====
  { name: "Linear: search issues", query: "search linear issues", expectedTool: "search_issues_1_nxs", expectedConfidence: "high", shouldPass: true },
  { name: "Linear: create issue", query: "create linear issue", expectedTool: "create_issue_1_nxs", expectedConfidence: "high", shouldPass: true },
  { name: "Linear: get project", query: "get project details", expectedTool: "get_project_1_nxs", shouldPass: true },

  // ===== SUPABASE TESTS =====
  { name: "Supabase: list tables", query: "list database tables", expectedTool: "list_tables_2_nxs", expectedConfidence: "high", shouldPass: true },
  { name: "Supabase: query table", query: "query supabase table", expectedTool: "query_table_2_nxs", expectedConfidence: "high", shouldPass: true },
  { name: "Supabase: insert row", query: "insert data into table", expectedTool: "insert_row_2_nxs", shouldPass: true },

  // ===== DISAMBIGUATION TESTS =====
  { name: "Disambiguate: github vs linear issues", query: "search github issues", expectedTool: "search_issues_0_nxs", shouldPass: true },
  { name: "Disambiguate: linear vs github issues", query: "search linear issues", expectedTool: "search_issues_1_nxs", shouldPass: true },
  { name: "Ambiguous: 'search issues' (no context)", query: "search issues", expectedTool: /search_issues_(0|1)_nxs/, shouldPass: true },

  // ===== KNOWN FAILURES (need synonyms) =====
  { name: "FAIL: code review → pull request", query: "code review", expectedTool: "get_pull_request_0_nxs", shouldPass: false },
  { name: "FAIL: ticket → issue", query: "create a ticket", expectedTool: /create_issue_(0|1)_nxs/, shouldPass: false },
  { name: "FAIL: PR → pull request", query: "create PR", expectedTool: "create_pull_request_0_nxs", shouldPass: false },
  { name: "FAIL: merge → pull request", query: "merge request", expectedTool: "create_pull_request_0_nxs", shouldPass: false }
];

async function runTests() {
  console.log("🧪 Building tool index...\n");
  const toolIndex = await buildToolIndex(mockEndServers, mockNamespaceMap);
  const router = new ToolRouter(toolIndex);

  console.log(`📊 Index Stats:`);
  console.log(`  - Total tools: ${toolIndex.byName.size}`);
  console.log(`  - Unique keywords: ${toolIndex.byKeyword.size}`);
  console.log(`\n${"=".repeat(80)}\n`);

  let passed = 0;
  let failed = 0;
  let knownFailures = 0;

  for (const test of testCases) {
    try {
      const result = await router.route({ userQuery: test.query });

      let testPassed: boolean;
      if (typeof test.expectedTool === "string") {
        testPassed = result.selectedTool === test.expectedTool;
      } else {
        testPassed = test.expectedTool.test(result.selectedTool);
      }

      if (test.expectedConfidence) {
        testPassed = testPassed && result.confidence === test.expectedConfidence;
      }

      const icon = testPassed ? "✅" : (test.shouldPass ? "❌" : "⚠️ ");
      const status = testPassed ? "PASS" : (test.shouldPass ? "FAIL" : "KNOWN FAIL");

      console.log(`${icon} ${status}: ${test.name}`);
      console.log(`   Query: "${test.query}"`);
      console.log(`   Selected: ${result.selectedTool} (${result.confidence} confidence)`);
      console.log(`   Reason: ${result.reason}`);

      if (!testPassed && test.shouldPass) {
        console.log(`   ❗ Expected: ${test.expectedTool}`);
        failed++;
      } else if (testPassed) {
        passed++;
      } else {
        knownFailures++;
      }

      console.log();
    } catch (error) {
      console.log(`❌ ERROR: ${test.name}`);
      console.log(`   Query: "${test.query}"`);
      console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
      console.log();
      failed++;
    }
  }

  console.log(`${"=".repeat(80)}\n`);
  console.log(`📈 Test Results:`);
  console.log(`   ✅ Passed: ${passed}/${testCases.filter(t => t.shouldPass).length}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   ⚠️  Known Failures (need synonyms): ${knownFailures}`);
  console.log();

  const passRate = (passed / testCases.filter(t => t.shouldPass).length * 100).toFixed(1);
  console.log(`🎯 Success Rate: ${passRate}%`);

  if (failed === 0) {
    console.log(`\n🎉 All expected tests passed! Keyword extraction is working well.`);
  } else {
    console.log(`\n💡 ${failed} test(s) failed. Consider adding synonym support.`);
  }

  // Show which cases would benefit from synonyms
  const synonymNeeded = testCases.filter(t => !t.shouldPass);
  if (synonymNeeded.length > 0) {
    console.log(`\n🔍 Synonym Opportunities (${synonymNeeded.length} cases):`);
    synonymNeeded.forEach(t => {
      console.log(`   - "${t.query}" → needs synonym mapping`);
    });
  }
}

// Run tests
console.log("🚀 Starting Tool Router Tests\n");
runTests().catch(console.error);
