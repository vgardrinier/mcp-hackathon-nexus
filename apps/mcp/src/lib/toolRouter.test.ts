import { describe, it, expect, beforeAll } from "@jest/globals";
import { buildToolIndex } from "./toolIndexer.js";
import { ToolRouter } from "./toolRouter.js";
import type { EndServer } from "./endServer/endServer.js";

/**
 * Test suite for intelligent tool routing
 *
 * Tests against actual MCP servers: GitHub, Linear, Supabase
 * Measures keyword extraction effectiveness and routing accuracy
 */

// Mock EndServer data based on actual servers
const mockEndServers: Record<string, EndServer> = {
  "github-mcp-server": {
    id: "github-mcp-server",
    name: "GitHub",
    listTools: async () => [
      {
        name: "search_repositories",
        description: "Search for repositories on GitHub using a query string"
      },
      {
        name: "search_code",
        description: "Search for code across GitHub repositories"
      },
      {
        name: "search_issues",
        description: "Search for issues and pull requests in GitHub repositories"
      },
      {
        name: "get_pull_request",
        description: "Get details about a specific pull request from a repository"
      },
      {
        name: "create_issue",
        description: "Create a new issue in a GitHub repository with title and description"
      },
      {
        name: "get_file_contents",
        description: "Get the contents of a file from a GitHub repository"
      }
    ]
  } as any,
  "linear-mcp-server": {
    id: "linear-mcp-server",
    name: "Linear",
    listTools: async () => [
      {
        name: "search_issues",
        description: "Search for issues in Linear workspace"
      },
      {
        name: "create_issue",
        description: "Create a new issue in Linear"
      },
      {
        name: "update_issue",
        description: "Update an existing Linear issue"
      },
      {
        name: "get_project",
        description: "Get details about a Linear project"
      }
    ]
  } as any,
  "supabase-mcp-server": {
    id: "supabase-mcp-server",
    name: "Supabase",
    listTools: async () => [
      {
        name: "list_tables",
        description: "List all tables in the Supabase database"
      },
      {
        name: "query_table",
        description: "Query a table in the Supabase database using SQL"
      },
      {
        name: "insert_row",
        description: "Insert a new row into a Supabase table"
      },
      {
        name: "update_row",
        description: "Update an existing row in a Supabase table"
      }
    ]
  } as any
};

const mockNamespaceMap = {
  "github-mcp-server": "0",
  "linear-mcp-server": "1",
  "supabase-mcp-server": "2"
};

