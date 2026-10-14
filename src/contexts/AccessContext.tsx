"use client";

import { createContext, useContext } from "react";

import type { AccessLevel } from "@/lib/subscription";

export type SalonDetails = {
  tenantName: string;
  tenantLogo: string | null;
  tenantAddress: string | null;
  tenantCity: string | null;
  tenantState: string | null;
  tenantPincode: string | null;
  tenantPhone: string | null;
  tenantEmail: string | null;
  tenantGstNumber: string | null;
};

type AccessContextValue = SalonDetails & {
  accessLevel: AccessLevel;
  userName: string;
};

const DEFAULT_SALON_DETAILS: SalonDetails = {
  tenantName: "",
  tenantLogo: null,
  tenantAddress: null,
  tenantCity: null,
  tenantState: null,
  tenantPincode: null,
  tenantPhone: null,
  tenantEmail: null,
  tenantGstNumber: null,
};

const AccessContext = createContext<AccessContextValue>({
  accessLevel: "FULL",
  userName: "",
  ...DEFAULT_SALON_DETAILS,
});

export function AccessProvider({
  accessLevel,
  tenantName,
  tenantLogo = null,
  tenantAddress = null,
  tenantCity = null,
  tenantState = null,
  tenantPincode = null,
  tenantPhone = null,
  tenantEmail = null,
  tenantGstNumber = null,
  userName = "",
  children,
}: {
  accessLevel: AccessLevel;
  tenantName: string;
  tenantLogo?: string | null;
  tenantAddress?: string | null;
  tenantCity?: string | null;
  tenantState?: string | null;
  tenantPincode?: string | null;
  tenantPhone?: string | null;
  tenantEmail?: string | null;
  tenantGstNumber?: string | null;
  userName?: string;
  children: React.ReactNode;
}) {
  return (
    <AccessContext.Provider
      value={{
        accessLevel,
        tenantName,
        tenantLogo,
        tenantAddress,
        tenantCity,
        tenantState,
        tenantPincode,
        tenantPhone,
        tenantEmail,
        tenantGstNumber,
        userName,
      }}
    >
      {children}
    </AccessContext.Provider>
  );
}

export function useAccess() {
  return useContext(AccessContext);
}
