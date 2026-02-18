// Central place to configure the backend base URL.
//
// Priority:
// 1) VITE_API_BASE_URL (recommended)
// 2) VITE_API_BASE (legacy)
// 3) Cloud Run deployed URL (safe fallback)

const FALLBACK_API_BASE = "https://gentle-path-api-883951071472.us-central1.run.app";

function normalizeBase(url: string): string {
  return url.replace(/\/+$/, "");
}

const envBase =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  (import.meta.env.VITE_API_BASE as string | undefined) ??
  "";

export const API_BASE = normalizeBase(envBase || FALLBACK_API_BASE);

export function apiUrl(path: string): string {
  if (!path) return API_BASE;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
}
