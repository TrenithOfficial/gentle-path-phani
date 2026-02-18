import { useEffect, useMemo, useRef, useState } from "react";
import { Send, MessageSquare, CheckCheck } from "lucide-react";
import { getAuth } from "firebase/auth";

import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiUrl } from "@/lib/api";

type ChatMessage = {
  id: string;
  threadUserId: string;
  senderRole: "client" | "admin";
  body: string;
  createdAt: string;
  deliveredAt: string;
  readAtClient: string | null;
  readAtAdmin: string | null;
};

async function authedFetch(path: string, init?: RequestInit) {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("Not logged in");

  const token = await user.getIdToken(true);

  return fetch(apiUrl(path), {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
}

function formatTime(ts: string) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function Message() {
  const { toast } = useToast();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");

  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const unreadFromAdmin = useMemo(
    () => messages.filter((m) => m.senderRole === "admin" && !m.readAtClient).length,
    [messages]
  );

  const scrollToBottom = (smooth = true) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  };

  const loadChat = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await authedFetch("/api/chat/messages");
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed (${res.status})`);
      }
      const data = (await res.json()) as ChatMessage[];
      setMessages(data);
      return data;
    } catch (err: any) {
      toast({
        title: "Failed to load chat",
        description: err?.message || "Something went wrong.",
        variant: "destructive",
      });
      return null;
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const markRead = async () => {
    try {
      await authedFetch("/api/chat/read", { method: "POST" });
      return true;
    } catch {
      return false;
    }
  };

  // initial load
  useEffect(() => {
    let mounted = true;

    void (async () => {
      const data = await loadChat();
      if (!mounted || !data) return;

      // If there are unread admin messages, mark read immediately.
      const hasUnread = data.some((m) => m.senderRole === "admin" && !m.readAtClient);
      if (hasUnread) {
        await markRead();
        await loadChat(true); // refresh so unread badges update right away
      }

      scrollToBottom(false);
    })();

    const t = window.setInterval(() => {
      void (async () => {
        const data = await loadChat(true);
        if (!data) return;

        // Auto-mark as read when new admin messages arrive while user is on this screen
        const hasUnread = data.some((m) => m.senderRole === "admin" && !m.readAtClient);
        if (hasUnread) {
          await markRead();
          await loadChat(true);
        }
      })();
    }, 3000);

    return () => {
      mounted = false;
      window.clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (nearBottom) scrollToBottom(false);
  }, [messages]);

  const onSend = async () => {
    const body = draft.trim();
    if (!body) return;

    setSending(true);

    const tempId = `temp-${Date.now()}`;
    const now = new Date().toISOString();
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        threadUserId: "",
        senderRole: "client",
        body,
        createdAt: now,
        deliveredAt: now,
        readAtClient: now,
        readAtAdmin: null,
      },
    ]);
    setDraft("");
    scrollToBottom(true);

    try {
      const res = await authedFetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed (${res.status})`);
      }

      await loadChat(true);
    } catch (err: any) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setDraft(body);
      toast({
        title: "Failed to send",
        description: err?.message || "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header title="Messages" showBack />

      <main className="container max-w-lg mx-auto px-4 py-4 space-y-4">
        <Card variant="glass" className="animate-fade-in">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-warm-terracotta/10 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-warm-terracotta" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Care Team Chat</p>
                <p className="text-xs text-muted-foreground">
                  {unreadFromAdmin > 0 ? `${unreadFromAdmin} unread` : "All caught up"}
                </p>
              </div>

              <Button variant="outline" size="sm" onClick={() => void loadChat()} disabled={loading}>
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card variant="elevated" className="animate-slide-up">
          <CardContent className="p-0">
            <div ref={scrollerRef} className="h-[58vh] overflow-auto px-3 py-4 space-y-2 bg-muted/10">
              {loading ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Loading chat…</div>
              ) : messages.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">No messages yet. Say hi.</div>
              ) : (
                messages.map((m) => {
                  const mine = m.senderRole === "client";
                  const time = formatTime(m.createdAt);
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={
                          "max-w-[85%] rounded-2xl px-3 py-2 shadow-soft border " +
                          (mine
                            ? "bg-primary text-primary-foreground border-primary/20"
                            : "bg-card text-foreground border-border/60")
                        }
                      >
                        <p className="text-sm whitespace-pre-line break-words">{m.body}</p>
                        <div className={`mt-1 flex items-center gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                          <span className={`text-[11px] ${mine ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                            {time}
                          </span>
                          {mine && (
                            <span className="text-[11px] text-primary-foreground/80 inline-flex items-center gap-1">
                              <CheckCheck className="h-3 w-3" />
                              {m.readAtAdmin ? "Seen" : "Delivered"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-3 border-t border-border/60 bg-card">
              <div className="flex gap-2 items-end">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Type a message…"
                  className="min-h-[56px] max-h-[140px]"
                />
                <Button
                  variant="healing"
                  className="h-[56px] px-4"
                  onClick={() => void onSend()}
                  disabled={sending || !draft.trim()}
                  title={!draft.trim() ? "Type a message" : "Send"}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
}
