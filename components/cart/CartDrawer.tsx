"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/context/CartContext";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

type PromoQuote = {
  code: string;
  eligibleSubtotalCents: number;
  discountCents: number;
  cartKey: string;
};

export default function CartDrawer({ isOpen, onClose }: Props) {
  const {
    items,
    removeItem,
    updateQuantity,
    total,
    orderType,
    setOrderType,
    tableNumber,
    setTableNumber,
    guestCount,
    setGuestCount,
    promoCode,
    setPromoCode,
  } = useCart();
  const [promoQuote, setPromoQuote] = useState<PromoQuote | null>(null);
  const [promoError, setPromoError] = useState("");
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const itemCount = items.reduce((count, item) => count + item.quantity, 0);

  if (!isOpen) return null;

  const cartKey = JSON.stringify(
    items.map((item) => [item.id, item.menuItemId, item.name, item.quantity])
  );
  const quoteIsCurrent = promoQuote?.cartKey === cartKey;

  async function handleApplyPromo(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPromoError("");
    setIsApplyingPromo(true);

    try {
      const response = await fetch("/api/promos/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: promoCode,
          items: items.map((item) => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            displayName: item.name,
          })),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setPromoQuote(null);
        setPromoError(data.error ?? "Could not apply this promo code.");
        return;
      }

      setPromoCode(data.code);
      setPromoQuote({
        code: data.code,
        eligibleSubtotalCents: data.eligibleSubtotalCents,
        discountCents: data.discountCents,
        cartKey,
      });
    } catch {
      setPromoQuote(null);
      setPromoError("Could not verify the promo code. Please try again.");
    } finally {
      setIsApplyingPromo(false);
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close cart"
        className="fixed inset-0 z-40 bg-stone-950/50 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Your cart"
        className="fixed right-0 top-0 z-50 flex h-[100dvh] w-full max-w-md flex-col bg-white text-[#1C1917] shadow-2xl"
      >
        <div className="flex min-h-16 items-center justify-between border-b border-[#EBE6DD] px-5 py-4">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight">Your Cart</h2>
            {items.length > 0 && (
              <p className="mt-0.5 text-xs font-medium text-stone-500">
                {itemCount} {itemCount === 1 ? "item" : "items"} in your order
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close cart"
            className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-100"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {items.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-5 py-10 text-center">
              <p className="font-bold text-stone-800">Your cart is empty</p>
              <p className="mt-1 text-sm text-stone-500">
                Add something delicious from our menu.
              </p>
              <Link
                href="/menu"
                onClick={onClose}
                className="mt-5 inline-flex min-h-10 items-center justify-center rounded-lg bg-[#C2410C] px-4 text-sm font-bold text-white transition hover:bg-[#9A3412] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-200"
              >
                Browse menu
              </Link>
            </div>
          ) : (
            items.map((item) => (
              <article
                key={item.id}
                className="flex items-start justify-between gap-4 border-b border-[#EBE6DD] pb-4 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-bold leading-5 text-stone-900">{item.name}</p>
                  <p className="mt-1 text-sm text-stone-600">
                    ${item.price.toFixed(2)} each
                  </p>
                  <div className="mt-2.5 flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={`Decrease ${item.name} quantity`}
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 bg-white text-sm text-stone-700 transition hover:border-orange-300 hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-100"
                    >
                      −
                    </button>
                    <span className="min-w-4 text-center text-sm font-semibold tabular-nums">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      aria-label={`Increase ${item.name} quantity`}
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 bg-white text-sm text-stone-700 transition hover:border-orange-300 hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-100"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="ml-1 rounded px-1 py-1 text-xs font-medium text-stone-600 underline underline-offset-2 transition hover:text-[#C2410C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <p className="shrink-0 font-bold tabular-nums text-stone-900">
                  ${(item.price * item.quantity).toFixed(2)}
                </p>
              </article>
            ))
          )}

          {items.length > 0 && (
            <>
              <form
                onSubmit={handleApplyPromo}
                className="border-b border-[#EBE6DD] pb-5"
              >
                <label
                  htmlFor="cart-promo-code"
                  className="mb-2 block text-sm font-bold text-stone-800"
                >
                  Promo code
                </label>
                <div className="flex gap-2">
                  <input
                    id="cart-promo-code"
                    value={promoCode}
                    onChange={(event) => {
                      setPromoCode(event.target.value);
                      setPromoQuote(null);
                      setPromoError("");
                    }}
                    placeholder="ENTER CODE"
                    autoComplete="off"
                    className="min-w-0 flex-1 rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm font-medium uppercase text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                  />
                  <button
                    type="submit"
                    disabled={isApplyingPromo || !promoCode.trim()}
                    className="min-h-10 rounded-lg border border-orange-200 px-3 text-sm font-bold text-[#C2410C] transition hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isApplyingPromo ? "Checking..." : "Apply"}
                  </button>
                </div>
                {promoError && (
                  <p role="alert" className="mt-2 text-xs text-red-700">
                    {promoError}
                  </p>
                )}
                {promoQuote && quoteIsCurrent && (
                  <p className="mt-2 text-xs text-green-700">
                    {promoQuote.code} applied · $
                    {(promoQuote.discountCents / 100).toFixed(2)} off
                  </p>
                )}
                {promoQuote && !quoteIsCurrent && (
                  <p role="status" className="mt-2 text-xs text-amber-700">
                    Cart changed. Re-apply this code to refresh the discount.
                  </p>
                )}
              </form>

              <div>
                <p className="mb-2 text-sm font-bold text-stone-800">
                  Order type
                </p>
                <div className="flex gap-2">
                  {(["Takeaway", "Dine-In"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setOrderType(option)}
                      aria-pressed={orderType === option}
                      className={`min-h-11 flex-1 rounded-lg border px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-100 ${
                        orderType === option
                          ? "border-[#C2410C] bg-[#EA580C] text-white shadow-sm"
                          : "border-stone-200 bg-white text-stone-700 hover:border-orange-300 hover:bg-orange-50"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                {orderType === "Dine-In" && (
                  <div className="mt-3 space-y-3">
                    <label className="block text-sm font-medium text-stone-700">
                      Table number
                      <input
                        type="text"
                        value={tableNumber}
                        onChange={(event) => setTableNumber(event.target.value)}
                        placeholder="e.g. 12"
                        className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-900 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                      />
                    </label>
                    <div className="flex items-center gap-3 text-sm text-stone-700">
                      <span>Guests</span>
                      <button
                        type="button"
                        onClick={() => setGuestCount(Math.max(1, guestCount - 1))}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 hover:bg-orange-50"
                      >
                        −
                      </button>
                      <span className="min-w-4 text-center font-semibold tabular-nums">
                        {guestCount}
                      </span>
                      <button
                        type="button"
                        onClick={() => setGuestCount(guestCount + 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 hover:bg-orange-50"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {items.length > 0 && (
          <div className="space-y-3 border-t border-[#EBE6DD] bg-white px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-[0_-8px_24px_rgba(41,35,31,0.06)]">
            <div className="flex items-center justify-between font-bold">
              <span>Total</span>
              <span className="tabular-nums">${total.toFixed(2)}</span>
            </div>
            <Link
              href="/checkout"
              onClick={onClose}
              className="flex min-h-12 w-full items-center justify-center rounded-xl bg-[#EA580C] px-4 text-center font-bold text-white transition hover:bg-[#C2410C] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-200"
            >
              Continue to checkout
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}
