import { supabase } from "@/lib/supabase";
import Link from "next/link";

export const instant = false;

export default async function AdminPage() {
  const [{ data: orders, error: ordersError }, { data: reservations, error: reservationsError }] =
    await Promise.all([
      supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("reservations")
        .select(
          "id, customer_name, customer_email, reservation_date, reservation_time, party_size, status"
        )
        .order("reservation_date", { ascending: true })
        .limit(8),
    ]);

  if (ordersError || reservationsError) {
    const message = ordersError?.message ?? reservationsError?.message;

    return (
      <main className="min-h-screen bg-[#FAF7F2] px-4 py-12 text-[#1C1917] sm:px-8">
        <div className="mx-auto max-w-4xl rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold text-red-700">Could not load admin panel</h1>
          <p className="mt-2 text-sm text-red-600">{message}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FAF7F2] px-4 py-8 text-[#1C1917] sm:px-8 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#EA580C]">
              Mickleham Kebab &amp; Grill
            </p>
            <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">Admin Dashboard</h1>
            <p className="mt-2 text-sm text-gray-600">
              Keep an eye on today&apos;s orders and upcoming bookings.
            </p>
          </div>
          <Link
            href="/"
            className="text-sm font-semibold text-[#C2410C] transition-colors hover:text-[#9A3412]"
          >
            View customer site →
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#EBE6DD] bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Recent orders</p>
            <p className="mt-2 text-3xl font-extrabold text-[#C2410C]">{orders?.length ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-[#EBE6DD] bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Upcoming reservations
            </p>
            <p className="mt-2 text-3xl font-extrabold text-[#C2410C]">
              {reservations?.length ?? 0}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-[#EBE6DD] bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-bold">Recent orders</h2>
            {orders?.length ? (
              <div className="mt-4 divide-y divide-[#EBE6DD]">
                {orders.map((order) => (
                  <div
                    key={String(order.id)}
                    className="flex items-center justify-between gap-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-semibold">Order #{String(order.id).slice(0, 8)}</p>
                      <p className="text-xs text-gray-500">
                        {order.created_at
                          ? new Date(String(order.created_at)).toLocaleString()
                          : "Date unavailable"}
                      </p>
                    </div>
                    <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-[#C2410C]">
                      {String(order.status ?? "pending")}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-gray-500">No orders have been placed yet.</p>
            )}
          </section>

          <section className="rounded-2xl border border-[#EBE6DD] bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-bold">Upcoming reservations</h2>
            {reservations?.length ? (
              <div className="mt-4 divide-y divide-[#EBE6DD]">
                {reservations.map((reservation) => (
                  <div key={String(reservation.id)} className="py-3 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <p className="font-semibold">{reservation.customer_name}</p>
                      <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold capitalize text-[#C2410C]">
                        {reservation.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {reservation.reservation_date} at{" "}
                      {String(reservation.reservation_time).slice(0, 5)} ·{" "}
                      {reservation.party_size} guests
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-gray-500">No reservations have been made yet.</p>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}