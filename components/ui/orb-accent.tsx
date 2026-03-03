"use client";

import { useEffect, useRef } from "react";
import { supportsReducedMotion } from "@/lib/motion";

export function OrbAccent() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!ref.current || supportsReducedMotion() || navigator.hardwareConcurrency <= 4) return;
    let frame = 0;
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const draw = () => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);
      const g = ctx.createRadialGradient(width * 0.5, height * 0.5, 30, width * 0.5, height * 0.5, width * 0.45);
      g.addColorStop(0, "rgba(99, 102, 241, 0.28)");
      g.addColorStop(0.5, "rgba(56, 189, 248, 0.18)");
      g.addColorStop(1, "rgba(236, 72, 153, 0.02)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(width * 0.5 + Math.sin(frame / 80) * 6, height * 0.5, width * 0.44, height * 0.35, frame / 1000, 0, Math.PI * 2);
      ctx.fill();
      frame += 1;
      requestAnimationFrame(draw);
    };
    draw();
  }, []);

  return <canvas ref={ref} width={640} height={280} className="pointer-events-none absolute right-0 top-2 -z-10 hidden opacity-70 lg:block" aria-hidden />;
}
