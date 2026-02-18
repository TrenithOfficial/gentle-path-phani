import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Card, CardContent } from "@/components/ui/card";
import { fetchAdminCheckinById, type AdminCheckInRow } from "@/lib/adminCheckins";

const AdminCheckInDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<AdminCheckInRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!id) {
        setError("Missing check-in id");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const data = await fetchAdminCheckinById(id);
        if (!cancelled) setRow(data);
      } catch (e: any) {
        console.error(e);
        if (!cancelled) setError(e?.message || "Failed to load check-in details");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const createdAt = row?.createdAt ? new Date(row.createdAt as any).toLocaleString() : "-";

  const travelStart = row?.travelStartDate?.trim() ? row.travelStartDate : "-";
  const travelReturn = row?.travelReturnDate?.trim() ? row.travelReturnDate : "-";
  const missedNote = row?.missedProtocolNote?.trim() ? row.missedProtocolNote : "-";

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header title="Check-in Details" showBack />

      <main className="container max-w-lg mx-auto px-4 py-6 space-y-4">
        <Card variant="elevated">
          <CardContent className="py-4 space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Check-in ID</p>
              <p className="text-sm font-medium break-all">{id}</p>
            </div>

            {loading && <p className="text-sm text-muted-foreground">Loading details…</p>}

            {!loading && error && <p className="text-sm text-destructive">{error}</p>}

            {!loading && !error && row && (
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Client</p>
                  <p className="text-sm font-medium">{row.email || "-"}</p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Day</p>
                    <p className="text-sm font-medium">{row.day ?? "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Mood</p>
                    <p className="text-sm font-medium">
                      {row.mood ?? "-"}
                      {row.mood != null ? "/5" : ""}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Energy</p>
                    <p className="text-sm font-medium">
                      {row.energy ?? "-"}
                      {row.energy != null ? "/5" : ""}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {row.isTravelDay && (
                    <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
                      Travel
                    </span>
                  )}
                  {row.missedProtocol && (
                    <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">
                      Missed Protocol
                    </span>
                  )}
                </div>

                {/* ✅ NEW: Travel dates visible to admin */}
                {row.isTravelDay && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Travel start</p>
                      <p className="text-sm font-medium">{travelStart}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Travel return</p>
                      <p className="text-sm font-medium">{travelReturn}</p>
                    </div>
                  </div>
                )}

                {/* ✅ NEW: Missed protocol note visible to admin */}
                {row.missedProtocol && (
                  <div>
                    <p className="text-xs text-muted-foreground">Missed protocol note</p>
                    <p className="text-sm whitespace-pre-wrap">{missedNote}</p>
                  </div>
                )}

                <div>
                  <p className="text-xs text-muted-foreground">Notes</p>
                  <p className="text-sm whitespace-pre-wrap">{row.notes?.trim() ? row.notes : "-"}</p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="text-sm">{createdAt}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <BottomNav isAdmin />
    </div>
  );
};

export default AdminCheckInDetail;
