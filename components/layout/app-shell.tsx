"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Globe, Menu, Moon, Sun, UserCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const labels = {
  "en-US": { dashboard: "Dashboard", jobs: "My Jobs", files: "My Files", settings: "Settings", logout: "Logout", title: "MyHire" },
  "zh-CN": { dashboard: "仪表板", jobs: "职位", files: "我的文件", settings: "设置", logout: "退出", title: "MyHire" },
  "es-ES": { dashboard: "Panel", jobs: "Empleos", files: "Mis archivos", settings: "Ajustes", logout: "Cerrar sesión", title: "MyHire" },
  "fr-FR": { dashboard: "Tableau de bord", jobs: "Mes offres", files: "Mes fichiers", settings: "Paramètres", logout: "Déconnexion", title: "MyHire" },
  ar: { dashboard: "لوحة التحكم", jobs: "وظائفي", files: "ملفاتي", settings: "الإعدادات", logout: "تسجيل الخروج", title: "MyHire" },
  "pt-BR": { dashboard: "Painel", jobs: "Minhas Vagas", files: "Meus arquivos", settings: "Configurações", logout: "Sair", title: "MyHire" },
  "hi-IN": { dashboard: "डैशबोर्ड", jobs: "नौकरियां", files: "मेरी फ़ाइलें", settings: "सेटिंग्स", logout: "लॉगआउट", title: "MyHire" }
} as const;

type Locale = keyof typeof labels;

export function AppShell({ children, logoutButton }: { children: React.ReactNode; logoutButton: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [locale, setLocale] = useState<Locale>("en-US");

  useEffect(() => {
    const storedTheme = localStorage.getItem("myhire-theme") as "light" | "dark" | null;
    const storedLocale = localStorage.getItem("myhire-locale") as Locale | null;
    if (storedTheme) setTheme(storedTheme);
    if (storedLocale && labels[storedLocale]) setLocale(storedLocale);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("myhire-theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("myhire-locale", locale);
  }, [locale]);

  const text = useMemo(() => labels[locale], [locale]);
  const navLinks = (
    <>
      <Link className="block rounded-md px-3 py-2 hover:bg-muted" href="/dashboard" onClick={() => setMobileNavOpen(false)}>{collapsed ? "📊" : text.dashboard}</Link>
      <Link className="block rounded-md px-3 py-2 hover:bg-muted" href="/jobs" onClick={() => setMobileNavOpen(false)}>{collapsed ? "💼" : text.jobs}</Link>
      <Link className="block rounded-md px-3 py-2 hover:bg-muted" href="/files" onClick={() => setMobileNavOpen(false)}>{collapsed ? "📁" : text.files}</Link>
      <Link className="block rounded-md px-3 py-2 hover:bg-muted" href="/settings" onClick={() => setMobileNavOpen(false)}>{collapsed ? "⚙️" : text.settings}</Link>
    </>
  );

  return (
    <div className="flex min-h-screen bg-grid">
      {mobileNavOpen ? <button className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setMobileNavOpen(false)} aria-label="Close menu" /> : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 border-r border-border/50 bg-panel/80 p-4 backdrop-blur transition-all md:static md:z-0 ${
          collapsed ? "md:w-20" : "md:w-64"
        } ${mobileNavOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"} w-64`}
      >
        <div className="mb-6 flex items-center justify-between">
          {!collapsed ? <h2 className="bg-gradient-to-r from-indigo-500 to-cyan-400 bg-clip-text text-xl font-extrabold text-transparent">{text.title}</h2> : null}
          <Button variant="ghost" onClick={() => setMobileNavOpen(false)} className="md:hidden" aria-label="Close mobile menu">
            <X size={16} />
          </Button>
          <Button variant="ghost" onClick={() => setCollapsed((v) => !v)} className="hidden md:inline-flex" aria-label="Toggle side menu">
            {collapsed ? <Menu size={16} /> : <X size={16} />}
          </Button>
        </div>
        <nav className="space-y-2">
          {navLinks}
          <div className="rounded-md px-1 md:hidden">{logoutButton}</div>
          <div className="rounded-md px-1 hidden md:block">{logoutButton}</div>
        </nav>
        <Button
          variant="ghost"
          className="absolute -right-4 top-16 hidden h-8 w-8 rounded-full border border-border bg-background/95 p-0 shadow-sm md:inline-flex"
          onClick={() => setCollapsed((v) => !v)}
          aria-label="Collapse left side menu"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </Button>
      </aside>
      <section className="flex-1">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border/40 bg-panel/70 px-5 py-3 backdrop-blur">
          <div className="flex items-center gap-2">
            <Button variant="ghost" className="h-8 w-8 p-0 md:hidden" onClick={() => setMobileNavOpen(true)} aria-label="Open mobile menu">
              <Menu size={18} />
            </Button>
            <div className="h-10 w-40 animate-pulse rounded-full bg-gradient-to-r from-indigo-500/30 via-cyan-400/20 to-fuchsia-500/30" />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-full border border-border/60 bg-background/70 p-1">
              <Button variant="ghost" className="h-8 w-8 rounded-full p-0" onClick={() => setTheme("light")} aria-label="Light mode">
                <Sun size={15} />
              </Button>
              <Button variant="ghost" className="h-8 w-8 rounded-full p-0" onClick={() => setTheme("dark")} aria-label="Dark mode">
                <Moon size={15} />
              </Button>
            </div>
            <div className="flex items-center rounded-full border border-border/60 bg-background/70 px-2">
              <Globe size={14} className="mr-1" />
              <select value={locale} onChange={(e) => setLocale(e.target.value as Locale)} className="bg-transparent text-sm outline-none" aria-label="Language">
                {Object.keys(labels).map((lng) => (
                  <option key={lng}>{lng}</option>
                ))}
              </select>
            </div>
            <button className="rounded-full border border-border/60 bg-background/70 p-2">
              <UserCircle2 size={18} />
            </button>
          </div>
        </header>
        <div className="p-6">{children}</div>
      </section>
    </div>
  );
}
