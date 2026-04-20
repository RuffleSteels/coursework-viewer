"use client";

import { SessionProvider } from "next-auth/react";

const isProd = process.env.NODE_ENV === "production";
const basePath = isProd ? "/coursework" : "";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
      <SessionProvider basePath={`${basePath}/api/auth`}>
        {children}
      </SessionProvider>
  );
}