"use client";
import Link from "next/link";
import type { Route } from "next";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  BriefcaseBusiness,
  Compass,
  FolderOpen,
  LayoutDashboard,
  Menu,
  Moon,
  Settings,
  Sun,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
const items = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/jobs", label: "My Jobs", Icon: BriefcaseBusiness },
  { href: "/job-finder", label: "Descobrir", Icon: Compass },
  { href: "/preparation", label: "Preparação", Icon: BookOpen },
  { href: "/files", label: "Meus CVs", Icon: FolderOpen },
];
export function AppShell({
  children,
  logoutButton,
  name,
}: {
  children: React.ReactNode;
  logoutButton: React.ReactNode;
  name: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false),
    [dark, setDark] = useState(false);
  useEffect(() => {
    const value = localStorage.getItem("myhire-theme") === "dark";
    setDark(value);
    document.documentElement.dataset.theme = value ? "dark" : "light";
  }, []);
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);
  const title =
    items.find((i) => pathname.startsWith(i.href))?.label ||
    (pathname.startsWith("/interview-prep")
      ? "Preparação"
      : pathname === "/settings"
        ? "Configurações"
        : "Documentos");
  return (
    <div className="min-h-screen">
      <a className="skip-link" href="#main-content">
        Ir para o conteúdo
      </a>
      {open && (
        <button
          aria-label="Fechar navegação"
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={`app-sidebar ${open ? "is-open" : ""}`}>
        <div className="mb-10 flex items-center justify-between">
          <Link href="/dashboard" className="text-3xl font-bold tracking-tight">
            My<span className="text-primary">Hire</span>
          </Link>
          <Button
            variant="ghost"
            className="md:hidden"
            aria-label="Fechar menu"
            onClick={() => setOpen(false)}
          >
            <X size={20} />
          </Button>
        </div>
        <nav aria-label="Navegação principal" className="space-y-2">
          {items.map(({ href, label, Icon }) => {
            const active =
              pathname.startsWith(href) ||
              (href === "/preparation" &&
                pathname.startsWith("/interview-prep"));
            return (
              <Link
                href={href as Route}
                key={href}
                aria-current={active ? "page" : undefined}
                className={`nav-link ${active ? "active" : ""}`}
              >
                <Icon size={20} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-3 pt-12">
          <Link className="nav-link" href="/settings">
            <Settings size={20} />
            Configurações
          </Link>
          <div className="flex items-center gap-3 border-t border-border px-3 pt-5">
            <span className="avatar">{name.slice(0, 1).toUpperCase()}</span>
            <span className="truncate text-sm">{name}</span>
          </div>
          {logoutButton}
        </div>
      </aside>
      <div className="md:ml-[220px]">
        <header className="app-header">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              className="md:hidden"
              aria-expanded={open}
              aria-label="Abrir navegação"
              onClick={() => setOpen(true)}
            >
              <Menu size={20} />
            </Button>
            <span className="text-sm text-muted-foreground">{title}</span>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              aria-label={dark ? "Ativar tema claro" : "Ativar tema escuro"}
              onClick={() => {
                document.documentElement.dataset.theme = dark
                  ? "light"
                  : "dark";
                localStorage.setItem("myhire-theme", dark ? "light" : "dark");
                setDark(!dark);
              }}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </Button>
            <Link href="/settings" aria-label="Minha conta" className="avatar">
              {name.slice(0, 1).toUpperCase()}
            </Link>
          </div>
        </header>
        <main
          id="main-content"
          className="mx-auto max-w-[1500px] p-4 sm:p-7 lg:p-9"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
