"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { formatDiscount, isPromoCurrentlyActive, type Promo } from "@/lib/promos";
import {
  formatMelbourneDate,
  formatClockTime,
  getMelbourneDateParts,
} from "@/lib/date-time";
import Footer from "@/components/Footer";
import Skeleton from "@/components/Skeleton";

// One row from the Supabase "operating_hours" table.
interface OperatingHour {
  day_of_week: number; // 0 = Sunday ... 6 = Saturday
  open_time: string; // e.g. "10:00:00"
  close_time: string; // e.g. "22:30:00"
  is_closed: boolean;
}

// "22:30:00" -> 1350 (minutes since midnight), so times can be compared as numbers.
function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

// Small highlights shown in a strip under the hero.
const HIGHLIGHTS = [
  { icon: "🥗", label: "Vegetarian options" },
  { icon: "🥡", label: "Dine-in & Takeaway" },
  { icon: "💬", label: "Ask us about allergies" },
];

// Shared heading style so every section reads the same way.
function SectionHeading({
  id,
  eyebrow,
  title,
  description,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C2410C]">
        {eyebrow}
      </p>
      <h2
        id={id}
        className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl"
      >
        {title}
      </h2>
      {description && <p className="mt-3 text-gray-600">{description}</p>}
    </div>
  );
}

