import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Plane, AlertCircle } from "lucide-react";
import { Header } from "@/components/Header";
import { MoodScale } from "@/components/MoodScale";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { getCurrentDay } from "@/types/healing";
import { createCheckIn } from "@/lib/checkins";
import { fetchMe } from "@/lib/me";

const CheckIn = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [startDate, setStartDate] = useState<string | null>(null);
  const [meLoading, setMeLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setMeLoading(true);
        const me = await fetchMe();
        if (cancelled) return;
        setStartDate(me?.startDate || null);
      } catch (e) {
        console.error(e);
        if (!cancelled) setStartDate(null);
      } finally {
        if (!cancelled) setMeLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const currentDay = useMemo(() => {
    return startDate ? getCurrentDay(startDate) : 1;
  }, [startDate]);

  const [mood, setMood] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [notes, setNotes] = useState("");

  const [isTravelDay, setIsTravelDay] = useState(false);
  const [missedProtocol, setMissedProtocol] = useState(false);

  // ✅ NEW fields
  const [travelStartDate, setTravelStartDate] = useState("");
  const [travelReturnDate, setTravelReturnDate] = useState("");
  const [missedProtocolNote, setMissedProtocolNote] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Clear dependent fields when unchecked (prevents stale values)
  useEffect(() => {
    if (!isTravelDay) {
      setTravelStartDate("");
      setTravelReturnDate("");
    }
  }, [isTravelDay]);

  useEffect(() => {
    if (!missedProtocol) {
      setMissedProtocolNote("");
    }
  }, [missedProtocol]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // ✅ Frontend validation (matches backend rules)
    if (isTravelDay && (!travelStartDate || !travelReturnDate)) {
      toast({
        title: "Missing travel dates",
        description: "Please select both start and return dates.",
        variant: "destructive",
      });
      return;
    }

    if (missedProtocol && !missedProtocolNote.trim()) {
      toast({
        title: "Missing note",
        description: "Please add a note for the missed protocol.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await createCheckIn({
        day: currentDay,
        mood,
        energy,
        notes,
        isTravelDay,
        missedProtocol,

        // ✅ NEW
        travelStartDate: isTravelDay ? travelStartDate : null,
        travelReturnDate: isTravelDay ? travelReturnDate : null,
        missedProtocolNote: missedProtocol ? missedProtocolNote.trim() : "",
      });

      setIsSubmitted(true);
      toast({
        title: "Check-in Complete",
        description: "Your daily check-in has been saved.",
      });
    } catch (err: any) {
      toast({
        title: "Save failed",
        description: err?.message || "Could not save check-in.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background">
        <Header title="Daily Check-in" showBack />

        <main className="container max-w-lg mx-auto px-4 py-8">
          <Card variant="elevated" className="text-center animate-fade-in">
            <CardContent className="pt-8 pb-6">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-primary" />
              </div>
              <h2 className="font-serif text-xl font-semibold text-foreground mb-2">
                Check-in Complete!
              </h2>
              <p className="text-muted-foreground mb-6">
                Thank you for logging Day {currentDay}. Keep up the great work on your healing journey.
              </p>
              <Button variant="healing" onClick={() => navigate("/dashboard")}>
                Return to Dashboard
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      <Header title="Daily Check-in" showBack />

      <main className="container max-w-lg mx-auto px-4 py-6">
        <Card variant="glass" className="mb-6 animate-fade-in">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Day {meLoading ? "..." : currentDay}</CardTitle>
            <CardDescription>
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </CardDescription>
          </CardHeader>
        </Card>

        <form onSubmit={handleSubmit} className="space-y-6 animate-slide-up">
          <Card variant="elevated">
            <CardContent className="pt-5">
              <MoodScale label="How is your mood today?" value={mood} onChange={setMood} />
            </CardContent>
          </Card>

          <Card variant="elevated">
            <CardContent className="pt-5">
              <MoodScale label="What's your energy level?" value={energy} onChange={setEnergy} />
            </CardContent>
          </Card>

          <Card variant="elevated">
            <CardContent className="pt-5">
              <label className="text-sm font-medium text-foreground mb-2 block">
                Notes (optional)
              </label>
              <Textarea
                placeholder="Any symptoms, wins, or observations to share..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[100px]"
              />
            </CardContent>
          </Card>

          <Card variant="elevated">
            <CardContent className="pt-5 space-y-4">
              {/* Travel */}
              <div className="flex items-start gap-3">
                <Checkbox
                  id="travel"
                  checked={isTravelDay}
                  onCheckedChange={(checked) => setIsTravelDay(checked as boolean)}
                />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor="travel"
                    className="text-sm font-medium leading-none cursor-pointer flex items-center gap-2"
                  >
                    <Plane className="h-4 w-4 text-muted-foreground" />
                    Travel day
                  </label>
                  <p className="text-xs text-muted-foreground">Check if you're traveling today</p>
                </div>
              </div>

              {/* ✅ Travel dates appear BELOW travel option */}
              {isTravelDay && (
                <div className="pl-8 space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Start date</label>
                    <Input
                      type="date"
                      value={travelStartDate}
                      onChange={(e) => setTravelStartDate(e.target.value)}
                      max={travelReturnDate || undefined}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Return date</label>
                    <Input
                      type="date"
                      value={travelReturnDate}
                      onChange={(e) => setTravelReturnDate(e.target.value)}
                      min={travelStartDate || undefined}
                    />
                  </div>
                </div>
              )}

              {/* Missed protocol */}
              <div className="flex items-start gap-3">
                <Checkbox
                  id="missed"
                  checked={missedProtocol}
                  onCheckedChange={(checked) => setMissedProtocol(checked as boolean)}
                />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor="missed"
                    className="text-sm font-medium leading-none cursor-pointer flex items-center gap-2"
                  >
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    Missed protocol today
                  </label>
                  <p className="text-xs text-muted-foreground">Check if you missed any supplements</p>
                </div>
              </div>

              {/* ✅ Missed note appears BELOW missed protocol */}
              {missedProtocol && (
                <div className="pl-8">
                  <label className="text-xs text-muted-foreground">Note</label>
                  <Textarea
                    placeholder="What did you miss and why?"
                    value={missedProtocolNote}
                    onChange={(e) => setMissedProtocolNote(e.target.value)}
                    className="min-h-[90px]"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Button
            type="submit"
            variant="healing"
            size="lg"
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving..." : "Submit Check-in"}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Check-ins cannot be edited once submitted
          </p>
        </form>
      </main>
    </div>
  );
};

export default CheckIn;
