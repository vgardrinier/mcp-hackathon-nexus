"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import Link from "next/link";

interface Client {
  id: string;
  name: string;
  description: string;
  status: "connected" | "disconnected";
}

const clients: Client[] = [
  {
    id: "chatgpt",
    name: "ChatGPT",
    description: "OpenAI's GPT models",
    status: "disconnected"
  },
  {
    id: "claude",
    name: "Claude",
    description: "Anthropic's Claude models",
    status: "disconnected"
  },
  {
    id: "gemini",
    name: "Gemini",
    description: "Google's Gemini models",
    status: "disconnected"
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

  const handleConnect = (clientId: string) => {
    // Navigate to connect page with client-specific instructions
    router.push(`/dashboard/connect?client=${clientId}`);
  };

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
        <p style={{ color: "#666", fontSize: "0.95rem" }}>Connect AI models and assistants</p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: "1.5rem"
        }}
      >
        {clients.map((client) => (
          <div
            key={client.id}
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
              <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🤖</div>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "0.25rem" }}>{client.name}</h2>
              <p style={{ color: "#999", fontSize: "0.85rem", marginBottom: "0.5rem" }}>{client.status}</p>
            </div>

            <p style={{ color: "#666", fontSize: "0.9rem", marginBottom: "1.5rem", flex: 1 }}>
              {client.description}
            </p>

            <button
              onClick={() => handleConnect(client.id)}
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
          </div>
        ))}
      </div>
    </div>
  );
}

