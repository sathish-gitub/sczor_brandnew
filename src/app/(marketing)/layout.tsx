import type { ReactNode } from "react";
import Footer from "@/components/marketing/Footer";
import Navbar from "@/components/marketing/Navbar";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}