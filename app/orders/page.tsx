"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import Loader from "@/components/Loader";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { formatMelbourneDateTime } from "@/lib/date-time";

interface OrderItem {
  id: string;
  order_id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  special_instructions?: string | null;
}

interface Order {
  id: string;
  order_number: string;
  user_id?: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  order_type: string;
  status: string;
  payment_status: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  promo_id?: string | null;
  promo_code?: string | null;
  promo_discount_amount?: number | null;
  pickup_time?: string | null;
  table_number?: string | null;
  guest_count?: number | null;
  notes?: string | null;
  created_at: string;
  order_items?: OrderItem[];
}

export default function OrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersUserId, setOrdersUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Search state
  const [searchInput, setSearchInput] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("");
  const [searched, setSearched] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const orderTriggerRef = useRef<HTMLButtonElement | null>(null);
  const closeDetailsRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!selectedOrder) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeDetailsRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedOrder(null);
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      orderTriggerRef.current?.focus();
    };
  }, [selectedOrder]);

  // Fetch orders from Supabase dynamically
  const fetchOrders = useCallback(
    async (
      queryTerm?: string
    ): Promise<{ orders: Order[]; errorMessage: string | null }> => {
      if (!user) {
        return { orders: [], errorMessage: null };
      }

      try {
        const ownerFilter = user.email
          ? `user_id.eq.${user.id},customer_email.eq.${user.email}`
          : `user_id.eq.${user.id}`;

        let query = supabase
          .from("orders")
          .select("*")
          .order("created_at", { ascending: false })
          .or(ownerFilter);

        const term = queryTerm?.trim();

        if (term) {
          const clean = term.replace(/^#/, "");
          const digits = clean.replace(/\D/g, "");

          const conditions: string[] = [
            `order_number.ilike.%${clean}%`,
            `customer_name.ilike.%${clean}%`,
            `customer_email.ilike.%${clean}%`,
            `customer_phone.ilike.%${clean}%`,
          ];

          if (digits.length >= 8) {
            conditions.push(`customer_phone.ilike.%${digits}%`);
            if (digits.length === 10) {
              const formatted = `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
              conditions.push(`customer_phone.ilike.%${formatted}%`);
            }
          }

          query = query.or(conditions.join(","));
        }
        const { data, error } = await query;

        if (error) {
          return { orders: [], errorMessage: error.message };
        }

        const loadedOrders = data ?? [];
        if (loadedOrders.length === 0) {
          return { orders: [], errorMessage: null };
        }

        const { data: itemData, error: itemError } = await supabase
          .from("order_items")
          .select("*")
          .in(
            "order_id",
            loadedOrders.map((order) => order.id)
          );
        if (itemError) {
          return { orders: [], errorMessage: itemError.message };
        }

        const itemsByOrder = new Map<string, OrderItem[]>();
        for (const item of itemData ?? []) {
          const orderItems = itemsByOrder.get(item.order_id) ?? [];
          orderItems.push(item as OrderItem);
          itemsByOrder.set(item.order_id, orderItems);
        }

        return {
          orders: loadedOrders.map((order) => ({
            ...order,
            order_items: itemsByOrder.get(order.id) ?? [],
          })) as Order[],
          errorMessage: null,
        };
      } catch (err: unknown) {
        if (err instanceof Error) {
          return { orders: [], errorMessage: err.message };
        }
        return {
          orders: [],
          errorMessage: "An unexpected error occurred while loading orders.",
        };
      }
    },
    [user]
  );

  useEffect(() => {
    if (authLoading || !user) {
      return;
    }

    let cancelled = false;
    const loadOrders = async () => {
      const result = await fetchOrders();
      if (cancelled) {
        return;
      }
      setOrders(result.orders);
      setOrdersUserId(user.id);
      setErrorMessage(result.errorMessage);
      setLoading(false);
    };

    void loadOrders();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading, fetchOrders]);

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) {
      handleClearSearch();
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    setSearched(true);
    setActiveFilter(searchInput.trim());
    const result = await fetchOrders(searchInput.trim());
    setOrders(result.orders);
    setOrdersUserId(user?.id ?? null);
    setErrorMessage(result.errorMessage);
    setLoading(false);
  };

  const handleClearSearch = async () => {
    setSearchInput("");
    setActiveFilter("");
    setSearched(false);
    setLoading(true);
    setErrorMessage(null);
    const result = await fetchOrders();
    setOrders(result.orders);
    setOrdersUserId(user?.id ?? null);
    setErrorMessage(result.errorMessage);
    setLoading(false);
  };

  const getStatusBadge = (status: string) => {
    const s = (status || "pending").toLowerCase();
    if (s === "completed") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Completed
        </span>
      );
    }
    if (s === "preparing" || s === "in_progress") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          Preparing
        </span>
      );
    }
    if (s === "cancelled") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
          Cancelled
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] text-[#1C1917] flex flex-col font-sans">
        <main className="flex-1 flex items-center justify-center p-4">
          <Loader label="Checking your sign-in..." />
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] text-[#1C1917] flex flex-col font-sans">
        <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
          <section className="w-full max-w-lg bg-white rounded-2xl border border-[#EBE6DD] p-8 sm:p-10 text-center shadow-xs">
            <div className="w-14 h-14 bg-orange-50 text-[#EA580C] rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
              📦
            </div>
            <h1 className="text-2xl font-extrabold text-[#1C1917]">
              Sign in to view your orders
            </h1>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <Link
                href="/login"
                className="px-5 py-3 bg-[#C2410C] hover:bg-[#9A3412] text-white rounded-xl text-sm font-bold transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-sm font-bold transition-colors"
              >
                Create an Account
              </Link>
            </div>
          </section>
        </main>
      </div>
    );
  }

  const visibleOrders = ordersUserId === user.id ? orders : [];
  const ordersLoading = loading || ordersUserId !== user.id;

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1C1917] flex flex-col font-sans">
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-8">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 font-medium mb-1.5 transition-colors"
            >
              ← Back to Home
            </Link>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1C1917]">
              Order History
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              View and search your orders
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/menu"
              className="px-4 py-2 bg-[#C2410C] hover:bg-[#9A3412] text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-colors"
            >
              + Order Online
            </Link>
          </div>
        </div>

        {/* Search is limited to the signed-in user's orders. */}
        <div className="mb-6 bg-white rounded-2xl border border-[#EBE6DD] p-4 sm:p-5 shadow-xs">
          <form onSubmit={handleSearchSubmit} className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search your orders by order number, name, email, or phone..."
                  className="w-full pl-9 pr-4 py-2.5 text-xs sm:text-sm rounded-xl border border-gray-300 bg-[#FAF7F2] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#EA580C]/20 focus:border-[#EA580C] text-gray-900 placeholder:text-gray-400"
                />
                <span className="absolute left-3 top-3 text-gray-400 text-xs">
                  🔍
                </span>
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => setSearchInput("")}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-700 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 sm:flex-none px-5 py-2.5 bg-[#C2410C] hover:bg-[#9A3412] text-white text-xs sm:text-sm font-bold rounded-xl transition-colors shadow-xs cursor-pointer disabled:cursor-wait disabled:opacity-70"
                >
                  {loading ? (
                    <Loader
                      size="sm"
                      label="Searching..."
                      inline
                      className="text-white"
                    />
                  ) : (
                    "Search"
                  )}
                </button>
                {(searched || activeFilter) && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="px-3.5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs sm:text-sm font-semibold rounded-xl transition-colors cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-gray-100 text-xs">
              {activeFilter && (
                <span className="text-gray-500 font-medium">
                  Filtering for:{" "}
                  <strong className="text-gray-900 font-bold">
                    &ldquo;{activeFilter}&rdquo;
                  </strong>
                </span>
              )}
            </div>
          </form>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-xs sm:text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {/* Loading state */}
        {ordersLoading && (
          <div className="py-16 text-center">
            <Loader label="Searching orders..." />
          </div>
        )}

        {/* Empty orders state */}
        {!ordersLoading && visibleOrders.length === 0 && (
          <div className="bg-white rounded-2xl border border-[#EBE6DD] p-10 text-center shadow-xs">
            <div className="w-14 h-14 bg-orange-50 text-[#EA580C] rounded-full flex items-center justify-center mx-auto mb-3 text-2xl">
              📦
            </div>
            <h3 className="text-lg font-bold text-gray-900">
              No Matching Orders Found
            </h3>
            <p className="text-xs sm:text-sm text-gray-500 max-w-md mx-auto mt-1 mb-6">
              {searched
                ? `We couldn't find any orders matching "${activeFilter}". Try searching by order number (e.g. MKG-1003) or customer name.`
                : "No orders are linked to your account yet. Place your first order online!"}
            </p>
            <div className="flex justify-center gap-3">
              <Link
                href="/menu"
                className="px-5 py-2 bg-[#C2410C] hover:bg-[#9A3412] text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
              >
                Browse Menu
              </Link>
            </div>
          </div>
        )}

        {/* Orders list */}
        {!ordersLoading && visibleOrders.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between text-xs text-gray-500 px-1">
              <span>
                Found <strong>{visibleOrders.length}</strong>{" "}
                {visibleOrders.length === 1 ? "order" : "orders"}
              </span>
            </div>

            {visibleOrders.map((order) => (
              <button
                type="button"
                key={order.id}
                ref={(element) => {
                  if (selectedOrder?.id === order.id) {
                    orderTriggerRef.current = element;
                  }
                }}
                onClick={(event) => {
                  orderTriggerRef.current = event.currentTarget;
                  setSelectedOrder(order);
                }}
                aria-haspopup="dialog"
                aria-label={`View details for order ${order.order_number}`}
                className="block w-full overflow-hidden rounded-2xl border border-[#EBE6DD] bg-white text-left shadow-xs transition-all hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C2410C]"
              >
                <span className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EBE6DD] bg-[#FAF7F2] px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm sm:text-base font-extrabold text-[#1C1917]">
                      {order.order_number}
                    </span>
                    {getStatusBadge(order.status)}
                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-700 capitalize">
                      {order.order_type}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-extrabold text-[#C2410C]">
                        ${Number(order.total_amount).toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-500 font-medium">
                        {formatMelbourneDateTime(order.created_at)}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-[#C2410C]">
                      View details <span aria-hidden="true">→</span>
                    </span>
                  </div>
                </span>
              </button>
            ))}
          </div>
        )}

        {selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
            <button
              type="button"
              aria-label="Close order details"
              onClick={() => setSelectedOrder(null)}
              className="absolute inset-0 bg-stone-950/50 backdrop-blur-[1px]"
            />
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="order-details-title"
              className="relative z-10 flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#EBE6DD] bg-white text-[#1C1917] shadow-2xl"
            >
              <header className="flex min-h-16 items-center justify-between border-b border-[#EBE6DD] px-5 py-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#C2410C]">
                    Order details
                  </p>
                  <h2
                    id="order-details-title"
                    className="mt-1 text-lg font-extrabold"
                  >
                    {selectedOrder.order_number}
                  </h2>
                </div>
                <button
                  ref={closeDetailsRef}
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  aria-label="Close order details"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-100"
                >
                  ✕
                </button>
              </header>

              <div className="flex-1 space-y-6 overflow-y-auto p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {getStatusBadge(selectedOrder.status)}
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-[11px] font-medium capitalize text-gray-700">
                      {selectedOrder.order_type}
                    </span>
                    <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                      {selectedOrder.payment_status}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-gray-500">
                    {formatMelbourneDateTime(selectedOrder.created_at)}
                  </p>
                </div>

                <section aria-labelledby="order-items-title">
                  <h3
                    id="order-items-title"
                    className="text-xs font-bold uppercase tracking-wider text-gray-500"
                  >
                    Items ordered
                  </h3>
                  <div className="mt-2 divide-y divide-[#EBE6DD] rounded-xl border border-[#EBE6DD] px-4">
                    {selectedOrder.order_items?.length ? (
                      selectedOrder.order_items.map((item) => (
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
                    ) : (
                      <p className="py-4 text-sm text-gray-500">
                        Itemized details are unavailable for this order.
                      </p>
                    )}
                  </div>
                </section>

                <section
                  aria-labelledby="order-customer-title"
                  className="grid gap-4 rounded-xl bg-[#FAF7F2] p-4 sm:grid-cols-2"
                >
                  <div>
                    <h3
                      id="order-customer-title"
                      className="text-xs font-bold uppercase tracking-wider text-gray-500"
                    >
                      Customer
                    </h3>
                    <p className="mt-2 text-sm font-semibold">
                      {selectedOrder.customer_name}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      {selectedOrder.customer_email}
                    </p>
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
                    <span>${Number(selectedOrder.subtotal || 0).toFixed(2)}</span>
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
                        -${Number(
                          selectedOrder.promo_discount_amount ?? 0
                        ).toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-gray-600">
                    <span>GST</span>
                    <span>${Number(selectedOrder.tax_amount || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-[#EBE6DD] pt-3 text-lg font-extrabold">
                    <span>Total</span>
                    <span className="text-[#C2410C]">
                      ${Number(selectedOrder.total_amount).toFixed(2)}
                    </span>
                  </div>
                </section>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
