import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { BarChart3, BookOpenCheck, Heart, LayoutGrid, Menu, Presentation, Radar, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useAppState, resetDemo } from "@/lib/store";
import { toast } from "sonner";
import { LIVE } from "@/lib/config";
import { useLiveSync } from "@/services/mockApi";

export const Route = createFileRoute("/teacher")({
  component: TeacherLayout,
});

const nav = [
  { to: "/teacher", label: "Overview", icon: LayoutGrid, exact: true },
  { to: "/teacher/sessions", label: "Classroom Sessions", icon: Presentation },
  { to: "/teacher/radar", label: "Misconception Radar", icon: Radar },
  { to: "/teacher/activities", label: "Learning Activities", icon: BookOpenCheck },
  { to: "/teacher/insights", label: "Insights", icon: BarChart3 },
  { to: "/teacher/families", label: "Families", icon: Heart },
] as const;

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { parents = [] } = useAppState();
  const waiting = parents.filter((p) => p.status === "pending").length;
  return (
    <nav className="space-y-1">
      {nav.map((n) => (
        <Link key={n.to} to={n.to} onClick={onNavigate} activeOptions={{ exact: "exact" in n }}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-background/65 transition-colors hover:bg-background/10 hover:text-background"
          activeProps={{ className: "!bg-primary !text-primary-foreground shadow-soft" }}>
          <n.icon className="h-4 w-4" /> {n.label}
          {n.to === "/teacher/families" && waiting > 0 && (
            <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-alert px-1.5 text-[11px] font-bold text-foreground" aria-label={`${waiting} waiting`}>{waiting}</span>
          )}
        </Link>
      ))}
    </nav>
  );
}

function TeacherLayout() {
  const { session, students } = useAppState();
  const [open, setOpen] = useState(false);
  useLiveSync("teacher");
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-hidden bg-foreground p-4 text-background lg:flex">
        <span className="glow -left-16 top-1/3 h-48 w-48 bg-primary/40" aria-hidden />
        <Logo className="relative px-2 text-background [&>span:first-child]:bg-primary [&>span:first-child]:text-primary-foreground" />
        <p className="relative mt-8 px-3 text-[11px] font-semibold uppercase tracking-wider text-background/40">Teacher portal</p>
        <div className="relative mt-2 flex-1"><NavLinks /></div>
        <Button variant="ghost" size="sm" className="relative justify-start text-background/60 hover:bg-background/10 hover:text-background" onClick={() => { resetDemo(); toast(LIVE ? "Left the session" : "Demo classroom reset"); }}>
          <RotateCcw className="h-4 w-4" /> {LIVE ? "Leave session" : "Reset demo data"}
        </Button>
      </aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 border-none bg-foreground text-background">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Logo className="text-background [&>span:first-child]:bg-primary [&>span:first-child]:text-primary-foreground" />
          <div className="mt-8"><NavLinks onNavigate={() => setOpen(false)} /></div>
        </SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu className="h-5 w-5" /></Button>
          <Link to="/teacher/live" className="flex min-w-0 items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-sm shadow-soft hover:bg-muted">
            {session.status === "live" ? <span className="live-dot" /> : <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />}
            <span className="truncate font-medium">{session.title}</span>
            <span className="hidden text-muted-foreground sm:inline">· {students.length} students</span>
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-right text-sm sm:block"><span className="block font-medium leading-tight">Ms. Sharma</span><span className="text-xs text-muted-foreground">Grade 5 · Room 204</span></span>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground" aria-label="Account">AS</span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-8"><Outlet /></main>
      </div>
    </div>
  );
}
