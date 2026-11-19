import "server-only";

import { getMelbourneDateParts } from "@/lib/date-time";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type OperatingHoursRow = {
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
};

export type CheckoutAvailability = {
  available: boolean;
  reason?: "closed" | "unavailable";
  message: string;
};

const UNAVAILABLE_MESSAGE =
  "We can't verify trading hours right now. Please try again shortly.";
const CLOSED_MESSAGE =
  "Ordering is closed right now. Please come back during trading hours.";

function toMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  return hours * 60 + minutes;
}

export async function getCheckoutAvailability(
  now = new Date()
): Promise<CheckoutAvailability> {
  const melbourneTime = getMelbourneDateParts(now);
  const dayOfWeek = new Date(
    Date.UTC(
      melbourneTime.year,
      melbourneTime.month - 1,
      melbourneTime.day
    )
  ).getUTCDay();

  try {
    const { data, error } = await getSupabaseAdmin()
      .from("operating_hours")
      .select("day_of_week, open_time, close_time, is_closed")
      .eq("day_of_week", dayOfWeek)
      .maybeSingle();

    if (error) {
      console.error("Failed to load trading hours for checkout:", error);
      return {
        available: false,
        reason: "unavailable",
        message: UNAVAILABLE_MESSAGE,
      };
    }

    const row = (data ?? null) as OperatingHoursRow | null;
    if (row?.is_closed) {
      return {
        available: false,
        reason: "closed",
        message: CLOSED_MESSAGE,
      };
    }

    const isThursdayToSaturday =
      dayOfWeek === 4 || dayOfWeek === 5 || dayOfWeek === 6;
    const openTime = row?.open_time ?? "10:00:00";
    const closeTime =
      row?.close_time ?? (isThursdayToSaturday ? "23:45:00" : "22:30:00");
    const opensAt = toMinutes(openTime);
    const closesAt = toMinutes(closeTime);

    if (opensAt === null || closesAt === null || closesAt <= opensAt) {
      console.error("Invalid operating hours configured for checkout:", {
        dayOfWeek,
        openTime,
        closeTime,
      });
      return {
        available: false,
        reason: "unavailable",
        message: UNAVAILABLE_MESSAGE,
      };
    }

    const currentMinutes = melbourneTime.hour * 60 + melbourneTime.minute;
    const available = currentMinutes >= opensAt && currentMinutes < closesAt;

    return available
      ? { available: true, message: "Ordering is open now." }
      : {
          available: false,
          reason: "closed",
          message: CLOSED_MESSAGE,
        };
  } catch (error) {
    console.error("Could not verify trading hours for checkout:", error);
    return {
      available: false,
      reason: "unavailable",
      message: UNAVAILABLE_MESSAGE,
    };
  }
}
