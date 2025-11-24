"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard/servers";
  const hasRedirected = useRef(false);

  useEffect(() => {
    // Prevent multiple redirects
    if (hasRedirected.current) return;
    
    // Supabase SDK automatically processes hash fragments on the client side
    const handleCallback = async () => {
      try {
        // Clear hash from URL immediately to prevent loops
        if (typeof window !== "undefined" && window.location.hash) {
          window.history.replaceState(null, "", window.location.pathname + window.location.search);
        }
        
        // Wait a bit for Supabase to process the hash
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Get the current session (Supabase SDK processes hash automatically)
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Error getting session:", error);
          hasRedirected.current = true;
          window.location.href = `/login?error=${encodeURIComponent(error.message)}`;
          return;
        }

        if (session?.access_token) {
          // Sync session to server-side cookies via API
          try {
            await fetch("/api/auth/sync-session", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ accessToken: session.access_token }),
              credentials: "include"
            });
          } catch (syncError) {
            console.warn("Failed to sync session to cookies:", syncError);
            // Continue anyway - session is in localStorage
          }
          
          // Use window.location.href to do a full redirect (clears everything)
          hasRedirected.current = true;
          window.location.href = next;
        } else {
          // No session yet, wait a bit more then redirect
          setTimeout(() => {
            if (!hasRedirected.current) {
              hasRedirected.current = true;
              window.location.href = next;
            }
          }, 1000);
        }
      } catch (error: any) {
        console.error("Error in auth callback:", error);
        if (!hasRedirected.current) {
          hasRedirected.current = true;
          window.location.href = `/login?error=${encodeURIComponent(error.message || "Authentication failed")}`;
        }
      }
    };

    handleCallback();
  }, [next]);

  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <p>Completing sign in...</p>
    </div>
  );
}

