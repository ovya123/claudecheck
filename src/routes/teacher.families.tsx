import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Heart, Loader2, ShieldAlert, ShieldCheck, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState, timeAgo } from "@/components/common";
import { LANGUAGES } from "@/i18n";
import { LIVE } from "@/lib/config";
import { useAppState } from "@/lib/store";
import { setParentVerification } from "@/services/mockApi";
import type { ParentLink } from "@/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/teacher/families")({
  head: () => ({
    meta: [
      { title: "Families — ClassBridge" },
      { name: "description", content: "Verify parents and guardians before they can see a student's work." },
      { property: "og:title", content: "Families — ClassBridge" },
      { property: "og:description", content: "Verify parents and guardians before they can see a student's work." },
    ],
  }),
  component: Families,
});

const langName = (code: string) => LANGUAGES.find((l) => l.code === code)?.label ?? code;

function Families() {
  const { parents = [] } = useAppState();
  const pending = parents.filter((p) => p.status === "pending");
  const decided = parents.filter((p) => p.status !== "pending");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Families</h1>
        <p className="text-muted-foreground">Parents and guardians see their child's work translated into their own language, but only after you verify them.</p>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-alert/30 bg-alert-soft/60 p-4">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-alert-foreground" />
        <div className="text-sm">
          <p className="font-semibold text-alert-foreground">How verification works</p>
          <p className="mt-0.5 text-foreground/80">
            Each student has a private family code on their class page. A family member enters it at <b>/parent</b>, and the request appears here.
            Only verify people you recognise, for example from school records or by asking the student.
          </p>
        </div>
      </div>

      {!LIVE ? (
        <EmptyState icon={Heart} title="Parent portal needs the live backend" body="Set VITE_API_URL to connect to the ClassBridge server, then family requests will appear here." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="surface p-6">
            <h2 className="flex items-center gap-2 font-semibold">
              <ShieldAlert className="h-4 w-4 text-alert" /> Waiting for verification
              <span className="ml-auto rounded-full bg-alert-soft px-2 py-0.5 text-xs font-semibold text-alert-foreground">{pending.length}</span>
            </h2>
            <ul className="mt-4 space-y-3">
              {pending.length === 0 && <EmptyState icon={Check} title="No requests waiting" body="New family requests will show up here automatically." />}
              {pending.map((p) => <Request key={p.id} p={p} />)}
            </ul>
          </section>

          <section className="surface p-6">
            <h2 className="flex items-center gap-2 font-semibold"><Users className="h-4 w-4 text-primary" /> Linked families</h2>
            <ul className="mt-4 divide-y">
              {decided.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Nobody verified yet.</p>}
              {decided.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-3">
                  <Avatar name={p.name} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{p.name} <span className="text-muted-foreground">· {p.relation} of {p.studentName}</span></p>
                    <p className="text-xs text-muted-foreground">Reads in {langName(p.language)}</p>
                  </div>
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                    p.status === "verified" ? "bg-success-soft text-success" : "bg-destructive/10 text-destructive")}>
                    {p.status === "verified" ? <><ShieldCheck className="h-3 w-3" /> Verified</> : <><X className="h-3 w-3" /> Rejected</>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}

function Request({ p }: { p: ParentLink }) {
  const [busy, setBusy] = useState<"verify" | "reject" | null>(null);
  async function decide(verify: boolean) {
    setBusy(verify ? "verify" : "reject");
    try {
      await setParentVerification(p.id, verify);
      toast.success(verify ? `${p.name} can now see ${p.studentName}'s work` : `Request from ${p.name} rejected`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update the request");
    } finally {
      setBusy(null);
    }
  }
  return (
    <li className="rounded-xl border bg-gradient-to-br from-alert-soft/40 to-card p-4">
      <div className="flex items-start gap-3">
        <Avatar name={p.name} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{p.name}</p>
          <p className="text-sm text-muted-foreground">says they are <b className="text-foreground">{p.studentName}</b>'s {p.relation.toLowerCase()}</p>
          <p className="mt-1 text-xs text-muted-foreground">Reads in {langName(p.language)} · requested {timeAgo(p.createdAt, Date.now())}</p>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button size="sm" onClick={() => void decide(true)} disabled={busy !== null}>
          {busy === "verify" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Verify
        </Button>
        <Button size="sm" variant="outline" onClick={() => void decide(false)} disabled={busy !== null}>
          {busy === "reject" ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />} Reject
        </Button>
      </div>
    </li>
  );
}

function Avatar({ name }: { name: string }) {
  return <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-alert-soft font-semibold text-alert-foreground">{name.slice(0, 1).toUpperCase()}</span>;
}
