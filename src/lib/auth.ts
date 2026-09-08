import { compare } from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  pages: {
    signIn: "/login",
    signOut: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
  },
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-next-auth.session-token"
          : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: {
          label: "Email",
          type: "email",
        },
        password: {
          label: "Password",
          type: "password",
        },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;

        if (!email || !password) {
          return null;
        }

        const superAdmin = await prisma.superAdmin.findUnique({
          where: { email },
        });

        if (superAdmin) {
          const isValidSuperAdminPassword = await compare(password, superAdmin.password);

          if (!isValidSuperAdminPassword) {
            return null;
          }

          return {
            id: superAdmin.id,
            name: superAdmin.name,
            email: superAdmin.email,
            role: "SUPER_ADMIN",
            tenantId: "super-admin",
            isSuperAdmin: true,
            isEmailVerified: true,
          };
        }

        const user = await prisma.user.findFirst({
          where: {
            email,
            isActive: true,
            tenant: {
              isActive: true,
            },
          },
          select: {
            id: true,
            name: true,
            email: true,
            password: true,
            role: true,
            tenantId: true,
            emailVerified: true,
            isActive: true,
            tenant: {
              select: {
                isActive: true,
              },
            },
          },
        });

        if (!user) {
          return null;
        }

        if (!user.tenant.isActive) {
          throw new Error("SALON_INACTIVE");
        }

        const isValidPassword = await compare(password, user.password);

        if (!isValidPassword) {
          return null;
        }

        if (!user.emailVerified) {
          throw new Error("EMAIL_NOT_VERIFIED");
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          tenantId: user.tenantId,
          isSuperAdmin: false,
          isEmailVerified: user.emailVerified,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.tenantId = user.tenantId;
        token.role = user.role;
        token.isEmailVerified = user.isEmailVerified;
        token.isSuperAdmin = user.isSuperAdmin;
      }

      if (token.isSuperAdmin) {
        return token;
      }

      if (token.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { emailVerified: true },
        });

        if (dbUser) {
          token.isEmailVerified = dbUser.emailVerified;
        }
      }

      if (token.tenantId) {
        const tenant = await prisma.tenant.findUnique({
          where: { id: token.tenantId as string },
          select: {
            trialEndsAt: true,
            isSubscribed: true,
            plan: true,
          },
        });

        if (tenant) {
          const now = new Date();
          token.trialExpired = tenant.trialEndsAt ? now > tenant.trialEndsAt : false;
          token.isSubscribed = tenant.isSubscribed;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.tenantId = token.tenantId as string;
        session.user.role = token.role as string;
        session.user.id = token.sub as string;
        session.user.isEmailVerified = token.isEmailVerified as boolean;
        session.user.isSuperAdmin = Boolean(token.isSuperAdmin);
      }

      return session;
    },
  },
};