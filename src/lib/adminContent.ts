import { getAuth } from "firebase/auth";
import { apiUrl } from "@/lib/api";

export type AdminGuidanceRow = {
  id: string;
  phaseId: number;
  day: number;
  title: string;
  content: string;
  audioUrl: string | null;
  createdAt: string;
};

export type AdminHealingSheetRow = {
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

export async function fetchAdminGuidance(phaseId?: number): Promise<AdminGuidanceRow[]> {
  const qs = phaseId ? `?phaseId=${phaseId}` : "";
  const res = await authedFetch(apiUrl(`/api/admin/guidance${qs}`));
  if (!res.ok) throw new Error(`Failed to load guidance: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function upsertAdminGuidance(payload: {
  phaseId: number;
  day: number;
  title: string;
  content: string;
  audioUrl?: string | null;
}): Promise<AdminGuidanceRow> {
  const res = await authedFetch(apiUrl("/api/admin/guidance"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phaseId: payload.phaseId,
      day: payload.day,
      title: payload.title,
      content: payload.content,
      audioUrl: payload.audioUrl ?? null,
    }),
  });

  if (!res.ok) throw new Error(`Failed to save guidance: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function deleteAdminGuidance(id: string): Promise<void> {
  const res = await authedFetch(apiUrl(`/api/admin/guidance/${id}`), { method: "DELETE" });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Failed to delete guidance: ${res.status} ${await res.text()}`);
  }
}

export async function fetchAdminHealingSheets(): Promise<AdminHealingSheetRow[]> {
  const res = await authedFetch(apiUrl("/api/admin/healing-sheets"));
  if (!res.ok) throw new Error(`Failed to load sheets: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function uploadAdminHealingSheet(form: FormData): Promise<AdminHealingSheetRow> {
  const res = await authedFetch(apiUrl("/api/admin/healing-sheets/upload"), {
    method: "POST",
    body: form,
  });

  if (!res.ok) throw new Error(`Failed to upload sheet: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function renameAdminHealingSheet(id: string, name: string): Promise<AdminHealingSheetRow> {
  const res = await authedFetch(apiUrl(`/api/admin/healing-sheets/${id}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });

  if (!res.ok) throw new Error(`Failed to rename sheet: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function deleteAdminHealingSheet(id: string): Promise<void> {
  const res = await authedFetch(apiUrl(`/api/admin/healing-sheets/${id}`), { method: "DELETE" });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Failed to delete sheet: ${res.status} ${await res.text()}`);
  }
}

export function resolveFileUrl(url: string) {
  if (!url) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return apiUrl(url);
}
