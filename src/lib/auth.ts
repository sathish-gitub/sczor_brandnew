import { compare } from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";

import { prisma } from "@/lib/prisma";
import { checkRateLimit, recordAttempt } from "@/lib/rateLimit";

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

        const rateLimitCheck = await checkRateLimit(email, "LOGIN");
        if (!rateLimitCheck.allowed) {
          throw new Error(`TOO_MANY_ATTEMPTS:${rateLimitCheck.retryAfterMinutes}`);
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

        if (!user.password) {
          // Google-only account - no password to compare against.
          return null;
        }

        const isValidPassword = await compare(password, user.password);

        if (!isValidPassword) {
          await recordAttempt(email, "LOGIN");
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
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google") {
        return true;
      }

      if (!user.email) {
        return false;
      }

      const email = user.email.trim().toLowerCase();

      const existingUser = await prisma.user.findFirst({
        where: { email },
        select: {
          id: true,
          tenantId: true,
          role: true,
          emailVerified: true,
          googleId: true,
          isActive: true,
          tenant: { select: { isActive: true } },
        },
      });

      if (existingUser) {
        if (!existingUser.isActive || !existingUser.tenant.isActive) {
          return false;
        }

        if (!existingUser.googleId) {
          await prisma.user.update({
            where: { id: existingUser.id },
            data: { googleId: account.providerAccountId },
          });
        }

        user.id = existingUser.id;
        user.tenantId = existingUser.tenantId;
        user.role = existingUser.role;
        user.isEmailVerified = existingUser.emailVerified;
        user.isSuperAdmin = false;
        user.needsOnboarding = false;
        return true;
      }

      // Brand new Google sign-up - no Tenant yet, route through /complete-signup.
      user.tenantId = "";
      user.role = "OWNER";
      user.isEmailVerified = true;
      user.isSuperAdmin = false;
      user.needsOnboarding = true;
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.tenantId = user.tenantId;
        token.role = user.role;
        token.isEmailVerified = user.isEmailVerified;
        token.isSuperAdmin = user.isSuperAdmin;
        token.needsOnboarding = user.needsOnboarding ?? false;
      }

      if (trigger === "update" && session) {
        token.needsOnboarding = false;
        token.isEmailVerified = true;
        if (session.tenantId) {
          token.tenantId = session.tenantId as string;
        }
        if (session.role) {
          token.role = session.role as string;
        }
        if (session.userId) {
          token.sub = session.userId as string;
        }
      }

      if (token.isSuperAdmin) {
        return token;
      }

      if (token.needsOnboarding) {
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
        session.user.needsOnboarding = Boolean(token.needsOnboarding);
      }

      return session;
    },
  },
};