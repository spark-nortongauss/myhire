import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast-provider";
import { RouteProgress } from "@/components/ui/route-progress";

export const metadata: Metadata = {
  title: "MyHire - Job Application Tracker",
  description: "Candidaturas, entrevistas e histórias. Tudo em um só lugar."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body><ToastProvider><RouteProgress />{children}</ToastProvider></body>
    </html>
  );
}
