"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { DashboardLayout } from "@/components/DashboardLayout";

function OAuthErrorHandler({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return; // Wait for user to be loaded
    
    // Handle OAuth callback errors (check both query params and hash)
    const error = searchParams.get("error") || (typeof window !== "undefined" ? new URLSearchParams(window.location.hash.substring(1)).get("error") : null);
    const errorDescription = searchParams.get("error_description") || (typeof window !== "undefined" ? new URLSearchParams(window.location.hash.substring(1)).get("error_description") : null);
    
    if (error) {
      console.log("OAuth error detected:", error, errorDescription);
      
      // If it's a database error and user exists, try to set them up manually
      if (error === "server_error" && errorDescription?.includes("Database error saving new user") && user) {
        console.log("Attempting to set up user manually...");
        fetch("/api/auth/setup-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id, email: user.email })
        })
          .then(async (res) => {
            const data = await res.json();
            console.log("Setup user response:", res.ok, data);
            if (res.ok) {
              // Success! Clear URL and refresh
              window.location.href = "/dashboard/servers";
            } else {
              // Still failed, but user is logged in - they can continue
              console.warn("User setup failed but user is logged in, redirecting anyway");
              window.location.href = "/dashboard/servers";
            }
          })
          .catch((err) => {
            console.error("Error setting up user:", err);
            // Failed, but user is logged in - they can continue
            window.location.href = "/dashboard/servers";
          });
      } else {
        // Other errors - log and redirect
        console.warn("OAuth error (non-database):", error, errorDescription);
        // Clear error from URL
        router.replace("/dashboard/servers");
      }
    } else if (typeof window !== "undefined" && window.location.hash.includes("error")) {
      // Handle hash-based errors
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const hashError = hashParams.get("error");
      const hashErrorDesc = hashParams.get("error_description");
      
      console.log("Hash-based OAuth error:", hashError, hashErrorDesc);
      
      if (hashError === "server_error" && hashErrorDesc?.includes("Database error saving new user") && user) {
        console.log("Attempting to set up user manually (hash error)...");
        fetch("/api/auth/setup-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id, email: user.email })
        })
          .then(async (res) => {
            const data = await res.json();
            console.log("Setup user response (hash):", res.ok, data);
            window.location.href = "/dashboard/servers";
          })
          .catch((err) => {
            console.error("Error setting up user (hash):", err);
            window.location.href = "/dashboard/servers";
          });
      } else {
        router.replace("/dashboard/servers");
      }
    }
  }, [searchParams, router, user]);

  return <>{children}</>;
}

export default function DashboardLayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<DashboardLayout>{children}</DashboardLayout>}>
      <OAuthErrorHandler>
        <DashboardLayout>{children}</DashboardLayout>
      </OAuthErrorHandler>
    </Suspense>
  );
}

