import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      tenantId: string;
      role: string;
      isEmailVerified: boolean;
      isSuperAdmin: boolean;
      needsOnboarding: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    tenantId: string;
    role: string;
    isEmailVerified: boolean;
    isSuperAdmin: boolean;
    needsOnboarding?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    tenantId: string;
    role: string;
    trialExpired: boolean;
    isSubscribed: boolean;
    isEmailVerified: boolean;
    isSuperAdmin: boolean;
    needsOnboarding?: boolean;
  }
}