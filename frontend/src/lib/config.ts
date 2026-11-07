/**
 * Backend connection.
 *
 * Set VITE_API_URL (e.g. in `frontend/.env`) to the ClassBridge Python backend, e.g.
 *   VITE_API_URL=http://localhost:8000
 * When it is set the app runs in LIVE mode (real AI, real data shared between devices).
 * When it is empty the app runs in DEMO mode with the built-in sample classroom.
 */
export const API_URL: string = ((import.meta.env["VITE_API_URL"] as string | undefined) ?? "").trim().replace(/\/+$/, "");
export const LIVE: boolean = API_URL.length > 0;
