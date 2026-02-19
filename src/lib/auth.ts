import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, authReady } from "@/lib/firebase";

const withTimeout = <T,>(p: Promise<T>, ms = 15000) =>
  Promise.race([
    p,
    new Promise<T>((_, rej) =>
      setTimeout(() => rej(new Error(`Auth timed out after ${ms}ms`)), ms)
    ),
  ]);

export async function login(email: string, password: string) {
  console.log("AUTH: login() called");

  console.log("AUTH: waiting authReady...");
  await withTimeout(authReady, 8000);
  console.log("AUTH: authReady done");

  console.log("AUTH: calling signInWithEmailAndPassword...");
  const cred = await withTimeout(
    signInWithEmailAndPassword(auth, email, password),
    15000
  );

  console.log("AUTH: signIn success", cred.user?.uid);
  return cred.user;
}
