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
  configured: boolean;
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
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache"
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
    try {
      const res = await fetch(`/api/user/mcp/servers/${serverId}`, { 
        method: "POST",
        credentials: "include"
      });
      const data = await res.json();
      if (res.ok) {
        // Refresh servers list with cache-busting
        const refreshed = await fetch("/api/user/mcp/servers", {
          credentials: "include",
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache"
          }
        }).then((r) => r.json());
        if (Array.isArray(refreshed)) {
          setServers(refreshed);
        }
      } else {
        console.error("Failed to install server:", data);
        alert(`Failed to install server: ${data.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error installing server:", error);
      alert("Failed to install server");
    }
  };

  const handleUninstall = async (serverId: string) => {
    if (!confirm("Are you sure you want to uninstall this server? This will remove all configuration and authentication data.")) {
      return;
    }

    try {
      const res = await fetch(`/api/user/mcp/servers/${serverId}`, { 
        method: "DELETE",
        credentials: "include",
        cache: "no-store"
      });
      const data = await res.json();
      if (res.ok) {
        // Refresh servers list with cache-busting
        const refreshed = await fetch("/api/user/mcp/servers", {
          credentials: "include",
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache"
          }
        }).then((r) => r.json());
        if (Array.isArray(refreshed)) {
          setServers(refreshed);
        }
      } else {
        console.error("Failed to uninstall server:", data);
        alert(`Failed to uninstall server: ${data.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error uninstalling server:", error);
      alert("Failed to uninstall server");
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
    if (!server.configured) {
      if (server.transport === "stdio") return "configuration required";
      if (server.requiresAuth && !server.authenticated) return "auth required";
      return "configuration required";
    }
    return "connected";
  };

  const getServerLogo = (serverId: string) => {
    if (serverId === "github-stdio") {
      return (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" style={{ color: "#24292e" }}>
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
        </svg>
      );
    }
    if (serverId === "notion-http") {
      return (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
          <path 
            d="M4.459 4.208c.746.606 1.026.56 2.428.33l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337 3.694c.093.42 0 .841-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .841-1.168.841l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" 
            fill="#000000"
            fillRule="evenodd"
          />
        </svg>
      );
    }
    // Default icon for other servers
    return <span style={{ fontSize: "2rem" }}>🔌</span>;
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
              <div style={{ marginBottom: "0.5rem", display: "flex", alignItems: "center" }}>
                {getServerLogo(server.id)}
              </div>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "0.25rem" }}>{server.name}</h2>
              <p style={{ color: "#999", fontSize: "0.85rem", marginBottom: "0.5rem" }}>{getStatusText(server)}</p>
            </div>

            <p style={{ color: "#666", fontSize: "0.9rem", marginBottom: "1.5rem", flex: 1 }}>
              {server.description}
            </p>

            <div style={{ display: "flex", gap: "0.5rem" }}>
              {server.installed ? (
                <>
                  {server.configured ? (
                    <>
                      <Link
                        href={`/dashboard/servers/${server.id}`}
                        style={{
                          flex: 1,
                          padding: "0.75rem",
                          backgroundColor: "#28a745",
                          color: "white",
                          textDecoration: "none",
                          borderRadius: "4px",
                          fontSize: "0.9rem",
                          fontWeight: 500,
                          textAlign: "center",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "0.5rem"
                        }}
                      >
                        <span>✓</span>
                        <span>Connected</span>
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
                  )}
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

