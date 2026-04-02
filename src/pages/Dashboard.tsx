import {
  CalendarCheck,
  FileText,
  Pill,
  MessageSquare,
  Play,
  Pause,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";

import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { ProgressRing } from "@/components/ProgressRing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { getCurrentDay, getPhaseForDay } from "@/types/healing";
import { fetchMe } from "@/lib/me";
import { fetchGuidanceToday, resolveFileUrl } from "@/lib/content";
import { fetchMyPasswordResetLink } from "@/lib/passwordReset";

type TodayGuidance = {
  title: string;
  content: string;
  audioUrl?: string | null;
};

export default function Dashboard() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);

  const [name, setName] = useState<string>("");
  const [startDate, setStartDate] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [todaysGuidance, setTodaysGuidance] = useState<TodayGuidance>({
    title: "Loading...",
    content: "",
    audioUrl: null,
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const me = await fetchMe();
        if (cancelled) return;

        setName(me?.name || "");
        setStartDate(me?.startDate || null);

        const today = await fetchGuidanceToday();
        if (cancelled) return;

        const g = today?.guidance;

        setTodaysGuidance({
          title: g?.title || "No guidance yet",
          content:
            g?.content ||
            "Your care team hasn’t published today’s guidance yet.",
          audioUrl: g?.audioUrl ?? null,
        });
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setTodaysGuidance({
            title: "Unable to load guidance",
            content: "Please try again.",
            audioUrl: null,
          });
        }
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
    return todaysGuidance.audioUrl ? resolveFileUrl(todaysGuidance.audioUrl) : "";
  }, [todaysGuidance.audioUrl]);

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

  const currentDay = useMemo(() => {
    return startDate ? getCurrentDay(startDate) : 1;
  }, [startDate]);

  const currentPhase = useMemo(() => {
    return getPhaseForDay(currentDay);
  }, [currentDay]);

  const progress = useMemo(() => {
    const pct = (currentDay / 90) * 100;
    return Math.max(0, Math.min(100, pct));
  }, [currentDay]);

  const quickActions = [
    {
      icon: <CalendarCheck className="h-5 w-5" />,
      label: "Check-in",
      path: "/checkin",
      color: "bg-primary/10 text-primary",
    },
    {
      icon: <FileText className="h-5 w-5" />,
      label: "Sheets",
      path: "/sheets",
      color: "bg-warm-gold/10 text-warm-gold",
    },
    {
      icon: <Pill className="h-5 w-5" />,
      label: "Protocol",
      path: "/protocol",
      color: "bg-sage/10 text-sage",
    },
    {
      icon: <MessageSquare className="h-5 w-5" />,
      label: "Message",
      path: "/message",
      color: "bg-warm-terracotta/10 text-warm-terracotta",
    },
  ];

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
      <Header
        showProfileMenu
        onChangePasswordClick={async () => {
          try {
            const link = await fetchMyPasswordResetLink();
            window.open(link, "_blank", "noopener,noreferrer");
          } catch (e: any) {
            console.error(e);
            alert(e?.message || "Failed to open reset link");
          }
        }}
      />

      <main className="container max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Welcome & Progress */}
        <section className="text-center animate-fade-in">
          <h1 className="font-serif text-2xl font-semibold text-foreground mb-1">
            Welcome back{ name ? `, ${name}` : "" }
          </h1>
          <p className="text-muted-foreground text-sm">
            Day {currentDay} of your healing journey
          </p>

          <div className="flex justify-center mt-6">
            <ProgressRing progress={progress} size={140} strokeWidth={10} />
          </div>
        </section>

        {/* Current Phase Card (phase metadata stays frontend-only) */}
        <Card
          variant="glass"
          className="animate-slide-up"
          style={{ animationDelay: "0.1s" }}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-primary uppercase tracking-wider">
                Phase {currentPhase.id}
              </span>
              <span className="text-xs text-muted-foreground">
                Days {currentPhase.startDay}–{currentPhase.endDay}
              </span>
            </div>
            <CardTitle className="text-lg mt-1">{currentPhase.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {currentPhase.description}
            </p>
          </CardContent>
        </Card>

        {/* Today's Guidance (real DB content) */}
        <Card
          variant="elevated"
          className="animate-slide-up"
          style={{ animationDelay: "0.2s" }}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-lg">Today's Guidance</CardTitle>

              {!!audioSrc && (
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={toggleAudio}
                  disabled={loading}
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

            <p className="text-sm font-medium text-primary mt-1">
              {todaysGuidance.title}
            </p>
          </CardHeader>

          <CardContent>
            <div className="prose prose-sm max-w-none">
              <p className="text-sm text-muted-foreground whitespace-pre-line line-clamp-6">
                {todaysGuidance.content}
              </p>
            </div>

            <Button
              variant="link"
              className="px-0 mt-2 h-auto text-primary"
              onClick={() => navigate("/guidance/today")}
              disabled={loading}
            >
              Read full guidance →
            </Button>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <section
          className="animate-slide-up"
          style={{ animationDelay: "0.3s" }}
        >
          <h2 className="font-serif text-lg font-semibold text-foreground mb-3">
            Quick Actions
          </h2>
          <div className="grid grid-cols-4 gap-3">
            {quickActions.map((action) => (
              <button
                key={action.path}
                onClick={() => navigate(action.path)}
                className="flex flex-col items-center gap-2 p-3 rounded-xl bg-card border border-border/50 shadow-soft hover:shadow-card transition-all duration-200 active:scale-95"
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${action.color}`}
                >
                  {action.icon}
                </div>
                <span className="text-xs font-medium text-foreground">
                  {action.label}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Daily Check-in CTA */}
        <Card
          variant="glass"
          className="border-primary/20 bg-sage-light/30 animate-slide-up cursor-pointer hover:shadow-card transition-all"
          style={{ animationDelay: "0.4s" }}
          onClick={() => navigate("/checkin")}
        >
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <CalendarCheck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">Daily Check-in</p>
                <p className="text-xs text-muted-foreground">
                  How are you feeling today?
                </p>
              </div>
            </div>

            <Button variant="healing" size="sm" disabled={loading}>
              Log Now
            </Button>
          </CardContent>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
}