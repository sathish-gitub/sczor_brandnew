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
  "/subscription-required",
  "/select-plan",
];

const superAdminPrefix = "/super-admin";

function withNoStoreHeaders(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  response.headers.set("Pragma", "no-cache");
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  console.log("[proxy-debug] invoked for", pathname);
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const isAuthenticated = Boolean(token);
  if (pathname === "/dashboard") {
    console.log("[proxy-debug]", { pathname, isAuthenticated, token });
  }

  if (pathname === superAdminPrefix || pathname.startsWith(`${superAdminPrefix}/`)) {
    if (!isAuthenticated || !token?.isSuperAdmin) {
      const loginUrl = new URL("/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
    return withNoStoreHeaders(NextResponse.next());
  }

  const isProtectedRoute = protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (!isAuthenticated && isProtectedRoute) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Super admins manage tenants from /super-admin - keep them out of tenant dashboards.
  if (isAuthenticated && token?.isSuperAdmin && isProtectedRoute) {
    return NextResponse.redirect(new URL("/super-admin/dashboard", request.url));
  }

  if (
    isAuthenticated &&
    !token?.isEmailVerified &&
    isProtectedRoute &&
    !pathname.startsWith("/verify-email") &&
    !pathname.startsWith("/api/auth")
  ) {
    const verifyUrl = new URL("/verify-email", request.url);
    if (token?.email) {
      verifyUrl.searchParams.set("email", token.email as string);
    }
    return NextResponse.redirect(verifyUrl);
  }

  if (
    token?.tenantId &&
    token.trialExpired &&
    !token.isSubscribed &&
    pathname !== "/select-plan" &&
    !pathname.startsWith("/subscription-required") &&
    !pathname.startsWith("/settings/subscription") &&
    !pathname.startsWith("/api/auth")
  ) {
    return NextResponse.redirect(new URL("/subscription-required", request.url));
  }

  if (isProtectedRoute) {
    return withNoStoreHeaders(NextResponse.next());
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
    "/subscription-required/:path*",
    "/select-plan/:path*",
    "/super-admin/:path*",
  ],
};