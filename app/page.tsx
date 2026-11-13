"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatDiscount, isPromoCurrentlyActive, type Promo } from "@/lib/promos";
import { formatMelbourneDate } from "@/lib/date-time";

export default function Home() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [promosLoading, setPromosLoading] = useState(true);
  const [promoError, setPromoError] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadPromos() {
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

      setPromosLoading(false);
    }

    void loadPromos();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#FAF7F2] px-4 py-12 text-center text-[#1C1917] sm:px-8 sm:py-16">
      <div className="mx-auto max-w-5xl">
        <section className="rounded-2xl border border-[#EBE6DD] bg-white px-6 py-16 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#EA580C]">
            Mickleham Kebab &amp; Grill
          </p>
          <h1 className="mt-4 text-4xl font-extrabold sm:text-5xl">
            Fresh kebabs and grills
          </h1>
          <p className="mt-4 text-lg text-gray-600">
            Made your way, ready when you are.
          </p>
          <a
            href="/menu"
            className="mt-8 inline-flex rounded-lg bg-[#C2410C] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#9A3412]"
          >
            Order Now
          </a>
        </section>

        <section
          aria-labelledby="promos-heading"
          className="mt-8 rounded-2xl border border-[#EBE6DD] bg-white p-6 text-left shadow-sm sm:p-8"
        >
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#EA580C]">
              A little something extra
            </p>
            <h2
              id="promos-heading"
              className="mt-2 text-2xl font-extrabold sm:text-3xl"
            >
              Current promotions
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Use these deals when you order online.
            </p>
          </div>

          {promosLoading ? (
            <p className="mt-6 text-center text-sm text-gray-500">
              Loading promotions...
            </p>
          ) : promoError ? (
            <p role="status" className="mt-6 text-center text-sm text-gray-600">
              Promotions are unavailable right now. Please check back soon.
            </p>
          ) : promos.length ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {promos.map((promo) => (
                <article
                  key={promo.id}
                  className="rounded-xl border border-orange-100 bg-[#FFFAF5] p-5"
                >
                  <p className="text-sm font-bold uppercase tracking-wide text-[#C2410C]">
                    {formatDiscount(promo)}
                  </p>
                  <h3 className="mt-2 text-lg font-bold">{promo.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-600">
                    {promo.description}
                  </p>
                  <p className="mt-4 text-sm text-gray-600">
                    Use code{" "}
                    <span className="rounded-md border border-orange-200 bg-white px-2 py-1 font-mono font-bold tracking-wider text-[#9A3412]">
                      {promo.code}
                    </span>
                  </p>
                  {promo.expires_at && (
                    <p className="mt-3 text-xs text-gray-500">
                      Offer ends{" "}
                      {formatMelbourneDate(promo.expires_at)}
                    </p>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-6 text-center text-sm text-gray-500">
              No active promotions at the moment. Please check back soon.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
