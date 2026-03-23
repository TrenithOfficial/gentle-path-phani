import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  "https://gentle-path-api-883951071472.us-central1.run.app";

type AccountProfile = {
  id: string;
  email: string;
  name?: string;
  role: string;
  startDate?: string | null;
  createdAt?: string;

  firstName?: string | null;
  lastName?: string | null;
  age?: number | null;
  gender?: string | null;

  phoneCountryCode?: string | null;
  phoneNumber?: string | null;

  timezone?: string | null;
  address?: string | null;

  emergencyContactName?: string | null;
  emergencyContactPhoneCountryCode?: string | null;
  emergencyContactPhoneNumber?: string | null;

  notes?: string | null;
};

const getIdToken = async () => {
  const { getAuth } = await import("firebase/auth");
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Not authenticated");
  }

  return user.getIdToken();
};

const formatValue = (value?: string | number | null) => {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
};

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
};

export default function Account() {
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError("");

        const token = await getIdToken();

        const res = await fetch(`${API_BASE}/api/me/details`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || "Failed to load account details");
        }

        const data = await res.json();
        if (!cancelled) setProfile(data);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Failed to load account details");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header title="Manage account" showBack />

      <main className="container max-w-lg mx-auto px-4 py-6 space-y-4">
        {loading && (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">
              Loading your account details...
            </CardContent>
          </Card>
        )}

        {!loading && error && (
          <Card>
            <CardContent className="py-8 text-sm text-red-600">
              {error}
            </CardContent>
          </Card>
        )}

        {!loading && !error && profile && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Basic details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <DetailRow label="Full name" value={profile.name} />
                <DetailRow label="Email" value={profile.email} />
                <DetailRow label="Role" value={profile.role} />
                <DetailRow
                  label="Program start date"
                  value={formatDate(profile.startDate)}
                />
                <DetailRow
                  label="Account created"
                  value={formatDate(profile.createdAt)}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Personal information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <DetailRow label="First name" value={profile.firstName} />
                <DetailRow label="Last name" value={profile.lastName} />
                <DetailRow label="Age" value={profile.age} />
                <DetailRow label="Gender" value={profile.gender} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Contact details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <DetailRow
                  label="Phone country code"
                  value={profile.phoneCountryCode}
                />
                <DetailRow label="Phone number" value={profile.phoneNumber} />
                <DetailRow label="Timezone" value={profile.timezone} />
                <DetailRow label="Address" value={profile.address} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Emergency contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <DetailRow
                  label="Contact name"
                  value={profile.emergencyContactName}
                />
                <DetailRow
                  label="Contact phone country code"
                  value={profile.emergencyContactPhoneCountryCode}
                />
                <DetailRow
                  label="Contact phone number"
                  value={profile.emergencyContactPhoneNumber}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <p className="whitespace-pre-wrap text-foreground">
                  {formatValue(profile.notes)}
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/50 pb-3 last:border-b-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right text-foreground font-medium">
        {formatValue(value)}
      </span>
    </div>
  );
}