"use client";

import { useState } from "react";
import { useCart } from "@/context/CartContext";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

type PromoQuote = {
  code: string;
  title: string;
  subtotalCents: number;
  eligibleSubtotalCents: number;
  discountCents: number;
  totalCents: number;
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
  } = useCart();

  // Remember if we're waiting for Stripe to respond,
  // so we can show a loading state and stop double-clicks.
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoQuote, setPromoQuote] = useState<PromoQuote | null>(null);
  const [promoError, setPromoError] = useState("");
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  if (!isOpen) return null;

  const cartKey = JSON.stringify(
    items.map((item) => [item.id, item.menuItemId, item.name, item.quantity])
  );
  const quoteIsCurrent = promoQuote?.cartKey === cartKey;
  const displayedTotal = quoteIsCurrent
    ? promoQuote.totalCents / 100
    : total;
  const canCheckout =
    items.length > 0 &&
    orderType !== null &&
    (orderType === "Takeaway" || tableNumber.trim() !== "");

  async function handleApplyPromo(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPromoError("");
    setCheckoutError("");
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
      setPromoQuote({ ...data, cartKey });
    } catch {
      setPromoQuote(null);
      setPromoError("Could not verify the promo code. Please try again.");
    } finally {
      setIsApplyingPromo(false);
    }
  }

  function removePromo() {
    setPromoCode("");
    setPromoQuote(null);
    setPromoError("");
    setCheckoutError("");
  }

  // NEW: this function runs when "Go to Checkout" is clicked.
  async function handleCheckout() {
    if (promoQuote && !quoteIsCurrent) {
      setPromoError("Your cart changed. Re-apply the promo code before checkout.");
      return;
    }

    // Turn on the loading state, so the button shows "Loading..."
    // and can't be clicked twice while we wait.
    setIsCheckingOut(true);
    setCheckoutError("");

    try {
      // Build the data our /api/checkout route is expecting:
      // just id, quantity and a display name for each cart line.
      // We do NOT send the price - the server looks that up itself.
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            displayName: item.name,
          })),
          orderType: orderType,
          promoCode: quoteIsCurrent ? promoQuote.code : null,
        }),
      });

      // Turn the server's response back into a normal JS object.
      const data = await response.json();

      if (response.ok && data.url) {
        // Send the browser to the Stripe checkout page.
        // This leaves our site entirely - the customer is now on stripe.com.
        window.location.href = data.url;
      } else {
        setCheckoutError(data.error ?? "Could not start checkout. Please try again.");
        setIsCheckingOut(false);
      }
    } catch (error) {
      // This catches network errors (e.g. no internet connection).
      setCheckoutError(
        error instanceof Error
          ? error.message
          : "Could not start checkout. Please try again."
      );
      setIsCheckingOut(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      <div className="fixed top-0 right-0 h-full w-full max-w-sm bg-white z-50 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold">Your Cart</h2>
          <button onClick={onClose}>✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {items.length === 0 && (
            <p className="text-gray-500 text-center mt-8">
              Your cart is empty.
            </p>
          )}

          {items.map((item) => (
            <div key={item.id} className="flex justify-between items-start border-b pb-3">
              <div className="flex-1">
                <p className="font-medium">{item.name}</p>
                <p className="text-sm text-gray-600">
                  ${item.price.toFixed(2)} each
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    className="border rounded w-6 h-6 text-sm"
                  >
                    -
                  </button>
                  <span>{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    className="border rounded w-6 h-6 text-sm"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold">
                  ${(item.price * item.quantity).toFixed(2)}
                </p>
                <button
                  onClick={() => removeItem(item.id)}
                  className="text-xs text-red-600 mt-2"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}

          {items.length > 0 && (
            <div className="pt-2">
              <form onSubmit={handleApplyPromo} className="mb-5">
                <label
                  htmlFor="cart-promo-code"
                  className="mb-2 block text-sm font-medium"
                >
                  Promo code
                </label>
                <div className="flex gap-2">
                  <input
                    id="cart-promo-code"
                    value={promoCode}
                    onChange={(event) => {
                      setPromoCode(event.target.value);
                      setPromoError("");
                      setPromoQuote(null);
                    }}
                    placeholder="Enter code"
                    autoComplete="off"
                    className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm uppercase"
                  />
                  <button
                    type="submit"
                    disabled={isApplyingPromo || !promoCode.trim()}
                    className="rounded-lg border border-orange-200 px-3 py-2 text-sm font-semibold text-orange-800 disabled:opacity-50"
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
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs text-green-700">
                    <p>
                      {promoQuote.code} applied to eligible items
                      {promoQuote.eligibleSubtotalCents <
                        promoQuote.subtotalCents &&
                        ` ($${(promoQuote.eligibleSubtotalCents / 100).toFixed(2)} eligible)`}
                    </p>
                    <button
                      type="button"
                      onClick={removePromo}
                      className="font-semibold underline"
                    >
                      Remove
                    </button>
                  </div>
                )}
                {promoQuote && !quoteIsCurrent && (
                  <p role="status" className="mt-2 text-xs text-amber-700">
                    Your cart changed. Re-apply this code to update the discount.
                  </p>
                )}
              </form>

              <p className="font-medium mb-2">Order Type</p>
              <div className="flex gap-2">
                {(["Takeaway", "Dine-In"] as const).map((option) => (
                  <button
                    key={option}
                    onClick={() => setOrderType(option)}
                    className={`flex-1 py-2 rounded border ${
                      orderType === option
                        ? "bg-orange-600 text-white"
                        : "bg-white"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>

              {orderType === "Dine-In" && (
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="text-sm text-gray-600">
                      Table Number
                    </label>
                    <input
                      type="text"
                      value={tableNumber}
                      onChange={(e) => setTableNumber(e.target.value)}
                      placeholder="e.g. 12"
                      className="w-full border rounded px-2 py-1 mt-1"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-gray-600">
                      Number of Guests
                    </label>
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        onClick={() =>
                          setGuestCount(Math.max(1, guestCount - 1))
                        }
                        className="border rounded w-6 h-6 text-sm"
                      >
                        -
                      </button>
                      <span>{guestCount}</span>
                      <button
                        onClick={() => setGuestCount(guestCount + 1)}
                        className="border rounded w-6 h-6 text-sm"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t p-4">
            <div className="space-y-2 mb-3 text-sm">
              {quoteIsCurrent && promoQuote && (
                <>
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span>${(promoQuote.subtotalCents / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-medium text-green-700">
                    <span>Promo discount</span>
                    <span>−${(promoQuote.discountCents / 100).toFixed(2)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span>${displayedTotal.toFixed(2)}</span>
              </div>
            </div>

            {checkoutError && (
              <p role="alert" className="mb-3 text-center text-xs text-red-700">
                {checkoutError}
              </p>
            )}
            {/* onClick now calls handleCheckout, and the button
                text changes to "Loading..." while we wait for Stripe. */}
            <button
              disabled={!canCheckout || isCheckingOut || isApplyingPromo}
              onClick={handleCheckout}
              className="w-full bg-orange-600 text-white rounded py-2 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isCheckingOut ? "Loading..." : "Go to Checkout"}
            </button>

            {!canCheckout && orderType === null && (
              <p className="text-xs text-gray-500 mt-2 text-center">
                Please choose Takeaway or Dine-In.
              </p>
            )}
            {!canCheckout && orderType === "Dine-In" && tableNumber.trim() === "" && (
              <p className="text-xs text-gray-500 mt-2 text-center">
                Please enter your table number.
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}