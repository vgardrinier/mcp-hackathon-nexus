"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import Link from "next/link";

interface EnvVar {
  id: string;
  name: string;
  key: string;
  description: string | null;
  required: boolean;
  value: string | null;
}

interface Server {
  id: string;
  name: string;
  description: string;
  transport: string;
  requiresAuth: boolean;
  installed: boolean;
  authenticated: boolean;
  envVars: EnvVar[];
}

export default function ServerDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const serverId = params.id as string;

  const [server, setServer] = useState<Server | null>(null);
  const [loading, setLoading] = useState(true);
  const [envValues, setEnvValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [oauthMessage, setOauthMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchServerData = () => {
    fetch("/api/user/mcp/servers")
      .then((res) => res.json())
      .then((servers: Server[]) => {
        const found = servers.find((s) => s.id === serverId);
        if (found) {
          setServer(found);
          // Fetch env vars
          return fetch(`/api/user/mcp/servers/${serverId}/env-vars`);
        }
        return null;
      })
      .then((res) => {
        if (res) {
          return res.json();
        }
        return null;
      })
      .then((data) => {
        if (data?.envVars) {
          const values: Record<string, string> = {};
          data.envVars.forEach((envVar: EnvVar) => {
            values[envVar.key] = envVar.value || "";
          });
          setEnvValues(values);
        }
        setLoading(false);
      })
      .catch((error) => {
        console.error("Failed to fetch server:", error);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }

    if (user) {
      // Check for OAuth callback messages
      const oauthParam = searchParams.get("oauth");
      const oauthError = searchParams.get("oauth_error");
      const workspace = searchParams.get("workspace");

      if (oauthParam === "success") {
        setOauthMessage({
          type: "success",
          text: workspace
            ? `Successfully connected to Notion workspace: ${workspace}`
            : "Successfully authenticated with Notion!"
        });
        // Clear URL params
        router.replace(`/dashboard/servers/${serverId}`, { scroll: false });
        // Refresh server data to show authenticated status
        fetchServerData();
      } else if (oauthError) {
        const errorMessages: Record<string, string> = {
          missing_params: "OAuth callback missing required parameters",
          invalid_state: "OAuth state verification failed",
          unsupported: "OAuth not supported for this server",
          not_configured: "OAuth not configured. Please contact support",
          token_exchange_failed: "Failed to exchange authorization code for tokens",
          no_token: "No access token received from Notion",
          storage_failed: "Failed to store authentication tokens",
          internal_error: "An internal error occurred during authentication"
        };
        setOauthMessage({
          type: "error",
          text: errorMessages[oauthError] || `Authentication failed: ${oauthError}`
        });
        // Clear URL params
        router.replace(`/dashboard/servers/${serverId}`, { scroll: false });
      } else {
        fetchServerData();
      }
    }
  }, [user, authLoading, router, serverId, searchParams]);

  const handleSaveEnvVars = async () => {
    setSaving(true);
    const res = await fetch(`/api/user/mcp/servers/${serverId}/env`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ envVars: envValues })
    });

    if (res.ok) {
      alert("Environment variables saved!");
    } else {
      alert("Failed to save environment variables");
    }
    setSaving(false);
  };

  const handleOAuth = async () => {
    try {
      const res = await fetch(`/api/user/mcp/servers/${serverId}/auth/initiate`);
      const data = await res.json();
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else if (data.error) {
        setOauthMessage({ type: "error", text: data.error });
      }
    } catch (error) {
      setOauthMessage({ type: "error", text: "Failed to initiate OAuth flow" });
    }
  };

  if (authLoading || loading) {
    return (
      <div style={{ padding: "2rem" }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (!server) {
    return (
      <div style={{ padding: "2rem" }}>
        <p>Server not found</p>
        <Link href="/dashboard/servers">Back to servers</Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "800px", margin: "2rem auto", padding: "2rem" }}>
      <div style={{ marginBottom: "2rem" }}>
        <Link
          href="/dashboard/servers"
          style={{ color: "#0070f3", textDecoration: "none", fontSize: "0.9rem", marginBottom: "1rem", display: "block" }}
        >
          ← Back to servers
        </Link>
        <h1 style={{ fontSize: "1.8rem", fontWeight: 600, marginBottom: "0.5rem" }}>{server.name}</h1>
        <p style={{ color: "#666", fontSize: "0.9rem" }}>{server.description}</p>
      </div>

      {oauthMessage && (
        <div
          style={{
            padding: "1rem",
            marginBottom: "1.5rem",
            borderRadius: "4px",
            backgroundColor: oauthMessage.type === "success" ? "#d4edda" : "#f8d7da",
            color: oauthMessage.type === "success" ? "#155724" : "#721c24",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <span>{oauthMessage.text}</span>
          <button
            onClick={() => setOauthMessage(null)}
            style={{
              background: "none",
              border: "none",
              color: "inherit",
              cursor: "pointer",
              fontSize: "1.2rem",
              padding: "0 0.5rem"
            }}
          >
            ×
          </button>
        </div>
      )}

      {server.transport === "stdio" && server.envVars && server.envVars.length > 0 && (
        <div style={{ marginBottom: "2rem" }}>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "1rem" }}>Environment Variables</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {server.envVars.map((envVar) => (
              <div key={envVar.id}>
                <label
                  htmlFor={envVar.key}
                  style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500, fontSize: "0.9rem" }}
                >
                  {envVar.name} {envVar.required && <span style={{ color: "#dc3545" }}>*</span>}
                </label>
                <input
                  id={envVar.key}
                  type="password"
                  value={envValues[envVar.key] || ""}
                  onChange={(e) => setEnvValues({ ...envValues, [envVar.key]: e.target.value })}
                  placeholder={envVar.description || ""}
                  required={envVar.required}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    fontSize: "0.9rem"
                  }}
                />
                {envVar.description && (
                  <p style={{ fontSize: "0.85rem", color: "#666", marginTop: "0.25rem" }}>{envVar.description}</p>
                )}
              </div>
            ))}
            <button
              onClick={handleSaveEnvVars}
              disabled={saving}
              style={{
                padding: "0.75rem 1.5rem",
                backgroundColor: "#28a745",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: saving ? "not-allowed" : "pointer",
                fontSize: "0.9rem",
                fontWeight: 500,
                opacity: saving ? 0.6 : 1
              }}
            >
              {saving ? "Saving..." : "Save Environment Variables"}
            </button>
          </div>
        </div>
      )}

      {server.transport === "streamable-http" && server.requiresAuth && (
        <div style={{ marginBottom: "2rem" }}>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "1rem" }}>Authentication</h2>
          {server.authenticated ? (
            <div
              style={{
                padding: "1rem",
                backgroundColor: "#d4edda",
                color: "#155724",
                borderRadius: "4px"
              }}
            >
              ✓ Authenticated
            </div>
          ) : (
            <div>
              <p style={{ marginBottom: "1rem", color: "#666" }}>
                This server requires OAuth authentication. Click the button below to connect.
              </p>
              <button
                onClick={handleOAuth}
                style={{
                  padding: "0.75rem 1.5rem",
                  backgroundColor: "#0070f3",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "0.9rem",
                  fontWeight: 500
                }}
              >
                Connect with {server.name}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

