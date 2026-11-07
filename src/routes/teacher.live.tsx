import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Copy, Hourglass, Inbox, Lightbulb, Radar, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DemoBadge, EmptyState, LangChip, timeAgo } from "@/components/common";
import { MisconceptionCard, RadarVisual } from "@/components/radar/MisconceptionCard";
import { useAppState } from "@/lib/store";
import { markAnswered } from "@/services/mockApi";

export const Route = createFileRoute("/teacher/live")({
  head: () => ({
    meta: [
      { title: "Live Session — ClassBridge" },
      { name: "description", content: "Incoming student questions and the live Misconception Radar." },
      { property: "og:title", content: "Live Session — ClassBridge" },
      { property: "og:description", content: "Incoming student questions and the live Misconception Radar." },
    ],
  }),
  component: Live,
});

function useNow() {
  const [now, setNow] = useState(0);
  useEffect(() => { setNow(Date.now()); const i = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(i); }, []);
  return now;
}

function Live() {
  const { session, students, questions, misconceptions } = useAppState();
  const now = useNow();
  const pending = questions.filter((q) => q.status === "pending").sort((a, b) => b.createdAt - a.createdAt);
  const feed = [...questions].sort((a, b) => b.createdAt - a.createdAt);
  const analyzedCount = questions.filter((q) => q.misconceptionId).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium">{session.status === "live" ? <><span className="live-dot" /> Live session</> : <span className="text-muted-foreground capitalize">Session {session.status}</span>}</div>
          <h1 className="mt-1 font-display text-3xl font-semibold">{session.title}</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="surface flex items-center gap-3 px-4 py-2">
            <span className="text-xs text-muted-foreground">Code</span>
            <span className="font-mono text-lg font-semibold tracking-[0.2em]">{session.joinCode}</span>
            <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Copy join code" onClick={() => { navigator.clipboard?.writeText(session.joinCode); toast.success("Copied"); }}><Copy className="h-3.5 w-3.5" /></Button>
          </div>
          <div className="surface flex items-center gap-2 px-4 py-2.5 text-sm"><Users className="h-4 w-4 text-sky" /><b>{students.length}</b> joined</div>
        </div>
      </div>

      <section className="surface overflow-hidden" aria-labelledby="radar-h">
        <div className="grid lg:grid-cols-[300px_1fr]">
          <div className="border-b bg-foreground p-6 text-background lg:border-b-0 lg:border-r">
            <h2 id="radar-h" className="flex items-center gap-2 font-semibold"><Radar className="h-4 w-4" /> Misconception Radar</h2>
            <p className="mt-1 text-sm opacity-70">Questions grouped by the idea behind them, across languages.</p>
            <div className="mx-auto mt-4 aspect-square max-w-[240px] rounded-full bg-background p-2"><RadarVisual items={misconceptions.map((m) => ({ label: m.id, value: m.questionIds.length, severity: m.severity }))} /></div>
            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div><dt className="opacity-60">Grouped</dt><dd className="font-display text-2xl">{analyzedCount}</dd></div>
              <div><dt className="opacity-60">Pending</dt><dd className="font-display text-2xl">{pending.length}</dd></div>
            </dl>
          </div>
          <div className="space-y-3 p-5 sm:p-6">
            <div className="flex items-center justify-between"><p className="text-sm font-semibold">Detected misconceptions</p><DemoBadge label="Sample results — not live AI" /></div>
            {misconceptions.length === 0 ? (
              <EmptyState icon={Radar} title="Nothing detected yet" body="As questions arrive and are analyzed, shared misconceptions will appear here." />
            ) : (
              misconceptions.map((m, i) => <MisconceptionCard key={m.id} m={m} questions={questions} total={questions.length} defaultOpen={i === 0} />)
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="surface p-6">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold"><Hourglass className="h-4 w-4 text-alert" /> Pending analysis</h2>
            <span className="rounded-full bg-alert-soft px-2 py-0.5 text-xs font-semibold text-alert-foreground">{pending.length}</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">New questions wait here until the analysis service is connected.</p>
          <ul className="mt-4 space-y-2">
            {pending.length === 0 && <EmptyState icon={Check} title="All caught up" body="No questions are waiting." />}
            {pending.map((q) => (
              <li key={q.id} className="flex items-start gap-3 rounded-lg border p-3">
                <div className="min-w-0 flex-1"><p className="text-sm">{q.text}</p><p className="mt-1 text-xs text-muted-foreground">{q.studentName} · {now ? timeAgo(q.createdAt, now) : ""}</p></div>
                <Button size="sm" variant="outline" onClick={() => markAnswered(q.id).then(() => toast.success("Marked as answered"))}>Answered</Button>
              </li>
            ))}
          </ul>
        </section>

        <section className="surface p-6">
          <h2 className="flex items-center gap-2 font-semibold"><Inbox className="h-4 w-4 text-primary" /> Incoming questions</h2>
          <ul className="mt-4 max-h-[420px] space-y-1 overflow-y-auto pr-1">
            {feed.map((q) => (
              <li key={q.id} className="flex items-start gap-3 rounded-lg p-2 hover:bg-muted">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-semibold">{q.studentName.slice(0, 2)}</span>
                <div className="min-w-0 flex-1"><p className="text-sm">{q.text}</p><p className="text-xs text-muted-foreground">{q.studentName}{q.status === "answered" && " · answered"}</p></div>
                <LangChip lang={q.detectedLanguage} />
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="surface p-6">
        <h2 className="flex items-center gap-2 font-semibold"><Lightbulb className="h-4 w-4 text-primary" /> Suggested teaching interventions</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {misconceptions.map((m) => (
            <div key={m.id} className="rounded-xl bg-primary-soft/60 p-4">
              <p className="text-xs font-semibold text-accent-foreground">{m.title}</p>
              <p className="mt-2 text-sm">{m.intervention}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
