"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import {
  BriefcaseBusiness,
  ChevronDown,
  FilePenLine,
  FolderOpen,
  LayoutDashboard,
  Menu,
  Moon,
  Settings,
  Sparkles,
  Sun,
  UserCircle2,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { OrbAccent } from "@/components/ui/orb-accent";

const labels = {
  "en-US": { dashboard: "Dashboard", jobs: "My Jobs", interviewPrep: "Interview Prep", files: "My Files", settings: "Settings", coverLetters: "Cover Letters", logout: "Logout", title: "MyHire" },
  "zh-CN": { dashboard: "仪表板", jobs: "职位", interviewPrep: "面试准备", files: "我的文件", settings: "设置", coverLetters: "求职信", logout: "退出", title: "MyHire" },
  "es-ES": { dashboard: "Panel", jobs: "Empleos", interviewPrep: "Preparación", files: "Mis archivos", settings: "Ajustes", coverLetters: "Cartas", logout: "Cerrar sesión", title: "MyHire" },
  "fr-FR": { dashboard: "Tableau de bord", jobs: "Mes offres", interviewPrep: "Préparation", files: "Mes fichiers", settings: "Paramètres", coverLetters: "Lettres", logout: "Déconnexion", title: "MyHire" },
  ar: { dashboard: "لوحة التحكم", jobs: "وظائفي", interviewPrep: "تحضير المقابلة", files: "ملفاتي", settings: "الإعدادات", coverLetters: "خطاب التقديم", logout: "تسجيل الخروج", title: "MyHire" },
  "pt-BR": { dashboard: "Painel", jobs: "Minhas Vagas", interviewPrep: "Preparação", files: "Meus arquivos", settings: "Configurações", coverLetters: "Cartas", logout: "Sair", title: "MyHire" },
  "hi-IN": { dashboard: "डैशबोर्ड", jobs: "नौकरियां", interviewPrep: "इंटरव्यू प्रेप", files: "मेरी फ़ाइलें", settings: "सेटिंग्स", coverLetters: "कवर लेटर", logout: "लॉगआउट", title: "MyHire" }
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
  const sidebarRef = useRef<HTMLElement>(null);
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

  useEffect(() => {
    if (!sidebarRef.current) return;

    const navLinks = sidebarRef.current.querySelectorAll("[data-nav-link]");
    gsap.fromTo(
      navLinks,
      { autoAlpha: 0, x: -20 },
      { autoAlpha: 1, x: 0, duration: 0.4, stagger: 0.06, ease: "power2.out", delay: 0.06 }
    );
  }, [collapsed, mobileNavOpen]);

  const text = useMemo(() => labels[locale], [locale]);
  const navItems: { href: Route; icon: typeof LayoutDashboard; label: string; accent: string }[] = [
    { href: "/dashboard", icon: LayoutDashboard, label: text.dashboard, accent: "from-indigo-500/25 to-cyan-400/20" },
    { href: "/jobs", icon: BriefcaseBusiness, label: text.jobs, accent: "from-violet-500/25 to-fuchsia-400/20" },
    { href: "/interview-prep", icon: Sparkles, label: text.interviewPrep, accent: "from-amber-500/25 to-orange-400/20" },
    { href: "/cover-letter-generator", icon: FilePenLine, label: text.coverLetters, accent: "from-cyan-500/25 to-emerald-400/20" },
    { href: "/files", icon: FolderOpen, label: text.files, accent: "from-orange-500/25 to-rose-400/20" },
    { href: "/settings", icon: Settings, label: text.settings, accent: "from-slate-500/25 to-zinc-400/20" }
  ];

  return (
    <div className="flex min-h-screen bg-grid">
      {mobileNavOpen ? <button className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setMobileNavOpen(false)} aria-label="Close menu" /> : null}

      <aside
        ref={sidebarRef}
        className={`sidebar-scroll fixed inset-y-0 left-0 z-40 w-[86vw] max-w-xs overflow-y-auto border-r border-border/50 bg-panel/90 p-4 backdrop-blur transition-all md:sticky md:top-0 md:h-screen md:self-start md:w-auto ${
          collapsed ? "md:w-20" : "md:w-64"
        } ${mobileNavOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        <div className="mb-6 flex items-center justify-between gap-2">
          {!collapsed ? (
            <h2 className="flex items-center gap-2 truncate bg-gradient-to-r from-indigo-500 via-cyan-400 to-fuchsia-500 bg-clip-text text-xl font-black text-transparent">
              <Sparkles size={16} className="text-cyan-400" />
              {text.title}
            </h2>
          ) : null}
          <div className="flex items-center gap-1">
            <Button variant="ghost" onClick={() => setCollapsed((v) => !v)} className="hidden md:inline-flex" aria-label="Toggle side menu">
              {collapsed ? <Menu size={16} /> : <X size={16} />}
            </Button>
            <Button variant="ghost" onClick={() => setMobileNavOpen(false)} className="md:hidden" aria-label="Close mobile menu">
              <X size={16} />
            </Button>
          </div>
        </div>
        <nav className="flex min-h-[calc(100dvh-4.5rem)] flex-col md:min-h-[calc(100vh-4.5rem)]">
          <div className="space-y-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  title={item.label}
                  data-nav-link
                  className={`group nav-animated-link relative flex min-w-0 items-center overflow-hidden rounded-xl border border-transparent px-3 py-2.5 transition-all duration-300 hover:border-border/70 hover:bg-muted/60 ${
                    collapsed ? "justify-center" : "gap-2.5"
                  } ${isActive ? "border-border/70 bg-muted/70 shadow-[0_0_0_1px_rgba(99,102,241,0.15)]" : ""}`}
                  href={item.href}
                  onClick={() => setMobileNavOpen(false)}
                  onMouseEnter={(e) => {
                    gsap.to(e.currentTarget.querySelector("[data-icon-wrap]"), { y: -1.5, scale: 1.04, duration: 0.2, ease: "power2.out" });
                  }}
                  onMouseLeave={(e) => {
                    gsap.to(e.currentTarget.querySelector("[data-icon-wrap]"), { y: 0, scale: 1, duration: 0.2, ease: "power2.out" });
                  }}
                >
                  <span className={`pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r opacity-0 transition-opacity duration-300 ${item.accent} ${isActive ? "opacity-100" : "group-hover:opacity-90"}`} />
                  <span data-icon-wrap className="rounded-lg bg-background/70 p-1.5 shadow-sm ring-1 ring-border/40 transition-colors group-hover:ring-border/70">
                    <item.icon size={16} className={isActive ? "text-indigo-500" : "text-foreground/80"} />
                  </span>
                  {!collapsed ? (
                    <span className="truncate text-sm font-semibold tracking-wide">{item.label}</span>
                  ) : null}
                  {isActive && !collapsed ? <span className="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.75)]" /> : null}
                </Link>
              );
            })}
          </div>
          <div className={`mt-auto rounded-md px-1 ${collapsed ? "[&_.logout-label]:hidden [&_button]:justify-center" : ""}`}>{logoutButton}</div>
        </nav>
      </aside>
      <section className="relative min-w-0 flex-1">
        <OrbAccent />
        <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-border/40 bg-panel/70 px-4 py-3 backdrop-blur md:px-5">
          <div className="flex items-center gap-2">
            <Button variant="ghost" className="h-8 w-8 p-0 md:hidden" onClick={() => setMobileNavOpen(true)} aria-label="Open mobile menu">
              <Menu size={18} />
            </Button>
            <div className="h-10 w-24 animate-pulse rounded-full bg-gradient-to-r from-indigo-500/30 via-cyan-400/20 to-fuchsia-500/30 sm:w-40" />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            <div className="flex rounded-full border border-border/60 bg-background/70 p-1">
              <Button variant="ghost" className="h-8 w-8 rounded-full p-0" onClick={() => setTheme("light")} aria-label="Light mode">
                <Sun size={15} />
              </Button>
              <Button variant="ghost" className="h-8 w-8 rounded-full p-0" onClick={() => setTheme("dark")} aria-label="Dark mode">
                <Moon size={15} />
              </Button>
            </div>
            <div className="relative flex min-w-0 items-center rounded-full border border-border/60 bg-background/70 pl-2 pr-6">
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value as Locale)}
                className="w-24 appearance-none bg-transparent pr-4 text-sm font-medium outline-none sm:w-44"
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
        <div ref={contentRef} className="p-4 md:p-6">{children}</div>
      </section>
    </div>
  );
}
