import { getAuth } from "firebase/auth";
import { apiUrl } from "@/lib/api";

export type ProtocolRow = {
  id: string;
  userId: string;
  name: string;
  dosage: string;
  timing: string;
  notes: string;
  shopUrl: string;
  createdAt: string;
};

async function getIdToken(): Promise<string> {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("Not logged in");
  return user.getIdToken(true);
}

// Admin: list protocols for a specific user
export async function fetchAdminUserProtocols(userId: string): Promise<ProtocolRow[]> {
  const token = await getIdToken();

  const res = await fetch(apiUrl(`/api/admin/users/${encodeURIComponent(userId)}/protocols`), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to load protocols: ${res.status} ${text}`);
  }

  return res.json();
}

export type AdminCreateProtocolInput = {
  userId: string;
  name: string;
  dosage?: string;
  timing?: string;
  notes?: string;
  shopUrl?: string;
};

// Admin: create protocol
export async function createAdminProtocol(input: AdminCreateProtocolInput): Promise<ProtocolRow> {
  const token = await getIdToken();

  const res = await fetch(apiUrl(`/api/admin/protocols`), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId: input.userId,
      name: input.name,
      dosage: input.dosage || "",
      timing: input.timing || "",
      notes: input.notes || "",
      shopUrl: input.shopUrl || "",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create protocol: ${res.status} ${text}`);
  }

  return res.json();
}

export type AdminUpdateProtocolInput = {
  name?: string;
  dosage?: string;
  timing?: string;
  notes?: string;
  shopUrl?: string;
};

// Admin: update protocol
export async function updateAdminProtocol(
  protocolId: string,
  patch: AdminUpdateProtocolInput
): Promise<ProtocolRow> {
  const token = await getIdToken();

  const res = await fetch(apiUrl(`/api/admin/protocols/${encodeURIComponent(protocolId)}`), {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(patch),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to update protocol: ${res.status} ${text}`);
  }

  return res.json();
}

// Admin: delete protocol
export async function deleteAdminProtocol(protocolId: string): Promise<void> {
  const token = await getIdToken();

  const res = await fetch(apiUrl(`/api/admin/protocols/${encodeURIComponent(protocolId)}`), {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to delete protocol: ${res.status} ${text}`);
  }
}
