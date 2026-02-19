import { getAuth } from "firebase/auth";
import { apiUrl } from "@/lib/api";
import { Capacitor } from "@capacitor/core";
import { CapacitorHttp } from "@capacitor/core";

export async function fetchMyPasswordResetLink(): Promise<string> {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("Not logged in");

  const token = await user.getIdToken(true);
  const url = apiUrl("/api/me/password-reset-link");

  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.request({
      method: "GET",
      url,
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Failed to get reset link: ${res.status} ${JSON.stringify(res.data)}`);
    }

    const link = (res.data?.resetLink || "").trim();
    if (!link) throw new Error("Reset link missing in response");
    return link;
  }

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Failed to get reset link: ${res.status} ${await res.text()}`);

  const data = await res.json();
  const link = (data?.resetLink || "").trim();
  if (!link) throw new Error("Reset link missing in response");
  return link;
}
