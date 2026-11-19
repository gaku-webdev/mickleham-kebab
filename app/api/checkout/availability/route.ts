import { NextResponse } from "next/server";
import { getCheckoutAvailability } from "@/lib/trading-hours";

export async function GET() {
  const availability = await getCheckoutAvailability();
  const status =
    availability.reason === "unavailable" ? 503 : 200;

  return NextResponse.json(availability, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