export default function Home() {
  // Promotions (from Supabase "promos" table)
  const [promos, setPromos] = useState<Promo[]>([]);
  const [promosLoading, setPromosLoading] = useState(true);
  const [promoError, setPromoError] = useState(false);

  // Opening hours - only used here for the "Open now" badge.
  // Full hours/address/phone are shown in the Footer instead.
  const [operatingHours, setOperatingHours] = useState<OperatingHour[]>([]);
  const [hoursLoading, setHoursLoading] = useState(true);

  // "Right now", in Melbourne time (not the visitor's own device time).
  const [currentDayOfWeek, setCurrentDayOfWeek] = useState<number | null>(null);
  const [currentMinutes, setCurrentMinutes] = useState<number | null>(null);

  useEffect(() => {
    // Prevents setState after this page has already been left.
    let active = true;

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
          console.error("Failed to load promotions:", error);
          setPromoError(true);
        } else {
          // isPromoCurrentlyActive() also checks date/time ranges, not just is_active.
          setPromos(
            ((data ?? []) as Promo[]).filter((promo) =>
              isPromoCurrentlyActive(promo)
            )
          );
        }
      } catch (error) {
        if (active) {
          console.error("Failed to load promotions:", error);
          setPromoError(true);
        }
      } finally {
        if (active) setPromosLoading(false);
      }
    }

    async function loadOperatingHours() {
      try {
        const { data, error } = await supabase
          .from("operating_hours")
          .select("day_of_week, open_time, close_time, is_closed")
          .order("day_of_week", { ascending: true });

        if (!error && data && active) {
          setOperatingHours(data as OperatingHour[]);
        }
      } catch (err) {
        console.error("Failed to load operating hours:", err);
      } finally {
        if (active) setHoursLoading(false);
      }
    }

    const parts = getMelbourneDateParts();
    const dayOfWeek = new Date(
      Date.UTC(parts.year, parts.month - 1, parts.day)
    ).getUTCDay();
    setCurrentDayOfWeek(dayOfWeek);
    setCurrentMinutes(parts.hour * 60 + parts.minute);

    loadPromos();
    loadOperatingHours();

    return () => {
      active = false;
    };
  }, []);

  // Today's row (falls back to default hours if not in the table yet).
  const todayRow = operatingHours.find(
    (oh) => oh.day_of_week === currentDayOfWeek
  );
  const isThuFriSat =
    currentDayOfWeek === 4 || currentDayOfWeek === 5 || currentDayOfWeek === 6;
  const todayOpenTime = todayRow?.open_time ?? "10:00:00";
  const todayCloseTime =
    todayRow?.close_time ?? (isThuFriSat ? "23:45:00" : "22:30:00");
  const todayIsClosed = todayRow ? todayRow.is_closed : false;

  const isOpenNow =
    !todayIsClosed &&
    currentMinutes !== null &&
    currentMinutes >= toMinutes(todayOpenTime) &&
    currentMinutes < toMinutes(todayCloseTime);

  // Fragment because this page returns both <main> and <Footer /> side by side.
  return (
    <>
      <main className="flex-1 bg-[#FAF7F2] text-[#1C1917]">
        {/* HERO */}
        <section className="px-4 pb-12 pt-10 sm:px-8 sm:pb-16 sm:pt-16">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-14">
            <div>
              {/* Fixed height so the heading doesn't jump when hours load */}
              <div className="mb-5 flex h-7 items-center">
                {hoursLoading ? (
                  <div
                    role="status"
                    aria-label="Loading opening status"
                    aria-busy="true"
                  >
                    <Skeleton className="h-7 w-48 rounded-full" />
                    <span className="sr-only">Loading opening status...</span>
                  </div>
                ) : (
                  <p className="inline-flex items-center gap-2 rounded-full border border-[#EBE6DD] bg-white px-3 py-1 text-xs font-semibold">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        isOpenNow ? "bg-green-500" : "bg-gray-400"
                      }`}
                      aria-hidden="true"
                    />
                    {isOpenNow
                      ? `Open now · Closes ${formatClockTime(todayCloseTime)}`
                      : "Closed right now"}
                  </p>
                )}
              </div>

              <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                Kebabs, pide and burgers, made fresh in{" "}
                <span className="text-[#C2410C]">Mickleham.</span>
              </h1>
              <p className="mt-5 max-w-md text-lg text-gray-600">
                Order online and pick up, or book a table and eat with us.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/menu"
                  className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#C2410C] px-7 font-semibold text-white shadow-sm transition-colors hover:bg-[#9A3412]"
                >
                  Order Now
                </Link>
                <Link
                  href="/reservation"
                  className="inline-flex min-h-12 items-center justify-center rounded-xl border border-gray-300 bg-white px-7 font-semibold text-gray-800 transition-colors hover:border-gray-500"
                >
                  Book a Table
                </Link>
              </div>
            </div>

            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-[#EFE7DB] shadow-xl shadow-black/10 lg:aspect-[4/5]">
              <Image
                src="/images/hero-grill-platter.jpg"
                alt="Grilled chicken and lamb skewers, lamb cutlets, roasted vegetables and dipping sauces served on flatbread"
                fill
                preload
                sizes="(min-width: 1024px) 520px, 100vw"
                className="object-cover"
              />
            </div>
          </div>
        </section>

        {/* HIGHLIGHTS STRIP */}
        <section aria-label="What we offer" className="border-y border-[#EBE6DD] bg-white px-4 sm:px-8">
          <ul className="mx-auto grid max-w-6xl divide-y divide-[#EBE6DD] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {HIGHLIGHTS.map((item) => (
              <li
                key={item.label}
                className="flex items-center gap-3 py-4 sm:justify-center sm:py-5"
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FAF7F2] text-xl"
                  aria-hidden="true"
                >
                  {item.icon}
                </span>
                <span className="text-sm font-semibold">{item.label}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* CURRENT PROMOTIONS */}
        <section
          aria-labelledby="promos-heading"
          className="px-4 py-16 sm:px-8 sm:py-20"
        >
          <div className="mx-auto max-w-6xl">
            <SectionHeading
              id="promos-heading"
              eyebrow="A little something extra"
              title="Current promotions"
              description="Use these deals when you order online."
            />

            {promosLoading ? (
              <div
                role="status"
                className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
                aria-busy="true"
                aria-label="Loading promotions"
              >
                {[0, 1, 2].map((index) => (
                  <article
                    key={index}
                    className="flex min-h-56 flex-col gap-4 rounded-2xl border border-[#EBE6DD] bg-white p-5"
                  >
                    <Skeleton tone="warm" className="h-5 w-2/3" />
                    <Skeleton tone="warm" className="h-3 w-full" />
                    <Skeleton tone="warm" className="h-3 w-4/5" />
                    <Skeleton tone="warm" className="mt-auto h-10 w-28 rounded-lg" />
                  </article>
                ))}
              </div>
            ) : promoError ? (
              <p
                role="status"
                className="mt-10 rounded-2xl bg-white px-6 py-8 text-center text-sm text-gray-600"
              >
                Promotions are unavailable right now. Please check back soon.
              </p>
            ) : promos.length ? (
              <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {promos.map((promo) => (
                  <article
                    key={promo.id}
                    className="flex flex-col rounded-2xl bg-white p-6 ring-1 ring-[#EBE6DD] transition-shadow hover:shadow-md"
                  >
                    <p className="text-3xl font-extrabold tracking-tight text-[#C2410C]">
                      {formatDiscount(promo)}
                    </p>
                    <h3 className="mt-3 text-lg font-bold">{promo.title}</h3>
                    <p className="mt-2 flex-1 text-sm leading-6 text-gray-600">
                      {promo.description}
                    </p>

                    <div className="mt-6 flex items-center justify-between gap-3 rounded-xl border-2 border-dashed border-orange-200 bg-[#FFFAF5] px-4 py-3">
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Use code
                      </span>
                      <span className="font-mono text-base font-bold tracking-wider text-[#9A3412]">
                        {promo.code}
                      </span>
                    </div>

                    {promo.expires_at && (
                      <p className="mt-3 text-xs text-gray-500">
                        Offer ends {formatMelbourneDate(promo.expires_at)}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-10 rounded-2xl bg-white px-6 py-8 text-center text-sm text-gray-500">
                No active promotions at the moment. Please check back soon.
              </p>
            )}
          </div>
        </section>

        {/* ABOUT / "YOUR LOCAL KEBAB SHOP" */}
        <section className="bg-[#EFE7DB] px-4 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-2 lg:items-center lg:gap-14">
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-[#E4D8C6] shadow-xl shadow-black/10">
              <Image
                src="/images/about-kebab-carving.jpg"
                alt="A cook carving kebab meat from a vertical rotisserie in front of the grill"
                fill
                sizes="(min-width: 1024px) 560px, 100vw"
                className="object-cover object-[35%_50%]"
              />
            </div>
            <div>
              <SectionHeading eyebrow="About us" title="Your local kebab shop" />
              <p className="mt-4 max-w-md text-lg leading-8 text-gray-700">
                We cook kebabs, burgers and grills fresh every day. You can
                pick up, eat in, or order for a group.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
