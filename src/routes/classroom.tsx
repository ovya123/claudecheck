import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AlertCircle, BookOpen, CheckCircle2, Clock, Copy, Eye, Heart, Lightbulb, Loader2, LogOut, Send, ShieldCheck, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Logo } from "@/components/common";
import { LanguageSwitcher } from "@/components/student/LanguageSwitcher";
import { FractionMiniLesson } from "@/components/lesson/FractionMiniLesson";
import { t, useLang, type ExplanationLevel } from "@/i18n";
import { setStudentId, useAppState, useStudentId } from "@/lib/store";
import { ensureStudentLanguage, generateExplanation, getStudentFamily, submitQuestion, submitQuizResponse, useLesson, useLiveSync, type StudentFamily } from "@/services/mockApi";
import { LIVE } from "@/lib/config";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/classroom")({
  head: () => ({
    meta: [
      { title: "Classroom — ClassBridge" },
      { name: "description", content: "Follow the lesson in your language and ask private questions." },
      { property: "og:title", content: "Classroom — ClassBridge" },
      { property: "og:description", content: "Follow the lesson in your language and ask private questions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Classroom,
});

const MAX = 500;

function Classroom() {
  const lang = useLang();
  const state = useAppState();
  const studentId = useStudentId();
  const navigate = useNavigate();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  useLiveSync("student");
  // LIVE: tell the backend when the student switches language (lesson, answers and activities follow).
  useEffect(() => { if (LIVE && studentId) ensureStudentLanguage(lang).catch(() => {}); }, [lang, studentId]);
  const { lesson, error: lessonError } = useLesson(lang);
  const student = state.students.find((s) => s.id === studentId);

  if (!hydrated) return <div className="mx-auto max-w-6xl space-y-4 p-6"><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>;
  if (!student) {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div className="surface max-w-sm p-8">
          <BookOpen className="mx-auto h-6 w-6 text-primary" />
          <h1 className="mt-3 font-display text-xl font-semibold">Join a class first</h1>
          <p className="mt-1 text-sm text-muted-foreground">Enter your teacher's code to open the classroom.</p>
          <Button asChild className="mt-5"><Link to="/join">Go to join page</Link></Button>
        </div>
      </div>
    );
  }

  const mine = state.questions.filter((q) => q.studentId === student.id).sort((a, b) => b.createdAt - a.createdAt);
  const shared = state.activities.filter((a) => a.status === "shared");

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b bg-card/80 shadow-soft backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Logo />
          {state.session.status === "live" && <span className="hidden items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success sm:flex"><span className="live-dot" />{t(lang, "live")}</span>}
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground md:inline">{t(lang, "hello")}, {student.name}</span>
            <LanguageSwitcher />
            <Button variant="ghost" size="icon" aria-label={t(lang, "leave")} onClick={() => { setStudentId(null); navigate({ to: "/" }); }}><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 pt-6">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary-deep via-primary to-sky p-6 text-primary-foreground shadow-lift sm:p-7">
          <span className="glow -right-10 -top-16 h-56 w-56 bg-alert/40" aria-hidden />
          <div className="dot-grid absolute inset-0 opacity-25 invert" aria-hidden />
          <div className="relative flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-primary-foreground/80">{t(lang, "hello")}, {student.name} 👋</p>
              <h1 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">{state.session.title}</h1>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="rounded-full bg-background/15 px-3 py-1 font-medium backdrop-blur">{state.session.subject}</span>
              {shared.length > 0 && <a href="#act-h" className="rounded-full bg-alert px-3 py-1 font-semibold text-foreground shadow-soft transition-transform hover:-translate-y-0.5">✨ {t(lang, "sharedActivity")}</a>}
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <article className="surface relative overflow-hidden p-6 sm:p-8">
            <span className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-sky to-alert" aria-hidden />
            <h2 className="mt-2 font-display text-3xl font-semibold">{t(lang, "lesson")}</h2>
            <p className="mt-3 inline-flex items-center gap-2 rounded-lg bg-sky-soft px-3 py-1.5 text-sm"><span className="text-muted-foreground">{t(lang, "currentTopic")}:</span> <b>{lesson?.topic ?? state.session.subject}</b></p>
            <div className="mt-6 max-w-prose space-y-6 text-[17px] leading-relaxed">
              {lessonError && <p className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"><AlertCircle className="h-4 w-4" />{lessonError}</p>}
              {!lesson && !lessonError && <div className="space-y-3"><Skeleton className="h-4 w-11/12" /><Skeleton className="h-4 w-4/5" /><Skeleton className="h-4 w-2/3" /></div>}
              {lesson?.sections.map((s, i) => (
                <section key={s.heading || i}>{s.heading && <h2 className="font-semibold">{s.heading}</h2>}<p className="mt-1 whitespace-pre-line text-foreground/85">{s.body}</p></section>
              ))}
            </div>
            {state.session.notes && (
              <aside className="mt-6 rounded-xl border-l-4 border-primary bg-muted p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t(lang, "notes")}</p>
                <p className="mt-1 text-sm">{state.session.notes}</p>
              </aside>
            )}
          </article>

          <ExplanationPanel />

          <section className="surface p-6" aria-labelledby="act-h">
            <h2 id="act-h" className="flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4 text-primary" /> {t(lang, "sharedActivity")}</h2>
            {shared.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{t(lang, "noActivity")}</p>
            ) : (
              <div className="mt-5 space-y-8">
                {shared.map((a) => (
                  <FractionMiniLesson key={a.id + lang} activity={a} lang={lang}
                    onAnswer={(i) => submitQuizResponse({ activityId: a.id, studentId: student.id, selectedIndex: i })} />
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:h-fit">
          <QuestionComposer studentId={student.id} studentName={student.name} />
          <section className="surface p-6">
            <h2 className="font-semibold">{t(lang, "yourQuestions")}</h2>
            {mine.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{t(lang, "noQuestions")}</p> : (
              <ul className="mt-3 space-y-2">
                {mine.map((q) => (
                  <li key={q.id} className="rounded-xl border bg-muted/30 p-3.5">
                    <p className="whitespace-pre-wrap text-sm">{q.text}</p>
                    {q.answer && <p className="mt-2 whitespace-pre-line rounded-md bg-sky-soft p-2.5 text-sm leading-relaxed">{q.answer}</p>}
                    <p className={cn("mt-2 inline-flex items-center gap-1 text-xs font-medium", q.status === "answered" ? "text-success" : q.status === "analyzed" ? "text-sky" : "text-alert-foreground")}>
                      {q.status === "answered" ? <><CheckCircle2 className="h-3 w-3" />{t(lang, "answered")}</> : q.status === "analyzed" ? <><Eye className="h-3 w-3" />{t(lang, "seen")}</> : <><Clock className="h-3 w-3" />{t(lang, "pending")}</>}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {LIVE && <FamilyCard />}
        </aside>
      </main>
    </div>
  );
}

function FamilyCard() {
  const lang = useLang();
  const [family, setFamily] = useState<StudentFamily | null>(null);
  useEffect(() => {
    const load = () => getStudentFamily().then(setFamily).catch(() => {});
    load();
    const id = window.setInterval(load, 8000);
    return () => window.clearInterval(id);
  }, []);
  if (!family) return null;
  const statusText = { pending: t(lang, "familyWaiting"), verified: t(lang, "familyVerified"), rejected: t(lang, "familyRejected") };
  const statusCls = { pending: "bg-alert-soft text-alert-foreground", verified: "bg-success-soft text-success", rejected: "bg-destructive/10 text-destructive" };
  return (
    <section className="surface bg-gradient-to-br from-alert-soft/50 to-card to-50% p-6">
      <h2 className="flex items-center gap-2 font-semibold"><Heart className="h-4 w-4 text-alert" /> {t(lang, "family")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t(lang, "familyHint")}</p>
      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-dashed border-alert/50 bg-card px-4 py-3">
        <span className="font-mono text-2xl font-semibold tracking-[0.2em]" data-testid="family-code">{family.familyCode}</span>
        <Button size="icon" variant="ghost" aria-label="Copy" onClick={() => { navigator.clipboard?.writeText(family.familyCode).catch(() => {}); toast.success(t(lang, "copied")); }}><Copy className="h-4 w-4" /></Button>
      </div>
      {family.parents.length > 0 && (
        <ul className="mt-3 space-y-2">
          {family.parents.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-muted-foreground" />{p.name} · {p.relation}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", statusCls[p.status])}>{statusText[p.status]}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function QuestionComposer({ studentId, studentName }: { studentId: string; studentName: string }) {
  const lang = useLang();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const len = text.length;
  const valid = text.trim().length > 0 && len <= MAX;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    try {
      await submitQuestion({ studentId, studentName, text }); // sent exactly as typed
      setText("");
      toast.success("✓");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send your question.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="surface bg-gradient-to-b from-alert-soft/70 to-card to-45% p-6">
      <h2 className="flex items-center gap-2 font-semibold"><Lightbulb className="h-4 w-4 text-alert" /> {t(lang, "askPrivately")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t(lang, "askHint")}</p>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder={t(lang, "placeholder")} aria-label={t(lang, "askPrivately")}
        className="mt-4 resize-none text-[15px]" spellCheck={false} autoCorrect="off" onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(e); }} />
      <div className="mt-3 flex items-center justify-between">
        <span className={cn("text-xs tabular-nums", len > MAX ? "text-destructive" : "text-muted-foreground")}>{len}/{MAX} {t(lang, "chars")}</span>
        <Button type="submit" disabled={!valid || busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {t(lang, "submit")}</Button>
      </div>
    </form>
  );
}

function ExplanationPanel() {
  const lang = useLang();
  const [level, setLevel] = useState<ExplanationLevel>("standard");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [lines, setLines] = useState<string[]>([]);

  const load = useCallback(async (lv: ExplanationLevel) => {
    setStatus("loading");
    try {
      setLines(await generateExplanation({ lang, level: lv }));
      setStatus("ready");
    } catch { setStatus("error"); }
  }, [lang]);

  useEffect(() => { load(level); }, [level, load]);

  return (
    <section className="surface overflow-hidden" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-gradient-to-r from-primary-soft to-sky-soft/60 px-6 py-4">
        <h2 className="flex items-center gap-2 font-semibold"><Wand2 className="h-4 w-4 text-primary" /> {t(lang, "explanation")}</h2>
        {!LIVE && <span className="text-[11px] text-muted-foreground">{t(lang, "sample")}</span>}
      </div>
      <div className="min-h-[160px] p-6">
        {status === "loading" && <div className="space-y-3" aria-label={t(lang, "loading")}><Skeleton className="h-4 w-11/12" /><Skeleton className="h-4 w-4/5" /><Skeleton className="h-4 w-2/3" /><p className="pt-1 text-xs text-muted-foreground">{t(lang, "loading")}</p></div>}
        {status === "error" && (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
            <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4" />{t(lang, "error")}</span>
            <Button size="sm" variant="outline" onClick={() => load(level)}>{t(lang, "retry")}</Button>
          </div>
        )}
        {status === "ready" && (
          <ol className="space-y-3">
            {lines.map((l, i) => (
              <li key={i} className="flex gap-3 text-[15px] leading-relaxed animate-in fade-in slide-in-from-bottom-1" style={{ animationDelay: `${i * 60}ms` }}>
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-sky text-xs font-semibold text-primary-foreground shadow-soft">{i + 1}</span>
                <span>{l.split(/(\d+\/\d+)/).map((part, j) => /\d+\/\d+/.test(part) ? <span key={j} className="rounded bg-muted px-1 font-mono font-semibold">{part}</span> : part)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
      <div className="flex flex-wrap gap-2 border-t px-6 py-4">
        {(["standard", "simple", "example"] as const).map((lv) => (
          <Button key={lv} size="sm" variant={level === lv ? "default" : "outline"} onClick={() => (level === lv ? load(lv) : setLevel(lv))}>
            {lv === "standard" ? t(lang, "explainSimply") : lv === "simple" ? t(lang, "moreSimply") : t(lang, "example")}
          </Button>
        ))}
      </div>
    </section>
  );
}
