"use client";

import { Suspense } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";

export default function DashboardLayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<DashboardLayout>{children}</DashboardLayout>}>
      <DashboardLayout>{children}</DashboardLayout>
    </Suspense>
  );
}

