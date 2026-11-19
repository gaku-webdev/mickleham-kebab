"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { formatClockTime, getMelbourneDateParts } from "@/lib/date-time";
import Skeleton from "@/components/Skeleton";

interface OperatingHour {
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
}

export default function Footer() {
  const [todayText, setTodayText] = useState("");
  const [hoursLoading, setHoursLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadTodayHours() {
      const parts = getMelbourneDateParts();
      const dayOfWeek = new Date(
        Date.UTC(parts.year, parts.month - 1, parts.day)
      ).getUTCDay();

      try {
        const { data, error } = await supabase
          .from("operating_hours")
          .select("day_of_week, open_time, close_time, is_closed")
          .eq("day_of_week", dayOfWeek)
          .maybeSingle();

        if (!active) return;
        if (error) {
          console.error("Failed to load today's operating hours:", error);
          setTodayText("Hours unavailable");
          return;
        }

        const row = (data ?? null) as OperatingHour | null;
        const isThuFriSat =
          dayOfWeek === 4 || dayOfWeek === 5 || dayOfWeek === 6;
        const openTime = row?.open_time ?? "10:00:00";
        const closeTime =
          row?.close_time ?? (isThuFriSat ? "23:45:00" : "22:30:00");
        const closed = row ? row.is_closed : false;

        setTodayText(
          closed
            ? "Closed today"
            : `Today: ${formatClockTime(openTime)} – ${formatClockTime(closeTime)}`
        );
      } catch (error) {
        if (!active) return;
        console.error("Failed to load today's operating hours:", error);
        setTodayText("Hours unavailable");
      } finally {
        if (active) setHoursLoading(false);
      }
    }

    loadTodayHours();
    return () => {
      active = false;
    };
  }, []);

  return (
    <footer className="border-t border-[#493A30] bg-[#25221D] px-5 py-10 text-[#E7E2DA] sm:px-8 sm:py-12">
      <div className="mx-auto flex max-w-7xl flex-col gap-7 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm">
            2/9–33 Errol Boulevard, Mickleham VIC 3064
          </p>
          <a
            href="tel:0394539778"
            className="mt-1 block text-sm text-[#D5A78F] hover:underline"
          >
            (03) 9453 9778
          </a>
          <a
            href="https://www.instagram.com/mickleham_kebab/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Follow Mickleham Kebab & Grill on Instagram (opens in a new tab)"
            className="mt-1 inline-flex items-center gap-2 text-sm text-[#D5A78F] hover:underline"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-4 w-4"
            >
              <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
            </svg>
            @mickleham_kebab
          </a>
          {hoursLoading ? (
            <div role="status" aria-label="Loading today's hours" aria-busy="true">
              <Skeleton tone="inverse" className="mt-2 h-4 w-56" />
              <span className="sr-only">Loading today&apos;s hours...</span>
            </div>
          ) : (
            <p className="mt-1 text-sm">{todayText}</p>
          )}
        </div>

        <div className="flex flex-col gap-2 text-sm sm:items-end">
          <div className="flex flex-wrap gap-4">
            <Link href="/store-info" className="hover:underline">
              Allergy Information
            </Link>
            <Link href="/terms" className="hover:underline">
              Terms
            </Link>
            <Link href="/privacy" className="hover:underline">
              Privacy
            </Link>
          </div>
          <p className="text-xs tracking-wide text-[#B4A99D]">
            © {new Date().getFullYear()} Mickleham Kebab &amp; Grill
          </p>
        </div>
      </div>
    </footer>
  );
}