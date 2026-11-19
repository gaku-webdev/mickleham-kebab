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
  {
    name: "Burgers",
    image:
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80",
    href: "/menu",
  },
  {
    name: "Fried Chicken",
    image:
      "https://images.unsplash.com/photo-1567620832903-9fc6debc209f?auto=format&fit=crop&w=400&q=80",
    href: "/menu",
  },
  {
    name: "Milkshake",
    image:
      "https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=400&q=80",
    href: "/menu",
  },
  {
    name: "Kebabs",
    image:
      "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?auto=format&fit=crop&w=400&q=80",
    href: "/menu",
  },
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
                  Mickleham Kebab &amp; Grill based in Vic offers great-tasting
                  Kebabs delights at affordable prices. Get Fresh Food Delivered
                  Hot To Your Doorstep!
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
                  2/9-33 Errol Bvd, Mickleham, Vic, VIC, 3064
                </p>
                <a
                  href="tel:0394539778"
                  className="inline-block text-xs sm:text-sm font-semibold text-[#0284C7] hover:underline"
                >
                  (03) 9453 9778
                </a>
              </div>

              {/* Embedded Google Map */}
              <div className="relative w-full h-64 sm:h-72 rounded-xl overflow-hidden border border-gray-200 shadow-2xs">
                <iframe
                  title="Mickleham Kebab & Grill Location"
                  src="https://maps.google.com/maps?q=2%2F9-33+Errol+Bvd%2C+Mickleham+VIC+3064&t=&z=15&ie=UTF8&iwloc=&output=embed"
                  className="w-full h-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-gray-500">

                <a
                  href="https://www.google.com/maps/dir/?api=1&destination=2%2F9-33+Errol+Bvd%2C+Mickleham+VIC+3064"
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
            {/* CARD 3: CUISINES */}
            <section className="bg-white rounded-2xl border border-[#EBE6DD] p-5 sm:p-6 shadow-xs">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-base select-none">🍴</span>
                <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-gray-900">
                  CUISINES
                </h2>
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-4 gap-2.5 text-center">
                {CUISINES.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="group flex flex-col items-center p-1.5 rounded-xl hover:bg-[#FAF7F2] transition-colors"
                  >
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border border-gray-200 shadow-2xs mb-1.5 bg-gray-50">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    </div>
                    <span className="text-[11px] sm:text-xs font-bold text-gray-800 group-hover:text-[#C2410C] transition-colors leading-tight">
                      {item.name}
                    </span>
                  </Link>
                ))}
              </div>
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
                    <thead className="bg-[#4B5563] text-[11px] font-bold uppercase tracking-wider text-white">
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
                    <thead className="bg-[#4B5563] text-white uppercase text-[11px] font-bold tracking-wider">
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
