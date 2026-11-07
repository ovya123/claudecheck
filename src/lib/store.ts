import { useSyncExternalStore } from "react";
import type { AppState } from "@/types";
import { createDemoState } from "@/data/demo";

/**
 * Demo state store: localStorage persistence + BroadcastChannel sync so a
 * teacher tab and a student tab in the same browser see each other's activity.
 * Replace with real API/websocket subscriptions later.
 */
const KEY = "classbridge:state:v1";
const listeners = new Set<() => void>();
let cache: AppState | null = null;
let serverSnapshot: AppState | null = null;
let channel: BroadcastChannel | null = null;

function load(): AppState {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as AppState;
  } catch { /* ignore */ }
  return createDemoState();
}

function ensureChannel() {
  if (channel || typeof window === "undefined" || !("BroadcastChannel" in window)) return;
  channel = new BroadcastChannel("classbridge");
  channel.onmessage = () => {
    cache = load();
    listeners.forEach((l) => l());
  };
}

export function getState(): AppState {
  if (typeof window === "undefined") return (serverSnapshot ??= createDemoState());
  if (!cache) cache = load();
  return cache;
}

export function setState(updater: (s: AppState) => AppState) {
  cache = updater(getState());
  window.localStorage.setItem(KEY, JSON.stringify(cache));
  listeners.forEach((l) => l());
  ensureChannel();
  channel?.postMessage("update");
}

export function resetDemo() {
  setState(() => createDemoState());
}

function subscribe(cb: () => void) {
  ensureChannel();
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) { cache = load(); cb(); }
  };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(cb); window.removeEventListener("storage", onStorage); };
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getState, () => (serverSnapshot ??= createDemoState()));
}

// ---- current student identity (per browser) ----
const STUDENT_KEY = "classbridge:student";
export function getStudentId(): string | null {
  return typeof window === "undefined" ? null : window.localStorage.getItem(STUDENT_KEY);
}
export function setStudentId(id: string | null) {
  if (id) window.localStorage.setItem(STUDENT_KEY, id);
  else window.localStorage.removeItem(STUDENT_KEY);
  listeners.forEach((l) => l());
}
export function useStudentId(): string | null {
  return useSyncExternalStore(subscribe, getStudentId, () => null);
}
