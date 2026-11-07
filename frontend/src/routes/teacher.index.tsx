import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, MessageSquareText, Plus, Radar, Users } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { DemoBadge, LangChip, StatCard } from "@/components/common";
import { RadarVisual } from "@/components/radar/MisconceptionCard";
import { useAppState } from "@/lib/store";
import { demoQuestionTimeline } from "@/data/demo";
import { LIVE } from "@/lib/config";
import type { StudentQuestion } from "@/types";

/** Cumulative questions per 3-minute bucket since the first question (LIVE mode). */
function questionTimeline(questions: StudentQuestion[]) {
  if (questions.length === 0) return [{ t: "0′", questions: 0 }];
  const times = questions.map((q) => q.createdAt).sort((a, b) => a - b);
  const start = times[0]!;
  const lastMin = Math.ceil((times[times.length - 1]! - start) / 60000);
  const step = Math.max(1, Math.ceil(lastMin / 8));
  const out = [];
  for (let m = 0; m <= lastMin + step; m += step) out.push({ t: `${m}′`, questions: times.filter((x) => x <= start + m * 60000).length });
  return out;
}

export const Route = createFileRoute("/teacher/")({
  head: () => ({
    meta: [
      { title: "Teacher Overview — ClassBridge" },
      { name: "description", content: "Your classroom at a glance: students, questions and detected misconceptions." },
      { property: "og:title", content: "Teacher Overview — ClassBridge" },
      { property: "og:description", content: "Your classroom at a glance: students, questions and detected misconceptions." },
    ],
  }),
  component: Overview,
});

function Overview() {
  const { session, students, questions, misconceptions } = useAppState();
  const recent = [...questions].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Good morning, Ms. Sharma</p>
          <h1 className="font-display text-3xl font-semibold">Here's your classroom today</h1>
        </div>
        <Button asChild><Link to="/teacher/sessions"><Plus className="h-4 w-4" /> Create new session</Link></Button>
      </div>

      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-foreground via-foreground to-primary-deep p-6 text-background shadow-lift sm:p-8">
        <span className="glow -right-10 -top-20 h-64 w-64 bg-primary/50" aria-hidden />
        <span className="glow bottom-[-5rem] left-1/4 h-48 w-48 bg-sky/25" aria-hidden />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-background/80">
              {session.status === "live" ? <><span className="live-dot" /> Live now</> : <span className="capitalize">Session {session.status}</span>}
            </div>
            <h2 className="mt-2 font-display text-3xl font-semibold">{session.title}</h2>
            <p className="text-background/70">{session.subject}</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="rounded-xl border border-dashed border-background/30 bg-background/10 px-5 py-3 text-center backdrop-blur">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-background/60">Join code</p>
              <p className="font-mono text-3xl font-semibold tracking-[0.25em]">{session.joinCode}</p>
            </div>
            <Button asChild variant="secondary" size="lg"><Link to="/teacher/live">Open session <ArrowRight className="h-4 w-4" /></Link></Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Students joined" value={students.length} icon={Users} tone="sky" />
        <StatCard label="Questions submitted" value={questions.length} hint={`${questions.filter((q) => q.status === "pending").length} pending analysis`} icon={MessageSquareText} />
        <StatCard label="Misconceptions detected" value={misconceptions.length} hint={LIVE ? "Detected by AI" : "Sample results"} icon={AlertTriangle} tone="alert" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="surface p-6">
          <div className="flex items-center justify-between"><h3 className="font-semibold">Questions over the lesson</h3><DemoBadge /></div>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={LIVE ? questionTimeline(questions) : demoQuestionTimeline} margin={{ left: -20, right: 8, top: 8 }}>
                <defs><linearGradient id="qg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--primary)" stopOpacity={0.3} /><stop offset="1" stopColor="var(--primary)" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="t" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10 }} />
                <Area type="monotone" dataKey="questions" stroke="var(--primary)" strokeWidth={2} fill="url(#qg)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <Link to="/teacher/radar" className="surface group flex flex-col p-6 transition-shadow hover:shadow-lift">
          <div className="flex items-center justify-between"><h3 className="flex items-center gap-2 font-semibold"><Radar className="h-4 w-4 text-primary" /> Live radar</h3><ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></div>
          <div className="mx-auto mt-2 aspect-square w-full max-w-[220px]"><RadarVisual items={misconceptions.map((m) => ({ label: m.id, value: m.questionIds.length, severity: m.severity }))} /></div>
          <p className="mt-2 text-sm text-muted-foreground">{misconceptions[0]?.title ?? "No misconceptions yet"}</p>
        </Link>
      </div>

      <div className="surface p-6">
        <div className="flex items-center justify-between"><h3 className="font-semibold">Recent student questions</h3><Link to="/teacher/live" className="text-sm font-medium text-primary hover:underline">View all</Link></div>
        <ul className="mt-4 divide-y">
          {recent.map((q) => (
            <li key={q.id} className="flex items-start gap-3 py-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">{q.studentName.slice(0, 2)}</span>
              <div className="min-w-0 flex-1"><p className="text-sm">{q.text}</p><p className="mt-1 text-xs text-muted-foreground">{q.studentName}</p></div>
              <LangChip lang={q.detectedLanguage} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
