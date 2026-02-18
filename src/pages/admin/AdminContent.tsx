import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, FileUp, Trash2 } from "lucide-react";
import { getAuth } from "firebase/auth";
import { resolveFileUrl } from "@/lib/content";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiUrl } from "@/lib/api";

type GuidanceRow = {
  id: string;
  phaseId: number;
  day: number;
  title: string;
  content: string;
  audioUrl?: string | null;
  createdAt: string;
};

type AdminUserRow = {
  id: string;
  email: string;
  role: string;
  status?: string;
};

type HealingSheetRow = {
  id: string;
  name: string | null;
  scope: "phase" | "personal";
  phaseId: number | null;
  userId: string | null;
  url: string; // backend returns url (often like /uploads/healing-sheets/xyz.pdf)
  uploadedAt: string;
};

async function authedFetch(input: RequestInfo, init?: RequestInit) {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("Not logged in");
  const token = await user.getIdToken(true);

  const res = await fetch(input, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });

  return res;
}

async function fetchAdminGuidance(): Promise<GuidanceRow[]> {
  const res = await authedFetch(apiUrl("/api/admin/guidance"));
  if (!res.ok) throw new Error(`Failed to load guidance: ${res.status} ${await res.text()}`);
  return res.json();
}

async function upsertAdminGuidance(body: {
  phaseId: number;
  day: number;
  title: string;
  content: string;
  audioUrl?: string | null;
}): Promise<GuidanceRow> {
  const res = await authedFetch(apiUrl("/api/admin/guidance"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Failed to save guidance: ${res.status} ${await res.text()}`);
  return res.json();
}

async function deleteAdminGuidance(id: string): Promise<void> {
  const res = await authedFetch(apiUrl(`/api/admin/guidance/${encodeURIComponent(id)}`), {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 204)
    throw new Error(`Failed to delete guidance: ${res.status} ${await res.text()}`);
}

async function fetchAdminUsersActive(): Promise<AdminUserRow[]> {
  const res = await authedFetch(apiUrl("/api/admin/users?status=active"));
  if (!res.ok) throw new Error(`Failed to load users: ${res.status} ${await res.text()}`);
  return res.json();
}

async function fetchAdminHealingSheets(): Promise<HealingSheetRow[]> {
  const res = await authedFetch(apiUrl("/api/admin/healing-sheets"));
  if (!res.ok) throw new Error(`Failed to load healing sheets: ${res.status} ${await res.text()}`);
  return res.json();
}

async function uploadAdminHealingSheet(form: FormData): Promise<HealingSheetRow> {
  const res = await authedFetch(apiUrl("/api/admin/healing-sheets/upload"), {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(`Failed to upload sheet: ${res.status} ${await res.text()}`);
  return res.json();
}

// ✅ NEW: delete healing sheet (admin)
async function deleteAdminHealingSheet(id: string): Promise<void> {
  const res = await authedFetch(apiUrl(`/api/admin/healing-sheets/${encodeURIComponent(id)}`), {
    method: "DELETE",
  });

  if (!res.ok && res.status !== 204) {
    throw new Error(`Failed to delete sheet: ${res.status} ${await res.text()}`);
  }
}

function PhaseCard({
  phaseId,
  title,
  subtitle,
  createdCount,
  onAdd,
  onEdit,
}: {
  phaseId: number;
  title: string;
  subtitle: string;
  createdCount: number;
  onAdd: () => void;
  onEdit: () => void;
}) {
  return (
    <Card variant="elevated" className="mb-4">
      <CardContent className="py-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-foreground truncate">Phase {phaseId}</p>
            <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
            <p className="text-xs text-muted-foreground mt-1">{createdCount}/15 days created</p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button className="text-sm text-foreground hover:underline" onClick={onAdd}>
            Add
          </button>
          <button className="text-sm text-foreground hover:underline" onClick={onEdit}>
            Edit
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminContent() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [guidance, setGuidance] = useState<GuidanceRow[]>([]);
  const [sheets, setSheets] = useState<HealingSheetRow[]>([]);
  const [clients, setClients] = useState<AdminUserRow[]>([]);

  // Guidance modal
  const [guidanceOpen, setGuidanceOpen] = useState(false);
  const [gPhaseId, setGPhaseId] = useState<number>(1);
  const [gPhaseLocked, setGPhaseLocked] = useState<boolean>(true);
  const [gDay, setGDay] = useState<number>(1);
  const [gTitle, setGTitle] = useState("");
  const [gContent, setGContent] = useState("");
  const [gAudioUrl, setGAudioUrl] = useState<string>("");
  const [savingGuidance, setSavingGuidance] = useState(false);

  // Healing sheet modal
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetName, setSheetName] = useState<string>("");
  const [sheetScope, setSheetScope] = useState<"phase" | "personal">("phase");
  const [sheetPhaseId, setSheetPhaseId] = useState<number>(1);
  const [sheetUserId, setSheetUserId] = useState<string>("");
  const [sheetFile, setSheetFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const phases = useMemo(
    () => [
      { id: 1, name: "Deep Detox & Pathogen Purge" },
      { id: 2, name: "Gut Rebalancing & Microbiome Support" },
      { id: 3, name: "Immune System Strengthening" },
      { id: 4, name: "Cellular Energy & Mito Boost" },
      { id: 5, name: "Stored Trauma & Emotional Imprints" },
      { id: 6, name: "Transformation & Spiritual Alignment" },
    ],
    []
  );

  const phaseStartDay = (phaseId: number) => (phaseId - 1) * 15 + 1;
  const phaseEndDay = (phaseId: number) => phaseId * 15;
  const toGlobalDay = (phaseId: number, localDay: number) => phaseStartDay(phaseId) + localDay - 1;

  const guidanceByPhase = useMemo(() => {
    const map = new Map<number, GuidanceRow[]>();
    for (const row of guidance) {
      if (!map.has(row.phaseId)) map.set(row.phaseId, []);
      map.get(row.phaseId)!.push(row);
    }
    for (const [k, v] of map.entries()) {
      v.sort((a, b) => a.day - b.day);
      map.set(k, v);
    }
    return map;
  }, [guidance]);

  const refreshAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [g, s, u] = await Promise.all([
        fetchAdminGuidance(),
        fetchAdminHealingSheets(),
        fetchAdminUsersActive(),
      ]);

      setGuidance(g || []);
      setSheets(s || []);
      setClients((u || []).filter((x) => x.role === "client"));
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to load content");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refreshAll();
      } finally {
        if (cancelled) return;
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAddGuidance = (phaseId: number) => {
    setGPhaseLocked(true);
    setGPhaseId(phaseId);
    setGDay(1);
    setGTitle("");
    setGContent("");
    setGAudioUrl("");
    setGuidanceOpen(true);
  };

  const openEditGuidance = (phaseId: number) => {
    setGPhaseLocked(true);
    setGPhaseId(phaseId);
    setGDay(1);
    const existing = guidanceByPhase.get(phaseId)?.find((x) => x.day === 1);
    setGTitle(existing?.title || "");
    setGContent(existing?.content || "");
    setGAudioUrl(existing?.audioUrl || "");
    setGuidanceOpen(true);
  };

  const openTopAddGuidance = () => {
    setGPhaseLocked(false);
    setGPhaseId(1);
    setGDay(1);
    setGTitle("");
    setGContent("");
    setGAudioUrl("");
    setGuidanceOpen(true);
  };

  const onGuidanceDayChange = (day: number) => {
    setGDay(day);
    const existing = guidanceByPhase.get(gPhaseId)?.find((x) => x.day === day);
    setGTitle(existing?.title || "");
    setGContent(existing?.content || "");
    setGAudioUrl(existing?.audioUrl || "");
  };

  const saveGuidance = async () => {
    setSavingGuidance(true);
    try {
      await upsertAdminGuidance({
        phaseId: gPhaseId,
        day: gDay, // backend expects local day (1-15) inside the phase
        title: gTitle,
        content: gContent,
        audioUrl: gAudioUrl.trim() ? gAudioUrl.trim() : null,
      });
      setGuidanceOpen(false);
      await refreshAll();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Save failed");
    } finally {
      setSavingGuidance(false);
    }
  };

  const deleteGuidance = async () => {
    const existing = guidanceByPhase.get(gPhaseId)?.find((x) => x.day === gDay);
    if (!existing) {
      alert("No guidance exists for this phase/day.");
      return;
    }
    if (!confirm("Delete this guidance?")) return;

    try {
      await deleteAdminGuidance(existing.id);
      await refreshAll();
      onGuidanceDayChange(gDay);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Delete failed");
    }
  };

  const openUploadSheet = () => {
    setSheetOpen(true);
    setSheetName("");
    setSheetScope("phase");
    setSheetPhaseId(1);
    setSheetUserId("");
    setSheetFile(null);
  };

const doUploadSheet = async () => {
  const name = sheetName.trim();
  if (!name) {
    alert("Please enter a sheet name");
    return;
  }

  if (!sheetFile) {
    alert("Choose a file");
    return;
  }


    if (sheetScope === "personal" && !sheetUserId) {
      alert("Pick a client for personal sheet");
      return;
    }
    if (sheetScope === "phase" && !sheetPhaseId) {
      alert("Pick a phase");
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      if (sheetName.trim()) fd.append("name", name);

      fd.append("scope", sheetScope);

      if (sheetScope === "phase") {
        fd.append("phaseId", String(sheetPhaseId));
      } else {
        fd.append("userId", sheetUserId);
      }

      fd.append("file", sheetFile);

      await uploadAdminHealingSheet(fd);
      setSheetOpen(false);
      await refreshAll();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const createdCountForPhase = (phaseId: number) => {
    return guidanceByPhase.get(phaseId)?.length || 0;
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header title="Manage Content" showBack onBack={() => navigate("/admin")} />

      <main className="container max-w-lg mx-auto px-4 py-6 space-y-6">
        {error && (
          <Card variant="elevated" className="border border-red-200 bg-red-50">
            <CardContent className="py-4">
              <p className="text-sm text-red-700 font-medium">Failed to load content</p>
              <p className="text-xs text-red-700 mt-1">{error}</p>
              <div className="mt-3">
                <Button onClick={refreshAll} variant="healing">
                  Retry
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-serif text-lg font-semibold text-foreground">Daily Guidance</h2>
            <Button variant="healing" onClick={openTopAddGuidance} disabled={loading}>
              + Add
            </Button>
          </div>

          {phases.map((p) => (
            <PhaseCard
              key={p.id}
              phaseId={p.id}
              title={p.name}
              subtitle={p.name}
              createdCount={createdCountForPhase(p.id)}
              onAdd={() => openAddGuidance(p.id)}
              onEdit={() => openEditGuidance(p.id)}
            />
          ))}
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-serif text-lg font-semibold text-foreground">Healing Sheets</h2>
            <Button variant="healing" onClick={openUploadSheet} disabled={loading}>
              <FileUp className="h-4 w-4 mr-2" />
              Upload
            </Button>
          </div>

          <Card variant="glass">
            <CardContent className="py-4 space-y-3">
              {loading && <p className="text-sm text-muted-foreground">Loading sheets...</p>}

              {!loading && sheets.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No sheets uploaded yet.
                </p>
              )}

              {!loading &&
                sheets.map((s) => {
                  const viewUrl = resolveFileUrl(s.url); // opens from backend, not frontend

                  const uploadedLabel = s.uploadedAt
                    ? `Uploaded ${new Date(s.uploadedAt).toLocaleString()}`
                    : "";

                  return (
                    <div
                      key={s.id}
                      className="flex items-center justify-between gap-3 py-2 border-b border-border/50 last:border-0"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {s.name || "Untitled Sheet"}
                        </p>

                        <p className="text-xs text-muted-foreground">
                          {s.scope === "phase"
                            ? `Phase ${s.phaseId}`
                            : `Personal • ${
                                clients.find((c) => c.id === s.userId)?.email || "Client"
                              }`}
                        </p>

                        {uploadedLabel && (
                          <p className="text-[11px] text-muted-foreground mt-1">{uploadedLabel}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={viewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-primary hover:underline"
                        >
                          View
                        </a>

                        <button
                          className="p-2 rounded-lg hover:bg-muted"
                          title="Delete"
                          onClick={async () => {
                            if (!confirm("Delete this healing sheet?")) return;
                            try {
                              await deleteAdminHealingSheet(s.id);
                              await refreshAll();
                            } catch (e: any) {
                              console.error(e);
                              alert(e?.message || "Delete failed");
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </div>
                    </div>
                  );
                })}
            </CardContent>
          </Card>
        </section>
      </main>

      <BottomNav isAdmin />

      {guidanceOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
          <div className="w-full max-w-lg rounded-2xl bg-background border border-border shadow-elevated p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="font-serif text-lg font-semibold text-foreground">
                {guidanceByPhase.get(gPhaseId)?.some((x) => x.day === gDay) ? "Edit" : "Add"} Guidance
              </p>
              <button
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setGuidanceOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {gPhaseLocked ? (
                <div>
                  <label className="text-xs text-muted-foreground">Phase</label>
                  <div className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm">
                    Phase {gPhaseId}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Days {phaseStartDay(gPhaseId)}–{phaseEndDay(gPhaseId)}
                  </p>
                </div>
              ) : (
                <div>
                  <label className="text-xs text-muted-foreground">Phase</label>
                  <select
                    className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
                    value={gPhaseId}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      setGPhaseId(next);
                      onGuidanceDayChange(1);
                    }}
                  >
                    {phases.map((p) => (
                      <option key={p.id} value={p.id}>
                        Phase {p.id}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs text-muted-foreground">Day</label>
                <select
                  className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
                  value={gDay}
                  onChange={(e) => onGuidanceDayChange(Number(e.target.value))}
                >
                  {Array.from({ length: 15 }).map((_, i) => (
                    <option key={i + 1} value={i + 1}>
                      Day {toGlobalDay(gPhaseId, i + 1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-3">
              <label className="text-xs text-muted-foreground">Title</label>
              <input
                className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
                value={gTitle}
                onChange={(e) => setGTitle(e.target.value)}
              />
            </div>

            <div className="mt-3">
              <label className="text-xs text-muted-foreground">Content</label>
              <textarea
                className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm min-h-[140px]"
                value={gContent}
                onChange={(e) => setGContent(e.target.value)}
              />
            </div>

            <div className="mt-3">
              <label className="text-xs text-muted-foreground">Audio URL (optional)</label>
              <input
                className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
                value={gAudioUrl}
                onChange={(e) => setGAudioUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>

            <div className="mt-5 flex items-center justify-between">
              <Button variant="ghost" onClick={deleteGuidance} disabled={savingGuidance}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setGuidanceOpen(false)}
                  disabled={savingGuidance}
                >
                  Cancel
                </Button>
                <Button variant="healing" onClick={saveGuidance} disabled={savingGuidance}>
                  {savingGuidance ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {sheetOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
          <div className="w-full max-w-lg rounded-2xl bg-background border border-border shadow-elevated p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="font-serif text-lg font-semibold text-foreground">Upload Healing Sheet</p>
              <button
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setSheetOpen(false)}
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Name</label>
              <input
                className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
                value={sheetName}
                onChange={(e) => setSheetName(e.target.value)}
                placeholder="Sheet name"
              />
            </div>

            <div className="mt-4">
              <label className="text-xs text-muted-foreground">Scope</label>
              <div className="mt-2 flex gap-2">
                <Button
                  type="button"
                  variant={sheetScope === "phase" ? "healing" : "ghost"}
                  onClick={() => setSheetScope("phase")}
                >
                  Phase
                </Button>
                <Button
                  type="button"
                  variant={sheetScope === "personal" ? "healing" : "ghost"}
                  onClick={() => setSheetScope("personal")}
                >
                  Personal
                </Button>
              </div>
            </div>

            {sheetScope === "phase" ? (
              <div className="mt-4">
                <label className="text-xs text-muted-foreground">Phase</label>
                <select
                  className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
                  value={sheetPhaseId}
                  onChange={(e) => setSheetPhaseId(Number(e.target.value))}
                >
                  {phases.map((p) => (
                    <option key={p.id} value={p.id}>
                      Phase {p.id}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="mt-4">
                <label className="text-xs text-muted-foreground">Client</label>
                <select
                  className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
                  value={sheetUserId}
                  onChange={(e) => setSheetUserId(e.target.value)}
                >
                  <option value="">Select client</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.email}
                    </option>
                  ))}
                </select>
                {clients.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    No active clients found. (Users must have role=client and status=active)
                  </p>
                )}
              </div>
            )}

            <div className="mt-4">
              <label className="text-xs text-muted-foreground">File</label>
              <input
                type="file"
                className="mt-1 block w-full text-sm"
                onChange={(e) => setSheetFile(e.target.files?.[0] || null)}
              />
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={() => setSheetOpen(false)} disabled={uploading}>
                Cancel
              </Button>
              <Button
                variant="healing"
                onClick={doUploadSheet}
                disabled={
                  uploading ||
                  !sheetName.trim() ||
                  !sheetFile ||
                  (sheetScope === "personal" && !sheetUserId) ||
                  (sheetScope === "phase" && !sheetPhaseId)
                }
              >
                {uploading ? "Uploading..." : "Upload"}
              </Button>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
