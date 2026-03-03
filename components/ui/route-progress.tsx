"use client";

import { useEffect, useState } from "react";

export function RouteProgress() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const end = () => setTimeout(() => setActive(false), 240);
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const link = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!link) return;
      if (link.href.startsWith(window.location.origin) && link.href !== window.location.href) {
        setActive(true);
        end();
      }
    };
    window.addEventListener("popstate", end);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("popstate", end);
      document.removeEventListener("click", onClick);
    };
  }, []);

  return <div className={`fixed left-0 top-0 z-[90] h-0.5 bg-gradient-to-r from-indigo-500 via-cyan-400 to-fuchsia-500 transition-all duration-500 ${active ? "w-full opacity-100" : "w-0 opacity-0"}`} />;
}
