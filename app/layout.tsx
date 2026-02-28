import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MyHire - Job Application Tracker",
  description: "Track your job applications with Supabase + Vercel"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
