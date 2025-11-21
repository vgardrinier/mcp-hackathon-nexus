"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";

export default function ConnectPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    
    // Redirect to clients page
    if (user) {
      router.replace("/dashboard/clients");
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <div style={{ padding: "2rem" }}>
        <p>Redirecting...</p>
      </div>
    );
  }

  return null;
}

