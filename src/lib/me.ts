import { getAuth, onAuthStateChanged } from "firebase/auth";
import { apiUrl } from "@/lib/api";
import { httpGet } from "@/lib/http";

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
  const user: any = await waitForUser(auth);

  const token = await user.getIdToken(true);
  const url = apiUrl("/api/me");

  const res = await httpGet<AppMe>(url, { Authorization: `Bearer ${token}` });

  console.log("ME URL:", url);
  console.log("ME STATUS:", res.status);
  console.log("ME DATA:", res.data);

  if (res.status < 200 || res.status >= 300) {
    throw new Error(
      `Failed to load /me: status=${res.status} data=${JSON.stringify(res.data)} url=${url}`
    );
  }

  return res.data;
}

export async function fetchMeWithRetry(retries = 3): Promise<AppMe> {
  let lastErr: any;

  for (let i = 0; i < retries; i++) {
    try {
      if (i > 0) await sleep(600 * i);
      return await fetchMe();
    } catch (e: any) {
      lastErr = e;
      const msg = String(e?.message || "");

      if (
        msg.includes("Not logged in") ||
        msg.includes("Auth timed out") ||
        msg.includes("status=401")
      ) {
        continue;
      }

      throw e;
    }
  }

  throw lastErr;
}
