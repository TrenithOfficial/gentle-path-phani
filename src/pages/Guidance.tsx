import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";

import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetchGuidanceToday, resolveFileUrl, type ClientGuidanceRow } from "@/lib/content";

export default function Guidance() {
  const [loading, setLoading] = useState(true);
  const [guidance, setGuidance] = useState<ClientGuidanceRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

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
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const audioSrc = useMemo(() => {
    return guidance?.audioUrl ? resolveFileUrl(guidance.audioUrl) : "";
  }, [guidance?.audioUrl]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (!audioSrc) {
      setIsPlaying(false);
      return;
    }

    const audio = new Audio(audioSrc);
    audioRef.current = audio;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.pause();
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [audioSrc]);

  const toggleAudio = async () => {
    if (!audioRef.current) return;

    try {
      if (audioRef.current.paused) {
        await audioRef.current.play();
      } else {
        audioRef.current.pause();
      }
    } catch (e) {
      console.error(e);
      setIsPlaying(false);
      alert("Unable to play audio");
    }
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

                {!!audioSrc && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={toggleAudio}
                    title={isPlaying ? "Pause audio" : "Play audio"}
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="h-4 w-4 mr-2" />
                        Pause
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Play
                      </>
                    )}
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