"use client";
// We need "use client" because this uses useCart (state) and a click to open the drawer.

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import CartDrawer from "./cart/CartDrawer";

export default function Header() {
  // This remembers whether the cart drawer is open or closed.
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Get the cart items, so we can count how many are in it.
  const { items } = useCart();

  // Add up all the quantities to get a total item count.
  // Example: 2 kebabs + 1 drink = 3, even though there are only 2 cart lines.
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <>
      <header className="border-b px-4 sm:px-8 py-3.5 sticky top-0 bg-white z-30">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-bold text-lg">
            Mickleham Kebab & Grill
          </Link>

          <nav className="flex items-center gap-6">
            <Link href="/menu">Menu</Link>
            <Link href="/reservation">Book Table</Link>

            {/* Cart button with a badge showing how many items are inside. */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative"
            >
              🛒
              {/* Only show the badge number if there's at least 1 item. */}
              {itemCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-orange-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </button>
          </nav>
        </div>
      </header>

      {/* The drawer itself. It only shows its content when isCartOpen is true, */}
      {/* but we always render <CartDrawer> so it can slide in/out smoothly. */}
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </>
  );
}