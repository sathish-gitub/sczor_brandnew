import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

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
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-[var(--background)] text-[var(--foreground)] font-sans flex flex-col">
        {children}
      </body>
    </html>
  );
}
