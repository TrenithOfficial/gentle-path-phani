import { useEffect, useState } from "react";
import { Volume2 } from "lucide-react";

import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetchGuidanceToday, type ClientGuidanceRow } from "@/lib/content";

export default function Guidance() {
  const [loading, setLoading] = useState(true);
  const [guidance, setGuidance] = useState<ClientGuidanceRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetchGuidanceToday();
        if (cancelled) return;
        setGuidance(res.guidance ?? null);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || "Failed to load guidance");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const openAudio = () => {
    const url = guidance?.audioUrl?.trim();
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header title="Today's Guidance" showBack showProfileMenu />

      <main className="container max-w-lg mx-auto px-4 py-6">
        {loading && (
          <Card variant="elevated" className="animate-fade-in">
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">Loading guidance...</p>
            </CardContent>
          </Card>
        )}

        {!loading && error && (
          <Card variant="elevated" className="animate-fade-in border-destructive/30">
            <CardContent className="py-6">
              <p className="text-sm font-medium text-foreground mb-1">Could not load guidance</p>
              <p className="text-sm text-muted-foreground break-words">{error}</p>
            </CardContent>
          </Card>
        )}

        {!loading && !error && (
          <Card variant="elevated" className="animate-fade-in">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="text-lg truncate">
                    {guidance?.title || "No guidance yet"}
                  </CardTitle>
                  {guidance?.day ? (
                    <p className="text-xs text-muted-foreground mt-1">
                      Phase {guidance.phaseId} • Day {guidance.day}
                    </p>
                  ) : null}
                </div>

                {!!guidance?.audioUrl && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={openAudio}
                    title="Open audio"
                  >
                    <Volume2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>

            <CardContent>
              <div className="prose prose-sm max-w-none">
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {guidance?.content || "Your care team hasn’t published today’s guidance yet."}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
