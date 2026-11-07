import { createFileRoute } from "@tanstack/react-router";
import { Radar } from "lucide-react";
import { DemoBadge, EmptyState } from "@/components/common";
import { MisconceptionCard, RadarVisual } from "@/components/radar/MisconceptionCard";
import { useAppState } from "@/lib/store";

export const Route = createFileRoute("/teacher/radar")({
  head: () => ({
    meta: [
      { title: "Misconception Radar — ClassBridge" },
      { name: "description", content: "See the shared misunderstandings behind student questions in every language." },
      { property: "og:title", content: "Misconception Radar — ClassBridge" },
      { property: "og:description", content: "See the shared misunderstandings behind student questions in every language." },
    ],
  }),
  component: RadarPage,
});

function RadarPage() {
  const { questions, misconceptions } = useAppState();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Misconception Radar</h1>
          <p className="text-muted-foreground">Different concepts stay separate — each card is one underlying misunderstanding.</p>
        </div>
        <DemoBadge label="Sample results — analysis service not yet connected" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="surface h-fit p-5">
          <div className="aspect-square"><RadarVisual items={misconceptions.map((m) => ({ label: m.id, value: m.questionIds.length, severity: m.severity }))} /></div>
          <ul className="mt-4 space-y-2 text-sm">
            <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-alert" /> High frequency</li>
            <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-sky" /> Emerging</li>
            <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" /> Isolated</li>
          </ul>
        </div>
        <div className="space-y-3">
          {misconceptions.length === 0 ? <EmptyState icon={Radar} title="No misconceptions yet" body="Results will appear when questions have been analyzed." /> :
            misconceptions.map((m) => <MisconceptionCard key={m.id} m={m} questions={questions} total={questions.length} />)}
        </div>
      </div>
    </div>
  );
}
