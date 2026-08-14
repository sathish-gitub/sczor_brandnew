import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const protectedPrefixes = [
  "/dashboard",
  "/appointments",
  "/customers",
  "/services",
  "/staff",
  "/billing",
  "/attendance",
  "/reports",
  "/loyalty",
  "/settings",
  "/onboarding",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const isAuthenticated = Boolean(token);
  const isProtectedRoute = protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (!isAuthenticated && isProtectedRoute) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/appointments/:path*",
    "/customers/:path*",
    "/services/:path*",
    "/staff/:path*",
    "/billing/:path*",
    "/attendance/:path*",
    "/reports/:path*",
    "/loyalty/:path*",
    "/settings/:path*",
    "/onboarding/:path*",
  ],
};