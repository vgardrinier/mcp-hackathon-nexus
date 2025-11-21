"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  const navItems = [
    { href: "/dashboard/servers", label: "MCP Servers", icon: "🔌" },
    { href: "/dashboard/clients", label: "MCP Clients", icon: "🤖" },
    { href: "/dashboard/account", label: "Account", icon: "⚙️" }
  ];

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#f5f5f5" }}>
      {/* Sidebar */}
      <aside
        style={{
          width: "240px",
          backgroundColor: "#fff",
          borderRight: "1px solid #e0e0e0",
          padding: "1.5rem",
          display: "flex",
          flexDirection: "column"
        }}
      >
        <div style={{ marginBottom: "2rem" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "0.5rem" }}>Nexus</h1>
        </div>

        <nav style={{ flex: 1 }}>
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.75rem 1rem",
                  marginBottom: "0.5rem",
                  borderRadius: "6px",
                  textDecoration: "none",
                  color: isActive ? "#0070f3" : "#666",
                  backgroundColor: isActive ? "#e3f2fd" : "transparent",
                  fontWeight: isActive ? 600 : 400,
                  fontSize: "0.9rem"
                }}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {user && (
          <div style={{ paddingTop: "1rem", borderTop: "1px solid #e0e0e0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  backgroundColor: "#0070f3",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.85rem",
                  fontWeight: 600
                }}
              >
                {user.email?.[0]?.toUpperCase() || "U"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 500, color: "#333", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {user.email || "User"}
                </div>
              </div>
            </div>
            <button
              onClick={signOut}
              style={{
                width: "100%",
                padding: "0.5rem",
                backgroundColor: "transparent",
                color: "#666",
                border: "1px solid #e0e0e0",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "0.85rem"
              }}
            >
              Sign Out
            </button>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, overflow: "auto" }}>{children}</main>
    </div>
  );
}

