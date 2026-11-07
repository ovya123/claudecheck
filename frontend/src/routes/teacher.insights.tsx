import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, BarChart3, CheckCircle2, ClipboardCheck, MessageSquareText, Send } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DemoBadge, EmptyState, StatCard } from "@/components/common";
import { useAppState } from "@/lib/store";

export const Route = createFileRoute("/teacher/insights")({
  head: () => ({
    meta: [
      { title: "Insights — ClassBridge" },
      { name: "description", content: "Questions, misconception categories, shared interventions and quiz results." },
      { property: "og:title", content: "Insights — ClassBridge" },
      { property: "og:description", content: "Questions, misconception categories, shared interventions and quiz results." },
    ],
  }),
  component: Insights,
});

const tip = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10 };

function Insights() {
  const { questions, misconceptions, activities, quizResponses } = useAppState();
  const shared = activities.filter((a) => a.status === "shared").length;
  const correct = quizResponses.filter((r) => r.correct).length;
  const pct = quizResponses.length ? Math.round((correct / quizResponses.length) * 100) : null;
  const byMis = misconceptions.map((m) => ({ name: m.title.split(" ").slice(0, 3).join(" ") + "…", count: m.questionIds.length }));
  const langCounts = ["English", "Hindi", "French", "Hinglish", "unknown"].map((l) => ({ name: l === "unknown" ? "Not detected" : l, value: questions.filter((q) => q.detectedLanguage === l).length })).filter((d) => d.value);
  const colors = ["var(--chart-2)", "var(--chart-1)", "var(--chart-4)", "var(--chart-3)", "var(--muted-foreground)"];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="font-display text-3xl font-semibold">Insights</h1><p className="text-muted-foreground">What this session tells you so far.</p></div>
        <DemoBadge label="Includes demo data" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Questions" value={questions.length} icon={MessageSquareText} />
        <StatCard label="Misconception categories" value={misconceptions.length} icon={AlertTriangle} tone="alert" />
        <StatCard label="Interventions shared" value={shared} icon={Send} tone="sky" />
        <StatCard label="Quiz submissions" value={quizResponses.length} icon={ClipboardCheck} />
        <StatCard label="Correct answers" value={pct === null ? "—" : `${pct}%`} hint={pct === null ? "No quiz data yet" : `${correct} of ${quizResponses.length}`} icon={CheckCircle2} tone="success" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="surface p-6">
          <div className="flex items-center justify-between"><h2 className="font-semibold">Questions per misconception</h2><DemoBadge /></div>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byMis} layout="vertical" margin={{ left: 10, right: 16 }}>
                <CartesianGrid stroke="var(--border)" horizontal={false} />
                <XAxis type="number" allowDecimals={false} stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" width={140} stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tip} cursor={{ fill: "var(--muted)" }} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]} fill="var(--primary)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="surface p-6">
          <h2 className="font-semibold">Question languages</h2>
          <div className="mt-4 grid h-64 grid-cols-[1fr_auto] items-center gap-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={langCounts} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={2}>
                  {langCounts.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                </Pie>
                <Tooltip contentStyle={tip} />
              </PieChart>
            </ResponsiveContainer>
            <ul className="space-y-2 text-sm">
              {langCounts.map((d, i) => <li key={d.name} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: colors[i % colors.length] }} />{d.name} <b>{d.value}</b></li>)}
            </ul>
          </div>
        </div>
      </div>
      <div className="surface p-6">
        <h2 className="font-semibold">Student understanding</h2>
        <p className="mt-1 text-sm text-muted-foreground">Shown only from real quiz submissions in this session — nothing is estimated.</p>
        <div className="mt-4">
          {quizResponses.length === 0 ? (
            <EmptyState icon={BarChart3} title="No assessment data yet" body="Share a mini-lesson; once students answer its quick check, results appear here." />
          ) : (
            <div className="space-y-3">
              {[{ label: "Correct", v: correct, cls: "bg-success" }, { label: "Incorrect", v: quizResponses.length - correct, cls: "bg-alert" }].map((r) => (
                <div key={r.label} className="flex items-center gap-3 text-sm">
                  <span className="w-20">{r.label}</span>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted"><div className={`h-full ${r.cls}`} style={{ width: `${(r.v / quizResponses.length) * 100}%` }} /></div>
                  <span className="w-8 text-right tabular-nums">{r.v}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
