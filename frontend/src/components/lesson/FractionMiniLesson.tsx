import { useState } from "react";
import { Check, PartyPopper, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Lang, LearningActivity } from "@/types";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

function slicePath(i: number, n: number, r = 80, c = 90) {
  if (n === 1) return `M ${c - r} ${c} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0`;
  const a0 = (i / n) * Math.PI * 2 - Math.PI / 2;
  const a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
  const x0 = c + r * Math.cos(a0), y0 = c + r * Math.sin(a0);
  const x1 = c + r * Math.cos(a1), y1 = c + r * Math.sin(a1);
  return `M ${c} ${c} L ${x0} ${y0} A ${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1} ${y1} Z`;
}

/** Point inside slice i of n (for pepperoni), at a fraction t of the radius. */
function slicePoint(i: number, n: number, t: number, offset = 0, c = 90, r = 80) {
  const a = ((i + 0.5 + offset) / n) * Math.PI * 2 - Math.PI / 2;
  return [c + Math.cos(a) * r * t, c + Math.sin(a) * r * t] as const;
}

function Pizza({ n, shaded, onToggle, active, label }: { n: number; shaded: Set<number>; onToggle: (i: number) => void; active: boolean; label: string }) {
  return (
    <figure className={cn("relative flex flex-col items-center gap-3 overflow-hidden rounded-2xl border p-5 transition-all duration-300",
      active ? "border-primary/50 bg-gradient-to-b from-primary-soft/70 to-card shadow-lift" : "bg-card opacity-85 hover:opacity-100")}>
      <svg viewBox="0 0 180 180" className="h-40 w-40 drop-shadow-md sm:h-48 sm:w-48" role="group" aria-label={label}>
        {/* crust */}
        <circle cx="90" cy="90" r="88" fill="var(--crust)" />
        <circle cx="90" cy="90" r="88" fill="none" stroke="oklch(0.55 0.11 55)" strokeWidth="1.5" opacity="0.5" />
        {Array.from({ length: n }, (_, i) => {
          const on = shaded.has(i);
          return (
            <g key={i}>
              <path
                d={slicePath(i, n)}
                role="button"
                tabIndex={0}
                aria-pressed={on}
                aria-label={`Slice ${i + 1} of ${n}`}
                onClick={() => onToggle(i)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onToggle(i))}
                className="cursor-pointer outline-none transition-[fill] duration-200 hover:brightness-95 focus-visible:stroke-foreground"
                fill={on ? "var(--tomato)" : "var(--cheese)"}
                stroke="oklch(0.6 0.11 60)"
                strokeWidth="2.5"
              />
              {on && [[0.55, 0], [0.8, 0.22], [0.78, -0.22]].map(([t, o], k) => {
                if (n > 6 && k > 0) return null; // small slices: one pepperoni
                const [x, y] = slicePoint(i, n, t!, n > 6 ? 0 : o!);
                return <circle key={k} cx={x} cy={y} r={n > 6 ? 5 : 6.5} fill="oklch(0.5 0.17 28)" stroke="oklch(0.42 0.15 28)" strokeWidth="1" pointerEvents="none" />;
              })}
            </g>
          );
        })}
      </svg>
      <figcaption className={cn("font-display text-3xl font-semibold", active ? "text-primary-deep" : "text-muted-foreground")}>1/{n}</figcaption>
    </figure>
  );
}

