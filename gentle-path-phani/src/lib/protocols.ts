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

export async function fetchMyProtocols(): Promise<ProtocolRow[]> {
  const token = await getIdToken();

  const res = await fetch(apiUrl("/api/protocols"), {
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
