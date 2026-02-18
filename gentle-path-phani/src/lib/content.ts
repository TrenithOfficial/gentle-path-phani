import { getAuth } from "firebase/auth";
import { apiUrl } from "@/lib/api";

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

async function authedFetch(input: RequestInfo, init?: RequestInit) {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("Not logged in");
  const token = await user.getIdToken(true);

  const res = await fetch(input, {
    ...(init || {}),
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });

  return res;
}

export async function fetchGuidanceToday(): Promise<TodayGuidanceResponse> {
  const res = await authedFetch(apiUrl("/api/guidance/today"));
  if (!res.ok) throw new Error(`Failed to load guidance: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function fetchGuidanceByPhaseDay(
  phaseId: number,
  day: number
): Promise<ClientGuidanceRow | null> {
  const res = await authedFetch(apiUrl(`/api/guidance?phaseId=${phaseId}&day=${day}`));
  if (!res.ok) throw new Error(`Failed to load guidance: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.guidance ?? null;
}

export async function fetchHealingSheets(): Promise<ClientHealingSheetRow[]> {
  const res = await authedFetch(apiUrl("/api/healing-sheets"));
  if (!res.ok) throw new Error(`Failed to load sheets: ${res.status} ${await res.text()}`);
  return res.json();
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
