"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.replace("/dashboard/servers");
      } else {
        router.replace("/login");
      }
    }
  }, [user, loading, router]);

  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <p>Redirecting...</p>
    </div>
  );
}

