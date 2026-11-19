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
  { icon: "01", label: "Vegetarian options" },
  { icon: "02", label: "Dine-in & Takeaway" },
  { icon: "03", label: "Ask us about allergies" },
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
      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#9A4A2B]">
        {eyebrow}
      </p>
      <h2
        id={id}
        className="mt-3 font-serif text-4xl font-normal leading-tight tracking-[-0.035em] sm:text-5xl"
      >
        {title}
      </h2>
      {description && (
        <p className="mt-4 max-w-xl text-sm leading-7 text-[#6F6A62] sm:text-base">
          {description}
        </p>
      )}
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
  const [{ currentDayOfWeek, currentMinutes }] = useState(() => {
    const parts = getMelbourneDateParts();
    return {
      currentDayOfWeek: new Date(
        Date.UTC(parts.year, parts.month - 1, parts.day)
      ).getUTCDay(),
      currentMinutes: parts.hour * 60 + parts.minute,
    };
  });

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
      <main className="flex-1 bg-[#F8F6F0] text-[#25221D]">
        {/* HERO */}
        <section className="home-hero relative isolate overflow-hidden px-5 pb-10 pt-8 sm:px-8 sm:pb-14 sm:pt-12">
          <div className="mx-auto grid max-w-7xl gap-2 lg:grid-cols-[0.88fr_1.12fr] lg:items-center lg:gap-8">
            <div className="relative z-10 py-2 lg:py-10">
              <p className="home-reveal home-delay-1 mb-6 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8D4B32]">
                Mickleham, Victoria{" "}
                <span className="px-2 text-[#C9BFB0]">/</span> Kebab &amp; Grill
              </p>
              {/* Fixed height so the heading doesn't jump when hours load */}
              <div className="mb-6 flex h-7 items-center">
                {hoursLoading ? (
                  <div
                    role="status"
                    aria-label="Loading opening status"
                    aria-busy="true"
                  >
                    <Skeleton tone="warm" className="h-4 w-44" />
                    <span className="sr-only">Loading opening status...</span>
                  </div>
                ) : (
                  <p className="home-reveal inline-flex items-center gap-2 border-y border-[#DED7CA] py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[#5D574F]">
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

              <h1 className="home-reveal home-delay-2 max-w-2xl font-serif text-[3.4rem] font-normal leading-[0.96] tracking-[-0.055em] sm:text-7xl lg:text-[4rem]">
                Kebabs, pide
                <br />
                <span className="italic text-[#994C31]">&amp; burgers</span>
                <br />
                in Mickleham.
              </h1>
              <p className="home-reveal home-delay-3 mt-6 max-w-md text-base leading-7 text-[#6F6A62] sm:mt-7 sm:text-lg sm:leading-8">
                Big Flavor, Hot Grill, and Your Favourite Kebabs and Burgers.
              </p>

              <div className="home-reveal home-delay-4 mt-7 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:items-center">
                <Link
                  href="/menu"
                  className="home-cta home-cta-primary inline-flex min-h-12 items-center justify-center bg-[#29261F] px-7 text-xs font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#8F482F]"
                >
                  Explore the menu{" "}
                  <span className="home-arrow ml-3 text-base" aria-hidden="true">
                    ↗
                  </span>
                </Link>
                <Link
                  href="/reservation"
                  className="home-cta inline-flex min-h-12 items-center justify-center border border-[#CFC8BB] px-7 text-xs font-semibold uppercase tracking-[0.12em] text-[#29261F] transition-colors hover:border-[#8F482F] hover:text-[#8F482F]"
                >
                  Book a table
                </Link>
              </div>
            </div>

            <div className="home-hero-art home-reveal home-delay-3 relative mx-auto flex aspect-[1/0.88] w-full max-w-[560px] items-center justify-center lg:aspect-square">
              <span className="home-hero-word" aria-hidden="true">
                GRILL
              </span>
              <span className="home-hero-ring home-hero-ring-outer" aria-hidden="true" />
              <span className="home-hero-ring home-hero-ring-inner" aria-hidden="true" />
              <figure className="relative z-10 flex h-full w-full items-center justify-center">
                <Link
                  href="/menu"
                  aria-label="Explore the Mickleham Kebab & Grill menu"
                  className="home-hero-photo group relative block aspect-square w-[72%] max-w-[440px] overflow-hidden rounded-full border-[9px] border-[#FFF9F2] bg-[#E9E1D5]"
                >
                  <Image
                    src="/images/hero-grill-platter.jpg"
                    alt="Grilled chicken and lamb skewers, lamb cutlets, roasted vegetables and dipping sauces served on flatbread"
                    fill
                    preload
                    sizes="(min-width: 1024px) 440px, 72vw"
                    className="home-hero-photo-image object-cover"
                  />
                </Link>
                <figcaption className="absolute bottom-0 z-20 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-[#716A60]">
                  Grilled meats · Mickleham, Victoria
                </figcaption>
              </figure>
              <Link
                href="/menu"
                aria-label="Browse kebabs on the menu"
                className="home-callout home-callout-one"
              >
                Kebabs <span aria-hidden="true">↗</span>
              </Link>
              <Link
                href="/menu"
                aria-label="Browse Turkish pide on the menu"
                className="home-callout home-callout-two"
              >
                Biryani <span aria-hidden="true">↗</span>
              </Link>
              <Link
                href="/menu"
                aria-label="Browse burgers on the menu"
                className="home-callout home-callout-three"
              >
                Burgers <span aria-hidden="true">↗</span>
              </Link>
            </div>
          </div>
        </section>

        {/* HIGHLIGHTS STRIP */}
        <section aria-label="What we offer" className="home-highlight-strip border-y border-[#713C2B] bg-[#8F482F] px-5 text-[#FFF9F2] sm:px-8">
          <ul className="mx-auto grid max-w-7xl divide-y divide-[#B98269] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {HIGHLIGHTS.map((item) => (
              <li
                key={item.label}
                className="flex items-center gap-4 py-4 sm:justify-center sm:py-5"
              >
                <span
                  className="font-serif text-sm italic tracking-wide text-[#F1C4A9]"
                  aria-hidden="true"
                >
                  {item.icon}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#FFF9F2]">{item.label}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* CURRENT PROMOTIONS */}
        <section
          aria-labelledby="promos-heading"
          className="px-5 py-16 sm:px-8 sm:py-24"
        >
          <div className="mx-auto max-w-7xl">
            <div className="home-reveal">
              <SectionHeading
                id="promos-heading"
                eyebrow="At the table"
                title="A little something extra"
                description="Current offers available when you order online."
              />
            </div>

            {promosLoading ? (
              <div
                role="status"
                className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3"
                aria-busy="true"
                aria-label="Loading promotions"
              >
                {[0, 1, 2].map((index) => (
                  <article
                    key={index}
                    className="flex min-h-[292px] flex-col border-t border-[#BFB6A8] py-5"
                  >
                    <Skeleton tone="warm" className="h-9 w-28" />
                    <Skeleton tone="warm" className="mt-4 h-7 w-3/4" />
                    <div className="mt-4 space-y-3">
                      <Skeleton tone="warm" className="h-3 w-full" />
                      <Skeleton tone="warm" className="h-3 w-full" />
                      <Skeleton tone="warm" className="h-3 w-4/5" />
                    </div>
                    <Skeleton tone="warm" className="mt-auto h-11 w-full" />
                    <Skeleton tone="warm" className="mt-3 h-3 w-2/5" />
                  </article>
                ))}
              </div>
            ) : promoError ? (
              <p
                role="status"
                className="home-reveal mt-12 flex min-h-[292px] items-center justify-center border-y border-[#DED7CA] px-6 py-8 text-center text-sm text-[#6F6A62]"
              >
                Promotions are unavailable right now. Please check back soon.
              </p>
            ) : promos.length ? (
              <div className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
                {promos.map((promo, index) => (
                  <article
                    key={promo.id}
                    className="home-promo-card home-reveal flex min-h-[292px] flex-col border-t border-[#BFB6A8] py-5"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <p className="font-serif text-4xl font-normal tracking-tight text-[#994C31]">
                      {formatDiscount(promo)}
                    </p>
                    <h3 className="mt-4 font-serif text-2xl font-normal">
                      {promo.title}
                    </h3>
                    <p className="mt-3 flex-1 text-sm leading-7 text-[#6F6A62]">
                      {promo.description}
                    </p>

                    <div className="mt-6 flex items-center justify-between gap-3 border-y border-dashed border-[#CFC8BB] py-3">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#777065]">
                        Use code
                      </span>
                      <span className="font-mono text-sm font-bold tracking-wider text-[#8F482F]">
                        {promo.code}
                      </span>
                    </div>

                    {promo.expires_at && (
                      <p className="mt-3 text-xs text-[#777065]">
                        Offer ends {formatMelbourneDate(promo.expires_at)}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <p className="home-reveal mt-12 flex min-h-[292px] items-center justify-center border-y border-[#DED7CA] px-6 py-8 text-center text-sm text-[#777065]">
                No active promotions at the moment. Please check back soon.
              </p>
            )}
          </div>
        </section>

        {/* ABOUT / "YOUR LOCAL KEBAB SHOP" */}
        <section className="bg-[#EDE8DD] px-5 py-16 sm:px-8 sm:py-24">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-16">
            <figure className="home-reveal">
              <Link
                href="/menu"
                aria-label="Explore the menu"
                className="home-photo-link relative block aspect-[4/3] overflow-hidden bg-[#E4D8C6]"
              >
                <Image
                  src="/images/about-kebab-carving.jpg"
                  alt="A cook carving kebab meat from a vertical rotisserie in front of the grill"
                  fill
                  sizes="(min-width: 1024px) 560px, 100vw"
                  className="home-photo-image object-cover object-[35%_50%]"
                />
              </Link>
              <figcaption className="mt-3 border-t border-[#CEC5B6] pt-3 text-[10px] uppercase tracking-[0.16em] text-[#716A60]">
                Kebab meat carved from the vertical rotisserie.
              </figcaption>
            </figure>
            <div className="home-reveal home-delay-2 py-2 lg:py-8">
              <SectionHeading
                eyebrow="Mickleham, Victoria"
                title="Kebabs, pide and burgers on Errol Boulevard."
              />
              <p className="mt-5 max-w-md text-base leading-8 text-[#5F5A51] sm:text-lg">
                Visit us at 2/9–33 Errol Boulevard for dine-in, or order kebabs,
                pide, burgers and grilled meals for pickup.
              </p>
              <Link
                href="/menu"
                className="home-about-link mt-7 inline-flex items-center border-b border-[#8F482F] pb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#8F482F] transition-colors hover:border-[#29261F] hover:text-[#29261F]"
              >
                Browse the menu{" "}
                <span className="home-arrow ml-3 text-base" aria-hidden="true">
                  →
                </span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
