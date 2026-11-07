import { useState } from "react";
import { Loader2, ScanSearch } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LIVE } from "@/lib/config";
import { analyzeQuestions } from "@/services/mockApi";

/** Runs the AI Misconception Radar over the class's questions (LIVE mode only). */
export function AnalyzeButton({ size = "sm", className }: { size?: "sm" | "default"; className?: string }) {
  const [busy, setBusy] = useState(false);
  if (!LIVE) return null;
  async function run() {
    setBusy(true);
    try {
      const n = await analyzeQuestions();
      toast.success(n === 0 ? "Analyzed — no shared misconception found" : `Found ${n} misconception${n === 1 ? "" : "s"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button size={size} className={className} onClick={run} disabled={busy}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
      {busy ? "Analyzing with AI…" : "Analyze questions"}
    </Button>
  );
}
