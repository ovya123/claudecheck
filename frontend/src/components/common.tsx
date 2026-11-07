import { Link } from "@tanstack/react-router";
import { FlaskConical } from "lucide-react";
import type { DetectedLanguage } from "@/types";
import { cn } from "@/lib/utils";
import { LIVE } from "@/lib/config";

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn("inline-flex items-center gap-2 font-semibold text-foreground", className)} aria-label="ClassBridge home">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-foreground text-background">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
          <path d="M3 17c3-6 15-6 18 0" />
          <path d="M7 17v-3M12 17v-4.5M17 17v-3" />
        </svg>
      </span>
      <span className="font-display text-lg tracking-tight">ClassBridge</span>
    </Link>
  );
}

export function DemoBadge({ label = "Demo data" }: { label?: string }) {
  if (LIVE) return null; // real data in LIVE mode
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-input bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      <FlaskConical className="h-3 w-3" aria-hidden /> {label}
    </span>
  );
}

const langStyle: Record<DetectedLanguage, string> = {
  English: "bg-sky-soft text-sky",
  Hindi: "bg-primary-soft text-accent-foreground",
  French: "bg-secondary text-foreground border border-border",
  Hinglish: "bg-alert-soft text-alert-foreground",
  unknown: "bg-muted text-muted-foreground",
};

export function LangChip({ lang }: { lang: DetectedLanguage }) {
  return (
    <span className={cn("inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold", langStyle[lang])}>
      {lang === "unknown" ? "Not detected" : lang}
    </span>
  );
}

export function StatCard({ label, value, hint, icon: Icon, tone = "primary" }: { label: string; value: string | number; hint?: string; icon: React.ComponentType<{ className?: string }>; tone?: "primary" | "sky" | "alert" | "success" }) {
  const tones = { primary: "bg-primary-soft text-primary", sky: "bg-sky-soft text-sky", alert: "bg-alert-soft text-alert-foreground", success: "bg-success-soft text-success" };
  return (
    <div className="surface p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className={cn("grid h-8 w-8 place-items-center rounded-lg", tones[tone])}><Icon className="h-4 w-4" /></span>
      </div>
      <p className="mt-3 font-display text-3xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, body }: { icon: React.ComponentType<{ className?: string }>; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center">
      <Icon className="h-6 w-6 text-muted-foreground" />
      <p className="mt-3 font-medium">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

export function timeAgo(ts: number, now: number) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return "earlier";
}
