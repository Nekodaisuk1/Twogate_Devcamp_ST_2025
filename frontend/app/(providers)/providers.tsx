
"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

const qc = new QueryClient();
export default function Providers({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}
