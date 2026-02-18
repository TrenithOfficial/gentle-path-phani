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

// ✅ NEW: load my day-level confirmations
export async function fetchMyProtocolAcks(): Promise<ProtocolAckRow[]> {
  const token = await getIdToken();

  const res = await fetch(apiUrl("/api/protocols/acks"), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to load protocol confirmations: ${res.status} ${text}`);
  }

  return res.json();
}

// Existing: confirm a day
export async function createMyProtocolAck(day: number): Promise<ProtocolAckRow> {
  const token = await getIdToken();

  const res = await fetch(apiUrl("/api/protocols/ack"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ day }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to confirm protocol: ${res.status} ${text}`);
  }

  return res.json();
}
