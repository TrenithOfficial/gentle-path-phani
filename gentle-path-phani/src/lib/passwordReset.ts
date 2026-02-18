import { getAuth } from "firebase/auth";
import { apiUrl } from "@/lib/api";

export async function fetchMyPasswordResetLink(): Promise<string> {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("Not logged in");

  const token = await user.getIdToken(true);

  const res = await fetch(apiUrl("/api/me/password-reset-link"), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to get reset link: ${res.status} ${text}`);
  }

  const data = await res.json();
  const link = (data?.resetLink || "").trim();
  if (!link) throw new Error("Reset link missing in response");
  return link;
}
