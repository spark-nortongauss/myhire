import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast-provider";
import { RouteProgress } from "@/components/ui/route-progress";

export const metadata: Metadata = {
  title: "MyHire - Job Application Tracker",
  description: "Track your job applications with Supabase + Vercel"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body><ToastProvider><RouteProgress />{children}</ToastProvider></body>
    </html>
  );
}
