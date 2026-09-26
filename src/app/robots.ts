import type { MetadataRoute } from "next";

const baseUrl = "https://sczor.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard",
          "/appointments",
          "/attendance",
          "/billing",
          "/customers",
          "/inventory",
          "/loyalty",
          "/payroll",
          "/reports",
          "/services",
          "/settings",
          "/staff",
          "/subscription-required",
          "/super-admin",
          "/onboarding",
          "/select-plan",
          "/complete-signup",
          "/verify-email",
          "/forgot-password",
          "/reset-password",
          "/login",
          "/signup",
          "/api",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
