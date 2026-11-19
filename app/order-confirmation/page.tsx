"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Skeleton from "@/components/Skeleton";
import { useCart } from "@/context/CartContext";
import { formatMelbourneDateTime } from "@/lib/date-time";

interface OrderItem {
  id?: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  order_type: string;
  status: string;
  payment_status: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  promo_code?: string | null;
  promo_discount_amount?: number | null;
  pickup_time?: string | null;
  table_number?: string | null;
  guest_count?: number | null;
  notes?: string | null;
  created_at: string;
}

function OrderConfirmationSkeleton() {
  return (
    <main
      aria-label="Loading order confirmation"
      aria-busy="true"
      className="flex min-h-[70vh] flex-col items-center justify-center p-6"
    >
      <div className="w-full max-w-lg rounded-2xl border border-[#EBE6DD] bg-white p-6 shadow-sm">
        <div className="flex flex-col items-center gap-3 border-b border-[#EBE6DD] pb-5">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <div className="space-y-4 py-5">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
        <Skeleton className="h-11 w-full rounded-lg" />
      </div>
      <p role="status" className="sr-only">
        Confirming your order...
      </p>
    </main>
  );
}

function OrderConfirmationContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const orderNumberParam = searchParams.get("order_number");
  const { clearCart } = useCart();

  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadOrder() {
      if (!sessionId && !orderNumberParam) {
        setLoading(false);
        setErrorMessage("No order session or order number provided.");
        return;
      }

      try {
        const query = sessionId
          ? `session_id=${encodeURIComponent(sessionId)}`
          : `order_number=${encodeURIComponent(orderNumberParam!)}`;

        const response = await fetch(`/api/order-confirmation?${query}`);
        const data = await response.json();

        if (!isMounted) return;

        if (!response.ok || !data.order) {
          setErrorMessage(
            data.error || "Unable to locate your order details."
          );
          setLoading(false);
          return;
        }

        setOrder(data.order);
        setItems(data.items || []);
        setLoading(false);

        // Clear cart once order is confirmed
        try {
          clearCart();
        } catch {
          // Ignore if clearCart is already empty
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg =
          err instanceof Error
            ? err.message
            : "An unexpected error occurred while loading your order.";
        setErrorMessage(msg);
        setLoading(false);
      }
    }

    loadOrder();

    return () => {
      isMounted = false;
    };
  }, [sessionId, orderNumberParam, clearCart]);

  const handleCopyOrderNumber = () => {
    if (!order?.order_number) return;
    navigator.clipboard.writeText(order.order_number);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (loading) {
    return <OrderConfirmationSkeleton />;
  }

  if (errorMessage || !order) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center max-w-lg mx-auto">
        <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center text-2xl font-bold mb-4 border border-amber-200">
          !
        </div>
        <h1 className="text-2xl font-bold text-[#1C1917]">
          Order Not Found
        </h1>
        <p className="mt-2 text-sm text-[#78716C]">
          {errorMessage ||
            "We could not find an order matching this session. If you just placed an order, please check your email or visit your orders page."}
        </p>
        <div className="mt-6 flex flex-wrap gap-3 justify-center">
          <Link
            href="/orders"
            className="rounded-lg bg-[#C2410C] px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-[#9A3412] transition"
          >
            Check My Orders
          </Link>
          <Link
            href="/menu"
            className="rounded-lg border border-[#E8DED2] bg-white px-5 py-2.5 text-sm font-semibold text-[#29231F] hover:bg-[#FAF7F2] transition"
          >
            Return to Menu
          </Link>
        </div>
      </div>
    );
  }

  const isTakeaway =
    order.order_type.toLowerCase() === "takeaway" ||
    order.order_type.toLowerCase() === "pickup";

  return (
    <div className="min-h-screen bg-[#FAF7F2] py-8 sm:py-12">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Top Success Header */}
        <div className="text-center mb-8">
          <div className="mx-auto inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mb-4 shadow-sm ring-8 ring-emerald-50">
            <svg
              className="w-9 h-9"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold text-[#1C1917] tracking-tight">
            Order Confirmed!
          </h1>
          <p className="mt-2 text-base text-[#78716C] max-w-md mx-auto">
            Thank you for dining with us! The kitchen has received your order and
            preparation is underway.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
          {/* Main Info (Left Column: 7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Order Identity & Status Card */}
            <div className="rounded-2xl border border-[#E8DED2] bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-[#F2ECE4]">
                <div>
                  <span className="text-xs font-medium uppercase tracking-wider text-[#A8A29E]">
                    Order Number
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-2xl font-black text-[#1C1917] font-mono tracking-tight">
                      {order.order_number}
                    </span>
                    <button
                      onClick={handleCopyOrderNumber}
                      type="button"
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md bg-[#FAF7F2] border border-[#E8DED2] text-[#57534E] hover:text-[#C2410C] hover:border-[#C2410C] transition"
                      title="Copy order number"
                    >
                      {copied ? (
                        <>
                          <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-emerald-600">Copied!</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col sm:items-end gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Confirmed
                    </span>
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Paid via Card
                    </span>
                  </div>
                  <span className="text-xs text-[#A8A29E]">
                    {formatMelbourneDateTime(order.created_at)}
                  </span>
                </div>
              </div>

              {/* ESTIMATED PICKUP / READY TIME (Crucial for Sprint 4 Task 7.1) */}
              <div className="mt-5 p-4 rounded-xl bg-[#FFF8F3] border border-[#FED7AA]/60">
                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 rounded-lg bg-orange-100 text-[#C2410C]">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#C2410C]">
                        {isTakeaway ? "Estimated Pickup Time" : "Dine-In Ready Time"}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-orange-200/50 text-[#C2410C]">
                        {order.order_type}
                      </span>
                    </div>

                    <p className="mt-1 text-lg font-extrabold text-[#1C1917]">
                      {isTakeaway
                        ? order.pickup_time || "As soon as possible (about 20 min)"
                        : `Table #${order.table_number || "Assigned by Host"}${
                            order.guest_count ? ` · ${order.guest_count} Guests` : ""
                          }`}
                    </p>

                    <p className="mt-1 text-xs text-[#78716C]">
                      {isTakeaway
                        ? "Your order will be prepared warm and packaged ready for takeaway collection."
                        : "Please proceed to your table. Our staff will bring your freshly cooked meal directly to you."}
                    </p>

                    {/* Store location for collection */}
                    {isTakeaway && (
                      <div className="mt-3 pt-3 border-t border-[#FEEAD9] flex flex-wrap items-center justify-between gap-2 text-xs text-[#57534E]">
                        <div>
                          <strong className="text-[#1C1917]">Pickup Location:</strong> 2/9-33 Errol Blvd, Mickleham VIC 3064
                        </div>
                        <a
                          href="tel:0394539778"
                          className="font-semibold text-[#C2410C] hover:underline"
                        >
                          (03) 9453 9778
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Customer Contact Details */}
            <div className="rounded-2xl border border-[#E8DED2] bg-white p-6 shadow-sm">
              <h2 className="text-base font-bold text-[#1C1917] mb-4">
                Customer Information
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-xs text-[#A8A29E] block">Name</span>
                  <span className="font-semibold text-[#29231F] mt-0.5 block">
                    {order.customer_name}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-[#A8A29E] block">Phone Number</span>
                  <span className="font-semibold text-[#29231F] mt-0.5 block">
                    {order.customer_phone || "Not provided"}
                  </span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-xs text-[#A8A29E] block">Email Receipt</span>
                  <span className="font-semibold text-[#29231F] mt-0.5 block">
                    {order.customer_email}
                  </span>
                  <span className="text-xs text-[#A8A29E] mt-0.5 block">
                    A confirmation receipt has been sent to this email address.
                  </span>
                </div>
              </div>
            </div>

            {/* Navigation and Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link
                href="/orders"
                className="flex-1 inline-flex items-center justify-center rounded-xl bg-[#C2410C] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#9A3412] transition"
              >
                View in My Orders
              </Link>
              <Link
                href="/menu"
                className="flex-1 inline-flex items-center justify-center rounded-xl border border-[#E8DED2] bg-white px-5 py-3 text-sm font-semibold text-[#29231F] hover:bg-[#FAF7F2] transition"
              >
                Back to Menu
              </Link>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl border border-[#E8DED2] bg-white text-sm font-semibold text-[#57534E] hover:text-[#1C1917] hover:bg-[#FAF7F2] transition"
                title="Print Receipt"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                <span>Print</span>
              </button>
            </div>
          </div>

          {/* Order Summary (Right Column: 5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-2xl border border-[#E8DED2] bg-white p-6 shadow-sm sticky top-6">
              <div className="flex items-center justify-between pb-4 border-b border-[#F2ECE4]">
                <h2 className="text-base font-bold text-[#1C1917]">
                  Order Summary
                </h2>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#FAF7F2] text-[#78716C] border border-[#E8DED2]">
                  {items.reduce((sum, item) => sum + item.quantity, 0)} {items.reduce((sum, item) => sum + item.quantity, 0) === 1 ? "item" : "items"}
                </span>
              </div>

              {/* Items List */}
              <div className="divide-y divide-[#F5EFE9] max-h-72 overflow-y-auto py-2">
                {items.length === 0 ? (
                  <p className="py-4 text-xs text-[#A8A29E] text-center">
                    No item breakdown available.
                  </p>
                ) : (
                  items.map((item, idx) => (
                    <div key={item.id || idx} className="py-3 flex items-start justify-between gap-3 text-sm">
                      <div className="flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="font-semibold text-xs px-1.5 py-0.5 rounded bg-orange-100 text-[#C2410C]">
                            {item.quantity}×
                          </span>
                          <span className="font-medium text-[#29231F]">
                            {item.item_name}
                          </span>
                        </div>
                        <span className="text-xs text-[#A8A29E] ml-7 block mt-0.5">
                          ${Number(item.unit_price).toFixed(2)} each
                        </span>
                      </div>
                      <span className="font-semibold text-[#1C1917]">
                        ${Number(item.total_price).toFixed(2)}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* Pricing Breakdown */}
              <div className="pt-4 border-t border-[#F2ECE4] space-y-2 text-sm">
                <div className="flex justify-between text-[#78716C]">
                  <span>Subtotal</span>
                  <span>${Number(order.subtotal).toFixed(2)}</span>
                </div>

                {order.promo_discount_amount && Number(order.promo_discount_amount) > 0 ? (
                  <div className="flex justify-between text-emerald-700 font-medium">
                    <span>Promo Discount ({order.promo_code || "Special"})</span>
                    <span>-${Number(order.promo_discount_amount).toFixed(2)}</span>
                  </div>
                ) : null}

                <div className="flex justify-between text-xs text-[#A8A29E]">
                  <span>GST (Australian Tax)</span>
                  <span>Included</span>
                </div>

                <div className="pt-3 border-t border-[#F2ECE4] flex justify-between items-baseline">
                  <span className="text-base font-bold text-[#1C1917]">Total Paid</span>
                  <span className="text-2xl font-black text-[#C2410C]">
                    ${Number(order.total_amount).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Need help note */}
              <div className="mt-6 pt-4 border-t border-[#F2ECE4] text-center">
                <p className="text-xs text-[#78716C]">
                  Need help or have questions regarding your order?
                </p>
                <a
                  href="tel:0394539778"
                  className="mt-1 inline-block text-xs font-bold text-[#C2410C] hover:underline"
                >
                  Call Store: (03) 9453 9778
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OrderConfirmationPage() {
  return (
    <Suspense
      fallback={<OrderConfirmationSkeleton />}
    >
      <OrderConfirmationContent />
    </Suspense>
  );
}

