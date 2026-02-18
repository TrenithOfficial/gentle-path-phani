import { Users, FileText, MessageSquare, CalendarCheck, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useMemo, useState } from "react";
import { getAuth } from "firebase/auth";
import { apiUrl } from "@/lib/api";

import { fetchAdminCheckins, type AdminCheckInRow } from "@/lib/adminCheckins";
import { fetchAdminUsers, type AdminUserRow } from "@/lib/adminUsers";

type ChatThreadSummary = {
  userId: string;
  email: string;
  name?: string | null;
  startDate?: string | null;
  lastBody?: string | null;
  lastAt?: string | null;
  unreadAdmin: number;
  unreadClient: number;
};

async function fetchUnreadChatCount(): Promise<number> {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("Not logged in");

  const token = await user.getIdToken(true);

  const res = await fetch(apiUrl("/api/admin/chat/threads"), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Failed to load chat threads: ${res.status}`);
  }

  const threads: ChatThreadSummary[] = await res.json();
  return threads.reduce((sum, t) => sum + (t.unreadAdmin || 0), 0);
}


// ✅ Compare days in LOCAL time so “today” matches what you see on screen
function localDayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function todayLocalKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

const AdminDashboard = () => {
  const navigate = useNavigate();

  const [checkins, setCheckins] = useState<AdminCheckInRow[]>([]);
  const [usersActive, setUsersActive] = useState<AdminUserRow[]>([]);
  const [loadingCheckins, setLoadingCheckins] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const [unreadMessagesCount, setUnreadMessagesCount] = useState<number>(0);
  const [loadingUnreadMessages, setLoadingUnreadMessages] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoadingCheckins(true);
      try {
        const data = await fetchAdminCheckins();
        if (!cancelled) setCheckins(data);
      } catch (e) {
        console.error(e);
        if (!cancelled) setCheckins([]);
      } finally {
        if (!cancelled) setLoadingCheckins(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoadingUsers(true);
      try {
        const data = await fetchAdminUsers("active");
        if (!cancelled) {
          const clients = (data || []).filter((u) => u.role === "client");
          setUsersActive(clients);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) setUsersActive([]);
      } finally {
        if (!cancelled) setLoadingUsers(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoadingUnreadMessages(true);
      try {
        const count = await fetchUnreadChatCount();
        if (!cancelled) setUnreadMessagesCount(count);

        console.error(e);
        if (!cancelled) setUnreadMessagesCount(0);
      } finally {
        if (!cancelled) setLoadingUnreadMessages(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const clientCount = loadingUsers ? "..." : usersActive.length;

  // ✅ FIX: “today” based on LOCAL day
  const todayKey = todayLocalKey();
  const todayCheckIns = loadingCheckins
    ? "..."
    : checkins.filter((c) => localDayKey(c.createdAt) === todayKey).length;

  const unreadMessages = loadingUnreadMessages ? "..." : unreadMessagesCount;

  const stats = useMemo(
    () => [
      {
        label: "Active Clients",
        value: clientCount,
        icon: <Users className="h-5 w-5" />,
        color: "text-primary",
      },
      {
        label: "Today's Check-ins",
        value: todayCheckIns,
        icon: <CalendarCheck className="h-5 w-5" />,
        color: "text-sage",
      },
      {
        label: "Unread Messages",
        value: unreadMessages,
        icon: <MessageSquare className="h-5 w-5" />,
        color: "text-warm-gold",
      },
    ],
    [clientCount, todayCheckIns, unreadMessages]
  );

  const quickActions = [
    {
      label: "Manage Users",
      description: "Create and edit client accounts",
      icon: <Users className="h-6 w-6" />,
      path: "/admin/users",
    },
    {
      label: "Content",
      description: "Daily guidance and sheets",
      icon: <FileText className="h-6 w-6" />,
      path: "/admin/content",
    },
    {
      label: "View Check-ins",
      description: "Client daily logs",
      icon: <CalendarCheck className="h-6 w-6" />,
      path: "/admin/checkins",
    },
    {
      label: "Messages",
      description: "Client communications",
      icon: <MessageSquare className="h-6 w-6" />,
      path: "/admin/messages",
    },
  ];

  const loading = loadingUsers || loadingCheckins;

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header title="Admin Dashboard" />

      <main className="container max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Welcome */}
        <section className="animate-fade-in">
          <h1 className="font-serif text-2xl font-semibold text-foreground mb-1">
            Admin Overview
          </h1>
          <p className="text-muted-foreground text-sm">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        </section>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 animate-slide-up">
          {stats.map((stat) => (
            <Card key={stat.label} variant="elevated" className="text-center">
              <CardContent className="pt-4 pb-3">
                <div className={`mx-auto mb-2 ${stat.color}`}>{stat.icon}</div>
                <p className="text-2xl font-semibold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <section className="space-y-3 animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <h2 className="font-serif text-lg font-semibold text-foreground">Quick Actions</h2>

          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action) => (
              <Card
                key={action.path}
                variant="elevated"
                className="cursor-pointer hover:shadow-elevated transition-all active:scale-[0.98]"
                onClick={() => navigate(action.path)}
              >
                <CardContent className="pt-4 pb-4">
                  <div className="text-primary mb-2">{action.icon}</div>
                  <p className="font-medium text-foreground text-sm">{action.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Recent Activity */}
        <section className="animate-slide-up" style={{ animationDelay: "0.2s" }}>
          <h2 className="font-serif text-lg font-semibold text-foreground mb-3">
            Recent Activity
          </h2>

          <Card variant="glass">
            <CardContent className="py-4 space-y-3">
              {!loading &&
                checkins.slice(0, 3).map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Clock className="h-4 w-4 text-primary" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{c.email} checked in</p>
                      <p className="text-xs text-muted-foreground">Mood: {(c.mood ?? "-")}/5</p>
                    </div>

                    <span className="text-xs text-muted-foreground">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}

              {loading && (
                <p className="text-sm text-muted-foreground text-center py-4">Loading activity...</p>
              )}

              {!loading && checkins.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No check-ins yet.</p>
              )}
            </CardContent>
          </Card>
        </section>
      </main>

      <BottomNav isAdmin />
    </div>
  );
};

export default AdminDashboard;
