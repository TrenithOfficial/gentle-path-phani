import { getAuth } from "firebase/auth";
import { apiUrl } from "@/lib/api";

export type ProtocolAckRow = {
  id: string;
  userId: string;
  day: number;
  createdAt: string;
};

async function getIdToken(): Promise<string> {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("Not logged in");
  return user.getIdToken(true);
}

export async function fetchAdminUserProtocolAcks(userId: string): Promise<ProtocolAckRow[]> {
  const token = await getIdToken();

  const res = await fetch(apiUrl(`/api/admin/users/${encodeURIComponent(userId)}/protocol-acks`), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to load protocol acknowledgements: ${res.status} ${text}`);
  }

  return res.json();
}
