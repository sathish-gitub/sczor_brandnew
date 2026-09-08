"use client";

import { createContext, useContext } from "react";

import type { AccessLevel } from "@/lib/subscription";

type AccessContextValue = {
  accessLevel: AccessLevel;
};

const AccessContext = createContext<AccessContextValue>({ accessLevel: "FULL" });

export function AccessProvider({
  accessLevel,
  children,
}: {
  accessLevel: AccessLevel;
  children: React.ReactNode;
}) {
  return <AccessContext.Provider value={{ accessLevel }}>{children}</AccessContext.Provider>;
}

export function useAccess() {
  return useContext(AccessContext);
}
