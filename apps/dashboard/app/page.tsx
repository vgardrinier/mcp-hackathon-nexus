"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/servers");
  }, [router]);

  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont" }}>
      <p>Redirecting to dashboard...</p>
    </main>
  );
}


