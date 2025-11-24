"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`
        }
      });

      if (error) throw error;

      // The trigger should automatically set up the user via handle_new_user()
      // But if email confirmation is required, the user might not be in auth.users yet
      // So we'll call setup-user as a fallback, but don't fail if it doesn't work
      if (data.user) {
        // Wait a moment for the trigger to run (if user is immediately available)
        await new Promise(resolve => setTimeout(resolve, 500));
        
        try {
          const response = await fetch("/api/auth/setup-user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: data.user.id, email: data.user.email })
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            // If it's a foreign key error, the user doesn't exist in auth.users yet
            // This is OK - the trigger will handle it when they confirm email
            if (errorData.code !== "23503") {
              console.error("Failed to set up user:", errorData);
            }
          }
        } catch (fetchError) {
          console.error("Error calling setup-user API:", fetchError);
          // Don't fail signup if API call fails
        }
      }

      setMessage({
        type: "success",
        text: "Account created! Check your email to verify, then sign in."
      });
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to sign up" });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/dashboard/servers`,
          queryParams: {
            access_type: "offline",
            prompt: "consent"
          }
        }
      });
      
      if (error) {
        console.error("Google OAuth error:", error);
        throw error;
      }
      
      // OAuth redirect will happen automatically
      // Don't set loading to false here as we're redirecting
    } catch (error: any) {
      console.error("Error in handleGoogleSignUp:", error);
      setMessage({ 
        type: "error", 
        text: error.message || "Failed to sign up with Google. Please try again." 
      });
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "400px", margin: "4rem auto", padding: "2rem" }}>
      <h1 style={{ fontSize: "1.8rem", fontWeight: 600, marginBottom: "1.5rem" }}>Sign Up</h1>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div>
          <label htmlFor="email" style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500 }}>
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              width: "100%",
              padding: "0.5rem",
              border: "1px solid #ccc",
              borderRadius: "4px",
              fontSize: "1rem"
            }}
          />
        </div>

        <div>
          <label htmlFor="password" style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500 }}>
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            style={{
              width: "100%",
              padding: "0.5rem",
              border: "1px solid #ccc",
              borderRadius: "4px",
              fontSize: "1rem"
            }}
          />
        </div>

        {message && (
          <div
            style={{
              padding: "0.75rem",
              borderRadius: "4px",
              backgroundColor: message.type === "success" ? "#d4edda" : "#f8d7da",
              color: message.type === "success" ? "#155724" : "#721c24"
            }}
          >
            {message.text}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "0.75rem",
            backgroundColor: "#0070f3",
            color: "white",
            border: "none",
            borderRadius: "4px",
            fontSize: "1rem",
            fontWeight: 500,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1
          }}
        >
          {loading ? "Loading..." : "Sign Up"}
        </button>
      </form>

      <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
        <div style={{ margin: "1rem 0", color: "#666", fontSize: "0.9rem" }}>or</div>
        <button
          onClick={handleGoogleSignUp}
          disabled={loading}
          style={{
            width: "100%",
            padding: "0.75rem",
            backgroundColor: "white",
            color: "#333",
            border: "1px solid #ccc",
            borderRadius: "4px",
            fontSize: "1rem",
            fontWeight: 500,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem"
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
            <path
              fill="#4285F4"
              d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
            />
            <path
              fill="#34A853"
              d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
            />
            <path
              fill="#FBBC05"
              d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.951H.957C.348 6.174 0 7.55 0 9s.348 2.826.957 4.049l3.007-2.342z"
            />
            <path
              fill="#EA4335"
              d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.951L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"
            />
          </svg>
          Continue with Google
        </button>
      </div>

      <p style={{ marginTop: "1.5rem", fontSize: "0.9rem", color: "#666" }}>
        Already have an account?{" "}
        <a href="/login" style={{ color: "#0070f3", textDecoration: "none" }}>
          Sign in
        </a>
      </p>
    </div>
  );
}

