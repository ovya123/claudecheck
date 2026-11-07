import { useSyncExternalStore } from "react";
import type { AppState } from "@/types";
import { createDemoState } from "@/data/demo";
import { LIVE } from "@/lib/config";
import { emptyState, getStudentCreds, seedLiveState, setStudentCreds, setTeacherCreds } from "@/lib/session";

/**
 * App state store.
 * - DEMO mode: localStorage persistence + BroadcastChannel sync so a teacher tab and a
 *   student tab in the same browser see each other's activity.
 * - LIVE mode: in-memory per tab, filled by polling the ClassBridge backend
 *   (see src/services/api.ts). The backend is the shared source of truth.
 */
const KEY = "classbridge:state:v1";
const listeners = new Set<() => void>();
let cache: AppState | null = null;
let serverSnapshot: AppState | null = null;
let channel: BroadcastChannel | null = null;

const initialState = () => (LIVE ? emptyState() : createDemoState());

function load(): AppState {
  if (LIVE) return seedLiveState();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as AppState;
  } catch { /* ignore */ }
  return createDemoState();
}

function ensureChannel() {
  if (LIVE || channel || typeof window === "undefined" || !("BroadcastChannel" in window)) return;
  channel = new BroadcastChannel("classbridge");
  channel.onmessage = () => {
    cache = load();
    listeners.forEach((l) => l());
  };
}

export function getState(): AppState {
  if (typeof window === "undefined") return (serverSnapshot ??= initialState());
  if (!cache) cache = load();
  return cache;
}

export function setState(updater: (s: AppState) => AppState) {
  const next = updater(getState());
  if (LIVE) {
    // Polling produces a fresh object every few seconds; skip re-renders when nothing changed.
    if (JSON.stringify(next) === JSON.stringify(cache)) return;
    cache = next;
    listeners.forEach((l) => l());
    return;
  }
  cache = next;
  window.localStorage.setItem(KEY, JSON.stringify(cache));
  listeners.forEach((l) => l());
  ensureChannel();
  channel?.postMessage("update");
}

/** DEMO: restore the sample classroom. LIVE: leave the current teacher session. */
export function resetDemo() {
  if (LIVE) setTeacherCreds(null);
  setState(() => (LIVE ? emptyState() : createDemoState()));
}

function subscribe(cb: () => void) {
  ensureChannel();
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (!LIVE && e.key === KEY) { cache = load(); cb(); }
  };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(cb); window.removeEventListener("storage", onStorage); };
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getState, () => (serverSnapshot ??= initialState()));
}

// ---- current student identity (per browser in DEMO, per tab in LIVE) ----
const STUDENT_KEY = "classbridge:student";
export function getStudentId(): string | null {
  if (typeof window === "undefined") return null;
  if (LIVE) {
    const c = getStudentCreds();
    return c ? String(c.studentId) : null;
  }
  return window.localStorage.getItem(STUDENT_KEY);
}
export function setStudentId(id: string | null) {
  if (LIVE) {
    if (!id) {
      setStudentCreds(null);
      cache = seedLiveState();
    }
  } else if (id) window.localStorage.setItem(STUDENT_KEY, id);
  else window.localStorage.removeItem(STUDENT_KEY);
  listeners.forEach((l) => l());
}
export function useStudentId(): string | null {
  return useSyncExternalStore(subscribe, getStudentId, () => null);
}
