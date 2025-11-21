"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useRouter } from "next/navigation";

export default function AccountPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }

    fetch("/api/user/api-key")
      .then((res) => res.json())
      .then((data) => {
        if (data.apiKey) {
          setApiKey(data.apiKey);
        }
        setLoading(false);
      })
      .catch((error) => {
        console.error("Failed to fetch API key:", error);
        setLoading(false);
      });
  }, [user, router]);

  const handleCopy = async () => {
    if (!apiKey) return;
    await navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div style={{ padding: "2rem" }}>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "800px", margin: "2rem auto", padding: "2rem" }}>
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 600, marginBottom: "0.5rem" }}>Account</h1>
        <p style={{ color: "#666", fontSize: "0.95rem" }}>Manage your account settings and API key</p>
      </div>

      <div style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "1rem" }}>API Key</h2>
        <p style={{ color: "#666", marginBottom: "1rem", fontSize: "0.9rem" }}>
          Use this API key to authenticate your MCP clients (Cursor, Claude Desktop, GPT connectors).
        </p>

        {apiKey ? (
          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              alignItems: "center",
              padding: "1rem",
              backgroundColor: "#fff",
              border: "1px solid #e0e0e0",
              borderRadius: "8px",
              marginBottom: "1rem"
            }}
          >
            <code
              style={{
                flex: 1,
                fontFamily: "monospace",
                fontSize: "0.9rem",
                wordBreak: "break-all",
                color: "#333"
              }}
            >
              {apiKey}
            </code>
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
                fontWeight: 500
              }}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        ) : (
          <p style={{ color: "#999" }}>No API key found. Please contact support.</p>
        )}

        <div
          style={{
            padding: "1rem",
            backgroundColor: "#fff3cd",
            borderRadius: "4px",
            fontSize: "0.9rem",
            color: "#856404"
          }}
        >
          <strong>Important:</strong> Keep your API key secret. Don't share it publicly or commit it to version control.
        </div>
      </div>

      {user && (
        <div style={{ marginTop: "2rem", paddingTop: "2rem", borderTop: "1px solid #e0e0e0" }}>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "1rem" }}>Account Information</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div>
              <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.25rem" }}>Email</div>
              <div style={{ fontSize: "0.95rem", color: "#333" }}>{user.email || "Not set"}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.25rem" }}>User ID</div>
              <div style={{ fontSize: "0.85rem", color: "#999", fontFamily: "monospace" }}>{user.id}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

