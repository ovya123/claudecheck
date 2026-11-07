import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CalendarDays, ClipboardList, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/common";
import { LIVE } from "@/lib/config";
import { useAppState } from "@/lib/store";
import { createAssignment, deleteAssignment, saveGrades } from "@/services/mockApi";
import type { Assignment, AssignmentKind } from "@/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/teacher/grades")({
  head: () => ({
    meta: [
      { title: "Assignments & Grades — ClassBridge" },
      { name: "description", content: "Set homework, quizzes and tests, and grade them. Parents see grades and feedback in their own language." },
      { property: "og:title", content: "Assignments & Grades — ClassBridge" },
      { property: "og:description", content: "Set homework, quizzes and tests, and grade them." },
    ],
  }),
  component: Grades,
});

const KINDS: { value: AssignmentKind; label: string; cls: string }[] = [
  { value: "homework", label: "Homework", cls: "bg-sky-soft text-sky" },
  { value: "quiz", label: "Quiz", cls: "bg-primary-soft text-primary-deep" },
  { value: "test", label: "Test", cls: "bg-alert-soft text-alert-foreground" },
  { value: "project", label: "Project", cls: "bg-success-soft text-success" },
];
const kindOf = (k: string) => KINDS.find((x) => x.value === k) ?? KINDS[0]!;

