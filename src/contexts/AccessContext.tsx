"use client";

import { createContext, useContext } from "react";

import type { AccessLevel } from "@/lib/subscription";

type AccessContextValue = {
  accessLevel: AccessLevel;
  tenantName: string;
};

const AccessContext = createContext<AccessContextValue>({ accessLevel: "FULL", tenantName: "" });

export function AccessProvider({
  accessLevel,
  tenantName,
  children,
}: {
  accessLevel: AccessLevel;
  tenantName: string;
  children: React.ReactNode;
}) {
  return <AccessContext.Provider value={{ accessLevel, tenantName }}>{children}</AccessContext.Provider>;
}

export function useAccess() {
  return useContext(AccessContext);
}
