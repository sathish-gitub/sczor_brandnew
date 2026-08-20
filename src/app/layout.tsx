import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://sczor.app"),
  title: "sczor | Salon Management Software",
  description: "Salon management software for modern teams.",
  openGraph: {
    title: "sczor | Salon Management Software",
    description: "Appointments, billing, loyalty, and reports in one salon workspace.",
    url: "https://sczor.app",
    siteName: "sczor",
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: "sczor",
      },
    ],
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "sczor | Salon Management Software",
    description: "Appointments, billing, loyalty, and reports in one salon workspace.",
    images: ["/og-image.svg"],
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-[var(--background)] text-[var(--foreground)] font-sans flex flex-col">
        {children}
      </body>
    </html>
  );
}
