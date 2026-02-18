import { getAuth } from "firebase/auth";
import { apiUrl } from "@/lib/api";

export type AdminProtocolItemAckRow = {
  protocolId: string;
  confirmedAt: string; // RFC3339
};

async function getIdToken(): Promise<string> {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("Not logged in");
  return user.getIdToken(true);
}

export async function fetchAdminUserProtocolItemAcks(
  userId: string
): Promise<AdminProtocolItemAckRow[]> {
  const token = await getIdToken();

  const res = await fetch(
    apiUrl(`/api/admin/users/${encodeURIComponent(userId)}/protocol-item-acks`),
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to load protocol item acks: ${res.status} ${text}`);
  }

  return res.json();
}
