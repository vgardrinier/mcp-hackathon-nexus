"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/servers");
  }, [router]);

  return (
    <div style={{ padding: "2rem" }}>
      <p>Redirecting to dashboard (local mode, no login needed)...</p>
    </div>
  );
}
