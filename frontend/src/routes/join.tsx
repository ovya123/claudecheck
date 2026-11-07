import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/common";
import { LANGUAGES, setLang, useLang } from "@/i18n";
import { joinSession } from "@/services/mockApi";
import type { Lang } from "@/types";
import { cn } from "@/lib/utils";
import { LIVE } from "@/lib/config";

export const Route = createFileRoute("/join")({
  head: () => ({
    meta: [
      { title: "Join a Class — ClassBridge" },
      { name: "description", content: "Enter your classroom code, your name and your language to join a ClassBridge lesson." },
      { property: "og:title", content: "Join a Class — ClassBridge" },
      { property: "og:description", content: "Enter your classroom code, your name and your language to join a ClassBridge lesson." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Join,
});

function Join() {
  const navigate = useNavigate();
  const current = useLang();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [lang, setL] = useState<Lang | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const chosen = lang ?? current;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (code.trim().length !== 6) return setError("The class code has 6 characters.");
    if (!name.trim()) return setError("Please enter the name you'd like to show.");
    setBusy(true);
    try {
      setLang(chosen);
      await joinSession({ code, name, language: chosen });
      navigate({ to: "/classroom" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-foreground p-12 text-background lg:flex">
        <span className="glow -left-20 top-10 h-80 w-80 bg-primary/45" aria-hidden />
        <span className="glow -bottom-24 right-0 h-72 w-72 bg-sky/30" aria-hidden />
        <div className="dot-grid absolute inset-0 opacity-30 invert" aria-hidden />
        <Logo className="relative text-background [&>span:first-child]:bg-primary [&>span:first-child]:text-primary-foreground" />
        <div className="relative space-y-4">
          {[["Hello!", "English", "-rotate-2"], ["नमस्ते!", "हिन्दी", "translate-x-10 rotate-1"], ["Bonjour !", "Français", "translate-x-4 -rotate-1"]].map(([word, lang, tilt], i) => (
            <div key={lang} className={cn("float w-fit rounded-2xl rounded-bl-sm bg-background/10 px-5 py-3 backdrop-blur", tilt)} style={{ animationDelay: `${i * 0.8}s` }}>
              <p className="font-display text-3xl font-semibold">{word}</p>
              <p className="text-xs uppercase tracking-wider text-background/60">{lang}</p>
            </div>
          ))}
        </div>
        <div className="relative">
          <h2 className="font-display text-3xl font-semibold leading-tight">Learn in your language.<br />Ask without fear.</h2>
          <p className="mt-2 max-w-sm text-background/70">Your questions are private: only your teacher sees them, and never with your classmates watching.</p>
        </div>
      </aside>
      <div className="relative grid place-items-center px-4 py-10">
      <div className="dot-grid absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
      <div className="relative w-full max-w-md">
        <span className="glow -z-10 -left-16 top-24 h-64 w-64 bg-primary/25" aria-hidden />
        <span className="glow -z-10 -right-16 bottom-10 h-56 w-56 bg-alert/20" aria-hidden />
        <div className="mb-8 flex justify-center lg:hidden"><Logo /></div>
        <form onSubmit={onSubmit} className="surface space-y-6 border-t-4 border-t-primary p-7 shadow-lift" noValidate>
          <div className="text-center">
            <h1 className="font-display text-2xl font-semibold">Join your class</h1>
            <p className="mt-1 text-sm text-muted-foreground">No account needed. Ask your teacher for the code.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="code">Class code</Label>
            <Input id="code" value={code} maxLength={6} autoComplete="off" autoCapitalize="characters" onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              placeholder="ABC123" className="h-14 text-center font-mono text-2xl tracking-[0.4em] uppercase" />
            {!LIVE && <p className="text-xs text-muted-foreground">Demo code: <button type="button" className="font-mono font-semibold text-primary hover:underline" onClick={() => setCode("FRC24B")}>FRC24B</button></p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Your name</Label>
            <Input id="name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="e.g. Aarav" />
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Language</legend>
            <div className="grid grid-cols-3 gap-2">
              {LANGUAGES.map((l) => (
                <button type="button" key={l.code} onClick={() => setL(l.code)} aria-pressed={chosen === l.code}
                  className={cn("rounded-xl border px-2 py-3 text-center transition-all", chosen === l.code ? "border-primary bg-primary-soft shadow-glow ring-1 ring-primary" : "bg-card hover:-translate-y-0.5 hover:bg-muted")}>
                  <span className="block font-semibold">{l.native}</span><span className="text-xs text-muted-foreground">{l.label}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">You can change this any time during the lesson.</p>
          </fieldset>
          {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} Join classroom</Button>
        </form>
      </div>
      </div>
    </div>
  );
}
