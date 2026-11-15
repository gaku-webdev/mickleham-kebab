"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Loader from "@/components/Loader";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import {
  formatClockTime,
  formatDateOnly,
  getMelbourneDayRange,
  formatMelbourneDateTime,
  getMelbourneDateParts,
  toDateInputValue,
} from "@/lib/date-time";

type OrderItem = {
  id: string;
  order_id: string;
  item_name: string;
  quantity: number;
  special_instructions?: string | null;
};

type Order = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  order_type: string;
  status: string;
  payment_status: string;
  total_amount: number;
  pickup_time?: string | null;
  table_number?: string | null;
  guest_count?: number | null;
  notes?: string | null;
  created_at: string;
  order_items: OrderItem[];
};

type Reservation = {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  reservation_date: string;
  reservation_time: string;
  party_size: number;
  special_requests?: string | null;
  status: string;
};

type BoardTab = "orders" | "reservations";
type ListMode = "active" | "completed";
const ITEMS_PER_PAGE = 8;

const activeOrder = (order: Order) =>
  !["completed", "cancelled"].includes(order.status.toLowerCase());
const activeReservation = (reservation: Reservation) =>
  !["completed", "cancelled"].includes(reservation.status.toLowerCase());

function melbourneDateValue(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : toDateInputValue(getMelbourneDateParts(date));
}

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
      className="mt-5 flex flex-col gap-3 rounded-2xl border border-[#E8DED2] bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-xs text-stone-500" aria-live="polite">
        Showing {firstItem}–{lastItem} of {totalItems}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="min-h-10 rounded-lg border border-[#E7E1D8] px-3 text-sm font-semibold text-stone-700 transition hover:bg-[#FAF7F2] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        <span className="min-w-24 text-center text-xs font-semibold text-stone-600">
          Page {currentPage} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="min-h-10 rounded-lg border border-[#E7E1D8] px-3 text-sm font-semibold text-stone-700 transition hover:bg-[#FAF7F2] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </nav>
  );
}

function roleName(record: {
  role_id?: number | null;
  user_roles?: { role_name?: string } | { role_name?: string }[] | null;
}) {
  return Array.isArray(record.user_roles)
    ? record.user_roles[0]?.role_name
    : record.user_roles?.role_name;
}

function isAdminRole(record: {
  role_id?: number | null;
  user_roles?: { role_name?: string } | { role_name?: string }[] | null;
}) {
  return record.role_id === 2 || roleName(record) === "admin";
}

