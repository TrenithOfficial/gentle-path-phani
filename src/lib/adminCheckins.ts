import { getAuth } from "firebase/auth";
import { apiUrl } from "@/lib/api";

export type AdminCheckInRow = {
  id: string;
  userId: string;
  email: string;
  day: number;
  mood: number | null;
  energy: number | null;
  notes: string;
  isTravelDay: boolean;
  missedProtocol: boolean;

  // ✅ NEW fields from backend
  travelStartDate?: string | null;   // "YYYY-MM-DD" or null
  travelReturnDate?: string | null;  // "YYYY-MM-DD" or null
  missedProtocolNote?: string;       // "" if none

  createdAt: string;
};

async function getBearerToken(): Promise<string> {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("Not logged in");
  return user.getIdToken(true);
}

async function parseError(res: Response): Promise<string> {
  try {
    const text = await res.text();
    return text || res.statusText;
  } catch {
    return res.statusText;
  }
}

export async function fetchAdminCheckins(): Promise<AdminCheckInRow[]> {
  const token = await getBearerToken();

  const res = await fetch(apiUrl("/api/admin/checkins"), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const text = await parseError(res);
    throw new Error(`Failed to load admin check-ins: ${res.status} ${text}`);
  }

  return res.json();
}

export async function fetchAdminCheckinById(id: string): Promise<AdminCheckInRow> {
  const token = await getBearerToken();

  const res = await fetch(apiUrl(`/api/admin/checkins/${encodeURIComponent(id)}`), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const text = await parseError(res);
    throw new Error(`Failed to load check-in: ${res.status} ${text}`);
  }

  return res.json();
}
