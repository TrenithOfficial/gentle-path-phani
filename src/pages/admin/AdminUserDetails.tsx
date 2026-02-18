import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

import { fetchAdminUserCheckins, type AdminCheckInRow } from "@/lib/adminUsers";
import {
  fetchAdminUserProtocols,
  createAdminProtocol,
  updateAdminProtocol,
  deleteAdminProtocol,
  type ProtocolRow,
} from "@/lib/adminProtocols";

import {
  fetchAdminUserProtocolItemAcks,
  type AdminProtocolItemAckRow,
} from "@/lib/adminProtocolItemAcks";

const formatWhen = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
};

export default function AdminUserDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const userId = useMemo(() => (id ? String(id) : ""), [id]);

  const initialTab = useMemo(() => {
    const qs = new URLSearchParams(location.search);
    const t = qs.get("tab");
    return t === "protocols" ? "protocols" : "checkins";
  }, [location.search]);

  const [tab, setTab] = useState<"checkins" | "protocols">(initialTab);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const onTabChange = (next: "checkins" | "protocols") => {
    setTab(next);
    const qs = new URLSearchParams(location.search);
    qs.set("tab", next);
    navigate(`${location.pathname}?${qs.toString()}`, { replace: true });
  };

  // Check-ins
  const [checkins, setCheckins] = useState<AdminCheckInRow[]>([]);
  const [checkinsLoading, setCheckinsLoading] = useState(true);

  // Protocols
  const [protocols, setProtocols] = useState<ProtocolRow[]>([]);
  const [protocolsLoading, setProtocolsLoading] = useState(true);

  // ✅ Protocol confirmations per protocolId
  const [itemAcks, setItemAcks] = useState<Record<string, string>>({});
  const [itemAcksLoading, setItemAcksLoading] = useState(true);

  // Add form
  const [newName, setNewName] = useState("");
  const [newDosage, setNewDosage] = useState("");
  const [newTiming, setNewTiming] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newShopUrl, setNewShopUrl] = useState("");
  const [savingNew, setSavingNew] = useState(false);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ProtocolRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editDosage, setEditDosage] = useState("");
  const [editTiming, setEditTiming] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editShopUrl, setEditShopUrl] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete confirm
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProtocolRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!userId) return;

    let mounted = true;

    const run = async () => {
      // Check-ins
      setCheckinsLoading(true);
      try {
        const data = await fetchAdminUserCheckins(userId);
        if (!mounted) return;
        setCheckins(data);
      } catch (e) {
        console.error(e);
        if (!mounted) return;
        toast({ title: "Failed to load check-ins", description: "Please try again." });
      } finally {
        if (mounted) setCheckinsLoading(false);
      }

      // Protocols
      setProtocolsLoading(true);
      try {
        const rows = await fetchAdminUserProtocols(userId);
        if (!mounted) return;
        setProtocols(rows);
      } catch (e) {
        console.error(e);
        if (!mounted) return;
        toast({ title: "Failed to load protocols", description: "Please try again." });
      } finally {
        if (mounted) setProtocolsLoading(false);
      }

      // ✅ Protocol confirmations per protocol
      setItemAcksLoading(true);
      try {
        const rows: AdminProtocolItemAckRow[] = await fetchAdminUserProtocolItemAcks(userId);
        if (!mounted) return;

        const map: Record<string, string> = {};
        for (const r of rows) map[r.protocolId] = r.confirmedAt;
        setItemAcks(map);
      } catch (e) {
        console.error(e);
        if (!mounted) return;
        toast({ title: "Failed to load confirmations", description: "Please try again." });
      } finally {
        if (mounted) setItemAcksLoading(false);
      }
    };

    run();

    return () => {
      mounted = false;
    };
  }, [userId, toast]);

  const resetNewForm = () => {
    setNewName("");
    setNewDosage("");
    setNewTiming("");
    setNewNotes("");
    setNewShopUrl("");
  };

  const onCreateProtocol = async () => {
    const name = newName.trim();
    if (!name) {
      toast({ title: "Name is required" });
      return;
    }
    if (!userId) return;

    setSavingNew(true);
    try {
      const created = await createAdminProtocol({
        userId,
        name,
        dosage: newDosage,
        timing: newTiming,
        notes: newNotes,
        shopUrl: newShopUrl,
      });

      setProtocols((prev) => [created, ...prev]);
      resetNewForm();
      toast({ title: "Protocol added" });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Failed to add protocol", description: e?.message || "Please try again." });
    } finally {
      setSavingNew(false);
    }
  };

  const openEdit = (p: ProtocolRow) => {
    setEditTarget(p);
    setEditName(p.name || "");
    setEditDosage(p.dosage || "");
    setEditTiming(p.timing || "");
    setEditNotes(p.notes || "");
    setEditShopUrl(p.shopUrl || "");
    setEditOpen(true);
  };

  const onSaveEdit = async () => {
    if (!editTarget) return;

    const name = editName.trim();
    if (!name) {
      toast({ title: "Name is required" });
      return;
    }

    setSavingEdit(true);
    try {
      const updated = await updateAdminProtocol(editTarget.id, {
        name,
        dosage: editDosage,
        timing: editTiming,
        notes: editNotes,
        shopUrl: editShopUrl,
      });

      setProtocols((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      setEditOpen(false);
      setEditTarget(null);
      toast({ title: "Protocol updated" });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Failed to update protocol", description: e?.message || "Please try again." });
    } finally {
      setSavingEdit(false);
    }
  };

  const openDelete = (p: ProtocolRow) => {
    setDeleteTarget(p);
    setDeleteOpen(true);
  };

  const onConfirmDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      await deleteAdminProtocol(deleteTarget.id);
      setProtocols((prev) => prev.filter((x) => x.id !== deleteTarget.id));
      toast({ title: "Protocol deleted" });
      setDeleteOpen(false);
      setDeleteTarget(null);
    } catch (e: any) {
      console.error(e);
      toast({ title: "Failed to delete protocol", description: e?.message || "Please try again." });
    } finally {
      setDeleting(false);
    }
  };

  const lastConfirmed = useMemo(() => {
    let best: { protocolId: string; confirmedAt: string } | null = null;

    for (const [pid, ts] of Object.entries(itemAcks)) {
      const t = new Date(ts).getTime();
      if (!Number.isFinite(t)) continue;
      if (!best) best = { protocolId: pid, confirmedAt: ts };
      else if (t > new Date(best.confirmedAt).getTime()) best = { protocolId: pid, confirmedAt: ts };
    }

    if (!best) return null;

    const p = protocols.find((x) => x.id === best!.protocolId);
    return {
      name: p?.name || best.protocolId,
      confirmedAt: best.confirmedAt,
    };
  }, [itemAcks, protocols]);

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header title="Client Details" showBack onBack={() => navigate(-1)} />

      <main className="container max-w-lg mx-auto px-4 py-6 space-y-4">
        <Tabs value={tab} onValueChange={(v) => onTabChange(v as any)}>
          <TabsList className="w-full">
            <TabsTrigger value="checkins" className="flex-1">
              Check-ins
            </TabsTrigger>
            <TabsTrigger value="protocols" className="flex-1">
              Protocols
            </TabsTrigger>
          </TabsList>

          {/* CHECK-INS TAB */}
          <TabsContent value="checkins" className="space-y-3 mt-4">
            {checkinsLoading ? (
              <p className="text-sm text-muted-foreground">Loading check-ins...</p>
            ) : checkins.length === 0 ? (
              <Card variant="glass">
                <CardContent className="py-6 text-center text-sm text-muted-foreground">
                  No check-ins for this client yet.
                </CardContent>
              </Card>
            ) : (
              checkins.map((ci) => (
                <Card key={ci.id} variant="elevated">
                  <CardContent className="py-4 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">Day {ci.day}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(ci.createdAt).toLocaleString()}
                      </p>
                    </div>

                    <div className="text-sm text-muted-foreground">
                      Mood: {ci.mood ?? "-"} · Energy: {ci.energy ?? "-"}
                    </div>

                    {(ci.isTravelDay || ci.missedProtocol) && (
                      <div className="text-xs text-muted-foreground">
                        {ci.isTravelDay ? "Travel day" : ""}
                        {ci.isTravelDay && ci.missedProtocol ? " · " : ""}
                        {ci.missedProtocol ? "Missed protocol" : ""}
                      </div>
                    )}

                    {ci.notes && <div className="text-sm mt-2">{ci.notes}</div>}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* PROTOCOLS TAB */}
          <TabsContent value="protocols" className="space-y-3 mt-4">
            {/* ✅ Confirmations summary (no more weird top timestamp) */}
            <Card variant="glass">
              <CardContent className="py-4">
                <p className="font-medium text-sm">Protocol Confirmations</p>

                {itemAcksLoading ? (
                  <p className="text-xs text-muted-foreground mt-1">Loading confirmations...</p>
                ) : Object.keys(itemAcks).length === 0 ? (
                  <p className="text-xs text-muted-foreground mt-1">No confirmations yet.</p>
                ) : lastConfirmed ? (
                  <p className="text-xs text-muted-foreground mt-1">
                    Last confirmed: {lastConfirmed.name} • {formatWhen(lastConfirmed.confirmedAt)}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">Confirmations found.</p>
                )}
              </CardContent>
            </Card>

            {/* Add form */}
            <Card variant="glass">
              <CardContent className="py-4 space-y-3">
                <p className="font-medium text-sm">Add Protocol</p>

                <div className="space-y-2">
                  <Label htmlFor="p-name">Name</Label>
                  <Input
                    id="p-name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Example: Magnesium Glycinate"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="p-dosage">Dosage</Label>
                  <Input
                    id="p-dosage"
                    value={newDosage}
                    onChange={(e) => setNewDosage(e.target.value)}
                    placeholder="Example: 200mg"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="p-timing">Timing</Label>
                  <Input
                    id="p-timing"
                    value={newTiming}
                    onChange={(e) => setNewTiming(e.target.value)}
                    placeholder="Example: Night"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="p-notes">Notes</Label>
                  <Input
                    id="p-notes"
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="Optional notes..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="p-shop">Shop URL</Label>
                  <Input
                    id="p-shop"
                    value={newShopUrl}
                    onChange={(e) => setNewShopUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </div>

                <Button variant="calm" onClick={onCreateProtocol} disabled={savingNew} className="w-full">
                  {savingNew ? "Adding..." : "Add Protocol"}
                </Button>
              </CardContent>
            </Card>

            {/* Protocol list */}
            {protocolsLoading ? (
              <p className="text-sm text-muted-foreground">Loading protocols...</p>
            ) : protocols.length === 0 ? (
              <Card variant="glass">
                <CardContent className="py-6 text-center text-sm text-muted-foreground">
                  No protocols assigned to this client yet.
                </CardContent>
              </Card>
            ) : (
              protocols.map((p) => {
                const confirmedAt = itemAcks[p.id] || "";
                const isConfirmed = Boolean(confirmedAt);

                return (
                  <Card key={p.id} variant="elevated">
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">{p.name}</p>

                            <span
                              className={[
                                "text-[11px] px-2 py-1 rounded-full font-semibold shrink-0",
                                isConfirmed ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700",
                              ].join(" ")}
                            >
                              {isConfirmed ? "Confirmed" : "Not confirmed"}
                            </span>
                          </div>

                          <p className="text-xs text-muted-foreground mt-1">
                            {p.createdAt ? `Added: ${formatWhen(p.createdAt)}` : ""}
                          </p>

                          {isConfirmed && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Confirmed: {formatWhen(confirmedAt)}
                            </p>
                          )}

                          <p className="text-sm text-muted-foreground mt-2">
                            {(p.dosage || "-") + " • " + (p.timing || "-")}
                          </p>

                          {p.notes && (
                            <p className="text-xs text-muted-foreground mt-2 break-words">{p.notes}</p>
                          )}

                          {p.shopUrl && (
                            <a
                              href={p.shopUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary underline mt-2 inline-block"
                            >
                              Shop link
                            </a>
                          )}
                        </div>

                        <div className="flex gap-2 shrink-0">
                          <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
                            Edit
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => openDelete(p)}>
                            Delete
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Protocol</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Dosage</Label>
              <Input value={editDosage} onChange={(e) => setEditDosage(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Timing</Label>
              <Input value={editTiming} onChange={(e) => setEditTiming(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Shop URL</Label>
              <Input value={editShopUrl} onChange={(e) => setEditShopUrl(e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={savingEdit}>
              Cancel
            </Button>
            <Button variant="calm" onClick={onSaveEdit} disabled={savingEdit}>
              {savingEdit ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete protocol?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the protocol from the client immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BottomNav isAdmin />
    </div>
  );
}
