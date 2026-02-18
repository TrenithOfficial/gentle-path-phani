import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { fetchMe, type AppMe } from "@/lib/me";
import { useAuth } from "@/providers/AuthProvider";

type Props = {
  allow: Array<AppMe["role"]>;
  children: React.ReactNode;
};

export default function RequireRole({ allow, children }: Props) {
  const { user, ready } = useAuth();

  const [me, setMe] = useState<AppMe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Wait until Firebase finishes restoring session.
    if (!ready) return;

    // If Firebase says there's no user, stop here and go to login.
    if (!user) {
      setMe(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const data = await fetchMe();
        if (!cancelled) setMe(data);
      } catch {
        if (!cancelled) setMe(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, user]);

  // While Firebase is restoring session OR /api/me is loading, don't redirect.
  if (!ready || loading) return null;

  // Firebase ready and user is not logged in
  if (!user) return <Navigate to="/login" replace />;

  // Logged in but /api/me failed
  if (!me) return <Navigate to="/login" replace />;

  // Logged in but wrong role
  if (!allow.includes(me.role)) {
    return <Navigate to={me.role === "admin" ? "/admin" : "/dashboard"} replace />;
  }

  return <>{children}</>;
}
