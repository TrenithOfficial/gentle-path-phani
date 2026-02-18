import { createContext, useContext, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase"; // adjust if your firebase file path differs

type AuthCtx = { user: User | null; ready: boolean };
const Ctx = createContext<AuthCtx>({ user: null, ready: false });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setReady(true);
    });

    return () => unsub();
  }, []);

  return <Ctx.Provider value={{ user, ready }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