function Grades() {
  const { assignments = [], students } = useAppState();
  const [selected, setSelected] = useState<string | null>(null);
  const current = assignments.find((a) => a.id === selected) ?? assignments[assignments.length - 1];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Assignments & grades</h1>
        <p className="text-muted-foreground">Set homework, quizzes and tests, then grade them. Verified parents see the instructions, grades and your feedback translated into their language.</p>
      </div>
      {!LIVE ? (
        <EmptyState icon={ClipboardList} title="Grades need the live backend" body="Set VITE_API_URL to connect to the ClassBridge server." />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
          <div className="space-y-6">
            <NewAssignment onCreated={(id) => setSelected(id)} />
            <section className="surface p-4">
              <h2 className="px-2 pb-2 text-sm font-semibold text-muted-foreground">All assignments ({assignments.length})</h2>
              {assignments.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">Nothing set yet.</p>}
              <ul className="space-y-1.5">
                {[...assignments].reverse().map((a) => (
                  <li key={a.id}>
                    <button onClick={() => setSelected(a.id)}
                      className={cn("w-full rounded-xl border p-3 text-left transition-colors", current?.id === a.id ? "border-primary bg-primary-soft/50" : "bg-card hover:bg-muted")}>
                      <p className="flex items-center gap-2 font-medium"><span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-semibold", kindOf(a.kind).cls)}>{kindOf(a.kind).label}</span>{a.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {a.gradedCount}/{a.grades.length} graded{a.averagePercent !== null && ` · avg ${Math.round(a.averagePercent)}%`}{a.dueDate && ` · due ${a.dueDate}`}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </div>
          {current ? <Gradebook key={current.id} a={current} /> : (
            <EmptyState icon={ClipboardList} title="No assignment selected" body={students.length ? "Create an assignment to start grading." : "Students appear here once they join the class."} />
          )}
        </div>
      )}
    </div>
  );
}

function NewAssignment({ onCreated }: { onCreated: (id: string) => void }) {
  const [kind, setKind] = useState<AssignmentKind>("homework");
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [due, setDue] = useState("");
  const [max, setMax] = useState("10");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const maxPoints = Number(max);
    if (!title.trim() || !(maxPoints > 0)) return;
    setBusy(true);
    try {
      const a = await createAssignment({ kind, title: title.trim(), instructions: instructions.trim(), dueDate: due || null, maxPoints });
      setTitle(""); setInstructions(""); setDue("");
      onCreated(a.id);
      toast.success(`${kindOf(kind).label} created`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the assignment");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="surface space-y-4 p-5">
      <h2 className="flex items-center gap-2 font-semibold"><Plus className="h-4 w-4 text-primary" /> New assignment</h2>
      <div className="grid grid-cols-4 gap-1 rounded-xl bg-muted p-1">
        {KINDS.map((k) => (
          <button type="button" key={k.value} onClick={() => setKind(k.value)} aria-pressed={kind === k.value}
            className={cn("rounded-lg px-1 py-1.5 text-xs font-semibold transition-all", kind === k.value ? "bg-card shadow-soft" : "text-muted-foreground hover:text-foreground")}>
            {k.label}
          </button>
        ))}
      </div>
      <div className="space-y-1.5"><Label htmlFor="a-title">Title</Label><Input id="a-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Fractions worksheet 1" /></div>
      <div className="space-y-1.5"><Label htmlFor="a-ins">Instructions</Label><Textarea id="a-ins" rows={4} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="What should students do? Parents see this translated." /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label htmlFor="a-due">Due date</Label><Input id="a-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="a-max">Max points</Label><Input id="a-max" type="number" min={1} value={max} onChange={(e) => setMax(e.target.value)} /></div>
      </div>
      <Button type="submit" className="w-full" disabled={busy || !title.trim()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create</Button>
    </form>
  );
}

type Draft = Record<string, { score?: string; feedback?: string }>;

function Gradebook({ a }: { a: Assignment }) {
  // Only edited cells live here, so background refreshes don't wipe what the teacher is typing.
  const [draft, setDraft] = useState<Draft>({});
  const [busy, setBusy] = useState(false);
  const dirty = Object.keys(draft).length > 0;
  const k = kindOf(a.kind);
  const set = (id: string, field: "score" | "feedback", v: string) => setDraft((d) => ({ ...d, [id]: { ...d[id], [field]: v } }));

  async function save() {
    const rows = a.grades.filter((g) => draft[g.studentId]).map((g) => {
      const d = draft[g.studentId]!;
      const raw = d.score ?? (g.score === null ? "" : String(g.score));
      return { studentId: g.studentId, score: raw.trim() === "" ? null : Number(raw), feedback: d.feedback ?? g.feedback };
    });
    if (rows.some((r) => r.score !== null && (Number.isNaN(r.score) || r.score < 0 || r.score > a.maxPoints))) {
      toast.error(`Scores must be between 0 and ${a.maxPoints}`);
      return;
    }
    setBusy(true);
    try {
      await saveGrades(a.id, rows);
      setDraft({});
      toast.success("Grades saved. Parents will see them in their language.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save grades");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete "${a.title}" and all its grades?`)) return;
    try { await deleteAssignment(a.id); toast("Assignment deleted"); } catch (e) { toast.error(e instanceof Error ? e.message : "Could not delete"); }
  }

  return (
    <section className="surface overflow-hidden">
      <div className="border-b bg-gradient-to-r from-primary-soft/60 to-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", k.cls)}>{k.label}</span>
            <h2 className="mt-2 font-display text-2xl font-semibold">{a.title}</h2>
            <p className="mt-1 flex flex-wrap gap-x-4 text-sm text-muted-foreground">
              <span>Out of {a.maxPoints}</span>
              {a.dueDate && <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> Due {a.dueDate}</span>}
              {a.averagePercent !== null && <span>Class average {Math.round(a.averagePercent)}%</span>}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void remove()}><Trash2 className="h-4 w-4" /> Delete</Button>
            <Button size="sm" onClick={() => void save()} disabled={!dirty || busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save grades</Button>
          </div>
        </div>
        {a.instructions && <p className="mt-4 whitespace-pre-line rounded-xl bg-card/80 p-3 text-sm">{a.instructions}</p>}
      </div>
      {a.grades.length === 0 ? (
        <div className="p-6"><EmptyState icon={ClipboardList} title="No students yet" body="Students appear here once they join with the class code." /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="px-6 py-3 font-semibold">Student</th><th className="px-3 py-3 font-semibold">Score</th><th className="px-6 py-3 font-semibold">Feedback (parents see it translated)</th></tr>
            </thead>
            <tbody className="divide-y">
              {a.grades.map((g) => {
                const d = draft[g.studentId];
                const score = d?.score ?? (g.score === null ? "" : String(g.score));
                const pct = score !== "" && !Number.isNaN(Number(score)) ? (100 * Number(score)) / a.maxPoints : null;
                return (
                  <tr key={g.studentId} className={cn(d && "bg-alert-soft/30")}>
                    <td className="px-6 py-3 font-medium">{g.studentName}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <Input aria-label={`Score for ${g.studentName}`} type="number" min={0} max={a.maxPoints} step="0.5" value={score}
                          onChange={(e) => set(g.studentId, "score", e.target.value)} className="h-9 w-20 text-right tabular-nums" />
                        <span className="whitespace-nowrap text-muted-foreground">/ {a.maxPoints}</span>
                        {pct !== null && <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", pct >= 80 ? "bg-success-soft text-success" : pct >= 60 ? "bg-alert-soft text-alert-foreground" : "bg-tomato/10 text-tomato")}>{Math.round(pct)}%</span>}
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <Input aria-label={`Feedback for ${g.studentName}`} value={d?.feedback ?? g.feedback} placeholder="e.g. Mixed up numerator and denominator"
                        onChange={(e) => set(g.studentId, "feedback", e.target.value)} className="h-9 min-w-[240px]" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
