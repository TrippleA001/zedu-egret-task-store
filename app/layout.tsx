import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zedu Egret Store",
  description: "Task verification & onboarding portal",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
