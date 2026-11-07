import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle, AlertTriangle, BookOpen, CalendarDays, CheckCircle2, ChevronDown, ClipboardList, Clock, GraduationCap, Heart, Hourglass,
  Languages, Lightbulb, Loader2, LogOut, MessageCircleQuestion, RefreshCw, ShieldCheck, ShieldX, Sparkles, Target, XCircle,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Logo } from "@/components/common";
import { FractionMiniLesson } from "@/components/lesson/FractionMiniLesson";
import { isRtl, PARENT_LANGUAGES, pt, relationLabel, RELATIONS, useParentStrings } from "@/i18n/parent";
import { LIVE } from "@/lib/config";
import { getParentCreds } from "@/lib/session";
import {
  getParentOverview, getParentStatus, getParentTips, linkParent, setParentLanguage, signOutParent, translateUiStrings,
  type ParentAssignment, type ParentOverview, type ParentStatus, type ParentTips,
} from "@/services/mockApi";
import type { Lang } from "@/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/parent")({
  head: () => ({
    meta: [
      { title: "Parent Portal — ClassBridge" },
      { name: "description", content: "Parents and guardians see their child's classwork translated into their own language." },
      { property: "og:title", content: "Parent Portal — ClassBridge" },
      { property: "og:description", content: "See your child's classwork in your own language and learn how to help at home." },
    ],
  }),
  component: ParentPortal,
});

const LANG_SHORT: Record<string, string> = { en: "EN", hi: "हि", fr: "FR" };
/** The pizza widget has its own labels in en/hi/fr only. */
const widgetLang = (l: string): Lang => (l === "hi" || l === "fr" ? l : "en");

