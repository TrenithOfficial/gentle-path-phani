import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, authReady } from "@/lib/firebase";

export async function login(email: string, password: string) {
  await authReady; // ✅ critical for iOS WKWebView, safe for Android too
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}
