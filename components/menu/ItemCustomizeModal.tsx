"use client";
// This runs in the browser, because it reacts to clicks and remembers choices.

import { useState } from "react";
import { useCart } from "@/context/CartContext";

// This describes one menu item passed into the modal.
type MenuItem = {
  id: string;
  name: string;
  price: number;
  category: string;
  // We added category. Without it, we can't tell a drink from a kebab,
  // so every item would show the same options (size, cheese, sauce).
};

// This describes what this component needs from its parent page.
type Props = {
  item: MenuItem;
  onClose: () => void;
};

export default function ItemCustomizeModal({ item, onClose }: Props) {
  // Get the addItem function from the cart.
  const { addItem } = useCart();

  // ---------- Decide which options this item should show ----------
  // We work this out ONCE here, instead of repeating the same check
  // in many places later. This is the same "don't repeat yourself" idea
  // we used before.

  // Food that comes in a size (Regular/Large) and sides.
  const showSize = ["Kebabs", "Burgers", "Grills", "Sides"].includes(item.category);
  // .includes(...) checks: "is item.category one of these words?"
  // true or false.

  // Only kebabs/burgers/grills can have extra cheese.
  const showCheese = ["Kebabs", "Burgers", "Grills"].includes(item.category);

  // Only kebabs/burgers/grills come with a sauce choice.
  const showSauce = ["Kebabs", "Burgers", "Grills"].includes(item.category);

  // A drink or dessert will end up with showSize = false,
  // showCheese = false, showSauce = false - so none of those
  // sections will render. Only quantity will show.

  // ---------- Remember the user's choices ---------
  // These still exist for every item, but they are only USED
  // (and only shown on screen) when the matching "show..." flag is true.
  const [size, setSize] = useState("Regular");
  const [extraCheese, setExtraCheese] = useState(false);
  const [sauce, setSauce] = useState("Garlic");
  const [quantity, setQuantity] = useState(1);

  // ---------- Work out the price ----------
  function calculatePrice() {
    let price = item.price;

    // Only add the "Large" price if this category actually HAS sizes.
    // Without the showSize check, a drink could somehow still get
    // +$2 added, even though it never showed a size button.
    if (showSize && size === "Large") price += 2;

    if (showCheese && extraCheese) price += 1;

    return price;
  }

  // -------- Add the item to the cart ----------
  function handleAddToCart() {
    // Build the cart id piece by piece.
    // We start with just the item id...
    const parts = [item.id];

    // ...and only add size/cheese/sauce to the id if this item HAS them.
    // This stops a drink's id from looking like "drink-1-Regular-false-Garlic"
    // when it never had those choices in the first place.
    if (showSize) parts.push(size);
    if (showCheese) parts.push(String(extraCheese));
    // String(extraCheese) turns true/false into the text "true"/"false",
    // so it can be joined into the id string below.
    if (showSauce) parts.push(sauce);

    // Join all the parts together with "-" to make one id string.
    // Example for a kebab: "kebab-1-Large-true-Garlic"
    // Example for a drink: "drink-1" (nothing extra added)
    const cartItemId = parts.join("-");

    // ---------- Build the name shown in the cart ---------
    // Collect only the details that actually apply to this item.
    const details = [];
    if (showSize) details.push(size);
    if (showCheese && extraCheese) details.push("extra cheese");

    // If there are any details, wrap them in brackets like "(Large, extra cheese)".
    // If there are none (like for a drink), show nothing extra at all.
    const detailText = details.length > 0 ? ` (${details.join(", ")})` : "";

    addItem({
      id: cartItemId,
      menuItemId: item.id,
      name: `${item.name}${detailText}`,
      price: calculatePrice(),
      quantity: quantity,
    });

    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="customize-item-title"
        aria-describedby="customize-item-description"
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="shrink-0 border-b border-stone-100 px-5 pb-5 pt-4 sm:px-7 sm:pt-6">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-stone-200 sm:hidden" />
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-700">
                {item.category}
              </p>
              <h2
                id="customize-item-title"
                className="mt-1 text-2xl font-extrabold tracking-tight text-stone-900"
              >
                {item.name}
              </h2>
              <p
                id="customize-item-description"
                className="mt-1 text-sm text-stone-500"
              >
                Make it just the way you like.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close customization"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-100 text-xl text-stone-600 transition hover:bg-stone-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-200"
            >
              ×
            </button>
          </div>
          <p className="mt-4 text-lg font-bold tabular-nums text-stone-900">
            ${item.price.toFixed(2)}
            <span className="ml-1 text-sm font-normal text-stone-500">each</span>
          </p>
        </div>

        <div className="overflow-y-auto px-5 py-5 sm:px-7">
          {showSize && (
            <fieldset className="mb-6">
              <legend className="mb-3 text-sm font-bold text-stone-900">
                Choose your size
              </legend>
              <div className="grid grid-cols-2 gap-3">
                {["Regular", "Large"].map((option) => {
                  const isSelected = size === option;

                  return (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setSize(option)}
                      className={`flex min-h-14 items-center justify-between rounded-xl border px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-200 ${
                        isSelected
                          ? "border-orange-600 bg-orange-50 text-orange-800 ring-1 ring-orange-600"
                          : "border-stone-200 text-stone-700 hover:border-orange-300"
                      }`}
                    >
                      {option}
                      <span className="text-xs font-medium text-stone-500">
                        {option === "Large" ? "+$2.00" : "Included"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          {showSauce && (
            <div className="mb-6">
              <label
                htmlFor="item-sauce"
                className="mb-3 block text-sm font-bold text-stone-900"
              >
                Choose your sauce
              </label>
              <select
                id="item-sauce"
                value={sauce}
                onChange={(event) => setSauce(event.target.value)}
                className="h-12 w-full rounded-xl border border-stone-200 bg-white px-4 text-sm text-stone-800 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
              >
                <option>Garlic</option>
                <option>Chilli</option>
                <option>BBQ</option>
              </select>
            </div>
          )}

          {showCheese && (
            <label className="mb-6 flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-stone-200 p-4 transition hover:border-orange-300">
              <span>
                <span className="block text-sm font-semibold text-stone-900">
                  Add extra cheese
                </span>
                <span className="mt-1 block text-xs text-stone-500">
                  Make it extra cheesy
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-3">
                <span className="text-sm font-semibold text-stone-700">+$1.00</span>
                <input
                  type="checkbox"
                  checked={extraCheese}
                  onChange={(event) => setExtraCheese(event.target.checked)}
                  className="h-5 w-5 accent-orange-600"
                />
              </span>
            </label>
          )}

          <div className="flex items-center justify-between border-t border-stone-100 pt-5">
            <div>
              <p className="text-sm font-bold text-stone-900">Quantity</p>
              <p className="mt-0.5 text-xs text-stone-500">
                How many would you like?
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Decrease quantity"
                onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 text-lg font-semibold text-stone-700 transition hover:border-orange-300 hover:text-orange-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-200"
              >
                −
              </button>
              <span className="min-w-5 text-center font-bold tabular-nums text-stone-900">
                {quantity}
              </span>
              <button
                type="button"
                aria-label="Increase quantity"
                onClick={() => setQuantity((current) => current + 1)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 text-lg font-semibold text-stone-700 transition hover:border-orange-300 hover:text-orange-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-200"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-stone-100 bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 sm:px-7">
          <button
            type="button"
            onClick={handleAddToCart}
            className="flex min-h-14 w-full items-center justify-between rounded-xl bg-orange-700 px-5 text-base font-bold text-white shadow-lg shadow-orange-700/20 transition hover:bg-orange-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-300"
          >
            <span>Add to cart</span>
            <span className="tabular-nums">
              ${(calculatePrice() * quantity).toFixed(2)}
            </span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="mt-2 min-h-10 w-full text-sm font-semibold text-stone-500 transition hover:text-stone-800"
          >
            Keep browsing
          </button>
        </div>
      </section>
    </div>
  );
}