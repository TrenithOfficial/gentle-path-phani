import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, User, Calendar, MoreVertical, Edit, Trash2, Link2 } from "lucide-react";

import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createAdminUser,
  fetchAdminUserById,
  fetchAdminUsers,
  updateAdminUser,
  deleteAdminUser,
  inviteAdminUser,
  type AdminUserRow,
  type AdminUserStatus,
} from "@/lib/adminUsers";
import { getCurrentDay, getPhaseForDay } from "@/types/healing";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const AdminUsers = () => {
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<AdminUserStatus>("active");

  // Add modal
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newActive, setNewActive] = useState(true);

  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newAge, setNewAge] = useState("");
  const [newGender, setNewGender] = useState("");

  const [newPhoneCountryCode, setNewPhoneCountryCode] = useState("+1");
  const [newPhoneNumber, setNewPhoneNumber] = useState("");

  const [newTimezone, setNewTimezone] = useState("");
  const [newAddress, setNewAddress] = useState("");

  const [newEmergencyContactName, setNewEmergencyContactName] = useState("");
  const [newEmergencyContactPhoneCountryCode, setNewEmergencyContactPhoneCountryCode] =
    useState("+1");
  const [newEmergencyContactPhoneNumber, setNewEmergencyContactPhoneNumber] = useState("");

  const [newNotes, setNewNotes] = useState("");

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editUser, setEditUser] = useState<AdminUserRow | null>(null);

  const [editEmail, setEditEmail] = useState("");
  const [editName, setEditName] = useState("");
  const [editActive, setEditActive] = useState(true);

  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editAge, setEditAge] = useState("");
  const [editGender, setEditGender] = useState("");

  const [editPhoneCountryCode, setEditPhoneCountryCode] = useState("+1");
  const [editPhoneNumber, setEditPhoneNumber] = useState("");

  const [editTimezone, setEditTimezone] = useState("");
  const [editAddress, setEditAddress] = useState("");

  const [editEmergencyContactName, setEditEmergencyContactName] = useState("");
  const [editEmergencyContactPhoneCountryCode, setEditEmergencyContactPhoneCountryCode] =
    useState("+1");
  const [editEmergencyContactPhoneNumber, setEditEmergencyContactPhoneNumber] = useState("");

  const [editNotes, setEditNotes] = useState("");

  // Delete confirm
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteUser, setDeleteUser] = useState<AdminUserRow | null>(null);

  // Invite link modal
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [inviting, setInviting] = useState(false);

  const phoneCountryOptions = useMemo(
    () => [
      { label: "US/Canada (+1)", value: "+1" },
      { label: "India (+91)", value: "+91" },
      { label: "UK (+44)", value: "+44" },
      { label: "Australia (+61)", value: "+61" },
      { label: "UAE (+971)", value: "+971" },
      { label: "Mexico (+52)", value: "+52" },
      { label: "Brazil (+55)", value: "+55" },
      { label: "Germany (+49)", value: "+49" },
      { label: "France (+33)", value: "+33" },
    ],
    []
  );

  const genderOptions = useMemo(
    () => ["Female", "Male", "Non-binary", "Prefer not to say", "Other"],
    []
  );

  const resetCreateForm = () => {
    setNewEmail("");
    setNewName("");
    setNewActive(true);

    setNewFirstName("");
    setNewLastName("");
    setNewAge("");
    setNewGender("");

    setNewPhoneCountryCode("+1");
    setNewPhoneNumber("");

    setNewTimezone("");
    setNewAddress("");

    setNewEmergencyContactName("");
    setNewEmergencyContactPhoneCountryCode("+1");
    setNewEmergencyContactPhoneNumber("");

    setNewNotes("");
  };

  const openProtocols = (userId: string) => navigate(`/admin/users/${userId}?tab=protocols`);
  const openDetails = (userId: string) => navigate(`/admin/users/${userId}`);

  const load = async (s: AdminUserStatus) => {
    setLoading(true);
    try {
      const data = await fetchAdminUsers(s);
      setUsers(data);
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    if (!open) return;
    if (newTimezone.trim() === "") {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) setNewTimezone(tz);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const clients = useMemo(() => users.filter((u) => u.role === "client"), [users]);

  const filteredClients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => {
      const name = (c.name || "").toLowerCase();
      const email = (c.email || "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [clients, searchQuery]);

  const isCreateFormValid = useMemo(() => {
    const email = newEmail.trim().toLowerCase();
    const firstName = newFirstName.trim();
    const lastName = newLastName.trim();
    const age = newAge.trim();
    const gender = newGender.trim();
    const phoneNumber = newPhoneNumber.trim();
    const timezone = newTimezone.trim();
    const address = newAddress.trim();

    if (
      !email ||
      !firstName ||
      !lastName ||
      !age ||
      !gender ||
      !phoneNumber ||
      !timezone ||
      !address
    ) {
      return false;
    }

    if (!emailRegex.test(email)) {
      return false;
    }

    if (!Number.isFinite(Number(age))) {
      return false;
    }

    return true;
  }, [
    newEmail,
    newFirstName,
    newLastName,
    newAge,
    newGender,
    newPhoneNumber,
    newTimezone,
    newAddress,
  ]);

  const isEditFormValid = useMemo(() => {
    const email = editEmail.trim();
    const displayName = editName.trim();
    const firstName = editFirstName.trim();
    const lastName = editLastName.trim();
    const age = editAge.trim();
    const gender = editGender.trim();
    const phoneNumber = editPhoneNumber.trim();
    const timezone = editTimezone.trim();
    const address = editAddress.trim();

    if (
      !email ||
      !displayName ||
      !firstName ||
      !lastName ||
      !age ||
      !gender ||
      !phoneNumber ||
      !timezone ||
      !address
    ) {
      return false;
    }

    if (!emailRegex.test(email.toLowerCase())) {
      return false;
    }

    if (!Number.isFinite(Number(age))) {
      return false;
    }

    return true;
  }, [
    editEmail,
    editName,
    editFirstName,
    editLastName,
    editAge,
    editGender,
    editPhoneNumber,
    editTimezone,
    editAddress,
  ]);

  const onCreate = async () => {
    const email = newEmail.trim().toLowerCase();
    const displayName = newName.trim();
    const firstName = newFirstName.trim();
    const lastName = newLastName.trim();

    if (!isCreateFormValid) return;

    const ageVal = newAge.trim();
    const ageNum =
      ageVal === "" ? null : Number.isFinite(Number(ageVal)) ? Number(ageVal) : NaN;
    if (Number.isNaN(ageNum as any)) {
      alert("Age must be a number");
      return;
    }

    const finalDisplayName =
      displayName || `${firstName} ${lastName}`.trim();

    setSaving(true);
    try {
      await createAdminUser({
        email,
        name: finalDisplayName,
        active: newActive,

        firstName,
        lastName,
        age: ageNum,
        gender: newGender.trim(),

        phoneCountryCode: newPhoneCountryCode,
        phoneNumber: newPhoneNumber.trim(),

        timezone: newTimezone.trim(),
        address: newAddress.trim(),

        emergencyContactName: newEmergencyContactName.trim(),
        emergencyContactPhoneCountryCode: newEmergencyContactPhoneCountryCode,
        emergencyContactPhoneNumber: newEmergencyContactPhoneNumber.trim(),

        notes: newNotes.trim(),
      });

      setOpen(false);
      resetCreateForm();
      await load(status);
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Failed to create user");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = async (u: AdminUserRow) => {
    setEditUser(u);
    setEditOpen(true);
    setEditLoading(true);

    try {
      const detail = await fetchAdminUserById(u.id);

      setEditEmail(detail.email || "");
      setEditName(detail.name || "");
      setEditActive(Boolean(detail.startDate));

      setEditFirstName(detail.firstName ?? "");
      setEditLastName(detail.lastName ?? "");
      setEditAge(detail.age === null || detail.age === undefined ? "" : String(detail.age));
      setEditGender(detail.gender ?? "");

      setEditPhoneCountryCode(detail.phoneCountryCode ?? "+1");
      setEditPhoneNumber(detail.phoneNumber ?? "");

      setEditTimezone(detail.timezone ?? "");
      setEditAddress(detail.address ?? "");

      setEditEmergencyContactName(detail.emergencyContactName ?? "");
      setEditEmergencyContactPhoneCountryCode(
        detail.emergencyContactPhoneCountryCode ?? "+1"
      );
      setEditEmergencyContactPhoneNumber(detail.emergencyContactPhoneNumber ?? "");

      setEditNotes(detail.notes ?? "");
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Failed to load client details");
    } finally {
      setEditLoading(false);
    }
  };

  const saveEdit = async () => {
    if (!editUser) return;

    const email = editEmail.trim().toLowerCase();
    if (!email) return;

    const ageVal = editAge.trim();
    let ageNum: number | null = null;
    if (ageVal !== "") {
      if (!Number.isFinite(Number(ageVal))) {
        alert("Age must be a number");
        return;
      }
      ageNum = Number(ageVal);
    }

    setSaving(true);
    try {
      await updateAdminUser(editUser.id, {
        email,
        name: editName.trim(),
        active: editActive,

        firstName: editFirstName,
        lastName: editLastName,
        age: ageNum,
        gender: editGender,

        phoneCountryCode: editPhoneCountryCode,
        phoneNumber: editPhoneNumber,

        timezone: editTimezone,
        address: editAddress,

        emergencyContactName: editEmergencyContactName,
        emergencyContactPhoneCountryCode: editEmergencyContactPhoneCountryCode,
        emergencyContactPhoneNumber: editEmergencyContactPhoneNumber,

        notes: editNotes,
      });

      setEditOpen(false);
      setEditUser(null);
      await load(status);
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Failed to update user");
    } finally {
      setSaving(false);
    }
  };

  const openDelete = (u: AdminUserRow) => {
    setDeleteUser(u);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteUser) return;
    setSaving(true);
    try {
      await deleteAdminUser(deleteUser.id);
      setDeleteOpen(false);
      setDeleteUser(null);
      await load(status);
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Failed to delete user");
    } finally {
      setSaving(false);
    }
  };

  const onInvite = async (u: AdminUserRow) => {
    setInviting(true);
    try {
      const resp = await inviteAdminUser({
        email: u.email,
        name: u.name || "",
        active: Boolean(u.startDate),
      });
      setInviteLink(resp.resetLink);
      setInviteOpen(true);
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Failed to invite user");
    } finally {
      setInviting(false);
    }
  };

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      alert("Invite link copied");
    } catch {
      alert("Copy failed. You can manually select and copy the link.");
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header title="Manage Users" showBack />

      <main className="container max-w-lg mx-auto px-4 py-6 space-y-4">
        <Tabs value={status} onValueChange={(v) => setStatus(v as AdminUserStatus)}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="inactive">Inactive</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <Button
            variant="healing"
            size="icon"
            className="shrink-0"
            onClick={() => {
              resetCreateForm();
              setOpen(true);
            }}
            title="Add client"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading users...</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {filteredClients.length} client{filteredClients.length !== 1 ? "s" : ""}
          </p>
        )}

        <div className="space-y-3">
          {!loading && filteredClients.length === 0 && (
            <Card variant="glass">
              <CardContent className="py-6 text-center text-sm text-muted-foreground">
                No clients found.
              </CardContent>
            </Card>
          )}

          {filteredClients.map((client, index) => {
            const startDateStr = client.startDate;
            const startDate = startDateStr ? new Date(startDateStr) : null;

            const currentDay = startDate ? getCurrentDay(startDateStr) : 0;
            const currentPhase = startDate ? getPhaseForDay(currentDay) : null;

            return (
              <Card
                key={client.id}
                variant="elevated"
                className="animate-slide-up"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="h-5 w-5 text-primary" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-foreground">{client.name || "Unknown"}</p>
                          <p className="text-xs text-muted-foreground">{client.email}</p>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>

                          <DropdownMenuContent align="end">
                            <DropdownMenuItem className="gap-2" onClick={() => openDetails(client.id)}>
                              View Details
                            </DropdownMenuItem>

                            <DropdownMenuItem className="gap-2" onClick={() => openProtocols(client.id)}>
                              Protocols
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              className="gap-2"
                              onClick={() => onInvite(client)}
                              disabled={inviting}
                            >
                              <Link2 className="h-4 w-4" />
                              Invite Client
                            </DropdownMenuItem>

                            <DropdownMenuItem className="gap-2" onClick={() => openEdit(client)}>
                              <Edit className="h-4 w-4" />
                              Edit User
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              className="gap-2 text-destructive"
                              onClick={() => openDelete(client)}
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {startDate ? (
                        <div className="flex items-center gap-3 mt-2">
                          <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            Day {currentDay}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Phase {currentPhase?.id ?? "-"}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-muted-foreground">Start date not set</span>
                        </div>
                      )}

                      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        {startDate ? <>Started {startDate.toLocaleDateString()}</> : <>Not started</>}
                      </div>

                      <div className="mt-3 flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => openDetails(client.id)}>
                          Details
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openProtocols(client.id)}>
                          Protocols
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>

      // ONLY showing the changed CREATE FORM section — rest of your file stays exactly the same

      {/* Add Client */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Client</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>First Name *</Label>
                <Input
                  value={newFirstName}
                  onChange={(e) => setNewFirstName(e.target.value)}
                  className={!newFirstName.trim() ? "border-red-500" : ""}
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name *</Label>
                <Input
                  value={newLastName}
                  onChange={(e) => setNewLastName(e.target.value)}
                  className={!newLastName.trim() ? "border-red-500" : ""}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                inputMode="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="client@email.com"
                className={
                  newEmail && !emailRegex.test(newEmail.trim().toLowerCase())
                    ? "border-red-500 focus-visible:ring-red-500"
                    : ""
                }
              />
              {newEmail.trim() !== "" && !emailRegex.test(newEmail.trim().toLowerCase()) && (
                <p className="text-sm text-muted-foreground">
                  Enter a valid email address.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Display Name (optional)</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="If empty, First + Last will be used"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Age *</Label>
                <Input
                  value={newAge}
                  onChange={(e) => setNewAge(e.target.value)}
                  inputMode="numeric"
                  className={
                    !newAge.trim() || !Number.isFinite(Number(newAge))
                      ? "border-red-500"
                      : ""
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Gender *</Label>
                <select
                  value={newGender}
                  onChange={(e) => setNewGender(e.target.value)}
                  className={`h-10 w-full rounded-md px-3 text-sm ${
                    !newGender ? "border-red-500" : "border border-input"
                  }`}
                >
                  <option value="">Select</option>
                  {genderOptions.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-1">
                <Label>Country Code</Label>
                <select
                  value={newPhoneCountryCode}
                  onChange={(e) => setNewPhoneCountryCode(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {phoneCountryOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Phone Number *</Label>
                <Input
                  value={newPhoneNumber}
                  onChange={(e) => setNewPhoneNumber(e.target.value)}
                  className={!newPhoneNumber.trim() ? "border-red-500" : ""}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Timezone *</Label>
                <Input
                  value={newTimezone}
                  onChange={(e) => setNewTimezone(e.target.value)}
                  placeholder="America/New_York"
                  className={!newTimezone.trim() ? "border-red-500" : ""}
                />
              </div>
              <div className="flex items-center gap-2 pt-7">
                <Checkbox checked={newActive} onCheckedChange={(v) => setNewActive(Boolean(v))} />
                <span className="text-sm">Mark as Active</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Address *</Label>
              <Input
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                placeholder="Full address"
                className={!newAddress.trim() ? "border-red-500" : ""}
              />
            </div>

            {/* rest unchanged */}

            {!isCreateFormValid && (
              <p className="text-sm text-muted-foreground">
                Fill all marked details with a valid email to enable creating.
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button
                variant="healing"
                onClick={onCreate}
                disabled={saving || !isCreateFormValid}
              >
                {saving ? "Creating..." : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Client */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
          </DialogHeader>

          {editLoading ? (
            <div className="py-8 text-sm text-muted-foreground">Loading client details...</div>
          ) : (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input type="email" inputMode="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Display Name *</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox checked={editActive} onCheckedChange={(v) => setEditActive(Boolean(v))} />
                <span className="text-sm">Active</span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>First Name *</Label>
                  <Input value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Last Name *</Label>
                  <Input value={editLastName} onChange={(e) => setEditLastName(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Age *</Label>
                  <Input value={editAge} onChange={(e) => setEditAge(e.target.value)} inputMode="numeric" />
                </div>
                <div className="space-y-2">
                  <Label>Gender *</Label>
                  <select
                    value={editGender}
                    onChange={(e) => setEditGender(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Select</option>
                    {genderOptions.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-2 sm:col-span-1">
                  <Label>Country Code</Label>
                  <select
                    value={editPhoneCountryCode}
                    onChange={(e) => setEditPhoneCountryCode(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {phoneCountryOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Phone Number *</Label>
                  <Input value={editPhoneNumber} onChange={(e) => setEditPhoneNumber(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Timezone *</Label>
                  <Input value={editTimezone} onChange={(e) => setEditTimezone(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Address *</Label>
                  <Input value={editAddress} onChange={(e) => setEditAddress(e.target.value)} />
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-sm font-medium">Emergency Contact (optional)</div>

                <div className="space-y-2">
                  <Label>Emergency Contact Name</Label>
                  <Input value={editEmergencyContactName} onChange={(e) => setEditEmergencyContactName(e.target.value)} />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="space-y-2 sm:col-span-1">
                    <Label>Country Code</Label>
                    <select
                      value={editEmergencyContactPhoneCountryCode}
                      onChange={(e) => setEditEmergencyContactPhoneCountryCode(e.target.value)}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {phoneCountryOptions.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Emergency Contact Phone</Label>
                    <Input value={editEmergencyContactPhoneNumber} onChange={(e) => setEditEmergencyContactPhoneNumber(e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
              </div>

              {!isEditFormValid && (
                <p className="text-sm text-muted-foreground">
                  Fill all marked details to enable saving.
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setEditOpen(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button
                  variant="healing"
                  onClick={saveEdit}
                  disabled={saving || !isEditFormValid}
                >
                  {saving ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Client</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Delete <span className="font-medium text-foreground">{deleteUser?.email}</span> from the database?
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setDeleteOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmDelete} disabled={saving}>
                {saving ? "Deleting...." : "Delete"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invite link */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Link</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Send this link to the client to set their password.</p>
            <Input value={inviteLink} readOnly />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setInviteOpen(false)}>
                Close
              </Button>
              <Button variant="healing" onClick={copyInvite} disabled={!inviteLink}>
                Copy Link
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <BottomNav isAdmin />
    </div>
  );
};

export default AdminUsers;