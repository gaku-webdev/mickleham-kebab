"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Loader from "@/components/Loader";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import {
  formatDateOnly,
  formatClockTime,
  formatMelbourneDateTime,
} from "@/lib/date-time";

interface OrderRow {
  id: string;
  order_number?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  order_type?: string | null;
  status?: string | null;
  payment_status?: string | null;
  subtotal?: number | null;
  tax_amount?: number | null;
  total_amount?: number | null;
  promo_code?: string | null;
  promo_discount_amount?: number | null;
  pickup_time?: string | null;
  table_number?: string | null;
  guest_count?: number | null;
  notes?: string | null;
  created_at?: string;
}

interface OrderItemRow {
  id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  special_instructions?: string | null;
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

const ITEMS_PER_PAGE = 8;

function ListPagination({
  label,
  currentPage,
  totalItems,
  onPageChange,
}: {
  label: string;
  currentPage: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  if (totalPages <= 1) return null;

  const firstItem = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const lastItem = Math.min(currentPage * ITEMS_PER_PAGE, totalItems);

  return (
    <nav
      aria-label={label}
      className="flex flex-col gap-3 border-t border-[#EBE6DD] pt-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-xs text-gray-500" aria-live="polite">
        Showing {firstItem}–{lastItem} of {totalItems}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="rounded-lg border border-[#E7E1D8] px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-[#FAF7F2] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        <span className="min-w-20 text-center text-xs font-semibold text-gray-600">
          Page {currentPage} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="rounded-lg border border-[#E7E1D8] px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-[#FAF7F2] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </nav>
  );
}

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();

  const [roleLoading, setRoleLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [dataError, setDataError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [orderSearch, setOrderSearch] = useState("");
  const [reservationSearch, setReservationSearch] = useState("");
  const [orderPage, setOrderPage] = useState(1);
  const [reservationPage, setReservationPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);
  const [selectedOrderItems, setSelectedOrderItems] = useState<OrderItemRow[]>(
    []
  );
  const [orderDetailsLoading, setOrderDetailsLoading] = useState(false);
  const [orderDetailsError, setOrderDetailsError] = useState<string | null>(
    null
  );
  const orderDetailsCloseRef = useRef<HTMLButtonElement | null>(null);
  const orderDetailsTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!selectedOrder) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    orderDetailsCloseRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedOrder(null);
        setSelectedOrderItems([]);
        setOrderDetailsError(null);
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      orderDetailsTriggerRef.current?.focus();
    };
  }, [selectedOrder]);

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
          .select(
            "id, order_number, customer_name, customer_email, customer_phone, order_type, status, payment_status, subtotal, tax_amount, total_amount, promo_code, promo_discount_amount, pickup_time, table_number, guest_count, notes, created_at"
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("reservations")
          .select(
            "id, customer_name, customer_email, reservation_date, reservation_time, party_size, status"
          )
          .order("reservation_date", { ascending: false })
          .order("reservation_time", { ascending: false }),
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

  const updateOrderStatus = async (id: string, status: string) => {
    setUpdatingId(id);
    setActionError(null);
    setNotice(null);

    try {
      const { error } = await supabase
        .from("orders")
        .update({ status })
        .eq("id", id);
      if (error) {
        setActionError(`Could not update order status: ${error.message}`);
      } else {
        setOrders((current) =>
          current.map((order) =>
            order.id === id ? { ...order, status } : order
          )
        );
        setNotice("Order status updated.");
      }
    } catch (error: unknown) {
      setActionError(
        error instanceof Error
          ? `Could not update order status: ${error.message}`
          : "Could not update order status."
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const openOrderDetails = async (order: OrderRow) => {
    setSelectedOrder(order);
    setSelectedOrderItems([]);
    setOrderDetailsError(null);
    setOrderDetailsLoading(true);

    try {
      const { data, error } = await supabase
        .from("order_items")
        .select(
          "id, item_name, quantity, unit_price, total_price, special_instructions"
        )
        .eq("order_id", order.id);

      if (error) {
        setOrderDetailsError(error.message);
      } else {
        setSelectedOrderItems((data as OrderItemRow[]) ?? []);
      }
    } catch (error: unknown) {
      setOrderDetailsError(
        error instanceof Error
          ? error.message
          : "Could not load order items."
      );
    } finally {
      setOrderDetailsLoading(false);
    }
  };

  const closeOrderDetails = () => {
    setSelectedOrder(null);
    setSelectedOrderItems([]);
    setOrderDetailsError(null);
  };

  const updateReservationStatus = async (id: string, status: string) => {
    setUpdatingId(id);
    setActionError(null);
    setNotice(null);

    try {
      const { error } = await supabase
        .from("reservations")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) {
        setActionError(
          `Could not update reservation status: ${error.message}`
        );
      } else {
        setReservations((current) =>
          current.map((reservation) =>
            reservation.id === id ? { ...reservation, status } : reservation
          )
        );
        setNotice("Reservation status updated.");
      }
    } catch (error: unknown) {
      setActionError(
        error instanceof Error
          ? `Could not update reservation status: ${error.message}`
          : "Could not update reservation status."
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredOrders = orders.filter((order) => {
    const term = orderSearch.trim().toLowerCase();
    return (
      !term ||
      `${order.order_number ?? ""} ${order.customer_name ?? ""} ${order.status ?? ""}`
        .toLowerCase()
        .includes(term)
    );
  });
  const filteredReservations = reservations.filter((reservation) => {
    const term = reservationSearch.trim().toLowerCase();
    return (
      !term ||
      `${reservation.customer_name} ${reservation.customer_email} ${reservation.status}`
        .toLowerCase()
        .includes(term)
    );
  });
  const paginatedOrders = filteredOrders.slice(
    (orderPage - 1) * ITEMS_PER_PAGE,
    orderPage * ITEMS_PER_PAGE
  );
  const paginatedReservations = filteredReservations.slice(
    (reservationPage - 1) * ITEMS_PER_PAGE,
    reservationPage * ITEMS_PER_PAGE
  );

  // 1. Loading State
  if (authLoading || roleLoading) {
    return (
      <main className="min-h-screen bg-[#FAF7F2] px-4 py-12 text-[#1C1917] sm:px-8 flex items-center justify-center">
        <Loader label="Checking permissions..." />
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

  const orderStatuses = [
    "pending",
    "preparing",
    "in_progress",
    "completed",
    "cancelled",
  ];
  const reservationStatuses = [
    "pending",
    "confirmed",
    "completed",
    "cancelled",
  ];

  return (
    <main className="min-h-screen bg-[#FAF7F2] px-4 py-8 text-[#1C1917] sm:px-8 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#EA580C]">
            Mickleham Kebab &amp; Grill
          </p>
          <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">
            Admin Dashboard
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage service, bookings, menu items and promotions.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <a
            href="#orders"
            className="group rounded-2xl border border-[#EBE6DD] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-xl" aria-hidden="true">
                🧾
              </span>
              <span className="rounded-full bg-orange-50 px-3 py-1 text-sm font-bold text-[#C2410C]">
                {orders.length}
              </span>
            </div>
            <h2 className="mt-4 text-base font-bold">Order management</h2>
            <p className="mt-1 text-sm text-gray-500">
              Track orders and update kitchen status.
            </p>
            <span className="mt-4 inline-block text-sm font-bold text-[#C2410C]">
              Manage orders <span aria-hidden="true">→</span>
            </span>
          </a>

          <a
            href="#reservations"
            className="group rounded-2xl border border-[#EBE6DD] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-xl" aria-hidden="true">
                📅
              </span>
              <span className="rounded-full bg-orange-50 px-3 py-1 text-sm font-bold text-[#C2410C]">
                {reservations.length}
              </span>
            </div>
            <h2 className="mt-4 text-base font-bold">Reservation management</h2>
            <p className="mt-1 text-sm text-gray-500">
              Review bookings and confirm guest status.
            </p>
            <span className="mt-4 inline-block text-sm font-bold text-[#C2410C]">
              Manage reservations <span aria-hidden="true">→</span>
            </span>
          </a>

          <Link
            href="/manage-menu"
            className="group rounded-2xl border border-[#EBE6DD] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-xl" aria-hidden="true">
                🍽️
              </span>
              <span className="text-xl text-[#C2410C]" aria-hidden="true">↗</span>
            </div>
            <h2 className="mt-4 text-base font-bold">Menu management</h2>
            <p className="mt-1 text-sm text-gray-500">
              Add dishes, update prices and organize categories.
            </p>
            <span className="mt-4 inline-block text-sm font-bold text-[#C2410C]">
              Customize menu <span aria-hidden="true">→</span>
            </span>
          </Link>

          <Link
            href="/manage-promos"
            className="group rounded-2xl border border-[#EBE6DD] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-xl" aria-hidden="true">
                🏷️
              </span>
              <span className="text-xl text-[#C2410C]" aria-hidden="true">↗</span>
            </div>
            <h2 className="mt-4 text-base font-bold">Promotions management</h2>
            <p className="mt-1 text-sm text-gray-500">
              Create offers, promo codes and schedules.
            </p>
            <span className="mt-4 inline-block text-sm font-bold text-[#C2410C]">
              Manage promotions <span aria-hidden="true">→</span>
            </span>
          </Link>
        </div>

        {(actionError || notice) && (
          <div
            role={actionError ? "alert" : "status"}
            className={`mt-6 rounded-xl border px-4 py-3 text-sm ${
              actionError
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {actionError ?? notice}
          </div>
        )}

        {selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
            <button
              type="button"
              aria-label="Close order details"
              onClick={closeOrderDetails}
              className="absolute inset-0 bg-stone-950/50 backdrop-blur-[1px]"
            />
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="admin-order-details-title"
              className="relative z-10 flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#EBE6DD] bg-white text-[#1C1917] shadow-2xl"
            >
              <header className="flex min-h-16 items-center justify-between border-b border-[#EBE6DD] px-5 py-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#C2410C]">
                    Order details
                  </p>
                  <h2
                    id="admin-order-details-title"
                    className="mt-1 text-lg font-extrabold"
                  >
                    {selectedOrder.order_number ??
                      selectedOrder.id.slice(0, 8)}
                  </h2>
                </div>
                <button
                  ref={orderDetailsCloseRef}
                  type="button"
                  aria-label="Close order details"
                  onClick={closeOrderDetails}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-100"
                >
                  ✕
                </button>
              </header>

              <div className="flex-1 space-y-6 overflow-y-auto p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold capitalize text-[#C2410C]">
                      {selectedOrder.status || "pending"}
                    </span>
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-[11px] font-medium capitalize text-gray-700">
                      {selectedOrder.order_type || "Order"}
                    </span>
                    <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                      {selectedOrder.payment_status || "Payment unknown"}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-gray-500">
                    {selectedOrder.created_at
                      ? formatMelbourneDateTime(selectedOrder.created_at)
                      : "Date unavailable"}
                  </p>
                </div>

                <section aria-labelledby="admin-order-items-title">
                  <h3
                    id="admin-order-items-title"
                    className="text-xs font-bold uppercase tracking-wider text-gray-500"
                  >
                    Items ordered
                  </h3>
                  <div className="mt-2 divide-y divide-[#EBE6DD] rounded-xl border border-[#EBE6DD] px-4">
                    {orderDetailsLoading ? (
                      <div className="py-6">
                        <Loader size="sm" label="Loading order items..." />
                      </div>
                    ) : orderDetailsError ? (
                      <p role="alert" className="py-4 text-sm text-red-700">
                        Could not load order items: {orderDetailsError}
                      </p>
                    ) : selectedOrderItems.length ? (
                      selectedOrderItems.map((item) => (
                        <article
                          key={item.id}
                          className="flex items-start justify-between gap-4 py-3 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900">
                              <span className="mr-2 font-bold text-[#EA580C]">
                                {item.quantity}×
                              </span>
                              {item.item_name}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                              ${Number(item.unit_price).toFixed(2)} each
                            </p>
                            {item.special_instructions && (
                              <p className="mt-1 text-xs italic text-gray-500">
                                Note: {item.special_instructions}
                              </p>
                            )}
                          </div>
                          <p className="shrink-0 font-semibold tabular-nums">
                            ${Number(item.total_price).toFixed(2)}
                          </p>
                        </article>
                      ))
                    ) : selectedOrder.notes ? (
                      <p className="whitespace-pre-wrap py-4 text-sm text-gray-700">
                        {selectedOrder.notes}
                      </p>
                    ) : (
                      <p className="py-4 text-sm text-gray-500">
                        Itemized details are unavailable for this order.
                      </p>
                    )}
                  </div>
                </section>

                <section className="grid gap-4 rounded-xl bg-[#FAF7F2] p-4 sm:grid-cols-2">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                      Customer
                    </h3>
                    <p className="mt-2 text-sm font-semibold">
                      {selectedOrder.customer_name || "Guest"}
                    </p>
                    {selectedOrder.customer_email && (
                      <p className="mt-1 text-sm text-gray-600">
                        {selectedOrder.customer_email}
                      </p>
                    )}
                    {selectedOrder.customer_phone && (
                      <p className="mt-1 text-sm text-gray-600">
                        {selectedOrder.customer_phone}
                      </p>
                    )}
                  </div>
                  {(selectedOrder.pickup_time ||
                    selectedOrder.table_number) && (
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                        Fulfilment
                      </h3>
                      {selectedOrder.pickup_time && (
                        <p className="mt-2 text-sm">
                          Pickup: {selectedOrder.pickup_time}
                        </p>
                      )}
                      {selectedOrder.table_number && (
                        <p className="mt-2 text-sm">
                          Table: {selectedOrder.table_number}
                          {selectedOrder.guest_count
                            ? ` · ${selectedOrder.guest_count} guests`
                            : ""}
                        </p>
                      )}
                    </div>
                  )}
                  {selectedOrder.notes && (
                    <p className="text-sm italic text-gray-600 sm:col-span-2">
                      {selectedOrder.notes}
                    </p>
                  )}
                </section>

                <section
                  aria-label="Order total"
                  className="space-y-2 border-t border-[#EBE6DD] pt-4 text-sm"
                >
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span>
                      ${Number(selectedOrder.subtotal ?? 0).toFixed(2)}
                    </span>
                  </div>
                  {(selectedOrder.promo_code ||
                    Number(selectedOrder.promo_discount_amount ?? 0) > 0) && (
                    <div className="flex justify-between text-emerald-700">
                      <span>
                        Promotion
                        {selectedOrder.promo_code
                          ? ` (${selectedOrder.promo_code})`
                          : ""}
                      </span>
                      <span>
                        -$
                        {Number(
                          selectedOrder.promo_discount_amount ?? 0
                        ).toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-gray-600">
                    <span>GST</span>
                    <span>
                      ${Number(selectedOrder.tax_amount ?? 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-[#EBE6DD] pt-3 text-lg font-extrabold">
                    <span>Total</span>
                    <span className="text-[#C2410C]">
                      ${Number(selectedOrder.total_amount ?? 0).toFixed(2)}
                    </span>
                  </div>
                </section>
              </div>
            </section>
          </div>
        )}

        <div className="mt-8 grid gap-6 xl:grid-cols-2">
          <section
            id="orders"
            className="scroll-mt-6 rounded-2xl border border-[#EBE6DD] bg-white p-5 shadow-sm sm:p-6"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#C2410C]">
                  Kitchen
                </p>
                <h2 className="mt-1 text-xl font-bold">Orders</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {orders.length} {orders.length === 1 ? "order" : "orders"}
                </p>
              </div>
              <label className="block text-sm">
                <span className="sr-only">Search orders</span>
                <input
                  type="search"
                  value={orderSearch}
                  onChange={(event) => {
                    setOrderSearch(event.target.value);
                    setOrderPage(1);
                  }}
                  placeholder="Search orders"
                  className="w-full rounded-xl border border-[#E7E1D8] px-3.5 py-2.5 text-sm outline-none transition focus:border-[#C2410C] focus:ring-2 focus:ring-orange-100 sm:w-56"
                />
              </label>
            </div>
            {orders.length ? (
              <div className="mt-5 divide-y divide-[#EBE6DD]">
                {paginatedOrders.map((order) => {
                  const status = order.status || "pending";
                  const statuses = orderStatuses.includes(status)
                    ? orderStatuses
                    : [...orderStatuses, status];
                  return (
                    <article
                      key={order.id}
                      className="flex flex-col gap-3 border-b border-[#EBE6DD] py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <button
                        type="button"
                        onClick={(event) => {
                          orderDetailsTriggerRef.current = event.currentTarget;
                          void openOrderDetails(order);
                        }}
                        aria-haspopup="dialog"
                        className="min-w-0 flex-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C2410C]"
                      >
                        <p className="font-bold">
                          Order #{order.order_number ?? order.id.slice(0, 8)}
                        </p>
                        <p className="mt-1 text-sm text-gray-600">
                          {order.customer_name || "Guest"}
                          {order.order_type ? ` · ${order.order_type}` : ""}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {order.created_at
                            ? formatMelbourneDateTime(order.created_at)
                            : "Date unavailable"}
                          {order.total_amount != null
                            ? ` · $${Number(order.total_amount).toFixed(2)}`
                            : ""}
                          {order.payment_status
                            ? ` · ${order.payment_status} payment`
                            : ""}
                          <span className="ml-2 font-semibold text-[#C2410C]">
                            View details →
                          </span>
                        </p>
                      </button>
                      <label className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                        <span className="sr-only">
                          Update status for order{" "}
                          {order.order_number ?? order.id.slice(0, 8)}
                        </span>
                        <select
                          value={status}
                          disabled={updatingId !== null}
                          onChange={(event) =>
                            void updateOrderStatus(order.id, event.target.value)
                          }
                          className="rounded-full border border-orange-100 bg-orange-50 px-3 py-2 text-xs font-bold capitalize text-[#C2410C] outline-none focus:ring-2 focus:ring-orange-200 disabled:opacity-60"
                        >
                          {statuses.map((option) => (
                            <option key={option} value={option}>
                              {option.replace("_", " ")}
                            </option>
                          ))}
                        </select>
                        {updatingId === order.id && (
                          <Loader size="sm" label="Updating..." inline />
                        )}
                      </label>
                    </article>
                  );
                })}
                {!filteredOrders.length && (
                  <p className="py-6 text-center text-sm text-gray-500">
                    No orders match your search.
                  </p>
                )}
                <ListPagination
                  label="Orders pagination"
                  currentPage={orderPage}
                  totalItems={filteredOrders.length}
                  onPageChange={setOrderPage}
                />
              </div>
            ) : (
              <p className="mt-5 rounded-xl bg-[#FAF7F2] px-4 py-8 text-center text-sm text-gray-500">
                No orders have been placed yet.
              </p>
            )}
          </section>

          <section
            id="reservations"
            className="scroll-mt-6 rounded-2xl border border-[#EBE6DD] bg-white p-5 shadow-sm sm:p-6"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#C2410C]">
                  Guests
                </p>
                <h2 className="mt-1 text-xl font-bold">Reservations</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {reservations.length}{" "}
                  {reservations.length === 1 ? "booking" : "bookings"}
                </p>
              </div>
              <label className="block text-sm">
                <span className="sr-only">Search reservations</span>
                <input
                  type="search"
                  value={reservationSearch}
                  onChange={(event) => {
                    setReservationSearch(event.target.value);
                    setReservationPage(1);
                  }}
                  placeholder="Search reservations"
                  className="w-full rounded-xl border border-[#E7E1D8] px-3.5 py-2.5 text-sm outline-none transition focus:border-[#C2410C] focus:ring-2 focus:ring-orange-100 sm:w-56"
                />
              </label>
            </div>
            {reservations.length ? (
              <div className="mt-5 divide-y divide-[#EBE6DD]">
                {paginatedReservations.map((reservation) => {
                  const statuses = reservationStatuses.includes(
                    reservation.status
                  )
                    ? reservationStatuses
                    : [...reservationStatuses, reservation.status];
                  return (
                    <article
                      key={reservation.id}
                      className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="font-bold">{reservation.customer_name}</p>
                        <p className="mt-1 text-sm text-gray-600">
                          {reservation.customer_email}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {formatDateOnly(reservation.reservation_date)} at{" "}
                          {formatClockTime(reservation.reservation_time)}{" "}
                          Melbourne time · {reservation.party_size}{" "}
                          {reservation.party_size === 1 ? "guest" : "guests"}
                        </p>
                      </div>
                      <label className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                        <span className="sr-only">
                          Update reservation status for{" "}
                          {reservation.customer_name}
                        </span>
                        <select
                          value={reservation.status}
                          disabled={updatingId !== null}
                          onChange={(event) =>
                            void updateReservationStatus(
                              reservation.id,
                              event.target.value
                            )
                          }
                          className="rounded-full border border-orange-100 bg-orange-50 px-3 py-2 text-xs font-bold capitalize text-[#C2410C] outline-none focus:ring-2 focus:ring-orange-200 disabled:opacity-60"
                        >
                          {statuses.map((option) => (
                            <option key={option} value={option}>
                              {option.replace("_", " ")}
                            </option>
                          ))}
                        </select>
                        {updatingId === reservation.id && (
                          <Loader size="sm" label="Updating..." inline />
                        )}
                      </label>
                    </article>
                  );
                })}
                {!filteredReservations.length && (
                  <p className="py-6 text-center text-sm text-gray-500">
                    No reservations match your search.
                  </p>
                )}
                <ListPagination
                  label="Reservations pagination"
                  currentPage={reservationPage}
                  totalItems={filteredReservations.length}
                  onPageChange={setReservationPage}
                />
              </div>
            ) : (
              <p className="mt-5 rounded-xl bg-[#FAF7F2] px-4 py-8 text-center text-sm text-gray-500">
                No reservations have been made yet.
              </p>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}