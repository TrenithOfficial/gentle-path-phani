import { getAuth } from "firebase/auth";
import { apiUrl } from "@/lib/api";

export type AppMe = {
  id: string;
  email: string;
  name?: string;
  role: "admin" | "client";
  startDate?: string | null;
};

export async function fetchMe(): Promise<AppMe> {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("Not logged in");

  const token = await user.getIdToken(true);

  const res = await fetch(apiUrl("/api/me"), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to load /me: ${res.status} ${text}`);
  }

  return res.json();
}
