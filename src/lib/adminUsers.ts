import { getAuth } from "firebase/auth";
import { apiUrl } from "@/lib/api";

export type AdminUserStatus = "active" | "inactive" | "all";

export type AdminUserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  startDate: string | null;
  createdAt: string;
};

export type AdminUserDetailRow = AdminUserRow & {
  firstName?: string | null;
  lastName?: string | null;
  age?: number | null;
  gender?: string | null;

  phoneCountryCode?: string | null;
  phoneNumber?: string | null;

  timezone?: string | null;
  address?: string | null;

  emergencyContactName?: string | null;
  emergencyContactPhoneCountryCode?: string | null;
  emergencyContactPhoneNumber?: string | null;

  notes?: string | null;
};

async function getToken(forceRefresh = false): Promise<string> {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("Not logged in");
  return await user.getIdToken(forceRefresh);
}

async function requestJson(path: string, init: RequestInit = {}, forceRefreshToken = false) {
  const token = await getToken(forceRefreshToken);

  const res = await fetch(apiUrl(path), {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  // If token is stale (common after setting custom claims), refresh and retry once
  if ((res.status === 401 || res.status === 403) && !forceRefreshToken) {
    return requestJson(path, init, true);
  }

  if (!res.ok) {
    let body: any = null;
    try {
      body = await res.json();
    } catch {
      // ignore
    }

    const msg =
      body?.error
        ? `${body.error}${body.details ? `: ${body.details}` : ""}`
        : `Request failed (${res.status})`;

    throw new Error(msg);
  }

  if (res.status === 204) return null;
  return res.json();
}

export async function fetchAdminUsers(status: AdminUserStatus): Promise<AdminUserRow[]> {
  return requestJson(`/api/admin/users?status=${status}`, { method: "GET" });
}

// NEW: for edit-prefill
export async function fetchAdminUserById(id: string): Promise<AdminUserDetailRow> {
  return requestJson(`/api/admin/users/${encodeURIComponent(id)}`, { method: "GET" });
}

export async function createAdminUser(input: {
  email: string;
  name?: string;
  active?: boolean;

  firstName?: string;
  lastName?: string;
  age?: number | null;
  gender?: string;

  phoneCountryCode?: string;
  phoneNumber?: string;

  timezone?: string;
  address?: string;

  emergencyContactName?: string;
  emergencyContactPhoneCountryCode?: string;
  emergencyContactPhoneNumber?: string;

  notes?: string;
}): Promise<AdminUserRow> {
  return requestJson(`/api/admin/users`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateAdminUser(
  id: string,
  input: {
    email?: string;
    name?: string;
    active?: boolean;

    firstName?: string;
    lastName?: string;
    age?: number | null;
    gender?: string;

    phoneCountryCode?: string;
    phoneNumber?: string;

    timezone?: string;
    address?: string;

    emergencyContactName?: string;
    emergencyContactPhoneCountryCode?: string;
    emergencyContactPhoneNumber?: string;

    notes?: string;
  }
): Promise<AdminUserRow> {
  return requestJson(`/api/admin/users/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteAdminUser(id: string): Promise<void> {
  await requestJson(`/api/admin/users/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function inviteAdminUser(input: {
  email: string;
  name?: string;
  active?: boolean;
}): Promise<{ email: string; firebaseUid: string; resetLink: string }> {
  return requestJson(`/api/admin/users/invite`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export type AdminUserCheckInRow = {
  id: string;
  userId: string;
  email: string;
  day: number;
  mood: number | null;
  energy: number | null;
  notes: string;
  isTravelDay: boolean;
  missedProtocol: boolean;
  createdAt: string;
};

export async function fetchAdminUserCheckins(userId: string): Promise<AdminUserCheckInRow[]> {
  return requestJson(`/api/admin/user-checkins/${encodeURIComponent(userId)}`, { method: "GET" });
}
