import { useEffect, useMemo, useRef, useState } from "react";
import { Send, MessageSquare, Search, CheckCheck, UserRound } from "lucide-react";
import { getAuth } from "firebase/auth";

import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiUrl } from "@/lib/api";

type ThreadSummary = {
  userId: string;
  email: string;
  name: string | null;
  startDate: string | null;
  lastBody: string | null;
  lastAt: string | null;
  unreadAdmin: number;
  unreadClient: number;
};

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

function shortPreview(s?: string | null) {
  const t = (s || "").trim();
  if (!t) return "";
  return t.length > 60 ? `${t.slice(0, 60)}…` : t;
}

function displayName(t: ThreadSummary) {
  return (t.name && t.name.trim()) || t.email;
}

export default function AdminMessages() {
  const { toast } = useToast();

  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [q, setQ] = useState("");

  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const selectedThread = useMemo(
    () => threads.find((t) => t.userId === selectedUserId) || null,
    [threads, selectedUserId]
  );

  const filteredThreads = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return threads;
    return threads.filter((t) => {
      const n = (t.name || "").toLowerCase();
      const e = (t.email || "").toLowerCase();
      return n.includes(needle) || e.includes(needle);
    });
  }, [threads, q]);

  const scrollToBottom = (smooth = true) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  };

  const loadThreads = async (silent = false) => {
    if (!silent) setLoadingThreads(true);
    try {
      const res = await authedFetch(`/api/admin/chat/threads?status=${filter}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed (${res.status})`);
      }
      const data = (await res.json()) as ThreadSummary[];
      setThreads(data);

      // pick first thread automatically if nothing selected
      if (!selectedUserId && data.length > 0) {
        setSelectedUserId(data[0].userId);
      }
    } catch (err: any) {
      toast({
        title: "Failed to load clients",
        description: err?.message || "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      if (!silent) setLoadingThreads(false);
    }
  };

  // CHANGED: return data so the poll can decide if it should mark read
  const loadMessages = async (userId: string, silent = false): Promise<ChatMessage[] | null> => {
    if (!silent) setLoadingMessages(true);
    try {
      const res = await authedFetch(`/api/admin/chat/threads/${userId}/messages`);
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
      if (!silent) setLoadingMessages(false);
    }
  };

  const markReadAdmin = async (userId: string) => {
    try {
      await authedFetch(`/api/admin/chat/threads/${userId}/read`, { method: "POST" });
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    void loadThreads();

    const t = window.setInterval(() => {
      void (async () => {
        await loadThreads(true);

        if (selectedUserId) {
          const data = await loadMessages(selectedUserId, true);

          // NEW: if client sent messages while admin is viewing, mark read immediately
          const hasUnreadClient = (data || []).some(
            (m) => m.senderRole === "client" && !m.readAtAdmin
          );

          if (hasUnreadClient) {
            await markReadAdmin(selectedUserId);
            await loadMessages(selectedUserId, true);
            await loadThreads(true);
          }
        }
      })();
    }, 3000);

    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, selectedUserId]);

  useEffect(() => {
    if (!selectedUserId) return;
    void (async () => {
      await loadMessages(selectedUserId);
      await markReadAdmin(selectedUserId);
      scrollToBottom(false);
      // refresh thread list to clear unread badge
      await loadThreads(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
    if (nearBottom) scrollToBottom(false);
  }, [messages]);

  const onSelectThread = (t: ThreadSummary) => {
    setSelectedUserId(t.userId);
  };

  const onSend = async () => {
    if (!selectedUserId) return;
    const body = draft.trim();
    if (!body) return;

    setSending(true);

    const tempId = `temp-${Date.now()}`;
    const now = new Date().toISOString();
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        threadUserId: selectedUserId,
        senderRole: "admin",
        body,
        createdAt: now,
        deliveredAt: now,
        readAtClient: null,
        readAtAdmin: now,
      },
    ]);
    setDraft("");
    scrollToBottom(true);

    try {
      const res = await authedFetch(`/api/admin/chat/threads/${selectedUserId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed (${res.status})`);
      }

      await loadMessages(selectedUserId, true);
      await loadThreads(true);
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

  const totalUnread = useMemo(
    () => threads.reduce((sum, t) => sum + (t.unreadAdmin || 0), 0),
    [threads]
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header title="Messages" showBack />

      <main className="container max-w-5xl mx-auto px-4 py-4">
        <div className="mb-4 flex items-center gap-3 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            {threads.length} clients
          </span>
          <span>{totalUnread} unread</span>

          <div className="ml-auto flex gap-2">
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("all")}
            >
              All
            </Button>
            <Button
              variant={filter === "active" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("active")}
            >
              Active
            </Button>
            <Button
              variant={filter === "inactive" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("inactive")}
            >
              Inactive
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
          {/* Left: client list */}
          <Card variant="elevated" className="overflow-hidden">
            <CardContent className="p-0">
              <div className="p-3 border-b border-border/60 bg-card">
                <div className="relative">
                  <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search clients"
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="max-h-[70vh] overflow-auto">
                {loadingThreads ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">Loading clients…</div>
                ) : filteredThreads.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">No clients found</div>
                ) : (
                  filteredThreads.map((t) => {
                    const active = !!t.startDate;
                    const selected = t.userId === selectedUserId;

                    return (
                      <button
                        key={t.userId}
                        onClick={() => onSelectThread(t)}
                        className={
                          "w-full text-left px-3 py-3 border-b border-border/40 hover:bg-muted/30 transition " +
                          (selected ? "bg-muted/40" : "")
                        }
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <UserRound className="h-4 w-4 text-primary" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-foreground truncate">
                                {displayName(t)}
                              </p>
                              <span
                                className={
                                  "text-[11px] px-2 py-0.5 rounded-full border " +
                                  (active
                                    ? "border-sage/30 bg-sage/10 text-sage"
                                    : "border-muted-foreground/20 bg-muted/20 text-muted-foreground")
                                }
                              >
                                {active ? "Active" : "Inactive"}
                              </span>
                            </div>

                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {shortPreview(t.lastBody) || "No messages yet"}
                            </p>
                          </div>

                          {t.unreadAdmin > 0 && (
                            <div className="ml-2 shrink-0">
                              <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] text-[11px] rounded-full bg-primary text-primary-foreground">
                                {t.unreadAdmin}
                              </span>
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          {/* Right: chat */}
          <Card variant="elevated" className="overflow-hidden">
            <CardContent className="p-0">
              <div className="p-3 border-b border-border/60 bg-card">
                {selectedThread ? (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-warm-terracotta/10 flex items-center justify-center">
                      <MessageSquare className="h-5 w-5 text-warm-terracotta" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {displayName(selectedThread)}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {selectedThread.email}
                      </p>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-auto"
                      onClick={() => selectedUserId && void loadMessages(selectedUserId)}
                      disabled={loadingMessages || !selectedUserId}
                    >
                      Refresh
                    </Button>
                  </div>
                ) : (
                  <div className="py-2 text-sm text-muted-foreground">Select a client to start</div>
                )}
              </div>

              <div
                ref={scrollerRef}
                className="h-[58vh] overflow-auto px-3 py-4 space-y-2 bg-muted/10"
                onClick={() => selectedUserId && void markReadAdmin(selectedUserId)}
              >
                {!selectedThread ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">No thread selected</div>
                ) : loadingMessages ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">Loading chat…</div>
                ) : messages.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">No messages yet</div>
                ) : (
                  messages.map((m) => {
                    const mine = m.senderRole === "admin";
                    const time = formatTime(m.createdAt);
                    return (
                      <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div
                          className={
                            "max-w-[82%] rounded-2xl px-3 py-2 shadow-soft border " +
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
                                {m.readAtClient ? "Seen" : "Delivered"}
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
                    placeholder={selectedThread ? "Type a message…" : "Select a client to message"}
                    className="min-h-[56px] max-h-[140px]"
                    disabled={!selectedThread}
                  />
                  <Button
                    variant="healing"
                    className="h-[56px] px-4"
                    onClick={() => void onSend()}
                    disabled={!selectedThread || sending || !draft.trim()}
                    title={!selectedThread ? "Select a client" : !draft.trim() ? "Type a message" : "Send"}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <BottomNav isAdmin />
    </div>
  );
}
