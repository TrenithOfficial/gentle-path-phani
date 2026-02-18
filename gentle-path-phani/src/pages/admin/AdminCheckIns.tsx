import { useEffect, useMemo, useState } from "react";
import { Search, User, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fetchAdminCheckins, type AdminCheckInRow } from "@/lib/adminCheckins";

function localDayKey(iso: string) {
  const d = new Date(iso);
  // Stable local grouping key
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function localDayLabelFromKey(key: string) {
  // key is YYYY-MM-DD
  const [y, m, d] = key.split("-").map((x) => parseInt(x, 10));
  const dt = new Date(y, (m || 1) - 1, d || 1); // local midnight
  return dt.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

const AdminCheckIns = () => {
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const [checkins, setCheckins] = useState<AdminCheckInRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await fetchAdminCheckins();
        if (!cancelled) setCheckins(data);
      } catch (e) {
        console.error(e);
        if (!cancelled) setCheckins([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Filter by email for now
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return checkins;
    return checkins.filter((c) => (c.email || "").toLowerCase().includes(q));
  }, [checkins, searchQuery]);

  // ✅ Group by LOCAL date
  const grouped = useMemo(() => {
    const map: Record<string, AdminCheckInRow[]> = {};
    for (const c of filtered) {
      const createdAt = (c.createdAt || "").trim();
      const dayKey = createdAt ? localDayKey(createdAt) : "unknown";

      if (!map[dayKey]) map[dayKey] = [];
      map[dayKey].push(c);
    }

    // sort within each day newest-first
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => {
        const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bt - at;
      });
    }

    return map;
  }, [filtered]);

  const sortedDates = useMemo(() => {
    return Object.keys(grouped).sort((a, b) => (a < b ? 1 : -1));
  }, [grouped]);

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header title="Client Check-ins" showBack />

      <main className="container max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Search */}
        <div className="relative animate-fade-in">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by client email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {loading && <p className="text-sm text-muted-foreground">Loading check-ins…</p>}

        {!loading && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground">No check-ins found.</p>
        )}

        {/* Check-ins by date */}
        <div className="space-y-4">
          {sortedDates.map((date, dateIndex) => {
            const dateCheckIns = grouped[date] || [];

            return (
              <section
                key={date}
                className="animate-slide-up"
                style={{ animationDelay: `${dateIndex * 0.05}s` }}
              >
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  {date === "unknown" ? "Unknown date" : localDayLabelFromKey(date)}
                </h3>

                <div className="space-y-2">
                  {dateCheckIns.map((c) => {
                    const travelStart = (c.travelStartDate || "").trim();
                    const travelReturn = (c.travelReturnDate || "").trim();
                    const missedNote = (c.missedProtocolNote || "").trim();

                    return (
                      <Card
                        key={c.id}
                        variant="elevated"
                        className="cursor-pointer hover:shadow-elevated transition-all active:scale-[0.99]"
                        onClick={() => navigate(`/admin/checkins/${c.id}`)}
                      >
                        <CardContent className="py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <User className="h-5 w-5 text-primary" />
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-foreground">{c.email}</p>

                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-xs text-muted-foreground">
                                  Day <span className="text-foreground font-medium">{c.day}</span>
                                </span>

                                <span className="text-xs text-muted-foreground">
                                  Mood{" "}
                                  <span className="text-foreground font-medium">
                                    {c.mood ?? "-"}
                                  </span>
                                  /5
                                </span>

                                <span className="text-xs text-muted-foreground">
                                  Energy{" "}
                                  <span className="text-foreground font-medium">
                                    {c.energy ?? "-"}
                                  </span>
                                  /5
                                </span>
                              </div>

                              <div className="flex gap-2 mt-2">
                                {c.isTravelDay && (
                                  <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
                                    Travel
                                  </span>
                                )}
                                {c.missedProtocol && (
                                  <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">
                                    Missed Protocol
                                  </span>
                                )}
                              </div>

                              {/* ✅ NEW: show travel date range */}
                              {c.isTravelDay && (travelStart || travelReturn) && (
                                <p className="text-xs text-muted-foreground mt-2">
                                  Travel: {travelStart || "?"} → {travelReturn || "?"}
                                </p>
                              )}

                              {/* ✅ NEW: show missed protocol note preview */}
                              {c.missedProtocol && missedNote && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                  Missed note: {missedNote}
                                </p>
                              )}
                            </div>

                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </main>

      <BottomNav isAdmin />
    </div>
  );
};

export default AdminCheckIns;
