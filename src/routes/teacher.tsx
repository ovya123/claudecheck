import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { BarChart3, BookOpenCheck, LayoutGrid, Menu, Presentation, Radar, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useAppState, resetDemo } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/teacher")({
  component: TeacherLayout,
});

const nav = [
  { to: "/teacher", label: "Overview", icon: LayoutGrid, exact: true },
  { to: "/teacher/sessions", label: "Classroom Sessions", icon: Presentation },
  { to: "/teacher/radar", label: "Misconception Radar", icon: Radar },
  { to: "/teacher/activities", label: "Learning Activities", icon: BookOpenCheck },
  { to: "/teacher/insights", label: "Insights", icon: BarChart3 },
] as const;

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="space-y-1">
      {nav.map((n) => (
        <Link key={n.to} to={n.to} onClick={onNavigate} activeOptions={{ exact: "exact" in n }}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
          activeProps={{ className: "bg-sidebar-accent text-foreground" }}>
          <n.icon className="h-4 w-4" /> {n.label}
        </Link>
      ))}
    </nav>
  );
}

function TeacherLayout() {
  const { session, students } = useAppState();
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-sidebar p-4 lg:flex">
        <Logo className="px-2" />
        <div className="mt-8 flex-1"><NavLinks /></div>
        <Button variant="ghost" size="sm" className="justify-start text-muted-foreground" onClick={() => { resetDemo(); toast("Demo classroom reset"); }}>
          <RotateCcw className="h-4 w-4" /> Reset demo data
        </Button>
      </aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 bg-sidebar">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Logo />
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
