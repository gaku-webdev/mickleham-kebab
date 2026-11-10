"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

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
          .select("*, order_items(*)")
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

        return { orders: data || [], errorMessage: null };
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

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString("en-AU", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return isoStr;
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] text-[#1C1917] flex flex-col font-sans">
        <main className="flex-1 flex items-center justify-center p-4">
          <p className="text-sm text-gray-500">Checking your sign-in...</p>
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
                  className="flex-1 sm:flex-none px-5 py-2.5 bg-[#C2410C] hover:bg-[#9A3412] text-white text-xs sm:text-sm font-bold rounded-xl transition-colors shadow-xs cursor-pointer"
                >
                  Search Database
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
            <div className="inline-block animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full mb-3" />
            <p className="text-xs text-gray-500 font-medium">
              Searching orders 
            </p>
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
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-[#EBE6DD] shadow-xs overflow-hidden transition-all hover:shadow-sm"
              >
                {/* Order Header */}
                <div className="bg-[#FAF7F2] border-b border-[#EBE6DD] px-5 py-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm sm:text-base font-extrabold text-[#1C1917]">
                      {order.order_number}
                    </span>
                    {getStatusBadge(order.status)}
                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-700 capitalize">
                      {order.order_type}
                    </span>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-gray-500 font-medium">
                      {formatDate(order.created_at)}
                    </p>
                  </div>
                </div>

                {/* Order Body */}
                <div className="p-5 sm:p-6 space-y-4">
                  {/* Items Table */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                      Items Ordered
                    </h4>
                    <div className="divide-y divide-gray-100">
                      {order.order_items && order.order_items.length > 0 ? (
                        order.order_items.map((item) => (
                          <div
                            key={item.id}
                            className="py-2.5 flex items-start justify-between text-xs sm:text-sm"
                          >
                            <div className="pr-4">
                              <p className="font-semibold text-gray-900">
                                <span className="font-bold text-[#EA580C] mr-2">
                                  {item.quantity}x
                                </span>
                                {item.item_name}
                              </p>
                              {item.special_instructions && (
                                <p className="text-[11px] text-gray-500 italic mt-0.5">
                                  Note: {item.special_instructions}
                                </p>
                              )}
                            </div>
                            <span className="font-semibold text-gray-800 whitespace-nowrap">
                              ${Number(item.total_price).toFixed(2)}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-gray-500 py-2">
                          Order items details logged in database.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Customer & Pricing Summary Footer */}
                  <div className="border-t border-gray-100 pt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="text-xs text-gray-600 space-y-0.5">
                      <p>
                        <strong className="text-gray-800 font-semibold">
                          Customer:
                        </strong>{" "}
                        {order.customer_name} ({order.customer_phone})
                      </p>
                      <p>
                        <strong className="text-gray-800 font-semibold">
                          Email:
                        </strong>{" "}
                        {order.customer_email}
                      </p>
                      {order.notes && (
                        <p className="italic text-gray-500">
                          &ldquo;{order.notes}&rdquo;
                        </p>
                      )}
                    </div>

                    <div className="text-right sm:self-end">
                      <div className="text-xs text-gray-500 space-y-0.5">
                        <p>
                          Subtotal: ${Number(order.subtotal || 0).toFixed(2)}
                        </p>
                        <p>
                          GST: ${Number(order.tax_amount || 0).toFixed(2)}
                        </p>
                      </div>
                      <p className="text-base sm:text-lg font-extrabold text-[#C2410C] mt-1">
                        Total: ${Number(order.total_amount).toFixed(2)}
                      </p>
                      <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                        {order.payment_status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
