"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.push("/dashboard/servers");
      } else {
        router.push("/login");
      }
    }
  }, [user, loading, router]);

  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont" }}>
      <p>Loading...</p>
    </main>
  );
}


