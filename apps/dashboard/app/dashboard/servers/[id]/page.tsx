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
  const [manualToken, setManualToken] = useState("");
  const [savingToken, setSavingToken] = useState(false);
  const [showManualToken, setShowManualToken] = useState(false);

  const fetchServerData = () => {
    setLoading(true);
    fetch("/api/user/mcp/servers", {
      credentials: "include",
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache"
      }
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch servers: ${res.status}`);
        }
        return res.json();
      })
      .then((servers: Server[]) => {
        const found = servers.find((s) => s.id === serverId);
        if (found) {
          setServer(found);
          // Fetch env vars (only for STDIO servers)
          if (found.transport === "stdio") {
            return fetch(`/api/user/mcp/servers/${serverId}/env-vars`, {
              credentials: "include"
            })
              .then((envRes) => {
                if (!envRes.ok) {
                  console.error("Failed to fetch env vars:", envRes.status);
                  // Don't throw - we'll just show empty form
                  return { envVars: [] };
                }
                return envRes.json();
              })
              .then((data) => {
                if (data?.envVars) {
                  const values: Record<string, string> = {};
                  data.envVars.forEach((envVar: EnvVar) => {
                    values[envVar.key] = envVar.value || "";
                  });
                  setEnvValues(values);
                  // Also set env vars on server object for rendering
                  setServer({ ...found, envVars: data.envVars });
                }
              })
              .catch((error) => {
                console.error("Error fetching env vars:", error);
                // Continue anyway - form will show but empty
              });
          }
        }
        return null;
      })
      .then(() => {
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
    try {
      const res = await fetch(`/api/user/mcp/servers/${serverId}/env`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ envVars: envValues })
      });

      const data = await res.json();

      if (res.ok) {
        setOauthMessage({
          type: "success",
          text: "Environment variables saved successfully!"
        });
        // Refresh server data to show updated values
        fetchServerData();
      } else {
        console.error("Failed to save env vars:", data);
        setOauthMessage({
          type: "error",
          text: `Failed to save: ${data.error || "Unknown error"}`
        });
      }
    } catch (error) {
      console.error("Error saving env vars:", error);
      setOauthMessage({
        type: "error",
        text: "Failed to save environment variables"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleOAuth = async () => {
    try {
      const res = await fetch(`/api/user/mcp/servers/${serverId}/auth/initiate`, {
        credentials: "include"
      });
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

  const handleManualToken = async () => {
    if (!manualToken.trim()) {
      setOauthMessage({ type: "error", text: "Please enter a token" });
      return;
    }

    if (!manualToken.trim().startsWith("secret_")) {
      setOauthMessage({ 
        type: "error", 
        text: "Invalid token format. Notion integration tokens must start with 'secret_'. Get yours from https://www.notion.so/my-integrations" 
      });
      return;
    }

    setSavingToken(true);
    try {
      const res = await fetch(`/api/user/mcp/servers/${serverId}/auth/manual-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token: manualToken.trim() })
      });

      const data = await res.json();

      if (res.ok) {
        setOauthMessage({ 
          type: "success", 
          text: "Integration token saved! Restart the MCP server for it to take effect." 
        });
        setManualToken("");
        setShowManualToken(false);
        // Refresh server data
        fetchServerData();
      } else {
        setOauthMessage({ type: "error", text: data.error || "Failed to save token" });
      }
    } catch (error) {
      setOauthMessage({ type: "error", text: "Failed to save token" });
    } finally {
      setSavingToken(false);
    }
  };

  const handleUninstall = async () => {
    if (!confirm(`Are you sure you want to uninstall ${server?.name}? This will remove all configuration and authentication data.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/user/mcp/servers/${serverId}`, { 
        method: "DELETE",
        credentials: "include"
      });
      const data = await res.json();
      if (res.ok) {
        // Redirect to servers list after successful uninstall
        router.push("/dashboard/servers");
      } else {
        console.error("Failed to uninstall server:", data);
        setOauthMessage({
          type: "error",
          text: `Failed to uninstall server: ${data.error || "Unknown error"}`
        });
      }
    } catch (error) {
      console.error("Error uninstalling server:", error);
      setOauthMessage({
        type: "error",
        text: "Failed to uninstall server"
      });
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

      {server.transport === "stdio" && (
        <div style={{ marginBottom: "2rem" }}>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "1rem" }}>Environment Variables</h2>
          {server.envVars && server.envVars.length > 0 ? (
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
          ) : (
            <div style={{ padding: "1rem", backgroundColor: "#f8f9fa", borderRadius: "4px", color: "#666" }}>
              <p>Loading environment variable definitions...</p>
              <p style={{ fontSize: "0.85rem", marginTop: "0.5rem" }}>
                If this doesn't load, please refresh the page or check the browser console for errors.
              </p>
            </div>
          )}
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
              {serverId === "notion-http" && (
                <div style={{ marginBottom: "1.5rem", padding: "1rem", backgroundColor: "#fff3cd", border: "1px solid #ffc107", borderRadius: "4px" }}>
                  <p style={{ marginBottom: "0.5rem", fontWeight: 500, color: "#856404" }}>
                    ⚠️ Notion OAuth returns tokens that don't work with the MCP server
                  </p>
                  <p style={{ fontSize: "0.9rem", color: "#856404", marginBottom: "0.5rem" }}>
                    Use a manual integration token instead (recommended). Get yours from{" "}
                    <a href="https://www.notion.so/my-integrations" target="_blank" rel="noopener noreferrer" style={{ color: "#0070f3" }}>
                      https://www.notion.so/my-integrations
                    </a>
                  </p>
                  <p style={{ fontSize: "0.85rem", color: "#856404", fontStyle: "italic", marginBottom: "1rem", padding: "0.5rem", backgroundColor: "#fff", borderRadius: "4px" }}>
                    ⚠️ Important: You need an <strong>Integration Token</strong> (from "My Integrations"), NOT your OAuth Client Secret. 
                    Create a new integration and copy its "Internal Integration Token".
                  </p>
                  {!showManualToken ? (
                    <button
                      onClick={() => setShowManualToken(true)}
                      style={{
                        padding: "0.5rem 1rem",
                        backgroundColor: "#ffc107",
                        color: "#856404",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "0.9rem",
                        fontWeight: 500
                      }}
                    >
                      Enter Integration Token (secret_*)
                    </button>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      <input
                        type="password"
                        value={manualToken}
                        onChange={(e) => setManualToken(e.target.value)}
                        placeholder="secret_..."
                        style={{
                          width: "100%",
                          padding: "0.5rem",
                          border: "1px solid #ccc",
                          borderRadius: "4px",
                          fontSize: "0.9rem"
                        }}
                      />
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button
                          onClick={handleManualToken}
                          disabled={savingToken}
                          style={{
                            padding: "0.5rem 1rem",
                            backgroundColor: "#28a745",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: savingToken ? "not-allowed" : "pointer",
                            fontSize: "0.9rem",
                            fontWeight: 500,
                            opacity: savingToken ? 0.6 : 1
                          }}
                        >
                          {savingToken ? "Saving..." : "Save Token"}
                        </button>
                        <button
                          onClick={() => {
                            setShowManualToken(false);
                            setManualToken("");
                          }}
                          style={{
                            padding: "0.5rem 1rem",
                            backgroundColor: "#6c757d",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "0.9rem"
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <p style={{ marginBottom: "1rem", color: "#666" }}>
                {serverId === "notion-http" 
                  ? "Alternatively, you can try OAuth (but it may not work):"
                  : "This server requires OAuth authentication. Click the button below to connect."}
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
                Connect with {server.name} (OAuth)
              </button>
            </div>
          )}
        </div>
      )}

      {server.installed && (
        <div style={{ marginTop: "2rem", paddingTop: "2rem", borderTop: "1px solid #e0e0e0" }}>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "1rem", color: "#dc3545" }}>Danger Zone</h2>
          <p style={{ color: "#666", fontSize: "0.9rem", marginBottom: "1rem" }}>
            Uninstalling this server will remove all configuration, authentication tokens, and environment variables.
          </p>
          <button
            onClick={handleUninstall}
            style={{
              padding: "0.75rem 1.5rem",
              backgroundColor: "#dc3545",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "0.9rem",
              fontWeight: 500
            }}
          >
            Uninstall Server
          </button>
        </div>
      )}
    </div>
  );
}

