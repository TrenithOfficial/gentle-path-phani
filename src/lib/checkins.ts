import { getAuth } from "firebase/auth";
import { apiUrl } from "@/lib/api";

export async function createCheckIn(input: {
  day: number;
  mood?: number;
  energy?: number;
  notes?: string;
  isTravelDay?: boolean;
  missedProtocol?: boolean;

  // ✅ NEW
  travelStartDate?: string | null;   // YYYY-MM-DD
  travelReturnDate?: string | null;  // YYYY-MM-DD
  missedProtocolNote?: string;       // required if missedProtocol=true
}) {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("Not logged in");

  const token = await user.getIdToken(true);

  const res = await fetch(apiUrl("/api/checkins"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      day: input.day,
      mood: input.mood ?? null,
      energy: input.energy ?? null,
      notes: input.notes ?? "",
      isTravelDay: input.isTravelDay ?? false,
      missedProtocol: input.missedProtocol ?? false,

      // ✅ NEW fields sent to backend
      travelStartDate: input.travelStartDate ?? null,
      travelReturnDate: input.travelReturnDate ?? null,
      missedProtocolNote: input.missedProtocolNote ?? "",
    }),
  });

  if (!res.ok) {
    const txt = await res.text();

    // Duplicate check-in for same day (DB unique constraint)
    if (res.status === 409) {
      throw new Error("You already checked in today. Come back tomorrow.");
    }

    throw new Error(`Failed to create check-in: ${res.status} ${txt}`);
  }


  return res.json();
}
