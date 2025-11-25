"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navItems = [{ href: "/dashboard/servers", label: "MCP Servers", icon: "MCP" }];

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#f5f5f5" }}>
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
      </aside>

      <main style={{ flex: 1, overflow: "auto" }}>{children}</main>
    </div>
  );
}
