"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Loader from "@/components/Loader";
import { useCart } from "@/context/CartContext";

type PromoQuote = {
  code: string;
  title: string;
  subtotalCents: number;
  eligibleSubtotalCents: number;
  discountCents: number;
  totalCents: number;
  cartKey: string;
};

const cardClass =
  "rounded-xl border border-[#E8DED2] bg-white p-5 sm:p-6";
const inputClass =
  "mt-1.5 h-11 w-full rounded-lg border border-[#E2D6C9] bg-white px-3 text-sm text-[#29231F] outline-none transition placeholder:text-[#9A8B7D] focus:border-[#C2410C] focus:ring-2 focus:ring-orange-100";

type CheckoutCartItem = {
  menuItemId: string;
  quantity: number;
  name: string;
};

async function validatePromo(
  code: string,
  items: CheckoutCartItem[],
  cartKey: string
): Promise<{ quote: PromoQuote | null; error: string }> {
  try {
    const response = await fetch("/api/promos/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        items: items.map((item) => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          displayName: item.name,
        })),
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      return {
        quote: null,
        error: data.error ?? "Could not apply this promo code.",
      };
    }

    return {
      quote: {
        ...data,
        cartKey,
      },
      error: "",
    };
  } catch {
    return {
      quote: null,
      error: "Could not verify the promo code. Please try again.",
    };
  }
}