function isStaffRole(record: {
  role_id?: number | null;
  user_roles?: { role_name?: string } | { role_name?: string }[] | null;
}) {
  const name = roleName(record);
  return (
    record.role_id === 2 ||
    record.role_id === 3 ||
    name === "admin" ||
    name === "staff"
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const appearance =
    normalized === "completed" || normalized === "confirmed"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : normalized === "cancelled"
        ? "border-stone-200 bg-stone-100 text-stone-600"
        : "border-orange-200 bg-orange-50 text-orange-800";

  return (
    <span
      className={`inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-bold capitalize ${appearance}`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

export default function StaffPage() {
  const { user, loading: authLoading } = useAuth();
  const [permissionLoading, setPermissionLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tab, setTab] = useState<BoardTab>("orders");
  const [mode, setMode] = useState<ListMode>("active");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [orderPage, setOrderPage] = useState(1);
  const [reservationPage, setReservationPage] = useState(1);
  const [loadingData, setLoadingData] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const refreshInProgress = useRef(false);

  const loadBoard = useCallback(
    async (showRefreshIndicator = false, includeAllDates = false) => {
    if (refreshInProgress.current) return;
    refreshInProgress.current = true;
    if (showRefreshIndicator) setRefreshing(true);

    try {
      const { date: today, start, end } = getMelbourneDayRange();
      let ordersQuery = supabase
          .from("orders")
          .select(
            "id, order_number, customer_name, customer_email, customer_phone, order_type, status, payment_status, total_amount, pickup_time, table_number, guest_count, notes, created_at"
          )
          .order("created_at", { ascending: false });
      let reservationsQuery = supabase
          .from("reservations")
          .select(
            "id, customer_name, customer_email, customer_phone, reservation_date, reservation_time, party_size, special_requests, status"
          )
          .order("reservation_date", { ascending: true })
          .order("reservation_time", { ascending: true });

      if (!includeAllDates) {
        ordersQuery = ordersQuery.gte("created_at", start).lt("created_at", end);
        reservationsQuery = reservationsQuery.eq("reservation_date", today);
      }

      const [ordersResult, reservationsResult] = await Promise.all([
        ordersQuery,
        reservationsQuery,
      ]);

      if (ordersResult.error || reservationsResult.error) {
        setPageError(
          ordersResult.error?.message ??
            reservationsResult.error?.message ??
            "Could not load the service board."
        );
        return;
      }

      const loadedOrders = (ordersResult.data ?? []) as Omit<
        Order,
        "order_items"
      >[];
      const itemsResult =
        loadedOrders.length > 0
          ? await supabase
              .from("order_items")
              .select("id, order_id, item_name, quantity, special_instructions")
              .in(
                "order_id",
                loadedOrders.map((order) => order.id)
              )
          : { data: [], error: null };

      if (itemsResult.error) {
        setPageError(itemsResult.error.message);
        return;
      }

      const itemsByOrder = new Map<string, OrderItem[]>();
      for (const item of (itemsResult.data ?? []) as OrderItem[]) {
        const orderItems = itemsByOrder.get(item.order_id) ?? [];
        orderItems.push(item);
        itemsByOrder.set(item.order_id, orderItems);
      }

      setOrders(
        loadedOrders.map((order) => ({
          ...order,
          order_items: itemsByOrder.get(order.id) ?? [],
        }))
      );
      setReservations((reservationsResult.data ?? []) as Reservation[]);
      setPageError(null);
    } catch (error: unknown) {
      setPageError(
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while loading the service board."
      );
    } finally {
      setLoadingData(false);
      setRefreshing(false);
      refreshInProgress.current = false;
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function checkPermission() {
      if (authLoading) return;
      if (!user) {
        setAuthorized(false);
        setIsAdminUser(false);
        setPermissionLoading(false);
        setLoadingData(false);
        return;
      }

      setAuthorized(false);
      setPermissionLoading(true);
      setLoadingData(true);
      setPageError(null);
      const { data, error } = await supabase
        .from("users")
        .select("role_id, user_roles(role_name)")
        .eq("id", user.id)
        .single();

      if (!active) return;
      if (error) {
        setPageError(error.message);
        setAuthorized(false);
        setPermissionLoading(false);
        setLoadingData(false);
        return;
      }

      const canAccess = data ? isStaffRole(data) : false;
      const adminAccess = data ? isAdminRole(data) : false;
      setAuthorized(canAccess);
      setIsAdminUser(adminAccess);
      setPermissionLoading(false);
      if (!canAccess) {
        setLoadingData(false);
        return;
      }

      await loadBoard(false, adminAccess);
    }

    void checkPermission();
    return () => {
      active = false;
    };
  }, [authLoading, loadBoard, user]);

  useEffect(() => {
    if (!authorized) return;
    const intervalId = window.setInterval(() => {
      void loadBoard(true, isAdminUser);
    }, 15_000);
    return () => window.clearInterval(intervalId);
  }, [authorized, isAdminUser, loadBoard]);

  async function updateOrderStatus(order: Order, status: string) {
    setUpdatingId(order.id);
    setActionError(null);
    setNotice(null);
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status })
        .eq("id", order.id);

      if (error) throw new Error(error.message);
      setOrders((current) =>
        current.map((item) => (item.id === order.id ? { ...item, status } : item))
      );
      setNotice(`Order #${order.order_number} marked ${status.replaceAll("_", " ")}.`);
    } catch (error: unknown) {
      setActionError(
        `Could not update order #${order.order_number}: ${
          error instanceof Error ? error.message : "An unexpected error occurred."
        }`
      );
    } finally {
      setUpdatingId(null);
    }
  }

  async function updateReservationStatus(
    reservation: Reservation,
    status: string
  ) {
    setUpdatingId(reservation.id);
    setActionError(null);
    setNotice(null);
    try {
      const { error } = await supabase
        .from("reservations")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", reservation.id);

      if (error) throw new Error(error.message);
      setReservations((current) =>
        current.map((item) =>
          item.id === reservation.id ? { ...item, status } : item
        )
      );
      setNotice(`Reservation for ${reservation.customer_name} marked ${status}.`);
    } catch (error: unknown) {
      setActionError(
        `Could not update reservation: ${
          error instanceof Error ? error.message : "An unexpected error occurred."
        }`
      );
    } finally {
      setUpdatingId(null);
    }
  }

  const dateFilteredOrders = useMemo(
    () =>
      orders.filter((order) => {
        const orderDate = melbourneDateValue(order.created_at);
        return (
          (!isAdminUser || !startDate || orderDate >= startDate) &&
          (!isAdminUser || !endDate || orderDate <= endDate)
        );
      }),
    [endDate, isAdminUser, orders, startDate]
  );
  const dateFilteredReservations = useMemo(
    () =>
      reservations.filter(
        (reservation) =>
          (!isAdminUser || !startDate || reservation.reservation_date >= startDate) &&
          (!isAdminUser || !endDate || reservation.reservation_date <= endDate)
      ),
    [endDate, isAdminUser, reservations, startDate]
  );
  const activeOrders = useMemo(
    () => dateFilteredOrders.filter(activeOrder),
    [dateFilteredOrders]
  );
  const activeReservations = useMemo(
    () => dateFilteredReservations.filter(activeReservation),
    [dateFilteredReservations]
  );
  const visibleOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    return dateFilteredOrders.filter((order) => {
      const inMode = mode === "active" ? activeOrder(order) : !activeOrder(order);
      return (
        inMode &&
        (!query ||
          `${order.order_number} ${order.customer_name} ${order.customer_phone} ${order.status}`
            .toLowerCase()
            .includes(query))
      );
    });
  }, [dateFilteredOrders, mode, search]);
  const visibleReservations = useMemo(() => {
    const query = search.trim().toLowerCase();
    return dateFilteredReservations.filter((reservation) => {
      const inMode =
        mode === "active"
          ? activeReservation(reservation)
          : !activeReservation(reservation);
      return (
        inMode &&
        (!query ||
          `${reservation.customer_name} ${reservation.customer_phone} ${reservation.customer_email} ${reservation.status}`
            .toLowerCase()
            .includes(query))
      );
    });
  }, [dateFilteredReservations, mode, search]);
  const currentOrderPage = Math.min(
    orderPage,
    Math.max(1, Math.ceil(visibleOrders.length / ITEMS_PER_PAGE))
  );
  const currentReservationPage = Math.min(
    reservationPage,
    Math.max(1, Math.ceil(visibleReservations.length / ITEMS_PER_PAGE))
  );
  const paginatedOrders = visibleOrders.slice(
    (currentOrderPage - 1) * ITEMS_PER_PAGE,
    currentOrderPage * ITEMS_PER_PAGE
  );
  const paginatedReservations = visibleReservations.slice(
    (currentReservationPage - 1) * ITEMS_PER_PAGE,
    currentReservationPage * ITEMS_PER_PAGE
  );

  if (authLoading || permissionLoading || loadingData) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center bg-[#FAF7F2] px-4">
        <Loader label="Loading staff service board..." />
      </main>
    );
  }

  if (!user || !authorized) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center bg-[#FAF7F2] px-4 py-10 text-[#29231F]">
        <section className="w-full max-w-md rounded-3xl border border-[#EBE6DD] bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-2xl">
            🔒
          </div>
          <h1 className="mt-5 text-2xl font-extrabold">Staff access required</h1>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Sign in with an account that has a staff or admin role to manage orders and reservations.
          </p>
          {pageError && (
            <p role="alert" className="mt-4 text-sm text-red-700">
              {pageError}
            </p>
          )}
          <Link
            href={user ? "/" : "/login"}
            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#C2410C] px-5 text-sm font-bold text-white hover:bg-[#9A3412]"
          >
            {user ? "Return to home" : "Sign in"}
          </Link>
        </section>
      </main>
    );
  }

  const shownCount =
    tab === "orders" ? visibleOrders.length : visibleReservations.length;
  const dateScopeLabel = !isAdminUser
    ? "Today only"
    : startDate && endDate
      ? `${formatDateOnly(startDate)}–${formatDateOnly(endDate)}`
      : startDate
        ? `From ${formatDateOnly(startDate)}`
        : endDate
          ? `Through ${formatDateOnly(endDate)}`
          : "All dates";

  return (
    <main className="min-h-screen bg-[#F7F4EE] px-4 pb-12 pt-6 text-[#29231F] sm:px-6 sm:pt-8 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-5 rounded-3xl bg-[#29231F] p-5 text-white shadow-sm sm:flex-row sm:items-end sm:justify-between sm:p-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-orange-300">
              Mickleham Kebab &amp; Grill
            </p>
            <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">Service board</h1>
            <p className="mt-2 text-sm text-stone-300">
              {isAdminUser
                ? "All orders and reservations, ready for the team."
                : "Today's orders and reservations, ready for the team."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-stone-300">
                Active orders
              </p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums">{activeOrders.length}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-stone-300">
                Upcoming bookings
              </p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums">{activeReservations.length}</p>
            </div>
            <button
              type="button"
              onClick={() => void loadBoard(true, isAdminUser)}
              disabled={refreshing}
              className="min-h-12 rounded-xl border border-white/25 px-4 text-sm font-bold transition hover:bg-white/10 disabled:opacity-60"
            >
              {refreshing ? "Refreshing…" : "↻ Refresh"}
            </button>
          </div>
        </header>

        {(pageError || actionError || notice) && (
          <div
            role={pageError || actionError ? "alert" : "status"}
            className={`mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm ${
              pageError || actionError
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}
          >
            <span>{pageError ?? actionError ?? notice}</span>
            {(actionError || notice) && (
              <button
                type="button"
                onClick={() => {
                  setActionError(null);
                  setNotice(null);
                }}
                className="min-h-10 rounded-lg px-3 font-bold hover:bg-black/5"
              >
                Dismiss
              </button>
            )}
          </div>
        )}

        <section className="mb-5 rounded-2xl border border-[#E8DED2] bg-white p-3 shadow-sm sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <button
                type="button"
                onClick={() => {
                  setTab("orders");
                  setOrderPage(1);
                }}
                aria-pressed={tab === "orders"}
                className={`min-h-12 rounded-xl px-5 text-sm font-extrabold transition ${
                  tab === "orders"
                    ? "bg-[#C2410C] text-white shadow-sm"
                    : "bg-[#F7F4EE] text-stone-600 hover:bg-orange-50"
                }`}
              >
                🍽️ Orders <span className="ml-1 opacity-80">({activeOrders.length})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab("reservations");
                  setReservationPage(1);
                }}
                aria-pressed={tab === "reservations"}
                className={`min-h-12 rounded-xl px-5 text-sm font-extrabold transition ${
                  tab === "reservations"
                    ? "bg-[#C2410C] text-white shadow-sm"
                    : "bg-[#F7F4EE] text-stone-600 hover:bg-orange-50"
                }`}
              >
                📅 Reservations <span className="ml-1 opacity-80">({activeReservations.length})</span>
              </button>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="sr-only" htmlFor="staff-search">
                Search {tab}
              </label>
              <input
                id="staff-search"
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setOrderPage(1);
                  setReservationPage(1);
                }}
                placeholder={`Search ${tab}…`}
                className="min-h-12 w-full rounded-xl border border-[#E7DED4] px-4 text-sm outline-none focus:border-[#C2410C] focus:ring-2 focus:ring-orange-100 sm:w-56"
              />
              <div className="flex rounded-xl bg-[#F7F4EE] p-1">
                {(["active", "completed"] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    aria-pressed={mode === filter}
                    onClick={() => {
                      setMode(filter);
                      setOrderPage(1);
                      setReservationPage(1);
                    }}
                    className={`min-h-10 flex-1 rounded-lg px-4 text-xs font-bold capitalize sm:flex-none ${
                      mode === filter
                        ? "bg-white text-[#C2410C] shadow-sm"
                        : "text-stone-500 hover:text-stone-800"
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {isAdminUser && (
            <div className="mt-4 flex flex-col gap-3 border-t border-[#EEE8E0] pt-4 sm:flex-row sm:items-end">
              <div className="flex flex-1 flex-col gap-3 sm:flex-row">
                <div className="flex-1">
                  <label
                    htmlFor="staff-date-from"
                    className="mb-1.5 block text-xs font-bold text-stone-600"
                  >
                    From date
                  </label>
                  <input
                    id="staff-date-from"
                    type="date"
                    value={startDate}
                    onChange={(event) => {
                      setStartDate(event.target.value);
                      setOrderPage(1);
                      setReservationPage(1);
                    }}
                    className="min-h-12 w-full rounded-xl border border-[#E7DED4] px-3 text-sm outline-none focus:border-[#C2410C] focus:ring-2 focus:ring-orange-100"
                  />
                </div>
                <div className="flex-1">
                  <label
                    htmlFor="staff-date-to"
                    className="mb-1.5 block text-xs font-bold text-stone-600"
                  >
                    To date
                  </label>
                  <input
                    id="staff-date-to"
                    type="date"
                    value={endDate}
                    onChange={(event) => {
                      setEndDate(event.target.value);
                      setOrderPage(1);
                      setReservationPage(1);
                    }}
                    className="min-h-12 w-full rounded-xl border border-[#E7DED4] px-3 text-sm outline-none focus:border-[#C2410C] focus:ring-2 focus:ring-orange-100"
                  />
                </div>
              </div>
              {(startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setStartDate("");
                    setEndDate("");
                    setOrderPage(1);
                    setReservationPage(1);
                  }}
                  className="min-h-12 rounded-xl border border-[#E7DED4] px-4 text-sm font-bold text-stone-600 transition hover:bg-[#FAF7F2]"
                >
                  Clear dates
                </button>
              )}
              {startDate && endDate && startDate > endDate && (
                <p role="status" className="text-sm text-red-700 sm:basis-full">
                  The start date must be on or before the end date.
                </p>
              )}
            </div>
          )}
        </section>

        <div className="mb-4 flex items-center justify-between px-1">
          <h2 className="text-lg font-extrabold capitalize">
            {mode === "active" ? "Needs attention" : "Completed & cancelled"}
          </h2>
          <p className="text-sm font-semibold text-stone-500">
            {shownCount} {shownCount === 1 ? "record" : "records"}
            <span className="hidden sm:inline"> · {dateScopeLabel}</span>
          </p>
        </div>

        {tab === "orders" ? (
          visibleOrders.length ? (
            <>
            <section aria-label="Orders" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {paginatedOrders.map((order) => {
                const isUpdating = updatingId === order.id;
                const status = order.status || "preparing";
                const nextStatus =
                  status.toLowerCase() === "pending" ? "preparing" : "completed";
                const actionLabel =
                  nextStatus === "preparing" ? "Start preparing" : "Mark completed";
                return (
                  <article
                    key={order.id}
                    className="flex min-h-[24rem] flex-col rounded-3xl border border-[#E8DED2] bg-white p-5 shadow-sm sm:p-6"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-stone-500">
                          {order.order_type || "Order"} · {order.payment_status || "payment pending"}
                        </p>
                        <h3 className="mt-1 text-xl font-extrabold">
                          #{order.order_number || order.id.slice(0, 8)}
                        </h3>
                      </div>
                      <StatusBadge status={status} />
                    </div>
                    <div className="mt-4 rounded-2xl bg-[#FAF7F2] p-4">
                      <p className="text-sm font-bold">{order.customer_name || "Guest"}</p>
                      <p className="mt-1 text-xs text-stone-600">
                        {order.created_at ? formatMelbourneDateTime(order.created_at) : "Time unavailable"}
                      </p>
                      {order.customer_phone && (
                        <p className="mt-1 text-xs text-stone-600">{order.customer_phone}</p>
                      )}
                      <p className="mt-2 text-sm font-semibold text-[#C2410C]">
                        {order.order_type === "Dine-In"
                          ? `Table ${order.table_number || "—"}${order.guest_count ? ` · ${order.guest_count} guests` : ""}`
                          : `Pickup ${order.pickup_time || "as soon as possible"}`}
                      </p>
                    </div>
                    <div className="mt-4 flex-1">
                      <p className="text-xs font-bold uppercase tracking-wider text-stone-500">
                        Items
                      </p>
                      {order.order_items.length ? (
                        <ul className="mt-2 space-y-2">
                          {order.order_items.map((item) => (
                            <li key={item.id} className="flex gap-3 text-sm">
                              <span className="min-w-7 font-extrabold text-[#C2410C]">
                                {item.quantity}×
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="font-semibold">{item.item_name}</span>
                                {item.special_instructions && (
                                  <span className="mt-0.5 block text-xs text-stone-500">
                                    Note: {item.special_instructions}
                                  </span>
                                )}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-sm text-stone-500">Order details unavailable.</p>
                      )}
                      {order.notes && (
                        <p className="mt-3 rounded-xl border border-orange-100 bg-orange-50/70 p-3 text-sm text-stone-700">
                          {order.notes}
                        </p>
                      )}
                    </div>
                    <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#EEE8E0] pt-4">
                      <p className="text-lg font-extrabold tabular-nums">
                        ${Number(order.total_amount || 0).toFixed(2)}
                      </p>
                      {activeOrder(order) && (
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => void updateOrderStatus(order, nextStatus)}
                          className="min-h-12 rounded-xl bg-[#C2410C] px-4 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#9A3412] disabled:cursor-wait disabled:opacity-60"
                        >
                          {isUpdating ? "Saving…" : `${actionLabel} →`}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </section>
            <ListPagination
              label="Orders pagination"
              currentPage={currentOrderPage}
              totalItems={visibleOrders.length}
              onPageChange={setOrderPage}
            />
            </>
          ) : (
            <EmptyBoard
              icon="🍽️"
              title={mode === "active" ? "All caught up" : "No completed orders"}
              description={
                mode === "active"
                  ? "New paid orders will appear here automatically."
                  : "Completed orders will show here for reference."
              }
            />
          )
        ) : visibleReservations.length ? (
          <>
          <section aria-label="Reservations" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {paginatedReservations.map((reservation) => {
              const isUpdating = updatingId === reservation.id;
              return (
                <article
                  key={reservation.id}
                  className="flex min-h-[21rem] flex-col rounded-3xl border border-[#E8DED2] bg-white p-5 shadow-sm sm:p-6"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-stone-500">
                        Reservation · {reservation.party_size} guests
                      </p>
                      <h3 className="mt-1 text-xl font-extrabold">{reservation.customer_name}</h3>
                    </div>
                    <StatusBadge status={reservation.status} />
                  </div>
                  <div className="mt-4 rounded-2xl bg-[#FAF7F2] p-4">
                    <p className="text-lg font-extrabold text-[#C2410C]">
                      {formatDateOnly(reservation.reservation_date, {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                      <span className="mx-2 text-stone-300">·</span>
                      {formatClockTime(reservation.reservation_time)}
                    </p>
                    <p className="mt-2 text-sm text-stone-700">{reservation.customer_phone}</p>
                    <p className="mt-1 break-all text-xs text-stone-500">{reservation.customer_email}</p>
                  </div>
                  <div className="mt-4 flex-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-stone-500">
                      Special requests
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-700">
                      {reservation.special_requests || "No special requests"}
                    </p>
                  </div>
                  {activeReservation(reservation) && (
                    <div className="mt-5 flex flex-wrap gap-2 border-t border-[#EEE8E0] pt-4">
                      {reservation.status.toLowerCase() === "pending" && (
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => void updateReservationStatus(reservation, "confirmed")}
                          className="min-h-12 flex-1 rounded-xl bg-[#C2410C] px-4 text-sm font-extrabold text-white hover:bg-[#9A3412] disabled:opacity-60"
                        >
                          {isUpdating ? "Saving…" : "Confirm booking"}
                        </button>
                      )}
                      {reservation.status.toLowerCase() === "confirmed" && (
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => void updateReservationStatus(reservation, "completed")}
                          className="min-h-12 flex-1 rounded-xl bg-emerald-700 px-4 text-sm font-extrabold text-white hover:bg-emerald-800 disabled:opacity-60"
                        >
                          {isUpdating ? "Saving…" : "Mark completed"}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => void updateReservationStatus(reservation, "cancelled")}
                        className="min-h-12 rounded-xl border border-stone-200 px-4 text-sm font-bold text-stone-600 hover:bg-stone-50 disabled:opacity-60"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </section>
          <ListPagination
            label="Reservations pagination"
            currentPage={currentReservationPage}
            totalItems={visibleReservations.length}
            onPageChange={setReservationPage}
          />
          </>
        ) : (
          <EmptyBoard
            icon="📅"
            title={mode === "active" ? "No active reservations" : "No completed reservations"}
            description={
              mode === "active"
                ? "Upcoming bookings will appear here automatically."
                : "Completed or cancelled reservations will show here."
            }
          />
        )}
      </div>
    </main>
  );
}

function EmptyBoard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <section className="rounded-3xl border border-dashed border-[#DCCFC0] bg-white px-6 py-16 text-center">
      <span className="text-4xl" aria-hidden="true">
        {icon}
      </span>
      <h3 className="mt-4 text-xl font-extrabold">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-500">
        {description}
      </p>
    </section>
  );
}
