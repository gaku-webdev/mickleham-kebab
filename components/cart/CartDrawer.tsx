"use client";

import { useCart } from "@/context/CartContext";

// This describes what this component needs from its parent (Header).
type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export default function CartDrawer({ isOpen, onClose }: Props) {
  // Get everything we need from the shared cart.
  const {
    items,
    removeItem,
    updateQuantity,
    total,
    // Order type values, now coming from CartContext.
    orderType,
    setOrderType,
    tableNumber,
    setTableNumber,
    guestCount,
    setGuestCount,
  } = useCart();

  // If the drawer is closed, don't render anything at all.
  if (!isOpen) return null;

  // Work out if the customer is ready to check out.
  // They need an order type, and if it's Dine-In, a table number too.
  const canCheckout =
    items.length > 0 &&
    orderType !== null &&
    (orderType === "Takeaway" || tableNumber.trim() !== "");

  return (
    <>
      {/* Dark background. Clicking it closes the drawer. */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* The actual drawer panel, sliding in from the right. */}
      <div className="fixed top-0 right-0 h-full w-full max-w-sm bg-white z-50 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold">Your Cart</h2>
          <button onClick={onClose}>✕</button>
        </div>

        {/* Scrollable list of cart items. */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* If the cart is empty, show a message instead of a blank space. */}
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

                {/* Quantity controls for this specific cart line. */}
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

          {/* Order type section. Only show it once there's something in the cart. */}
          {items.length > 0 && (
            <div className="pt-2">
              <p className="font-medium mb-2">Order Type</p>
              <div className="flex gap-2">
                {/* "as const" tells TypeScript these are exactly the literal
                    values "Takeaway" and "Dine-In", not just any string. */}
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

              {/* Only show these fields if Dine-In is selected. */}
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

        {/* Footer with total and checkout button. Only show it if there's something to pay for. */}
        {items.length > 0 && (
          <div className="border-t p-4">
            <div className="flex justify-between mb-3 font-semibold">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>

            {/* The button is disabled until order type (and table number) is set. */}
            <button
              disabled={!canCheckout}
              className="w-full bg-orange-600 text-white rounded py-2 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Go to Checkout
            </button>

            {/* Small hint telling the customer what's missing. */}
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