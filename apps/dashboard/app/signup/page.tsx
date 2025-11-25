"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/servers");
  }, [router]);

  return (
    <div style={{ padding: "2rem" }}>
      <p>Redirecting to dashboard (local mode, no signup needed)...</p>
    </div>
  );
}
