import { getAuth, onAuthStateChanged } from "firebase/auth";
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

// --------------------
// Helpers
// --------------------
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ⭐ WAIT FOR FIREBASE USER (ANDROID FIX)
async function waitForUser(auth: any) {
  if (auth.currentUser) return auth.currentUser;

  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, (u) => {
      unsub();
      if (!u) return reject(new Error("Not logged in (auth not ready)"));
      resolve(u);
    });

    setTimeout(() => {
      unsub();
      reject(new Error("Auth timed out"));
    }, 8000);
  });
}

// --------------------
// API
// --------------------
export async function fetchMe(): Promise<AppMe> {
  const auth = getAuth();

  // ✅ Use waitForUser instead of reading currentUser immediately
  const user: any = await waitForUser(auth);

  // ✅ force refresh token (helps Android right after login)
  const token = await user.getIdToken(true);

  const url = apiUrl("/api/me");

  // ✅ Native (Android/iOS): no CORS
  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.request({
      method: "GET",
      url,
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log("ME(native) URL:", url);
    console.log("ME(native) STATUS:", res.status);
    console.log("ME(native) DATA:", res.data);
    console.log("ME(native) HEADERS:", res.headers);

    if (res.status < 200 || res.status >= 300) {
      throw new Error(
        `Failed to load /me: status=${res.status} data=${JSON.stringify(
          res.data
        )} headers=${JSON.stringify(res.headers)} url=${url}`
      );
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

// ✅ Use this in your login flow to avoid "fails first time, works after restart"
export async function fetchMeWithRetry(retries = 3): Promise<AppMe> {
  let lastErr: any;

  for (let i = 0; i < retries; i++) {
    try {
      if (i > 0) await sleep(600 * i); // 0ms, 600ms, 1200ms...
      return await fetchMe();
    } catch (e: any) {
      lastErr = e;
      const msg = String(e?.message || "");

      // Retry only for transient timing / token readiness cases
      if (
        msg.includes("Not logged in") ||
        msg.includes("Auth timed out") ||
        msg.includes("status=401")
      ) {
        continue;
      }

      // Not transient -> throw immediately
      throw e;
    }
  }

  throw lastErr;
}
