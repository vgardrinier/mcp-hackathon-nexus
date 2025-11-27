"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function ClaudeClientPage() {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCopied(false);
  }, []);

  const getConfig = () => {
    return JSON.stringify(
      {
        mcpServers: {
          nexus: {
            command: "node",
            args: ["apps/mcp/dist/stdio.js"],
            env: {}
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
    await navigator.clipboard.writeText(config);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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

      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 600 }}>Configuration</h2>
          <button
            onClick={handleCopy}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: copied ? "#28a745" : "#0070f3",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "0.9rem",
              fontWeight: 500,
              opacity: 1
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







