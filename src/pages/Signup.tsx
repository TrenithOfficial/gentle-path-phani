import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const Signup = () => {
  const [saving, setSaving] = useState(false);

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");

  const [phoneCountryCode, setPhoneCountryCode] = useState("+1");
  const [phoneNumber, setPhoneNumber] = useState("");

  const [timezone, setTimezone] = useState("");
  const [address, setAddress] = useState("");

  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhoneCountryCode, setEmergencyContactPhoneCountryCode] = useState("+1");
  const [emergencyContactPhoneNumber, setEmergencyContactPhoneNumber] = useState("");

  const [notes, setNotes] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

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

  useEffect(() => {
    if (timezone.trim() === "") {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) setTimezone(tz);
    }
  }, [timezone]);

  const passwordsMatch = useMemo(() => {
    if (!password || !confirmPassword) return true;
    return password === confirmPassword;
  }, [password, confirmPassword]);

  const isFormValid = useMemo(() => {
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedAge = age.trim();
    const trimmedGender = gender.trim();
    const trimmedPhoneNumber = phoneNumber.trim();
    const trimmedTimezone = timezone.trim();
    const trimmedAddress = address.trim();
    const trimmedPassword = password.trim();
    const trimmedConfirmPassword = confirmPassword.trim();

    if (
      !normalizedEmail ||
      !trimmedFirstName ||
      !trimmedLastName ||
      !trimmedAge ||
      !trimmedGender ||
      !trimmedPhoneNumber ||
      !trimmedTimezone ||
      !trimmedAddress ||
      !trimmedPassword ||
      !trimmedConfirmPassword
    ) {
      return false;
    }

    if (!emailRegex.test(normalizedEmail)) {
      return false;
    }

    if (!Number.isFinite(Number(trimmedAge))) {
      return false;
    }

    if (trimmedPassword !== trimmedConfirmPassword) {
      return false;
    }

    return true;
  }, [
    email,
    firstName,
    lastName,
    age,
    gender,
    phoneNumber,
    timezone,
    address,
    password,
    confirmPassword,
  ]);

  const onSignup = async () => {
    if (!isFormValid) return;

    setSaving(true);
    try {
      const finalDisplayName =
        displayName.trim() || `${firstName.trim()} ${lastName.trim()}`.trim();

      const res = await fetch("https://gentle-path-api-883951071472.us-central1.run.app/api/signup-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          name: finalDisplayName,
          password: password.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          age: Number(age.trim()),
          gender: gender.trim(),
          phoneCountryCode,
          phoneNumber: phoneNumber.trim(),
          timezone: timezone.trim(),
          address: address.trim(),
          emergencyContactName: emergencyContactName.trim(),
          emergencyContactPhoneCountryCode,
          emergencyContactPhoneNumber: emergencyContactPhoneNumber.trim(),
          notes: notes.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Failed to submit signup request");
      }

      alert("We’ve received your request. Please wait for admin approval via email.");
    } catch (err: any) {
      alert(err?.message || "Failed to submit signup request");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header title="Sign Up" showBack />

      <main className="container max-w-lg mx-auto px-4 py-6">
        <Card variant="glass">
          <CardContent className="py-6 space-y-5">
            <div>
              <h1 className="text-xl font-semibold">Create Your Account</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Fill in the required details to submit your signup request.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>First Name *</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Last Name *</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="client@email.com"
              />
              {email.trim() !== "" && !emailRegex.test(email.trim().toLowerCase()) && (
                <p className="text-sm text-muted-foreground">Enter a valid email address.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Display Name (optional)</Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="If empty, First + Last will be used"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Password *</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                />
              </div>
              <div className="space-y-2">
                <Label>Re-enter Password *</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                />
              </div>
            </div>

            {!passwordsMatch && (
              <p className="text-sm text-destructive">Passwords do not match.</p>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Age *</Label>
                <Input value={age} onChange={(e) => setAge(e.target.value)} inputMode="numeric" />
              </div>
              <div className="space-y-2">
                <Label>Gender *</Label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Select</option>
                  {genderOptions.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-1">
                <Label>Country Code</Label>
                <select
                  value={phoneCountryCode}
                  onChange={(e) => setPhoneCountryCode(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {phoneCountryOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Phone Number *</Label>
                <Input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Timezone *</Label>
              <Input
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="America/New_York"
              />
            </div>

            <div className="space-y-2">
              <Label>Address *</Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Full address"
              />
            </div>

            <div className="space-y-3">
              <div className="text-sm font-medium">Emergency Contact (optional)</div>

              <div className="space-y-2">
                <Label>Emergency Contact Name</Label>
                <Input
                  value={emergencyContactName}
                  onChange={(e) => setEmergencyContactName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-2 sm:col-span-1">
                  <Label>Country Code</Label>
                  <select
                    value={emergencyContactPhoneCountryCode}
                    onChange={(e) => setEmergencyContactPhoneCountryCode(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {phoneCountryOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Emergency Contact Phone</Label>
                  <Input
                    value={emergencyContactPhoneNumber}
                    onChange={(e) => setEmergencyContactPhoneNumber(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            {!isFormValid && (
              <p className="text-sm text-muted-foreground">
                Fill all marked details with a valid email and matching passwords to enable signup.
              </p>
            )}

            <div className="flex justify-end pt-2">
              <Button
                variant="healing"
                onClick={onSignup}
                disabled={saving || !isFormValid}
              >
                {saving ? "Submitting..." : "Sign Up"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
};

export default Signup;