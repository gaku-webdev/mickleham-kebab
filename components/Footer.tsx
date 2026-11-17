"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { formatClockTime, getMelbourneDateParts } from "@/lib/date-time";

interface OperatingHour {
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
}

export default function Footer() {
  const [todayText, setTodayText] = useState<string>("Loading hours...");

  useEffect(() => {
    let active = true;

    async function loadTodayHours() {
      const parts = getMelbourneDateParts();
      const dayOfWeek = new Date(
        Date.UTC(parts.year, parts.month - 1, parts.day)
      ).getUTCDay();

      const { data, error } = await supabase
        .from("operating_hours")
        .select("day_of_week, open_time, close_time, is_closed")
        .eq("day_of_week", dayOfWeek)
        .maybeSingle();

      if (!active) return;

      const row = (data ?? null) as OperatingHour | null;
      const isThuFriSat = dayOfWeek === 4 || dayOfWeek === 5 || dayOfWeek === 6;
      const openTime = row?.open_time ?? "10:00:00";
      const closeTime =
        row?.close_time ?? (isThuFriSat ? "23:45:00" : "22:30:00");
      const closed = row ? row.is_closed : false;

      if (!error) {
        setTodayText(
          closed
            ? "Closed today"
            : `Today: ${formatClockTime(openTime)} – ${formatClockTime(closeTime)}`
        );
      }
    }

    loadTodayHours();
    return () => {
      active = false;
    };
  }, []);

  return (
    <footer className="bg-[#1C1917] px-4 py-10 text-[#E7E2DA] sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-base font-extrabold text-white">
            Mickleham Kebab &amp; Grill
          </p>
          <p className="mt-2 text-sm">2/9-33 Errol Bvd, Mickleham, VIC 3064</p>
          <a
            href="tel:0394539778"
            className="mt-1 block text-sm text-[#F2B88A] hover:underline"
          >
            (03) 9453 9778
          </a>
          <p className="mt-1 text-sm">{todayText}</p>
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
          <p className="text-xs text-[#9C9188]">
            © {new Date().getFullYear()} Mickleham Kebab &amp; Grill
          </p>
        </div>
      </div>
    </footer>
  );
}