/** Reusable fraction comparison template; content comes from a LearningActivity. */
export function FractionMiniLesson({ activity, lang, onAnswer, compact }: { activity: LearningActivity; lang: Lang; onAnswer?: (index: number, correct: boolean) => void; compact?: boolean }) {
  const [a, b] = activity.denominators;
  const [focus, setFocus] = useState<number>(a);
  const [shadedA, setShadedA] = useState<Set<number>>(new Set([0]));
  const [shadedB, setShadedB] = useState<Set<number>>(new Set([0]));
  const [picked, setPicked] = useState<number | null>(null);
  const quiz = activity.quiz;
  const correct = picked === quiz.correctIndex;

  const toggle = (set: Set<number>, setter: (s: Set<number>) => void) => (i: number) => {
    const next = new Set(set);
    if (next.has(i)) next.delete(i); else next.add(i);
    setter(next);
  };
  const fracA = shadedA.size / a, fracB = shadedB.size / b;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-xl font-semibold">{activity.title[lang]}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{activity.instructions[lang]}</p>
      </div>

      <div className="inline-flex rounded-lg border bg-muted p-1" role="tablist" aria-label={t(lang, "compare")}>
        {[a, b].map((d) => (
          <button key={d} role="tab" aria-selected={focus === d} onClick={() => setFocus(d)}
            className={cn("rounded-md px-5 py-1.5 text-sm font-semibold transition-all", focus === d ? "bg-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground")}>
            1/{d}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Pizza n={a} shaded={shadedA} onToggle={toggle(shadedA, setShadedA)} active={focus === a} label={`${t(lang, "whole")} 1/${a}`} />
        <Pizza n={b} shaded={shadedB} onToggle={toggle(shadedB, setShadedB)} active={focus === b} label={`${t(lang, "whole")} 1/${b}`} />
      </div>

      <div className="space-y-2" aria-live="polite">
        {[{ d: a, s: shadedA.size, f: fracA }, { d: b, s: shadedB.size, f: fracB }].map((row) => (
          <div key={row.d} className="flex items-center gap-3">
            <span className="w-12 text-right text-sm font-semibold tabular-nums">{row.s}/{row.d}</span>
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-gradient-to-r from-alert to-tomato transition-all duration-500" style={{ width: `${row.f * 100}%` }} />
            </div>
          </div>
        ))}
        <p className="text-sm text-muted-foreground">
          {fracA === fracB ? `${shadedA.size}/${a} = ${shadedB.size}/${b}` : fracA > fracB ? `${shadedA.size}/${a} ${t(lang, "isBigger")} ${shadedB.size}/${b}` : `${shadedB.size}/${b} ${t(lang, "isBigger")} ${shadedA.size}/${a}`}
        </p>
      </div>

      <p className="rounded-xl border-l-4 border-sky bg-sky-soft p-4 text-[15px] leading-relaxed">{activity.explanation[lang]}</p>

      {!compact && (
        <div className="rounded-2xl border bg-gradient-to-br from-alert-soft/60 to-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-alert-foreground">{t(lang, "quiz")}</p>
          <p className="mt-1 font-semibold">{quiz.prompt[lang]}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {quiz.options.map((opt, i) => (
              <button key={opt} disabled={correct} onClick={() => { setPicked(i); onAnswer?.(i, i === quiz.correctIndex); }}
                className={cn("flex items-center justify-between rounded-xl border bg-card px-4 py-3.5 text-left font-display text-lg font-semibold shadow-soft transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  picked === i && i === quiz.correctIndex && "border-success bg-success-soft",
                  picked === i && i !== quiz.correctIndex && "border-destructive/50 bg-destructive/5",
                  picked !== i && "hover:bg-muted")}>
                {opt}
                {picked === i && (i === quiz.correctIndex ? <Check className="h-4 w-4 text-success" /> : <X className="h-4 w-4 text-destructive" />)}
              </button>
            ))}
          </div>
          {picked !== null && (
            <div className={cn("mt-3 flex items-center justify-between gap-3 rounded-lg p-3 text-sm", correct ? "bg-success-soft" : "bg-muted")} role="status">
              <span className="flex items-center gap-2">{correct && <PartyPopper className="h-4 w-4 text-success" />}{correct ? quiz.feedback[lang].correct : quiz.feedback[lang].incorrect}</span>
              {!correct && <Button variant="ghost" size="sm" onClick={() => setPicked(null)}><RotateCcw className="h-3.5 w-3.5" />{t(lang, "tryAgain")}</Button>}
            </div>
          )}
          {correct && <p className="mt-3 text-sm font-semibold text-success">✓ {t(lang, "done")}</p>}
        </div>
      )}
    </div>
  );
}