export default function CheckoutPage() {
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
    promoCode,
    setPromoCode,
  } = useCart();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [pickupTime, setPickupTime] = useState("As soon as possible (about 20 min)");
  const [promoQuote, setPromoQuote] = useState<PromoQuote | null>(null);
  const [promoError, setPromoError] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cartKey = JSON.stringify(
    items.map((item) => [item.id, item.menuItemId, item.name, item.quantity])
  );
  const quoteIsCurrent =
    Boolean(promoCode.trim()) &&
    promoQuote?.code === promoCode &&
    promoQuote?.cartKey === cartKey;
  const discountCents = quoteIsCurrent ? promoQuote.discountCents : 0;
  const finalTotal = Math.max(0, total - discountCents / 100);

  useEffect(() => {
    let active = true;

    if (!promoCode.trim() || items.length === 0) {
      return () => {
        active = false;
      };
    }

    void validatePromo(promoCode, items, cartKey).then(({ quote, error }) => {
      if (!active) return;
      setPromoQuote(quote);
      setPromoError(error);
      if (quote && promoCode !== quote.code) setPromoCode(quote.code);
    });

    return () => {
      active = false;
    };
  }, [cartKey, items, promoCode, setPromoCode]);

  async function applyPromo(code: string) {
    setPromoError("");
    setIsApplyingPromo(true);
    setPromoQuote(null);

    const result = await validatePromo(code, items, cartKey);
    setPromoError(result.error);
    setPromoQuote(result.quote);
    if (result.quote) setPromoCode(result.quote.code);
    setIsApplyingPromo(false);
    return Boolean(result.quote);
  }

  async function handlePlaceOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCheckoutError("");

    if (!items.length) {
      setCheckoutError("Your cart is empty. Add items before checking out.");
      return;
    }
    if (!orderType) {
      setCheckoutError("Choose takeaway or dine-in to continue.");
      return;
    }
    if (orderType === "Dine-In" && !tableNumber.trim()) {
      setCheckoutError("Enter your table number to continue.");
      return;
    }
    if (promoCode && !quoteIsCurrent) {
      const applied = await applyPromo(promoCode);
      if (!applied) return;
      setCheckoutError(
        "Your promotion has been checked again. Review the updated total and place your order."
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            displayName: item.name,
          })),
          orderType,
          promoCode: quoteIsCurrent ? promoQuote.code : null,
          customer: { name: name.trim(), phone: phone.trim(), email: email.trim() },
          pickupTime: orderType === "Takeaway" ? pickupTime : null,
          tableNumber: orderType === "Dine-In" ? tableNumber.trim() : null,
          guestCount: orderType === "Dine-In" ? guestCount : null,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.url) {
        setCheckoutError(data.error ?? "Could not start checkout. Please try again.");
        return;
      }
      window.location.assign(data.url);
    } catch (error) {
      setCheckoutError(
        error instanceof Error
          ? error.message
          : "Could not start checkout. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!items.length) {
    return (
      <main className="min-h-[70vh] flex-1 bg-[#FAF7F2] px-4 py-16 text-center text-[#29231F]">
        <h1 className="text-3xl font-extrabold">Your cart is empty</h1>
        <p className="mt-2 text-sm text-[#74685E]">
          Add something delicious from our menu to get started.
        </p>
        <Link
          href="/menu"
          className="mt-6 inline-flex rounded-lg bg-[#C2410C] px-6 py-3 font-semibold text-white hover:bg-[#9A3412]"
        >
          Browse menu
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex-1 bg-[#FAF7F2] px-4 py-8 text-[#29231F] sm:px-8 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-6 text-3xl font-extrabold tracking-tight sm:text-4xl">
          Checkout
        </h1>

        <form
          onSubmit={handlePlaceOrder}
          className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.8fr)_minmax(320px,1fr)]"
        >
          <div className="space-y-4">
            <section className={cardClass}>
              <h2 className="text-lg font-bold">1. Order type</h2>
              <div className="mt-3 grid grid-cols-2 rounded-lg bg-[#F3EEE8] p-1">
                {(["Takeaway", "Dine-In"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={orderType === option}
                    onClick={() => setOrderType(option)}
                    className={`h-10 rounded-md text-sm font-semibold transition ${
                      orderType === option
                        ? "bg-white text-[#29231F] shadow-sm"
                        : "text-[#74685E] hover:text-[#29231F]"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
              {orderType === "Takeaway" && (
                <label className="mt-4 block text-xs font-semibold">
                  Pickup time
                  <select
                    value={pickupTime}
                    onChange={(event) => setPickupTime(event.target.value)}
                    className={inputClass}
                  >
                    <option>As soon as possible (about 20 min)</option>
                    <option>In about 30 minutes</option>
                    <option>In about 45 minutes</option>
                    <option>In about 60 minutes</option>
                  </select>
                </label>
              )}
              {orderType === "Dine-In" && (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="text-xs font-semibold">
                    Table number
                    <input
                      required
                      value={tableNumber}
                      onChange={(event) => setTableNumber(event.target.value)}
                      placeholder="e.g. 12"
                      className={inputClass}
                    />
                  </label>
                  <p className="self-end pb-3 text-sm text-[#74685E]">
                    {guestCount} {guestCount === 1 ? "guest" : "guests"}
                  </p>
                </div>
              )}
            </section>

            <section className={cardClass}>
              <h2 className="text-lg font-bold">2. Your details</h2>
              <label className="mt-3 block text-xs font-semibold">
                Name
                <input
                  required
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your name"
                  className={inputClass}
                />
              </label>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <label className="text-xs font-semibold">
                  Phone
                  <input
                    required
                    type="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="04xx xxx xxx"
                    className={inputClass}
                  />
                </label>
                <label className="text-xs font-semibold">
                  Email
                  <input
                    required
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    className={inputClass}
                  />
                </label>
              </div>
            </section>

            <section className={cardClass}>
              <h2 className="text-lg font-bold">3. Payment</h2>
              <div className="mt-3 rounded-lg border border-[#C2410C] bg-[#FCE9E1] p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold">Pay by card</p>
                    <p className="mt-0.5 text-xs text-[#74685E]">
                      Secure payment with Stripe
                    </p>
                  </div>
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#C2410C] text-white">
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  </span>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between rounded-lg border border-[#E8DED2] p-4 opacity-60">
                <div>
                  <p className="text-sm font-bold">Pay at collection</p>
                  <p className="mt-0.5 text-xs text-[#74685E]">
                    Not available yet
                  </p>
                </div>
                <span className="h-4 w-4 rounded-full border border-[#B9AA9C]" />
              </div>
              <p className="mt-3 text-xs leading-5 text-[#74685E]">
                Your card details are entered securely on Stripe after you place
                your order. They are never stored on this site.
              </p>
            </section>

            {checkoutError && (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {checkoutError}
              </p>
            )}
          </div>

          <aside className={`${cardClass} lg:sticky lg:top-24`}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Your order</h2>
              <span className="text-xs text-[#8A7B6D]">
                {items.reduce((count, item) => count + item.quantity, 0)} items
              </span>
            </div>

            <div className="mt-3 divide-y divide-[#EEE6DD]">
              {items.map((item) => (
                <article key={item.id} className="flex gap-3 py-3">
                  <div
                    aria-hidden="true"
                    className="h-14 w-14 shrink-0 rounded-lg bg-[#EEE3D7]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-bold">{item.name}</p>
                      <p className="shrink-0 text-sm font-semibold">
                        ${(item.price * item.quantity).toFixed(2)}
                      </p>
                    </div>
                    <p className="mt-0.5 text-xs text-[#8A7B6D]">
                      ${item.price.toFixed(2)} each
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <div className="flex items-center rounded-md border border-[#E8DED2]">
                        <button
                          type="button"
                          aria-label={`Decrease ${item.name} quantity`}
                          onClick={() =>
                            updateQuantity(item.id, item.quantity - 1)
                          }
                          className="px-2 py-1"
                        >
                          −
                        </button>
                        <span className="px-1">{item.quantity}</span>
                        <button
                          type="button"
                          aria-label={`Increase ${item.name} quantity`}
                          onClick={() =>
                            updateQuantity(item.id, item.quantity + 1)
                          }
                          className="px-2 py-1"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="text-[#8A7B6D] underline"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-3 border-t border-[#EEE6DD] pt-3">
              <label
                htmlFor="checkout-promo-code"
                className="text-xs font-semibold"
              >
                Promo code
              </label>
              <div className="mt-1.5 flex gap-2">
                <input
                  id="checkout-promo-code"
                  value={promoCode}
                  onChange={(event) => {
                    setPromoCode(event.target.value);
                    setPromoQuote(null);
                    setPromoError("");
                  }}
                  placeholder="Enter code"
                  autoComplete="off"
                  className="h-10 min-w-0 flex-1 rounded-lg border border-[#E2D6C9] px-3 text-sm uppercase outline-none focus:border-[#C2410C]"
                />
                <button
                  type="button"
                  onClick={() => void applyPromo(promoCode)}
                  disabled={!promoCode.trim() || isApplyingPromo}
                  className="rounded-lg border border-[#E2D6C9] px-3 text-sm font-semibold disabled:opacity-50"
                >
                  {isApplyingPromo ? (
                    <Loader
                      size="sm"
                      label="Applying..."
                      inline
                      className="text-[#C2410C]"
                    />
                  ) : (
                    "Apply"
                  )}
                </button>
              </div>
              {promoError && (
                <p role="alert" className="mt-2 text-xs text-red-700">
                  {promoError}
                </p>
              )}
              {promoQuote && quoteIsCurrent && (
                <p className="mt-2 text-xs text-green-700">
                  ✓ {promoQuote.code} applied
                  {promoQuote.eligibleSubtotalCents < promoQuote.subtotalCents &&
                    ` to $${(promoQuote.eligibleSubtotalCents / 100).toFixed(2)} of eligible items`}
                </p>
              )}
              {promoQuote && !quoteIsCurrent && (
                <p role="status" className="mt-2 text-xs text-amber-700">
                  Cart changed. Re-apply the code to refresh the discount.
                </p>
              )}
            </div>

            <div className="mt-4 space-y-2 border-t border-[#EEE6DD] pt-3 text-sm">
              <div className="flex justify-between text-[#74685E]">
                <span>Subtotal</span>
                <span>${total.toFixed(2)}</span>
              </div>
              {quoteIsCurrent && promoQuote && (
                <div className="flex justify-between text-green-700">
                  <span>Discount</span>
                  <span>−${(discountCents / 100).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-extrabold">
                <span>Total</span>
                <span>${finalTotal.toFixed(2)}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || isApplyingPromo || !orderType}
              className="mt-4 w-full rounded-lg bg-[#CE421B] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#B73714] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting
                ? (
                    <Loader
                      size="sm"
                      label="Redirecting to secure payment..."
                      inline
                      className="text-white"
                    />
                  )
                : `Place order · $${finalTotal.toFixed(2)}`}
            </button>
            <p className="mt-3 text-center text-[10px] leading-4 text-[#8A7B6D]">
              By placing your order you agree to our Terms.
            </p>
          </aside>
        </form>
      </div>
    </main>
  );
}
