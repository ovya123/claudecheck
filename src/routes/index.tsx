import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Globe2, GraduationCap, Lock, MessageSquareText, Radar, School, Shapes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DemoBadge, LangChip, Logo } from "@/components/common";
import { RadarVisual } from "@/components/radar/MisconceptionCard";
import { LIVE } from "@/lib/config";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ClassBridge — Every student deserves to understand" },
      { name: "description", content: "ClassBridge connects multilingual students and teachers with private questions, instant language switching and a live Misconception Radar." },
      { property: "og:title", content: "ClassBridge — Every student deserves to understand" },
      { property: "og:description", content: "Different languages. Different learning speeds. One inclusive classroom." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: Globe2, tile: "bg-sky-soft text-sky", title: "Multilingual learning", body: "Students follow the lesson in English, Hindi or French and switch any time without losing their place." },
  { icon: Lock, tile: "bg-primary-soft text-primary", title: "Private questions", body: "Ask in any language or script — including Hinglish. Only the teacher sees it, exactly as typed." },
  { icon: Radar, tile: "bg-alert-soft text-alert-foreground", title: "Misconception Radar", body: "Questions in different languages are grouped by the underlying misunderstanding, not by wording." },
  { icon: Shapes, tile: "bg-success-soft text-success", title: "Interactive explanations", body: "Teachers share hands-on mini-lessons with a quick check, in each student's own language." },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <nav className="flex items-center gap-1 text-sm">
          <a href="#how" className="hidden rounded-md px-3 py-2 text-muted-foreground hover:text-foreground sm:inline">How it works</a>
          <Button asChild variant="ghost" size="sm"><Link to="/join">Join a class</Link></Button>
          <Button asChild size="sm"><Link to="/teacher">Teacher portal</Link></Button>
        </nav>
      </header>

      <section className="relative overflow-hidden">
        <div className="dot-grid absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
        <span className="glow -z-10 right-[8%] top-10 h-72 w-72 bg-primary/25" aria-hidden />
        <span className="glow -z-10 right-[30%] top-48 h-56 w-56 bg-sky/20" aria-hidden />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-10 lg:grid-cols-[1.05fr_1fr] lg:pt-16">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border bg-card/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-soft backdrop-blur">
              <span className="live-dot" /> Different languages. Different learning speeds. One inclusive classroom.
            </p>
            <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.02] tracking-tight sm:text-7xl">
              Every student deserves to <em className="marker text-primary not-italic">understand</em>, not just attend.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              ClassBridge lets multilingual students learn and ask questions in their own language, while teachers see — in one view — which ideas the whole class is struggling with.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-12 px-6"><Link to="/teacher"><School className="h-4 w-4" /> I'm a Teacher</Link></Button>
              <Button asChild size="lg" variant="outline" className="h-12 bg-card px-6"><Link to="/join"><GraduationCap className="h-4 w-4" /> I'm a Student</Link></Button>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>Learn in</span>
              {["English", "हिन्दी", "Français"].map((l) => (
                <span key={l} className="rounded-full border bg-card px-3 py-1 font-medium text-foreground shadow-soft">{l}</span>
              ))}
            </div>
          </div>
          <RadarPreview />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-16">
        <dl className="grid grid-cols-2 gap-4 rounded-2xl border bg-card/70 p-6 shadow-soft backdrop-blur md:grid-cols-4">
          {[["3", "languages, any script"], ["1", "radar for the whole class"], ["100%", "private questions"], ["< 1 min", "from question to insight"]].map(([v, l]) => (
            <div key={l} className="text-center">
              <dt className="sr-only">{l}</dt>
              <dd className="font-display text-3xl font-semibold text-primary-deep sm:text-4xl">{v}</dd>
              <dd className="mt-1 text-sm text-muted-foreground">{l}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section id="how" className="border-y bg-card/70 backdrop-blur">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="font-display text-3xl font-semibold">How ClassBridge works</h2>
          <p className="mt-2 text-muted-foreground">Three steps from silent confusion to a fixed misconception.</p>
          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            {[
              ["Start a session", "The teacher shares lesson notes and a six-character join code."],
              ["Students ask privately", "Each student reads in their language and asks whatever confuses them, in any script."],
              ["See the pattern, act on it", "The radar surfaces shared misconceptions; share a mini-lesson in one click."],
            ].map(([title, body], i) => (
              <li key={title} className="relative pl-14">
                <span className="absolute left-0 top-0 grid h-10 w-10 place-items-center rounded-full bg-primary font-display text-lg text-primary-foreground shadow-soft ring-4 ring-card">{i + 1}</span>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1 text-muted-foreground">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">Built for inclusive classrooms</p>
        <h2 className="mt-2 max-w-xl font-display text-3xl font-semibold sm:text-4xl">Everything a multilingual class needs, in one place.</h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {features.map((f) => (
            <div key={f.title} className="surface p-6 transition-all hover:-translate-y-0.5 hover:shadow-lift">
              <span className={cn("grid h-11 w-11 place-items-center rounded-xl", f.tile)}><f.icon className="h-5 w-5" /></span>
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-1 text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
        <div className="relative mt-16 flex flex-col items-start justify-between gap-6 overflow-hidden rounded-2xl bg-foreground p-8 text-background shadow-lift sm:flex-row sm:items-center sm:p-10">
          <span className="glow -right-10 -top-16 h-56 w-56 bg-primary/50" aria-hidden />
          <span className="glow bottom-[-6rem] left-1/3 h-48 w-48 bg-sky/30" aria-hidden />
          <div className="relative">
            <h2 className="font-display text-2xl font-semibold sm:text-3xl">{LIVE ? "Start a live classroom" : "Try the full classroom demo"}</h2>
            <p className="mt-1 opacity-75">{LIVE ? <>Create a session as the teacher, then join from another tab or phone with the code.</> : <>Open the teacher portal in one tab and join with code <b>FRC24B</b> in another.</>}</p>
          </div>
          <Button asChild variant="secondary" size="lg" className="relative"><Link to={LIVE ? "/teacher/sessions" : "/teacher/live"}>{LIVE ? "Create a session" : "Open live session"} <ArrowRight className="h-4 w-4" /></Link></Button>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm text-muted-foreground">
          <Logo />
          <p>WiE Hackathon 2026 · {LIVE ? "Powered by AI" : "All classroom data is demo data."}</p>
        </div>
      </footer>
    </div>
  );
}

function RadarPreview() {
  return (
    <div className="relative">
      {[
        ["Why is 1/8 smaller?", "EN", "-left-6 -top-6 rotate-[-4deg]", "0s"],
        ["हर बड़ा क्यों?", "HI", "-right-4 -top-10 rotate-[3deg]", "1.2s"],
        ["Pourquoi ?", "FR", "-bottom-7 left-10 rotate-[2deg]", "2.4s"],
      ].map(([q, l, pos, delay]) => (
        <div key={l} className={cn("float absolute z-10 hidden items-center gap-2 rounded-2xl rounded-bl-sm border bg-card px-3 py-2 text-sm font-medium shadow-lift sm:flex", pos)} style={{ animationDelay: delay }}>
          <span className="rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">{l}</span>{q}
        </div>
      ))}
    <div className="surface relative p-5 shadow-lift">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold"><Radar className="h-4 w-4 text-primary" /> Misconception Radar</div>
        <DemoBadge />
      </div>
      <div className="mt-4 grid gap-5 sm:grid-cols-[180px_1fr]">
        <div className="aspect-square"><RadarVisual items={[{ label: "a", value: 5, severity: "high" }, { label: "b", value: 2, severity: "medium" }, { label: "c", value: 1, severity: "low" }]} /></div>
        <div className="space-y-3">
          <div className="rounded-lg border-l-4 border-alert bg-alert-soft p-3">
            <p className="text-sm font-semibold">Larger denominator read as a larger fraction</p>
            <p className="mt-1 text-xs text-muted-foreground">5 questions · 4 languages</p>
          </div>
          {[
            ["English", "Why is 1/8 smaller than 1/4?"],
            ["Hindi", "बड़ा हर होने पर भिन्न छोटी क्यों होती है?"],
            ["Hinglish", "Agar denominator bada hai toh fraction chota kyun hota hai?"],
          ].map(([l, q]) => (
            <div key={q} className="flex items-start gap-2 text-sm"><LangChip lang={l as "English"} /><span className="text-muted-foreground">“{q}”</span></div>
          ))}
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-lg bg-muted p-3 text-sm"><MessageSquareText className="h-4 w-4 text-muted-foreground" /> 2 questions waiting for analysis</div>
    </div>
    </div>
  );
}
