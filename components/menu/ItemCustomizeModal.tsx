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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 max-w-sm w-full">
        <h2 className="text-xl font-bold mb-4">{item.name}</h2>

        {/* ---------- Size picker --------- */}
        {/* The whole block only renders if showSize is true. */}
        {/* If showSize is false, React skips this completely - */}
        {/* nothing is shown, not even an empty space. */}
        {showSize && (
          <div className="mb-4">
            <p className="font-medium mb-2">Size</p>
            <div className="flex gap-2">
              {["Regular", "Large"].map((option) => (
                <button
                  key={option}
                  onClick={() => setSize(option)}
                  className={`px-3 py-1 rounded border ${
                    size === option ? "bg-orange-600 text-white" : "bg-white"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ---------- Extra cheese checkbox ---------- */}
        {/* Only shows for food categories that make sense with cheese. */}
        {showCheese && (
          <label className="flex items-center gap-2 mb-4">
            <input
              type="checkbox"
              checked={extraCheese}
              onChange={(e) => setExtraCheese(e.target.checked)}
            />
            Extra cheese (+$1)
          </label>
        )}

        {/* ---------- Sauce dropdown -------- */}
        {/* Drinks and desserts never reach this part of the code. */}
        {showSauce && (
          <div className="mb-4">
            <p className="font-medium mb-2">Sauce</p>
            <select
              value={sauce}
              onChange={(e) => setSauce(e.target.value)}
              className="border rounded px-2 py-1 w-full"
            >
              <option>Garlic</option>
              <option>Chilli</option>
              <option>BBQ</option>
            </select>
          </div>
        )}

        {/* ------- Quantity ---------- */}
        {/* This always shows, no matter what category the item is. */}
        <div className="mb-6 flex items-center gap-3">
          <p className="font-medium">Quantity</p>
          <button
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="border rounded w-8 h-8"
          >
            -
          </button>
          <span>{quantity}</span>
          <button
            onClick={() => setQuantity((q) => q + 1)}
            className="border rounded w-8 h-8"
          >
            +
          </button>
        </div>

        {/* -------- Buttons ---------- */}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 border rounded py-2">
            Cancel
          </button>
          <button
            onClick={handleAddToCart}
            className="flex-1 bg-orange-600 text-white rounded py-2"
          >
            Add to Cart - ${(calculatePrice() * quantity).toFixed(2)}
          </button>
        </div>
      </div>
    </div>
  );
}