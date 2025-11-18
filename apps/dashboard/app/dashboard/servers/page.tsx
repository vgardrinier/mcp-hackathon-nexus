"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import Link from "next/link";

interface Server {
  id: string;
  name: string;
  description: string;
  transport: string;
  sourceUrl: string | null;
  logoUrl: string | null;
  requiresAuth: boolean;
  installed: boolean;
  authenticated: boolean;
}

export default function ServersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }

    if (user) {
      // Wait a bit after OAuth redirect to ensure session is established
      const delay = window.location.hash.includes("access_token") || window.location.search.includes("code") ? 1000 : 0;
      
      setTimeout(() => {
        fetch("/api/user/mcp/servers", {
          credentials: "include", // Ensure cookies are sent
          headers: {
            "Content-Type": "application/json"
          }
        })
          .then((res) => {
            if (!res.ok) {
              console.error("API error:", res.status, res.statusText);
              return res.json().then(data => {
                console.error("API error data:", data);
                throw new Error(data.error || "Failed to fetch servers");
              });
            }
            return res.json();
          })
          .then((data) => {
            // Ensure data is an array
            if (Array.isArray(data)) {
              setServers(data);
            } else {
              console.error("Invalid server data:", data);
              setServers([]);
            }
            setLoading(false);
          })
          .catch((error) => {
            console.error("Failed to fetch servers:", error);
            setServers([]);
            setLoading(false);
          });
      }, delay);
    }
  }, [user, authLoading, router]);

  const handleInstall = async (serverId: string) => {
    const res = await fetch(`/api/user/mcp/servers/${serverId}`, { method: "POST" });
    if (res.ok) {
      // Refresh servers list
      const data = await fetch("/api/user/mcp/servers").then((r) => r.json());
      if (Array.isArray(data)) {
        setServers(data);
      }
    }
  };

  const handleUninstall = async (serverId: string) => {
    const res = await fetch(`/api/user/mcp/servers/${serverId}`, { method: "DELETE" });
    if (res.ok) {
      // Refresh servers list
      const data = await fetch("/api/user/mcp/servers").then((r) => r.json());
      if (Array.isArray(data)) {
        setServers(data);
      }
    }
  };

  if (authLoading || loading) {
    return (
      <div style={{ padding: "2rem" }}>
        <p>Loading...</p>
      </div>
    );
  }

  const getStatusText = (server: Server) => {
    if (!server.installed) return "disconnected";
    if (server.requiresAuth && !server.authenticated) return "auth required";
    return "connected";
  };

  return (
    <div style={{ maxWidth: "1200px", margin: "2rem auto", padding: "2rem" }}>
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 600, marginBottom: "0.5rem" }}>MCP Servers</h1>
        <p style={{ color: "#666", fontSize: "0.95rem" }}>Connect to external services and tools</p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: "1.5rem"
        }}
      >
        {Array.isArray(servers) && servers.length > 0 ? (
          servers.map((server) => (
          <div
            key={server.id}
            style={{
              padding: "1.5rem",
              border: "1px solid #e0e0e0",
              borderRadius: "8px",
              display: "flex",
              flexDirection: "column",
              backgroundColor: "#fff"
            }}
          >
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🔌</div>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "0.25rem" }}>{server.name}</h2>
              <p style={{ color: "#999", fontSize: "0.85rem", marginBottom: "0.5rem" }}>{getStatusText(server)}</p>
            </div>

            <p style={{ color: "#666", fontSize: "0.9rem", marginBottom: "1.5rem", flex: 1 }}>
              {server.description}
            </p>

            <div style={{ display: "flex", gap: "0.5rem" }}>
              {server.installed ? (
                <>
                  <Link
                    href={`/dashboard/servers/${server.id}`}
                    style={{
                      flex: 1,
                      padding: "0.75rem",
                      backgroundColor: "#0070f3",
                      color: "white",
                      textDecoration: "none",
                      borderRadius: "4px",
                      fontSize: "0.9rem",
                      fontWeight: 500,
                      textAlign: "center"
                    }}
                  >
                    Configure
                  </Link>
                  <button
                    onClick={() => handleUninstall(server.id)}
                    style={{
                      padding: "0.75rem 1rem",
                      backgroundColor: "#dc3545",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "0.9rem",
                      fontWeight: 500
                    }}
                  >
                    Uninstall
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleInstall(server.id)}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    backgroundColor: "#0070f3",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "0.9rem",
                    fontWeight: 500
                  }}
                >
                  Connect
                </button>
              )}
            </div>
          </div>
        ))
        ) : (
          <div style={{ gridColumn: "1 / -1", padding: "2rem", textAlign: "center", color: "#666" }}>
            <p>No servers available. Make sure you're signed in and the database is set up correctly.</p>
          </div>
        )}
      </div>
    </div>
  );
}

