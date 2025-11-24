"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import Link from "next/link";

interface Client {
  id: string;
  name: string;
  description: string;
  icon: string;
  href: string;
}

const clients: Client[] = [
  {
    id: "cursor",
    name: "Cursor",
    description: "AI-powered code editor with MCP support. Connect via HTTP or STDIO.",
    icon: "⚡",
    href: "/dashboard/clients/cursor"
  },
  {
    id: "claude",
    name: "Claude Desktop",
    description: "Anthropic's Claude Desktop app with MCP support. Connect via STDIO.",
    icon: "🤖",
    href: "/dashboard/clients/claude"
  }
];

export default function ClientsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <div style={{ padding: "2rem" }}>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1200px", margin: "2rem auto", padding: "2rem" }}>
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 600, marginBottom: "0.5rem" }}>MCP Clients</h1>
        <p style={{ color: "#666", fontSize: "0.95rem" }}>Connect your AI applications to Nexus MCP servers</p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: "1.5rem"
        }}
      >
        {clients.map((client) => (
          <Link
            key={client.id}
            href={client.href}
            style={{
              padding: "1.5rem",
              border: "1px solid #e0e0e0",
              borderRadius: "8px",
              display: "flex",
              flexDirection: "column",
              backgroundColor: "#fff",
              textDecoration: "none",
              color: "inherit",
              transition: "transform 0.2s, box-shadow 0.2s",
              cursor: "pointer"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>{client.icon}</div>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "0.5rem", color: "#333" }}>
                {client.name}
              </h2>
            </div>

            <p style={{ color: "#666", fontSize: "0.9rem", marginBottom: "1.5rem", flex: 1 }}>
              {client.description}
            </p>

            <div
              style={{
                padding: "0.75rem",
                backgroundColor: "#0070f3",
                color: "white",
                borderRadius: "4px",
                fontSize: "0.9rem",
                fontWeight: 500,
                textAlign: "center"
              }}
            >
              Configure →
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

