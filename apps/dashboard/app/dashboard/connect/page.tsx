"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import Link from "next/link";

export default function ConnectPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"cursor-http" | "cursor-stdio" | "claude">("cursor-http");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }

    if (user) {
      fetch("/api/user/api-key")
        .then((res) => res.json())
        .then((data) => {
          if (data.apiKey) {
            setApiKey(data.apiKey);
          }
        })
        .catch((error) => {
          console.error("Failed to fetch API key:", error);
        });
    }
  }, [user, authLoading, router]);

  const mcpServerUrl = typeof window !== "undefined" ? `${window.location.protocol}//${window.location.hostname}:3001` : "http://localhost:3001";

  const getConfig = () => {
    if (!apiKey) return "";

    switch (activeTab) {
      case "cursor-http":
        return JSON.stringify(
          {
            mcpServers: {
              nexus: {
                url: `${mcpServerUrl}/mcp`,
                headers: {
                  Authorization: `Bearer ${apiKey}`
                }
              }
            }
          },
          null,
          2
        );
      case "cursor-stdio":
        return JSON.stringify(
          {
            mcpServers: {
              nexus: {
                command: "node",
                args: ["apps/mcp/dist/stdio.js"],
                env: {
                  API_KEY: apiKey,
                  DASHBOARD_URL: typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"
                }
              }
            }
          },
          null,
          2
        );
      case "claude":
        return JSON.stringify(
          {
            mcpServers: {
              nexus: {
                command: "node",
                args: ["apps/mcp/dist/stdio.js"],
                env: {
                  API_KEY: apiKey,
                  DASHBOARD_URL: typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"
                }
              }
            }
          },
          null,
          2
        );
    }
  };

  const getConfigPath = () => {
    switch (activeTab) {
      case "cursor-http":
      case "cursor-stdio":
        return {
          windows: "%APPDATA%\\Cursor\\User\\globalStorage\\saoudrizwan.claude-dev\\settings\\cline_mcp_settings.json",
          macos: "~/Library/Application Support/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json",
          linux: "~/.config/Cursor/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json"
        };
      case "claude":
        return {
          windows: "%APPDATA%\\Claude\\claude_desktop_config.json",
          macos: "~/Library/Application Support/Claude/claude_desktop_config.json",
          linux: "~/.config/claude/claude_desktop_config.json"
        };
    }
  };

  const handleCopy = async () => {
    const config = getConfig();
    if (config) {
      await navigator.clipboard.writeText(config);
      setCopied(activeTab);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  if (authLoading) {
    return (
      <div style={{ padding: "2rem" }}>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1000px", margin: "2rem auto", padding: "2rem" }}>
      <div style={{ marginBottom: "2rem" }}>
        <Link
          href="/dashboard/servers"
          style={{ color: "#0070f3", textDecoration: "none", fontSize: "0.9rem", marginBottom: "1rem", display: "block" }}
        >
          ← Back to servers
        </Link>
        <h1 style={{ fontSize: "1.8rem", fontWeight: 600, marginBottom: "0.5rem" }}>Connect to Your AI App</h1>
        <p style={{ color: "#666", fontSize: "0.9rem" }}>
          Copy the configuration below and add it to your MCP client settings.
        </p>
      </div>

      {!apiKey && (
        <div
          style={{
            padding: "1rem",
            backgroundColor: "#fff3cd",
            color: "#856404",
            borderRadius: "4px",
            marginBottom: "2rem"
          }}
        >
          Loading API key...
        </div>
      )}

      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid #e0e0e0" }}>
          {(["cursor-http", "cursor-stdio", "claude"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "0.75rem 1.5rem",
                backgroundColor: activeTab === tab ? "#0070f3" : "transparent",
                color: activeTab === tab ? "white" : "#666",
                border: "none",
                borderBottom: activeTab === tab ? "2px solid #0070f3" : "2px solid transparent",
                cursor: "pointer",
                fontSize: "0.9rem",
                fontWeight: activeTab === tab ? 600 : 400
              }}
            >
              {tab === "cursor-http" ? "Cursor (HTTP)" : tab === "cursor-stdio" ? "Cursor (STDIO)" : "Claude Desktop"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 600 }}>Configuration</h2>
          <button
            onClick={handleCopy}
            disabled={!apiKey}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: copied === activeTab ? "#28a745" : "#0070f3",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: apiKey ? "pointer" : "not-allowed",
              fontSize: "0.9rem",
              fontWeight: 500,
              opacity: apiKey ? 1 : 0.6
            }}
          >
            {copied === activeTab ? "Copied!" : "Copy Config"}
          </button>
        </div>

        <pre
          style={{
            padding: "1.5rem",
            backgroundColor: "#f5f5f5",
            borderRadius: "4px",
            overflow: "auto",
            fontSize: "0.85rem",
            fontFamily: "monospace",
            border: "1px solid #e0e0e0"
          }}
        >
          <code>{getConfig()}</code>
        </pre>
      </div>

      <div style={{ marginBottom: "2rem" }}>
        <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.5rem" }}>File Path</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {(["windows", "macos", "linux"] as const).map((os) => (
            <div key={os}>
              <div style={{ fontSize: "0.85rem", fontWeight: 500, marginBottom: "0.25rem", color: "#666" }}>
                {os === "windows" ? "Windows:" : os === "macos" ? "macOS:" : "Linux:"}
              </div>
              <code
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor: "#f5f5f5",
                  borderRadius: "4px",
                  fontSize: "0.85rem",
                  fontFamily: "monospace",
                  display: "block"
                }}
              >
                {getConfigPath()[os]}
              </code>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.5rem" }}>Steps</h3>
        <ol style={{ paddingLeft: "1.5rem", lineHeight: "1.8" }}>
          {activeTab === "cursor-http" && (
            <>
              <li>Open Cursor settings</li>
              <li>Navigate to MCP settings</li>
              <li>Copy the configuration above</li>
              <li>Paste it into your MCP settings file</li>
              <li>Restart Cursor</li>
            </>
          )}
          {activeTab === "cursor-stdio" && (
            <>
              <li>Make sure the Nexus MCP server is running</li>
              <li>Open Cursor settings</li>
              <li>Navigate to MCP settings</li>
              <li>Copy the configuration above</li>
              <li>Paste it into your MCP settings file</li>
              <li>Restart Cursor</li>
            </>
          )}
          {activeTab === "claude" && (
            <>
              <li>Make sure the Nexus MCP server is running</li>
              <li>Locate your Claude Desktop config file (path shown above)</li>
              <li>Copy the configuration above</li>
              <li>Paste it into your Claude Desktop config file</li>
              <li>Restart Claude Desktop</li>
            </>
          )}
        </ol>
      </div>
    </div>
  );
}

