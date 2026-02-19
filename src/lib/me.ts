import { getAuth } from "firebase/auth";
import { apiUrl } from "@/lib/api";
import { Capacitor } from "@capacitor/core";
import { CapacitorHttp } from "@capacitor/core";

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
  const url = apiUrl("/api/me");

  // ✅ Native (Android/iOS): no CORS
  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.request({
      method: "GET",
      url,
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status < 200 || res.status >= 300) {
      throw new Error(Failed to load /me: status=${res.status} data=${JSON.stringify(res.data)} headers=${JSON.stringify(res.headers)} url=${url}`);
    }

    return res.data as AppMe;
  }

  // ✅ Web fallback
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to load /me: ${res.status} ${text}`);
  }

  return res.json();
}