describe("Tool Router - Real World Tests", () => {
  let router: ToolRouter;

  beforeAll(async () => {
    const toolIndex = await buildToolIndex(mockEndServers, mockNamespaceMap);
    router = new ToolRouter(toolIndex);
  });

  describe("GitHub Tool Routing", () => {
    it("should route 'search github repos' to search_repositories", async () => {
      const result = await router.route({
        userQuery: "search github repos"
      });

      expect(result.selectedTool).toBe("search_repositories_0_nxs");
      expect(result.confidence).toBe("high");
    });

    it("should route 'find code in github' to search_code", async () => {
      const result = await router.route({
        userQuery: "find code in github"
      });

      expect(result.selectedTool).toBe("search_code_0_nxs");
      expect(result.confidence).toBe("high");
    });

    it("should route 'search github issues' to search_issues", async () => {
      const result = await router.route({
        userQuery: "search github issues"
      });

      expect(result.selectedTool).toBe("search_issues_0_nxs");
      expect(result.confidence).toBe("high");
    });

    it("should handle camelCase queries: searchRepositories", async () => {
      const result = await router.route({
        userQuery: "searchRepositories"
      });

      expect(result.selectedTool).toBe("search_repositories_0_nxs");
      expect(result.confidence).toBe("high");
    });

    it("should handle exact name match: get_file_contents", async () => {
      const result = await router.route({
        userQuery: "get_file_contents"
      });

      expect(result.selectedTool).toBe("get_file_contents_0_nxs");
      expect(result.confidence).toBe("high");
    });
  });

  describe("Linear Tool Routing", () => {
    it("should route 'search linear issues' to Linear search_issues", async () => {
      const result = await router.route({
        userQuery: "search linear issues"
      });

      expect(result.selectedTool).toBe("search_issues_1_nxs");
      expect(result.confidence).toBe("high");
    });

    it("should route 'create linear issue' to Linear create_issue", async () => {
      const result = await router.route({
        userQuery: "create linear issue"
      });

      expect(result.selectedTool).toBe("create_issue_1_nxs");
      expect(result.confidence).toBe("high");
    });

    it("should route 'get project details' to get_project", async () => {
      const result = await router.route({
        userQuery: "get project details"
      });

      expect(result.selectedTool).toBe("get_project_2_nxs");
    });
  });

  describe("Supabase Tool Routing", () => {
    it("should route 'list database tables' to list_tables", async () => {
      const result = await router.route({
        userQuery: "list database tables"
      });

      expect(result.selectedTool).toBe("list_tables_2_nxs");
      expect(result.confidence).toBe("high");
    });

    it("should route 'query supabase table' to query_table", async () => {
      const result = await router.route({
        userQuery: "query supabase table"
      });

      expect(result.selectedTool).toBe("query_table_2_nxs");
      expect(result.confidence).toBe("high");
    });
  });

  describe("Ambiguous Cases (Known Failures)", () => {
    it("FAIL: 'code review' should match pull_request but won't (needs synonyms)", async () => {
      const result = await router.route({
        userQuery: "code review"
      });

      // This will likely not match or get low confidence
      // because "review" isn't in tool descriptions
      console.log(`[Known Failure] "code review" routed to: ${result.selectedTool} (confidence: ${result.confidence})`);

      // We expect this to NOT work without synonyms
      expect(result.confidence).not.toBe("high");
    });

    it("FAIL: 'ticket' should match issue but won't (needs synonyms)", async () => {
      const result = await router.route({
        userQuery: "create a ticket"
      });

      console.log(`[Known Failure] "create a ticket" routed to: ${result.selectedTool} (confidence: ${result.confidence})`);

      // Without synonyms, "ticket" won't match "issue"
      expect(result.confidence).not.toBe("high");
    });
  });

  describe("Complex Natural Language Queries", () => {
    it("should handle 'find my repos about AI and resume'", async () => {
      const result = await router.route({
        userQuery: "find my repos about AI and resume"
      });

      // Should match either search_repositories or search_issues
      expect(result.selectedTool).toMatch(/search_(repositories|issues)_0_nxs/);
    });

    it("should handle noise words: 'can you search for code in github please'", async () => {
      const result = await router.route({
        userQuery: "can you search for code in github please"
      });

      expect(result.selectedTool).toBe("search_code_0_nxs");
      expect(result.confidence).toBe("high");
    });

    it("should handle verbose query: 'I want to search for repositories on github'", async () => {
      const result = await router.route({
        userQuery: "I want to search for repositories on github"
      });

      expect(result.selectedTool).toBe("search_repositories_0_nxs");
    });
  });

  describe("Server Disambiguation", () => {
    it("should prefer GitHub when query mentions 'github'", async () => {
      const result = await router.route({
        userQuery: "search github issues"
      });

      expect(result.selectedTool).toBe("search_issues_0_nxs");
      expect(result.selectedTool).not.toBe("search_issues_1_nxs"); // Not Linear
    });

    it("should prefer Linear when query mentions 'linear'", async () => {
      const result = await router.route({
        userQuery: "search linear issues"
      });

      expect(result.selectedTool).toBe("search_issues_1_nxs");
      expect(result.selectedTool).not.toBe("search_issues_0_nxs"); // Not GitHub
    });

    it("should handle ambiguous 'search issues' (could be GitHub or Linear)", async () => {
      const result = await router.route({
        userQuery: "search issues"
      });

      // Either is valid, but should still be confident
      expect(result.selectedTool).toMatch(/search_issues_(0|1)_nxs/);
      console.log(`[Ambiguous] "search issues" routed to: ${result.selectedTool} (confidence: ${result.confidence})`);
    });
  });

  describe("Performance Metrics", () => {
    it("should complete routing in under 10ms", async () => {
      const start = Date.now();

      await router.route({ userQuery: "search github repos" });

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(10);
      console.log(`Routing took ${duration}ms`);
    });

    it("should handle 100 queries efficiently", async () => {
      const queries = [
        "search github repos",
        "find code",
        "create issue",
        "list tables",
        "query database"
      ];

      const start = Date.now();

      for (let i = 0; i < 20; i++) {
        for (const query of queries) {
          await router.route({ userQuery: query });
        }
      }

      const duration = Date.now() - start;
      const avgPerQuery = duration / 100;

      console.log(`100 queries took ${duration}ms (avg ${avgPerQuery.toFixed(2)}ms per query)`);
      expect(avgPerQuery).toBeLessThan(5);
    });
  });
});
