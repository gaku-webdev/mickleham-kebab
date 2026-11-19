"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  formatDiscount,
  isPromoCurrentlyActive,
  type Promo,
} from "@/lib/promos";
import {
  formatMelbourneDate,
  formatClockTime,
  getMelbourneDateParts,
} from "@/lib/date-time";
import Skeleton from "@/components/Skeleton";

export interface OperatingHour {
  id: number;
  day_of_week: number;
  day_name: string;
  open_time: string;
  close_time: string;
  is_closed: boolean;
}

const CUISINES = [
  "Burgers",
  "Fried Chicken",
  "Milkshake",
  "Kebabs",
];

// Display order: Monday through Sunday (matching reference screenshot)
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_LABELS: Record<number, string> = {
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
  0: "Sun",
};

export default function StoreInfoPage() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [promosLoading, setPromosLoading] = useState(true);
  const [promoError, setPromoError] = useState(false);

  // Operating Hours fetched dynamically from Supabase
  const [operatingHours, setOperatingHours] = useState<OperatingHour[]>([]);
  const [hoursLoading, setHoursLoading] = useState(true);

  // Current day in Melbourne time for highlighting today's row
  const [currentDayOfWeek, setCurrentDayOfWeek] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    // 1. Fetch operating hours from database
    async function fetchOperatingHours() {
      try {
        const { data, error } = await supabase
          .from("operating_hours")
          .select("*")
          .order("day_of_week", { ascending: true });

        if (!error && data && data.length > 0 && active) {
          setOperatingHours(data as OperatingHour[]);
        }
      } catch (err) {
        console.error("Failed to load operating hours:", err);
      } finally {
        if (active) setHoursLoading(false);
      }
    }

    // 2. Fetch active promos
    async function loadPromos() {
      try {
        const { data, error } = await supabase
          .from("promos")
          .select(
            "id, title, description, code, discount_type, discount_value, is_active, starts_at, expires_at, applies_to_all, category_ids, menu_item_ids, active_days, daily_start_time, daily_end_time, schedule_timezone"
          )
          .eq("is_active", true)
          .order("starts_at", { ascending: true });

        if (!active) return;

        if (error) {
          setPromoError(true);
        } else {
          setPromos(
            ((data ?? []) as Promo[]).filter((promo) =>
              isPromoCurrentlyActive(promo)
            )
          );
        }
      } catch {
        if (active) setPromoError(true);
      } finally {
        if (active) setPromosLoading(false);
      }
    }

    // 3. Compute Melbourne current day of week (0 = Sun, 1 = Mon...)
    const melbParts = getMelbourneDateParts();
    const [y, m, d] = [melbParts.year, melbParts.month, melbParts.day];
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    setCurrentDayOfWeek(dow);

    fetchOperatingHours();
    loadPromos();

    return () => {
      active = false;
    };
  }, []);

  // Format opening hours rows from database in Mon -> Sun order
  const formattedHoursList = useMemo(() => {
    return DAY_ORDER.map((dayNum) => {
      const found = operatingHours.find((oh) => oh.day_of_week === dayNum);
      const isWeekendThursToSat = dayNum >= 4; // Thu, Fri, Sat

      const openTime = found?.open_time || "10:00:00";
      const closeTime =
        found?.close_time || (isWeekendThursToSat ? "23:45:00" : "22:30:00");
      const isClosed = found ? found.is_closed : false;

      // Pickup hours from database
      const pickupStr = isClosed
        ? "Closed"
        : `${formatClockTime(openTime).toUpperCase()} - ${formatClockTime(closeTime).toUpperCase()}`;

      // Delivery hours
      const deliveryClose = dayNum === 5 || dayNum === 6 ? "10:30 PM" : "10:00 PM";
      const deliveryStr = isClosed ? "Closed" : `4:45 PM - ${deliveryClose}`;

      return {
        dayNum,
        dayLabel: DAY_LABELS[dayNum],
        pickup: pickupStr,
        delivery: deliveryStr,
        isClosed,
        isToday: currentDayOfWeek === dayNum,
      };
    });
  }, [operatingHours, currentDayOfWeek]);

  return (
    <main className="min-h-screen bg-[#FAF7F2] text-[#1C1917] px-4 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Main Store Info Grid (Matching attached screenshot) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: INFO & LOCATION (lg:col-span-7) */}
          <div className="lg:col-span-7 space-y-6">
            {/* CARD 1: INFO */}
            <section className="bg-white rounded-2xl border border-[#EBE6DD] p-5 sm:p-6 shadow-xs">
              <div className="flex items-center gap-2 mb-3.5">
                <span className="flex items-center justify-center w-5 h-5 rounded-full border border-gray-400 text-gray-700 text-xs font-serif font-bold select-none">
                  i
                </span>
                <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-gray-900">
                  INFO
                </h2>
              </div>
              <div className="bg-[#FAF7F2] border border-[#EBE6DD] rounded-xl p-4 sm:p-5">
                <p className="text-xs sm:text-sm text-gray-700 leading-relaxed font-medium">
                  Find us at 2/9–33 Errol Boulevard, Mickleham VIC 3064. Visit
                  for dine-in, or order kebabs, pide and burgers for pickup.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3 pt-3 border-t border-[#EBE6DD]">
                  <Link
                    href="/menu"
                    className="px-4 py-2 bg-[#C2410C] hover:bg-[#9A3412] text-white rounded-lg text-xs font-bold transition-colors shadow-2xs"
                  >
                    View Menu &amp; Order
                  </Link>
                  <Link
                    href="/reservation"
                    className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-800 border border-gray-300 rounded-lg text-xs font-bold transition-colors"
                  >
                    Book a Table
                  </Link>
                </div>
              </div>
            </section>

            {/* CARD 2: LOCATION with Embedded Google Map */}
            <section className="bg-white rounded-2xl border border-[#EBE6DD] p-5 sm:p-6 shadow-xs">
              <div className="flex items-center gap-2 mb-3.5">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-5 h-5 text-gray-700"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
                  />
                </svg>
                <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-gray-900">
                  LOCATION
                </h2>
              </div>

              <div className="space-y-1 mb-4">
                <p className="text-xs sm:text-sm font-semibold text-gray-900">
                  2/9–33 Errol Boulevard, Mickleham VIC 3064
                </p>
                <a
                  href="tel:0394539778"
                  className="inline-block text-xs sm:text-sm font-semibold text-[#8F482F] hover:underline"
                >
                  (03) 9453 9778
                </a>
              </div>

              {/* Embedded Google Map */}
              <div className="relative w-full h-64 sm:h-72 rounded-xl overflow-hidden border border-gray-200 shadow-2xs">
                <iframe
                  title="Mickleham Kebab & Grill Location"
                  src="https://maps.google.com/maps?q=-37.5341057%2C144.8980763&z=17&output=embed"
                  className="w-full h-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-gray-500">

                <a
                  href="https://www.google.com/maps/dir/?api=1&destination=-37.5341057%2C144.8980763"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-[#C2410C] hover:underline flex items-center gap-1"
                >
                  Get Directions ↗
                </a>
              </div>
            </section>
          </div>

          {/* RIGHT COLUMN: CUISINES & OPENING HOURS (lg:col-span-5) */}
          <div className="lg:col-span-5 space-y-6">
            {/* MENU CATEGORIES */}
            <section className="bg-white rounded-2xl border border-[#EBE6DD] p-5 sm:p-6 shadow-xs">
              <div className="mb-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8F482F]">
                  The menu
                </p>
                <h2 className="mt-1 text-2xl text-[#29261F]">
                  Menu categories
                </h2>
              </div>
              <ul className="mt-4 divide-y divide-[#DED7CA] border-y border-[#DED7CA]">
                {CUISINES.map((cuisine, index) => (
                  <li key={cuisine} className="flex min-h-12 items-center gap-4 py-3">
                    <span className="font-serif text-sm italic text-[#9A4A2B]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="font-serif text-lg">{cuisine}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/menu"
                className="mt-4 inline-flex items-center gap-3 border-b border-[#8F482F] pb-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#8F482F]"
              >
                View the full menu <span aria-hidden="true">↗</span>
              </Link>
            </section>

            {/* CARD 4: OPENING HOURS */}
            <section className="bg-white rounded-2xl border border-[#EBE6DD] p-5 sm:p-6 shadow-xs">
              <div className="flex items-center gap-2 mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-5 h-5 text-gray-700"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-gray-900">
                  OPENING HOURS
                </h2>
              </div>

              {hoursLoading ? (
                <div
                  role="status"
                  aria-label="Loading operating hours"
                  aria-busy="true"
                  className="overflow-hidden rounded-xl border border-gray-300 shadow-2xs"
                >
                  <table className="w-full border-collapse text-left text-xs">
                    <thead className="bg-[#29261F] text-[11px] font-bold uppercase tracking-wider text-white">
                      <tr>
                        <th className="border-r border-gray-500/50 px-3 py-2.5">
                          Day
                        </th>
                        <th className="border-r border-gray-500/50 px-3 py-2.5 text-center">
                          Pickup
                        </th>
                        <th className="px-3 py-2.5 text-center">Delivery</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {Array.from({ length: 7 }, (_, index) => (
                        <tr key={index}>
                          <td className="px-3 py-3">
                            <Skeleton className="h-3 w-16" />
                          </td>
                          <td className="px-3 py-3">
                            <Skeleton className="mx-auto h-3 w-20" />
                          </td>
                          <td className="px-3 py-3">
                            <Skeleton className="mx-auto h-3 w-20" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="sr-only">Loading operating hours...</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-gray-300 shadow-2xs">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-[#29261F] text-white uppercase text-[11px] font-bold tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3 border-r border-gray-500/50">
                          Day
                        </th>
                        <th className="py-2.5 px-3 border-r border-gray-500/50 text-center">
                          Pickup
                        </th>
                        <th className="py-2.5 px-3 text-center">Delivery</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {formattedHoursList.map((row) => (
                        <tr
                          key={row.dayNum}
                          className={`transition-colors ${row.isToday
                            ? "bg-amber-50/80 font-bold text-gray-900"
                            : "text-gray-700 hover:bg-gray-50/80 font-medium"
                            }`}
                        >
                          <td className="py-2.5 px-3 border-r border-gray-200 whitespace-nowrap">
                            <span className="flex items-center gap-1.5">
                              {row.isToday && (
                                <span className="w-1.5 h-1.5 rounded-full bg-[#EA580C]" />
                              )}
                              <span>{row.dayLabel}</span>
                            </span>
                          </td>
                          <td className="py-2.5 px-3 border-r border-gray-200 text-center text-[11px] sm:text-xs whitespace-nowrap">
                            {row.pickup}
                          </td>
                          <td className="py-2.5 px-3 text-center text-[11px] sm:text-xs whitespace-nowrap">
                            {row.delivery}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <p className="mt-3 text-[11px] text-gray-500 text-center">
                Public holidays and special service hours may vary.
              </p>
            </section>
          </div>
        </div>


      </div>
    </main>
  );
}
