import type { Metadata } from "next";
import "./globals.css";
import SiteHeader from "./components/site-header";

export const metadata: Metadata = {
  title: "Zedu Egret Store",
  description: "Task verification & onboarding portal",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white font-sans text-ink">
        <div className="bg-brand-deep px-4 py-2 text-center text-[13px] font-medium text-white">
          Stage 1 verification is open — complete your ToDo milestone to claim your receipt.
        </div>
        <SiteHeader />
        <main>{children}</main>
        <footer className="mt-16 border-t border-line bg-canvas">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-[13px] text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="font-semibold text-ink">Zedu Egret Store <span className="font-normal text-muted">· Task verification &amp; onboarding</span></p>
            <p>Order receipts follow the <span className="font-mono font-semibold">ZE-2026-XXXX</span> format. Milestones are $0.00 products.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
