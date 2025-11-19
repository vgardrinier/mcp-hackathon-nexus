"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import Link from "next/link";

export default function ClaudeClientPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

  const getConfig = () => {
    if (!apiKey) return "";

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
  };

  const getConfigPath = () => {
    return {
      windows: "%APPDATA%\\Claude\\claude_desktop_config.json",
      macos: "~/Library/Application Support/Claude/claude_desktop_config.json",
      linux: "~/.config/claude/claude_desktop_config.json"
    };
  };

  const handleCopy = async () => {
    const config = getConfig();
    if (config) {
      await navigator.clipboard.writeText(config);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
          href="/dashboard/clients"
          style={{ color: "#0070f3", textDecoration: "none", fontSize: "0.9rem", marginBottom: "1rem", display: "block" }}
        >
          ← Back to clients
        </Link>
        <h1 style={{ fontSize: "1.8rem", fontWeight: 600, marginBottom: "0.5rem" }}>Connect Claude Desktop</h1>
        <p style={{ color: "#666", fontSize: "0.9rem" }}>
          Add the configuration below to your Claude Desktop config file to connect to Nexus MCP servers.
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 600 }}>Configuration</h2>
          <button
            onClick={handleCopy}
            disabled={!apiKey}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: copied ? "#28a745" : "#0070f3",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: apiKey ? "pointer" : "not-allowed",
              fontSize: "0.9rem",
              fontWeight: 500,
              opacity: apiKey ? 1 : 0.6
            }}
          >
            {copied ? "Copied!" : "Copy Config"}
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
        <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.5rem" }}>Config File Path</h3>
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
        <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.5rem" }}>Setup Steps</h3>
        <ol style={{ paddingLeft: "1.5rem", lineHeight: "1.8" }}>
          <li>Make sure the Nexus MCP server is running</li>
          <li>Locate your Claude Desktop config file (path shown above)</li>
          <li>Copy the configuration above</li>
          <li>Paste it into your Claude Desktop config file</li>
          <li>Restart Claude Desktop</li>
        </ol>
      </div>
    </div>
  );
}







