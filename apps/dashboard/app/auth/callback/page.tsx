"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AuthCallbackPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/servers");
  }, [router]);
  return (
    <div style={{ padding: "2rem" }}>
      <p>Authentication callback disabled; redirecting to dashboard.</p>
    </div>
  );
}
