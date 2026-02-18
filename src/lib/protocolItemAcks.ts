import { getAuth } from "firebase/auth";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8081";

export type ProtocolItemAckRow = {
  protocolId: string;
  confirmedAt: string; // RFC3339 string from backend
};

async function getToken(): Promise<string> {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("Not logged in");
  return user.getIdToken(true);
}

export async function fetchMyProtocolItemAcks(): Promise<ProtocolItemAckRow[]> {
  const token = await getToken();

  const res = await fetch(`${API_BASE}/api/protocols/item-acks`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to load confirmations: ${res.status} ${text}`);
  }

  return res.json();
}

export async function confirmMyProtocolItem(protocolId: string): Promise<ProtocolItemAckRow> {
  const token = await getToken();

  const res = await fetch(`${API_BASE}/api/protocols/item-acks`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    // ✅ send protocolId (backend supports this)
    body: JSON.stringify({ protocolId }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to confirm: ${res.status} ${text}`);
  }

  return res.json();
}
