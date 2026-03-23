import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { fetchHealingSheets, resolveFileUrl, type ClientHealingSheetRow } from "@/lib/content";

export default function HealingSheets() {
  const [loading, setLoading] = useState(true);
  const [sheets, setSheets] = useState<ClientHealingSheetRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const data = await fetchHealingSheets();
        if (!cancelled) setSheets(data || []);
      } catch (e) {
        console.error(e);
        if (!cancelled) setSheets([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = useMemo(() => {
    const phase: ClientHealingSheetRow[] = [];
    const personal: ClientHealingSheetRow[] = [];
    const other: ClientHealingSheetRow[] = [];

    for (const s of sheets) {
      if (s.userId) personal.push(s);
      else if (s.phaseId) phase.push(s);
      else other.push(s);
    }

    return { phase, personal, other };
  }, [sheets]);

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header title="Healing Sheets" showBack showProfileMenu />

      <main className="container max-w-lg mx-auto px-4 py-6 space-y-6">
        <Card variant="elevated">
          <CardContent className="py-4 space-y-3">
            <h2 className="font-serif text-lg font-semibold text-foreground">Your Sheets</h2>

            {loading && (
              <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
            )}

            {!loading && sheets.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No sheets available yet.
              </p>
            )}

            {!loading &&
              sheets.map((s) => {
                const href = resolveFileUrl(s.url);

                const uploadedLabel = s.uploadedAt
                  ? `Uploaded ${new Date(s.uploadedAt).toLocaleString()}`
                  : "";

                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-3 py-2 border-b border-border/50 last:border-0"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>

                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{s.name}</p>

                        <p className="text-xs text-muted-foreground">
                          {s.userId ? "Personal" : s.phaseId ? `Phase ${s.phaseId}` : "General"}
                        </p>

                        {uploadedLabel && (
                          <p className="text-[11px] text-muted-foreground mt-1">{uploadedLabel}</p>
                        )}
                      </div>
                    </div>

                    <Button variant="secondary" asChild>
                      <a href={href} target="_blank" rel="noreferrer">
                        View
                      </a>
                    </Button>
                  </div>
                );
              })}
          </CardContent>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
}
