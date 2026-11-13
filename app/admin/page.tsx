"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

interface OrderRow {
  id: string;
  order_number?: string;
  created_at?: string;
  status?: string;
}

interface ReservationRow {
  id: string;
  customer_name: string;
  customer_email: string;
  reservation_date: string;
  reservation_time: string;
  party_size: number;
  status: string;
}

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();

  const [roleLoading, setRoleLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [dataError, setDataError] = useState<string | null>(null);

  useEffect(() => {
    async function verifyRoleAndLoadData() {
      if (authLoading) return;

      //if user is not logged in, set roleLoading to false and return
      if (!user) {
        setRoleLoading(false);
        return;
      }

      setRoleLoading(true);
      setDataError(null);

      // checking user's roles first
      const { data: userRecord, error: roleError } = await supabase
        .from("users")
        .select("role_id, user_roles(role_name)")
        .eq("id", user.id)
        .single();

      const roleRelation: unknown = userRecord?.user_roles;
      const roleEntry = Array.isArray(roleRelation)
        ? roleRelation[0]
        : roleRelation;
      const roleName =
        typeof roleEntry === "object" &&
        roleEntry !== null &&
        "role_name" in roleEntry
          ? roleEntry.role_name
          : undefined;

      // role_id 2 = admin, role_id 3 = staff, from users table, and also checking user_roles table for role_name
      const hasAdminOrStaffRole =
        !roleError &&
        userRecord &&
        (userRecord.role_id === 2 ||
          userRecord.role_id === 3 ||
          roleName === "admin" ||
          roleName === "staff");

      if (!hasAdminOrStaffRole) {
        setIsAuthorized(false);
        setRoleLoading(false);
        return;
      }

      setIsAuthorized(true);

      // if user is admin then we load the orders and reservations data for the dashboard
      const [
        { data: ordersData, error: ordersError },
        { data: reservationsData, error: reservationsError },
      ] = await Promise.all([
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
        setDataError(
          ordersError?.message ??
            reservationsError?.message ??
            "Failed to load dashboard data."
        );
      } else {
        setOrders((ordersData as OrderRow[]) ?? []);
        setReservations((reservationsData as ReservationRow[]) ?? []);
      }

      setRoleLoading(false);
    }

    verifyRoleAndLoadData();
  }, [user, authLoading]);

  // 1. Loading State
  if (authLoading || roleLoading) {
    return (
      <main className="min-h-screen bg-[#FAF7F2] px-4 py-12 text-[#1C1917] sm:px-8 flex items-center justify-center">
        <div className="w-full max-w-md rounded-2xl border border-[#EBE6DD] bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-semibold text-gray-500 animate-pulse">
            Checking permissions...
          </p>
        </div>
      </main>
    );
  }

  // 2. if not logged in 
  if (!user) {
    return (
      <main className="min-h-screen bg-[#FAF7F2] px-4 py-12 text-[#1C1917] sm:px-8 flex items-center justify-center">
        <div className="w-full max-w-md rounded-2xl border border-[#EBE6DD] bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#FDEEE7] text-[#EA580C]">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="h-6 w-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-extrabold text-[#1C1917]">
            Authentication Required
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Please log in to view this page.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link
              href="/login"
              className="rounded-xl bg-[#C2410C] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#9A3412]"
            >
              Sign In
            </Link>
            <Link
              href="/"
              className="rounded-xl border border-[#EBE6DD] px-5 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // 3. Logged In, but has no role permission to access admin panel
  if (!isAuthorized) {
    return (
      <main className="min-h-screen bg-[#FAF7F2] px-4 py-12 text-[#1C1917] sm:px-8 flex items-center justify-center">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="h-6 w-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m0-10.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.25-8.25-3.286Zm0 13.036h.008v.008H12v-.008Z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-extrabold text-red-700">Access Denied</h1>
          <p className="mt-2 text-sm text-gray-600">
            You must be given admin/staff role to view this website.
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Signed in as {user.email}
          </p>
          <div className="mt-6">
            <Link
              href="/"
              className="inline-block rounded-xl bg-[#1C1917] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-gray-800"
            >
              Return to Customer Site
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // 4. Error loading data for admin dashboard
  if (dataError) {
    return (
      <main className="min-h-screen bg-[#FAF7F2] px-4 py-12 text-[#1C1917] sm:px-8">
        <div className="mx-auto max-w-4xl rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold text-red-700">
            Could not load admin panel
          </h1>
          <p className="mt-2 text-sm text-red-600">{dataError}</p>
        </div>
      </main>
    );
  }

  // 5.Staff dashboard view
  return (
    <main className="min-h-screen bg-[#FAF7F2] px-4 py-8 text-[#1C1917] sm:px-8 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#EA580C]">
              Mickleham Kebab &amp; Grill
            </p>
            <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">
              Admin Dashboard
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Keep an eye on today&apos;s orders and upcoming bookings.
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/manage-menu"
              className="text-sm font-semibold text-[#C2410C] transition-colors hover:text-[#9A3412]"
            >
              Customize the menu →
            </Link>
            <Link
              href="/manage-promos"
              className="text-sm font-semibold text-[#C2410C] transition-colors hover:text-[#9A3412]"
            >
              Manage promotions →
            </Link>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#EBE6DD] bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Recent orders
            </p>
            <p className="mt-2 text-3xl font-extrabold text-[#C2410C]">
              {orders.length}
            </p>
          </div>
          <div className="rounded-2xl border border-[#EBE6DD] bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Upcoming reservations
            </p>
            <p className="mt-2 text-3xl font-extrabold text-[#C2410C]">
              {reservations.length}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-[#EBE6DD] bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-bold">Recent orders</h2>
            {orders.length ? (
              <div className="mt-4 divide-y divide-[#EBE6DD]">
                {orders.map((order) => (
                  <div
                    key={String(order.id)}
                    className="flex items-center justify-between gap-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-semibold">
                        Order #{order.order_number ?? String(order.id).slice(0, 8)}
                      </p>
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
              <p className="mt-4 text-sm text-gray-500">
                No orders have been placed yet.
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-[#EBE6DD] bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-bold">Upcoming reservations</h2>
            {reservations.length ? (
              <div className="mt-4 divide-y divide-[#EBE6DD]">
                {reservations.map((reservation) => (
                  <div key={String(reservation.id)} className="py-3 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <p className="font-semibold">
                        {reservation.customer_name}
                      </p>
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
              <p className="mt-4 text-sm text-gray-500">
                No reservations have been made yet.
              </p>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}