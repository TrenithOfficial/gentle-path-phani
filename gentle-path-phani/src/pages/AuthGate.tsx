import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { fetchMe } from "@/lib/me";

export default function AuthGate() {
  const [to, setTo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const me = await fetchMe();
        if (cancelled) return;
        setTo(me.role === "admin" ? "/admin" : "/dashboard");
      } catch {
        if (cancelled) return;
        setTo("/login");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!to) return null;
  return <Navigate to={to} replace />;
}
