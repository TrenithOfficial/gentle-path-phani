import { getAuth } from "firebase/auth";
import { apiUrl } from "@/lib/api";
import { httpGet } from "@/lib/http";

export type ClientGuidanceRow = {
  id: string;
  phaseId: number;
  day: number;
  title: string;
  content: string;
  audioUrl: string | null;
  createdAt: string;
};

export type TodayGuidanceResponse = {
  phaseId: number;
  day: number;
  guidance: ClientGuidanceRow | null;
};

export type ClientHealingSheetRow = {
  id: string;
  name: string;
  url: string;
  phaseId: number | null;
  userId: string | null;
  uploadedAt: string;
};

async function authedGetJson<T>(url: string): Promise<T> {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("Not logged in");

  const token = await user.getIdToken(true);

  // Uses fetch on web, CapacitorHttp on native (via httpGet)
  const r = await httpGet(url, {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  });

  if (r.status < 200 || r.status >= 300) {
    throw new Error(
      `Request failed: ${r.status} ${
        typeof r.data === "string" ? r.data : JSON.stringify(r.data)
      }`
    );
  }

  return r.data as T;
}

export async function fetchGuidanceToday(): Promise<TodayGuidanceResponse> {
  return authedGetJson<TodayGuidanceResponse>(apiUrl("/api/guidance/today"));
}

export async function fetchGuidanceByPhaseDay(
  phaseId: number,
  day: number
): Promise<ClientGuidanceRow | null> {
  const data = await authedGetJson<{ guidance?: ClientGuidanceRow | null }>(
    apiUrl(`/api/guidance?phaseId=${phaseId}&day=${day}`)
  );
  return data.guidance ?? null;
}

export async function fetchHealingSheets(): Promise<ClientHealingSheetRow[]> {
  return authedGetJson<ClientHealingSheetRow[]>(apiUrl("/api/healing-sheets"));
}

// ✅ IMPORTANT: normalize any wrong admin paths into the real static path (/uploads)
// and always return a fully-qualified URL pointing at the backend.
export function resolveFileUrl(url: string) {
  if (!url) return url;

  // Already absolute
  if (url.startsWith("http://") || url.startsWith("https://")) return url;

  let u = url.trim();

  // Ensure leading slash
  if (!u.startsWith("/")) u = `/${u}`;

  // Normalize common wrong prefixes that cause 404s
  // (frontend routes like /admin/uploads do not exist on backend)
  u = u.replace(/^\/admin\/uploads/, "/uploads");
  u = u.replace(/^\/api\/admin\/uploads/, "/uploads");
  u = u.replace(/^\/api\/uploads/, "/uploads");

  return apiUrl(u);
}
