import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BookOpenCheck, CheckCircle2, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common";
import { FractionMiniLesson } from "@/components/lesson/FractionMiniLesson";
import { LANGUAGES } from "@/i18n";
import { useAppState } from "@/lib/store";
import { shareActivity } from "@/services/mockApi";
import type { Lang } from "@/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/teacher/activities")({
  validateSearch: (s: Record<string, unknown>): { id?: string | undefined } => ({ id: typeof s["id"] === "string" ? s["id"] : undefined }),
  head: () => ({
    meta: [
      { title: "Learning Activities — ClassBridge" },
      { name: "description", content: "Preview interactive mini-lessons and share them with your class." },
      { property: "og:title", content: "Learning Activities — ClassBridge" },
      { property: "og:description", content: "Preview interactive mini-lessons and share them with your class." },
    ],
  }),
  component: Activities,
});

function Activities() {
  const { activities, misconceptions, quizResponses } = useAppState();
  const { id } = Route.useSearch();
  const [selected, setSelected] = useState<string | undefined>(id);
  const [lang, setLang] = useState<Lang>("en");
  const [busy, setBusy] = useState(false);
  const act = activities.find((a) => a.id === selected) ?? activities[0];

  if (!act) return <EmptyState icon={BookOpenCheck} title="No activities yet" body="Generate a mini-lesson from a misconception on the radar." />;
  const mis = misconceptions.find((m) => m.id === act.misconceptionId);
  const responses = quizResponses.filter((r) => r.activityId === act.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Learning activities</h1>
        <p className="text-muted-foreground">Preview a mini-lesson as students will see it, then share it with the class.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <ul className="space-y-2">
          {activities.map((a) => (
            <li key={a.id}>
              <button onClick={() => setSelected(a.id)} className={cn("w-full rounded-xl border p-4 text-left transition-colors", a.id === act.id ? "border-primary bg-primary-soft/50" : "bg-card hover:bg-muted")}>
                <p className="font-medium">{a.title.en}</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  {a.status === "shared" ? <><CheckCircle2 className="h-3 w-3 text-success" /> Shared with class</> : "Draft · not shared"}
                </p>
              </button>
            </li>
          ))}
        </ul>
        <div className="surface p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Intervention preview</p>
              {mis && <p className="mt-1 text-sm">For: <span className="font-medium">{mis.title}</span></p>}
            </div>
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-lg border bg-muted p-1" aria-label="Preview language">
                {LANGUAGES.map((l) => (
                  <button key={l.code} onClick={() => setLang(l.code)} className={cn("rounded-md px-2.5 py-1 text-xs font-semibold", lang === l.code ? "bg-card shadow-soft" : "text-muted-foreground")}>{l.native}</button>
                ))}
              </div>
              {act.status === "shared" ? (
                <Button variant="outline" disabled><CheckCircle2 className="h-4 w-4" /> Shared</Button>
              ) : (
                <Button disabled={busy} onClick={async () => { setBusy(true); try { await shareActivity(act.id); toast.success("Shared with class — students see it now"); } catch (e) { toast.error(e instanceof Error ? e.message : "Could not share"); } finally { setBusy(false); } }}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Share with class
                </Button>
              )}
            </div>
          </div>
          <div className="pt-6"><FractionMiniLesson key={act.id + lang} activity={act} lang={lang} /></div>
          {act.status === "shared" && (
            <p className="mt-6 text-sm text-muted-foreground">{responses.length} quiz {responses.length === 1 ? "response" : "responses"} so far · {responses.filter((r) => r.correct).length} correct</p>
          )}
        </div>
      </div>
    </div>
  );
}
