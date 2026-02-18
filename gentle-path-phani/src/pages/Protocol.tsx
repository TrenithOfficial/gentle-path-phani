import { Pill, Clock, Info, ExternalLink, Check } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetchMyProtocols, type ProtocolRow } from "@/lib/protocols";
import { fetchMe, type AppMe } from "@/lib/me";
import { getCurrentDay, getPhaseForDay } from "@/types/healing";
import { useToast } from "@/hooks/use-toast";
import {
  fetchMyProtocolItemAcks,
  confirmMyProtocolItem,
  type ProtocolItemAckRow,
} from "@/lib/protocolItemAcks";

const formatWhen = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
};

const Protocol = () => {
  const { toast } = useToast();

  const [me, setMe] = useState<AppMe | null>(null);
  const [protocols, setProtocols] = useState<ProtocolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // protocolId -> confirmedAt
  const [itemAcks, setItemAcks] = useState<Record<string, string>>({});
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        // load everything
        const [meRes, protocolsRes] = await Promise.all([fetchMe(), fetchMyProtocols()]);
        if (!mounted) return;

        setMe(meRes);
        setProtocols(protocolsRes);

        // Load confirmations
        try {
          const acks: ProtocolItemAckRow[] = await fetchMyProtocolItemAcks();
          if (!mounted) return;

          const map: Record<string, string> = {};
          for (const a of acks) map[a.protocolId] = a.confirmedAt;
          setItemAcks(map);
        } catch (e: any) {
          console.error(e);
          toast({
            title: "Confirmations not loading",
            description: e?.message || "Could not load confirmations.",
            variant: "destructive",
          });
        }
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Failed to load protocol");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [toast]);

  const currentDay = useMemo(() => {
    const startDate = me?.startDate;
    if (!startDate) return 1;
    return getCurrentDay(startDate);
  }, [me?.startDate]);

  const currentPhase = useMemo(() => getPhaseForDay(currentDay), [currentDay]);

  const onConfirmItem = async (protocolId: string) => {
    if (confirmingId) return;

    setConfirmingId(protocolId);
    try {
      const res = await confirmMyProtocolItem(protocolId);

      setItemAcks((prev) => ({
        ...prev,
        [protocolId]: res.confirmedAt,
      }));

      toast({ title: "Confirmed", description: "Saved." });
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Confirm failed",
        description: e?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setConfirmingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header title="My Protocol" showBack />

      <main className="container max-w-lg mx-auto px-4 py-6">
        <Card variant="glass" className="mb-6 animate-fade-in">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-sage/10 flex items-center justify-center">
                <Pill className="h-5 w-5 text-sage" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Current Protocol</p>
                <p className="text-xs text-muted-foreground">
                  Phase {currentPhase.id} • Day {currentDay}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {loading && (
          <Card variant="elevated" className="animate-fade-in">
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">Loading protocol...</p>
            </CardContent>
          </Card>
        )}

        {!loading && error && (
          <Card variant="elevated" className="animate-fade-in border-destructive/30">
            <CardContent className="py-6">
              <p className="text-sm font-medium text-foreground mb-1">Could not load protocol</p>
              <p className="text-sm text-muted-foreground break-words">{error}</p>
            </CardContent>
          </Card>
        )}

        {!loading && !error && (
          <div className="space-y-3">
            {protocols.length === 0 ? (
              <Card variant="elevated" className="animate-fade-in">
                <CardContent className="py-8 text-center">
                  <Pill className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                  <p className="text-muted-foreground">No protocols assigned yet</p>
                </CardContent>
              </Card>
            ) : (
              protocols.map((protocol, index) => {
                const confirmedAt = itemAcks[protocol.id] || "";
                const isConfirmed = Boolean(confirmedAt);

                return (
                  <Card
                    key={protocol.id}
                    variant="elevated"
                    className="animate-slide-up"
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <CardContent className="py-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Pill className="h-5 w-5 text-primary" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium text-foreground truncate">{protocol.name}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {protocol.createdAt ? `Added: ${formatWhen(protocol.createdAt)}` : ""}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className={[
                                  "text-[11px] px-2 py-1 rounded-full font-semibold",
                                  isConfirmed
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-red-100 text-red-700",
                                ].join(" ")}
                              >
                                {isConfirmed ? "Confirmed" : "Not confirmed"}
                              </span>

                              {protocol.shopUrl && (
                                <a
                                  href={protocol.shopUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="shrink-0"
                                >
                                  <Button variant="ghost" size="icon" className="h-7 w-7">
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </Button>
                                </a>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">{protocol.dosage}</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              {protocol.timing}
                            </span>
                          </div>

                          {protocol.notes && (
                            <div className="flex items-start gap-1.5 mt-2 text-xs text-muted-foreground">
                              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                              <span>{protocol.notes}</span>
                            </div>
                          )}

                          {isConfirmed && (
                            <p className="text-xs mt-2 text-muted-foreground">
                              Confirmed: {formatWhen(confirmedAt)}
                            </p>
                          )}

                          {!isConfirmed && (
                            <div className="mt-3">
                              <Button
                                variant="calm"
                                size="sm"
                                className="gap-2"
                                onClick={() => onConfirmItem(protocol.id)}
                                disabled={confirmingId === protocol.id}
                              >
                                <Check className="h-4 w-4" />
                                {confirmingId === protocol.id ? "Confirming..." : "Confirm"}
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default Protocol;
