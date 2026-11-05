"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type StudioDashboardType from "./StudioDashboard";

// AG Studio only runs in the browser.
const StudioDashboard = dynamic(() => import("./StudioDashboard"), { ssr: false });

export function CashUpStudio(props: ComponentProps<typeof StudioDashboardType>) {
  return <StudioDashboard {...props} />;
}
