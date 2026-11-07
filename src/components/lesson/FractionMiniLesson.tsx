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

function Pizza({ n, shaded, onToggle, active, label }: { n: number; shaded: Set<number>; onToggle: (i: number) => void; active: boolean; label: string }) {
  return (
    <figure className={cn("flex flex-col items-center gap-2 rounded-xl border p-4 transition-all", active ? "border-primary bg-primary-soft/50 shadow-soft" : "bg-card opacity-80")}>
      <svg viewBox="0 0 180 180" className="h-40 w-40 sm:h-48 sm:w-48" role="group" aria-label={label}>
        <circle cx="90" cy="90" r="86" fill="var(--alert-soft)" stroke="var(--alert)" strokeWidth="3" />
        {Array.from({ length: n }, (_, i) => (
          <path
            key={i}
            d={slicePath(i, n)}
            role="button"
            tabIndex={0}
            aria-pressed={shaded.has(i)}
            aria-label={`Slice ${i + 1} of ${n}`}
            onClick={() => onToggle(i)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onToggle(i))}
            className="cursor-pointer outline-none transition-[fill] duration-200 focus-visible:stroke-foreground"
            fill={shaded.has(i) ? "var(--primary)" : "var(--card)"}
            stroke="var(--alert)"
            strokeWidth="2"
          />
        ))}
      </svg>
      <figcaption className="font-display text-2xl font-semibold">1/{n}</figcaption>
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
            className={cn("rounded-md px-4 py-1.5 text-sm font-semibold transition-colors", focus === d ? "bg-card text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground")}>
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
              <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${row.f * 100}%` }} />
            </div>
          </div>
        ))}
        <p className="text-sm text-muted-foreground">
          {fracA === fracB ? `${shadedA.size}/${a} = ${shadedB.size}/${b}` : fracA > fracB ? `${shadedA.size}/${a} ${t(lang, "isBigger")} ${shadedB.size}/${b}` : `${shadedB.size}/${b} ${t(lang, "isBigger")} ${shadedA.size}/${a}`}
        </p>
      </div>

      <p className="rounded-xl bg-sky-soft p-4 text-[15px] leading-relaxed">{activity.explanation[lang]}</p>

      {!compact && (
        <div className="rounded-xl border p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t(lang, "quiz")}</p>
          <p className="mt-1 font-semibold">{quiz.prompt[lang]}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {quiz.options.map((opt, i) => (
              <button key={opt} disabled={correct} onClick={() => { setPicked(i); onAnswer?.(i, i === quiz.correctIndex); }}
                className={cn("flex items-center justify-between rounded-lg border px-4 py-3 text-left font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