function LanguagePicker({ lang, onChange, className }: { lang: string; onChange: (l: string) => void; className?: string }) {
  return (
    <Select value={lang} onValueChange={onChange}>
      <SelectTrigger className={cn("h-9 w-auto min-w-[150px] gap-2 bg-card", className)} aria-label={pt(lang, "language")}>
        <Languages className="h-4 w-4 text-primary" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {PARENT_LANGUAGES.map((l) => (
          <SelectItem key={l.code} value={l.code}>{l.native}<span className="ml-1 text-xs text-muted-foreground">· {l.label}</span></SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ParentPortal() {
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState<ParentStatus | null>(null);
  const [lang, setLangState] = useState<string>("en");
  const labelsReady = useParentStrings(lang, translateUiStrings);

  // Restore this device's parent link, then keep its verification status fresh.
  const refresh = useCallback(async () => {
    const s = await getParentStatus().catch(() => getParentCreds() ? "pending" as const : null);
    setStatus(s);
    const c = getParentCreds();
    if (c) setLangState(c.language);
  }, []);
  useEffect(() => {
    setHydrated(true);
    if (LIVE) void refresh();
  }, [refresh]);
  useEffect(() => {
    if (status !== "pending") return;
    const id = window.setInterval(() => void refresh(), 4000);
    return () => window.clearInterval(id);
  }, [status, refresh]);

  async function changeLang(l: string) {
    setLangState(l);
    if (getParentCreds()) await setParentLanguage(l).catch(() => {});
  }
  function signOut() {
    signOutParent();
    setStatus(null);
  }

  return (
    <div className="min-h-screen" dir={isRtl(lang) ? "rtl" : "ltr"} lang={lang}>
      <header className="sticky top-0 z-20 border-b bg-card/80 shadow-soft backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Logo />
          <span className="hidden items-center gap-1.5 rounded-full bg-alert-soft px-2.5 py-1 text-xs font-semibold text-alert-foreground sm:flex">
            <Heart className="h-3 w-3" /> {pt(lang, "portal")}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {!labelsReady && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label={pt(lang, "loading")} />}
            <LanguagePicker lang={lang} onChange={(l) => void changeLang(l)} />
            {status && <Button variant="ghost" size="icon" aria-label={pt(lang, "signOut")} onClick={signOut}><LogOut className="h-4 w-4" /></Button>}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {!LIVE ? (
          <Notice icon={AlertCircle} title={pt(lang, "portal")} body={pt(lang, "needsLive")} />
        ) : !hydrated ? (
          <Skeleton className="mx-auto h-96 max-w-lg" />
        ) : status === null ? (
          <LinkForm lang={lang} onLang={(l) => setLangState(l)} onLinked={(s) => setStatus(s)} />
        ) : status === "pending" ? (
          <Pending lang={lang} />
        ) : status === "rejected" ? (
          <Notice icon={ShieldX} tone="bad" title={pt(lang, "rejectedTitle")} body={pt(lang, "rejectedBody")}
            action={<Button variant="outline" onClick={signOut}>{pt(lang, "useOtherCode")}</Button>} />
        ) : (
          <Dashboard key={lang} lang={lang} />
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------- link form

function LinkForm({ lang, onLang, onLinked }: { lang: string; onLang: (l: string) => void; onLinked: (s: ParentStatus) => void }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [relation, setRelation] = useState<(typeof RELATIONS)[number]>("Mother");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (code.trim().length < 6 || !name.trim()) return;
    setBusy(true);
    try {
      onLinked(await linkParent({ familyCode: code, name: name.trim(), relation, language: lang }));
    } catch (err) {
      setError(err instanceof Error ? err.message : pt(lang, "error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid items-center gap-10 py-6 lg:grid-cols-[1fr_440px]">
      <div className="relative">
        <span className="glow -left-10 top-0 h-64 w-64 bg-alert/25" aria-hidden />
        <p className="relative inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-semibold text-alert-foreground shadow-soft">
          <Heart className="h-3.5 w-3.5" /> {pt(lang, "portal")}
        </p>
        <h1 className="relative mt-5 font-display text-4xl font-semibold leading-tight sm:text-5xl">{pt(lang, "linkTitle")}</h1>
        <p className="relative mt-4 max-w-lg text-lg text-muted-foreground">{pt(lang, "linkSub")}</p>
        <div className="relative mt-8 flex max-w-lg items-start gap-3 rounded-2xl border bg-card/80 p-4 shadow-soft">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p className="text-sm text-muted-foreground">{pt(lang, "privacyNote")}</p>
        </div>
      </div>

      <form onSubmit={submit} className="surface space-y-5 border-t-4 border-t-alert p-7 shadow-lift" noValidate>
        <div className="space-y-2">
          <Label htmlFor="fcode">{pt(lang, "familyCode")}</Label>
          <Input id="fcode" value={code} maxLength={10} autoComplete="off" placeholder="K7MP2QXA"
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
            className="h-14 text-center font-mono text-2xl tracking-[0.3em] uppercase" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pname">{pt(lang, "yourName")}</Label>
          <Input id="pname" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{pt(lang, "relation")}</legend>
          <div className="grid grid-cols-2 gap-2">
            {RELATIONS.map((r) => (
              <button type="button" key={r} onClick={() => setRelation(r)} aria-pressed={relation === r}
                className={cn("rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all", relation === r ? "border-primary bg-primary-soft ring-1 ring-primary" : "bg-card hover:bg-muted")}>
                {relationLabel(lang, r)}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{pt(lang, "language")}</legend>
          <LanguagePicker lang={lang} onChange={onLang} className="h-11 w-full" />
        </fieldset>
        {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={busy || code.length < 6 || !name.trim()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} {pt(lang, "send")}
        </Button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------- waiting / notices

function Pending({ lang }: { lang: string }) {
  const c = getParentCreds();
  return (
    <Notice icon={Hourglass} title={pt(lang, "pendingTitle")}
      body={pt(lang, "pendingBody", { child: c?.childName ?? "", relation: relationLabel(lang, c?.relation ?? "").toLowerCase() })}
      action={<p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{c?.classroomTitle}</p>} />
  );
}

function Notice({ icon: Icon, title, body, action, tone = "neutral" }: {
  icon: React.ComponentType<{ className?: string }>; title: string; body: string; action?: React.ReactNode; tone?: "neutral" | "bad";
}) {
  return (
    <div className="mx-auto max-w-lg py-10">
      <div className="surface relative overflow-hidden p-8 text-center shadow-lift">
        <span className={cn("glow -top-16 left-1/2 h-40 w-40 -translate-x-1/2", tone === "bad" ? "bg-destructive/20" : "bg-alert/30")} aria-hidden />
        <span className={cn("relative mx-auto grid h-14 w-14 place-items-center rounded-2xl", tone === "bad" ? "bg-destructive/10 text-destructive" : "bg-alert-soft text-alert-foreground")}>
          <Icon className="h-6 w-6" />
        </span>
        <h1 className="relative mt-5 font-display text-2xl font-semibold">{title}</h1>
        <p className="relative mt-2 text-muted-foreground">{body}</p>
        {action && <div className="relative mt-6 flex justify-center">{action}</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- verified dashboard

function Dashboard({ lang }: { lang: string }) {
  const [data, setData] = useState<ParentOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    setError(null);
    getParentOverview().then(setData).catch((e: unknown) => setError(e instanceof Error ? e.message : pt(lang, "error")));
  }, [lang]);
  useEffect(() => {
    load();
    const id = window.setInterval(load, 30000);
    return () => window.clearInterval(id);
  }, [load]);

  const c = getParentCreds();
  if (error && !data) {
    return <Notice icon={AlertCircle} tone="bad" title={pt(lang, "error")} body={error} action={<Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4" />{pt(lang, "retry")}</Button>} />;
  }
  if (!data) {
    return <div className="space-y-6"><Skeleton className="h-40 w-full rounded-2xl" /><div className="grid gap-4 sm:grid-cols-3"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div><Skeleton className="h-64 w-full" /></div>;
  }
  const child = { child: data.childName };

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-foreground via-foreground to-primary-deep p-7 text-background shadow-lift sm:p-9">
        <span className="glow -right-10 -top-20 h-64 w-64 bg-alert/40" aria-hidden />
        <span className="glow bottom-[-5rem] left-1/3 h-48 w-48 bg-primary/40" aria-hidden />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-sm text-background/75"><ShieldCheck className="h-4 w-4 text-success" />{pt(lang, "verified")} · {relationLabel(lang, c?.relation ?? "")}</p>
            <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">{pt(lang, "hello")}, {c?.name}</h1>
            <p className="mt-1 text-lg text-background/80">{pt(lang, "headline", child)}</p>
          </div>
          <div className="rounded-xl border border-background/20 bg-background/10 px-4 py-3 backdrop-blur">
            <p className="flex items-center gap-2 font-semibold"><BookOpen className="h-4 w-4" />{data.classroomTitle}</p>
            {data.classroomTopic && <p className="text-sm text-background/70">{data.classroomTopic}</p>}
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={pt(lang, "statGrade")} value={data.gradeSummary["overall"] == null ? "—" : `${Math.round(data.gradeSummary["overall"])}%`} icon={GraduationCap} tone="from-alert-soft/80 text-alert-foreground" />
        <Stat label={pt(lang, "statQuestions")} value={data.stats.questions} icon={MessageCircleQuestion} tone="from-sky-soft/80 text-sky" />
        <Stat label={pt(lang, "statActivities")} value={`${data.stats.activities_done}/${data.stats.activities}`} icon={Sparkles} tone="from-primary-soft/80 text-primary" />
        <Stat label={pt(lang, "statCorrect")} value={data.stats.correct} icon={CheckCircle2} tone="from-success-soft/80 text-success" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <div className="space-y-6">
          <HelpAtHome lang={lang} childName={data.childName} />
          <Grades lang={lang} data={data} />
          <Assignments lang={lang} data={data} />

          <section className="surface p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold"><MessageCircleQuestion className="h-5 w-5 text-sky" />{pt(lang, "questionsTitle", child)}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{pt(lang, "questionsSub", child)}</p>
            {data.questions.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{pt(lang, "noQuestions", child)}</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {[...data.questions].reverse().map((q) => (
                  <li key={q.id} className="rounded-xl border bg-muted/30 p-4">
                    <p className="font-medium">“{q.translated}”</p>
                    {q.translated !== q.original && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        <span className="mr-1 rounded bg-muted px-1 py-0.5 font-semibold">{LANG_SHORT[q.originalLanguage] ?? q.originalLanguage}</span>
                        {pt(lang, "original")}: {q.original}
                      </p>
                    )}
                    {q.answer && (
                      <div className="mt-3 rounded-lg border-l-4 border-sky bg-sky-soft p-3 text-sm leading-relaxed">
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-sky">{pt(lang, "answerLabel", child)}</p>
                        {q.answer}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground"><Languages className="h-3.5 w-3.5" />{pt(lang, "translatedNote")}</p>
          </section>
        </div>

        <div className="space-y-6">
          <Mistakes lang={lang} data={data} />
          <section className="surface relative overflow-hidden p-6">
            <span className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-sky to-alert" aria-hidden />
            <h2 className="flex items-center gap-2 text-lg font-semibold"><BookOpen className="h-5 w-5 text-primary" />{pt(lang, "learning")}</h2>
            <p className="mt-3 whitespace-pre-line leading-relaxed text-foreground/85">{data.lessonNotes || "—"}</p>
          </section>

          <section className="surface p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold"><Sparkles className="h-5 w-5 text-primary" />{pt(lang, "activitiesTitle")}</h2>
            {data.activities.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{pt(lang, "noActivities")}</p>
            ) : (
              <ul className="mt-4 space-y-4">
                {data.activities.map((a) => <ActivityItem key={a.id} a={a} lang={lang} />)}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function ActivityItem({ a, lang }: { a: ParentOverview["activities"][number]; lang: string }) {
  const [open, setOpen] = useState(false);
  const result = a.childCorrect === null
    ? { icon: Clock, text: pt(lang, "notYet"), cls: "bg-muted text-muted-foreground" }
    : a.childCorrect
      ? { icon: CheckCircle2, text: pt(lang, "gotRight"), cls: "bg-success-soft text-success" }
      : { icon: XCircle, text: pt(lang, "gotWrong"), cls: "bg-alert-soft text-alert-foreground" };
  return (
    <li className="rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-semibold">{a.title}</p>
        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", result.cls)}><result.icon className="h-3 w-3" />{result.text}</span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{a.explanation}</p>
      <p className="mt-3 text-sm"><b>{a.quizQuestion}</b> → <span className="rounded bg-success-soft px-1.5 py-0.5 font-mono font-semibold text-success">{a.quizOptions[a.correctIndex]}</span></p>
      <Button variant="outline" size="sm" className="mt-3" onClick={() => setOpen((o) => !o)}><Sparkles className="h-3.5 w-3.5" />{pt(lang, "tryTogether")}</Button>
      {open && <div className="mt-4 border-t pt-4" dir="ltr"><FractionMiniLesson activity={a.lesson} lang={widgetLang(lang)} compact /></div>}
    </li>
  );
}

function HelpAtHome({ lang, childName }: { lang: string; childName: string }) {
  const [tips, setTips] = useState<ParentTips | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function get() {
    setBusy(true);
    setError(null);
    try { setTips(await getParentTips()); } catch (e) { setError(e instanceof Error ? e.message : pt(lang, "error")); } finally { setBusy(false); }
  }
  return (
    <section className="surface relative overflow-hidden bg-gradient-to-br from-alert-soft/80 to-card to-60% p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Lightbulb className="h-5 w-5 text-alert" />{pt(lang, "helpTitle")}</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">{pt(lang, "helpSub", { child: childName })}</p>
        </div>
        <Button onClick={get} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{tips ? pt(lang, "retry") : pt(lang, "helpButton")}</Button>
      </div>
      {busy && !tips && <p className="mt-4 text-sm text-muted-foreground">{pt(lang, "helpLoading")}</p>}
      {error && <p className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {tips && (
        <div className="mt-5 space-y-5 animate-in fade-in slide-in-from-bottom-1">
          <p className="leading-relaxed">{tips.summary}</p>
          {tips.weakAreas.length > 0 && (
            <div>
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-tomato"><Target className="h-3.5 w-3.5" />{pt(lang, "weakTitle", { child: childName })}</p>
              <ul className="mt-2 space-y-2">
                {tips.weakAreas.map((w, i) => (
                  <li key={i} className="rounded-xl border-s-4 border-tomato bg-card p-3 shadow-soft">
                    <p className="font-semibold">{w.area}</p>
                    {w.evidence && <p className="mt-1 text-sm text-muted-foreground"><b className="font-medium">{pt(lang, "whyLabel")}:</b> {w.evidence}</p>}
                    {w.howToHelp && <p className="mt-1 text-sm"><b className="font-medium text-primary">{pt(lang, "howHelp")}:</b> {w.howToHelp}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-alert-foreground">{pt(lang, "tryAtHome")}</p>
            <ol className="mt-2 space-y-2">
              {tips.tips.map((t, i) => (
                <li key={i} className="flex gap-3 rounded-xl bg-card p-3 shadow-soft">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gradient-to-br from-alert to-tomato text-xs font-bold text-primary-foreground">{i + 1}</span>
                  <span className="text-sm leading-relaxed">{t}</span>
                </li>
              ))}
            </ol>
          </div>
          {tips.conversationStarters.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">{pt(lang, "askChild")}</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {tips.conversationStarters.map((q, i) => <li key={i} className="rounded-2xl rounded-bl-sm border bg-card px-3 py-2 text-sm shadow-soft">💬 {q}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, icon: Icon, tone }: { label: string; value: string | number; icon: React.ComponentType<{ className?: string }>; tone: string }) {
  const [from, text] = tone.split(" ");
  return (
    <div className={cn("surface bg-gradient-to-br to-card to-60% p-5", from)}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className={cn("grid h-9 w-9 place-items-center rounded-xl bg-card shadow-soft", text)}><Icon className="h-4 w-4" /></span>
      </div>
      <p className="mt-3 font-display text-3xl font-semibold">{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------- grades, assignments, common mistakes

const KIND_STYLE: Record<string, string> = {
  homework: "bg-sky-soft text-sky", quiz: "bg-primary-soft text-primary-deep", test: "bg-alert-soft text-alert-foreground", project: "bg-success-soft text-success",
};
const kindLabel = (lang: string, kind: string) => pt(lang, (kind in KIND_STYLE ? kind : "homework") as "homework");
const fmtDate = (lang: string, d: string) => {
  try { return new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${d}T00:00:00`)); } catch { return d; }
};
const gradeTone = (pct: number) => (pct >= 80 ? "bg-success" : pct >= 60 ? "bg-alert" : "bg-tomato");
const fmtPoints = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function KindChip({ lang, kind }: { lang: string; kind: string }) {
  return <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-semibold", KIND_STYLE[kind] ?? KIND_STYLE["homework"])}>{kindLabel(lang, kind)}</span>;
}

function Grades({ lang, data }: { lang: string; data: ParentOverview }) {
  const graded = data.assignments.filter((a) => a.score !== null);
  const kinds = Object.entries(data.gradeSummary).filter(([k, v]) => k !== "overall" && v !== null) as [string, number][];
  return (
    <section className="surface p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold"><GraduationCap className="h-5 w-5 text-alert" />{pt(lang, "gradesTitle")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{pt(lang, "gradesSub")}</p>
      {graded.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{pt(lang, "noGrades")}</p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            {data.gradeSummary["overall"] != null && (
              <span className="rounded-xl bg-foreground px-3 py-2 text-sm font-semibold text-background">{pt(lang, "overall")} · {Math.round(data.gradeSummary["overall"])}%</span>
            )}
            {kinds.map(([k, v]) => (
              <span key={k} className={cn("rounded-xl px-3 py-2 text-sm font-semibold", KIND_STYLE[k])}>{kindLabel(lang, k)} · {Math.round(v)}%</span>
            ))}
          </div>
          <ul className="mt-4 space-y-3">
            {graded.map((a) => (
              <li key={a.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-2 font-semibold"><KindChip lang={lang} kind={a.kind} />{a.title}</p>
                  <p className="font-display text-xl font-semibold tabular-nums" dir="ltr">{fmtPoints(a.score!)}<span className="text-sm text-muted-foreground">/{fmtPoints(a.maxPoints)}</span></p>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted">
                  <div className={cn("h-full rounded-full", gradeTone(a.percent ?? 0))} style={{ width: `${Math.min(100, a.percent ?? 0)}%` }} />
                </div>
                {a.feedback && (
                  <p className="mt-3 rounded-lg bg-muted/60 p-3 text-sm"><b className="font-medium">{pt(lang, "teacherFeedback")}:</b> {a.feedback}</p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Assignments({ lang, data }: { lang: string; data: ParentOverview }) {
  const child = { child: data.childName };
  const sorted = [...data.assignments].sort((a, b) => (b.dueDate ?? "").localeCompare(a.dueDate ?? "") || b.id - a.id);
  return (
    <section className="surface p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold"><ClipboardList className="h-5 w-5 text-sky" />{pt(lang, "assignmentsTitle")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{pt(lang, "assignmentsSub", child)}</p>
      {sorted.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{pt(lang, "noAssignments")}</p>
      ) : (
        <ul className="mt-4 space-y-3">{sorted.map((a) => <AssignmentItem key={a.id} a={a} lang={lang} />)}</ul>
      )}
      <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground"><Languages className="h-3.5 w-3.5" />{pt(lang, "translatedNote")}</p>
    </section>
  );
}

function AssignmentItem({ a, lang }: { a: ParentAssignment; lang: string }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-xl border bg-muted/20">
      <button className="flex w-full items-center gap-3 p-4 text-start" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-semibold"><KindChip lang={lang} kind={a.kind} />{a.title}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {a.dueDate && <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{pt(lang, "due")}: {fmtDate(lang, a.dueDate)}</span>}
            {a.score === null
              ? <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{pt(lang, "notGraded")}</span>
              : <span className="inline-flex items-center gap-1 font-semibold text-success" dir="ltr"><CheckCircle2 className="h-3.5 w-3.5" />{fmtPoints(a.score)}/{fmtPoints(a.maxPoints)}</span>}
          </p>
        </div>
        <span className="hidden text-xs font-semibold text-primary sm:inline">{open ? pt(lang, "hideAssignment") : pt(lang, "viewAssignment")}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="border-t px-4 pb-4 pt-3 animate-in fade-in">
          <p className="whitespace-pre-line text-sm leading-relaxed">{a.instructions || <span className="text-muted-foreground">{pt(lang, "noInstructions")}</span>}</p>
        </div>
      )}
    </li>
  );
}

function Mistakes({ lang, data }: { lang: string; data: ParentOverview }) {
  const child = { child: data.childName };
  return (
    <section className="surface bg-gradient-to-br from-tomato/5 to-card to-50% p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold"><AlertTriangle className="h-5 w-5 text-tomato" />{pt(lang, "mistakesTitle")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{pt(lang, "mistakesSub", child)}</p>
      {data.classMistakes.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{pt(lang, "noMistakes")}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {data.classMistakes.map((m) => (
            <li key={m.id} className={cn("rounded-xl border p-4", m.childAffected ? "border-tomato/40 bg-card shadow-soft" : "bg-card/60")}>
              {m.childAffected && (
                <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-tomato/10 px-2 py-0.5 text-xs font-semibold text-tomato"><Target className="h-3 w-3" />{pt(lang, "childToo", child)}</span>
              )}
              <p className="font-semibold">{m.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
