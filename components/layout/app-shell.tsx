"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { BriefcaseBusiness, ChevronDown, FolderOpen, LayoutDashboard, Menu, Moon, Settings, Sun, UserCircle2, X } from "lucide-react";
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

const localeFlags: Record<Locale, string> = {
  "en-US": "🇺🇸",
  "zh-CN": "🇨🇳",
  "es-ES": "🇪🇸",
  "fr-FR": "🇫🇷",
  ar: "🇸🇦",
  "pt-BR": "🇧🇷",
  "hi-IN": "🇮🇳"
};

const localeMeta: Record<Locale, { countryCode: string; countryName: string; languageCode: string }> = {
  "en-US": { countryCode: "US", countryName: "United States", languageCode: "EN" },
  "zh-CN": { countryCode: "CN", countryName: "China", languageCode: "CN" },
  "es-ES": { countryCode: "ES", countryName: "Spain", languageCode: "ES" },
  "fr-FR": { countryCode: "FR", countryName: "France", languageCode: "FR" },
  ar: { countryCode: "SA", countryName: "Saudi Arabia", languageCode: "AR" },
  "pt-BR": { countryCode: "BR", countryName: "Brazil", languageCode: "PT" },
  "hi-IN": { countryCode: "IN", countryName: "India", languageCode: "HI" }
};

export function AppShell({ children, logoutButton }: { children: React.ReactNode; logoutButton: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [locale, setLocale] = useState<Locale>("en-US");
  const contentRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

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

  useEffect(() => {
    if (!contentRef.current) return;
    gsap.fromTo(contentRef.current, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.45, ease: "power2.out" });
  }, [pathname]);

  const text = useMemo(() => labels[locale], [locale]);
  const navItems: { href: Route; icon: typeof LayoutDashboard; label: string }[] = [
    { href: "/dashboard", icon: LayoutDashboard, label: text.dashboard },
    { href: "/jobs", icon: BriefcaseBusiness, label: text.jobs },
    { href: "/files", icon: FolderOpen, label: text.files },
    { href: "/settings", icon: Settings, label: text.settings }
  ];
  const navLinks = (
    <>
      {navItems.map((item) => (
        <Link
          key={item.href}
          title={item.label}
          className={`flex items-center rounded-md px-3 py-2 hover:bg-muted ${collapsed ? "justify-center" : "gap-2"}`}
          href={item.href}
          onClick={() => setMobileNavOpen(false)}
        >
          <item.icon size={18} />
          {!collapsed ? <span>{item.label}</span> : null}
        </Link>
      ))}
    </>
  );

  return (
    <div className="flex min-h-screen bg-grid">
      {mobileNavOpen ? <button className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setMobileNavOpen(false)} aria-label="Close menu" /> : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 border-r border-border/50 bg-panel/80 p-4 backdrop-blur transition-all md:static md:z-0 ${
          collapsed ? "md:w-20" : "md:w-64"
        } ${mobileNavOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"} ${collapsed ? "w-20" : "w-64"}`}
      >
        <div className="mb-6 flex items-center justify-between">
          {!collapsed ? <h2 className="bg-gradient-to-r from-indigo-500 to-cyan-400 bg-clip-text text-xl font-extrabold text-transparent">{text.title}</h2> : null}
          <Button variant="ghost" onClick={() => setMobileNavOpen(false)} className="md:hidden" aria-label="Close mobile menu">
            <X size={16} />
          </Button>
          <Button variant="ghost" onClick={() => setCollapsed((v) => !v)} className="inline-flex" aria-label="Toggle side menu">
            {collapsed ? <Menu size={16} /> : <X size={16} />}
          </Button>
        </div>
        <nav className="flex h-[calc(100vh-4.5rem)] flex-col">
          <div className="space-y-2">
          {navLinks}
          </div>
          <div className={`mt-auto rounded-md px-1 ${collapsed ? "[&_.logout-label]:hidden [&_button]:justify-center" : ""}`}>{logoutButton}</div>
        </nav>
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
            <div className="relative flex items-center rounded-full border border-border/60 bg-background/70 pl-2 pr-6">
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value as Locale)}
                className="appearance-none bg-transparent pr-4 text-sm font-medium outline-none"
                aria-label="Language"
                title={`${localeMeta[locale].countryName} (${localeMeta[locale].languageCode})`}
              >
                {Object.keys(labels).map((lng) => (
                  <option key={lng} value={lng} title={`${localeMeta[lng as Locale].countryName} (${localeMeta[lng as Locale].languageCode})`}>
                    {localeFlags[lng as Locale]} {localeMeta[lng as Locale].countryCode} ({localeMeta[lng as Locale].languageCode})
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2 text-muted-foreground" />
            </div>
            <button className="rounded-full border border-border/60 bg-background/70 p-2">
              <UserCircle2 size={18} />
            </button>
          </div>
        </header>
        <div ref={contentRef} className="p-6">{children}</div>
      </section>
    </div>
  );
}
