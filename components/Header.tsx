"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/context/CartContext";
import CartDrawer from "./cart/CartDrawer";

export default function Header() {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const pathname = usePathname();
  const { items } = useCart();
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const navLinkClass = (href: string) => {
    const isActive =
      href === "/" ? pathname === "/" : pathname.startsWith(href);

    return isActive
      ? "border border-gray-800 text-black px-3 py-1 rounded-md font-semibold"
      : "text-gray-700 hover:text-black transition-colors";
  };

  return (
    <>
      <header className="w-full bg-[#FAF7F2] border-b border-[#EBE6DD] px-4 sm:px-8 py-3.5 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[#EA580C] flex items-center justify-center text-white shadow-xs">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-5 h-5"
              >
                <path
                  fillRule="evenodd"
                  d="M12.963 2.286a.75.75 0 0 0-1.071-.136 9.742 9.742 0 0 0-3.539 6.177 7.547 7.547 0 0 1-1.705-1.715.75.75 0 0 0-1.152-.082A9 9 0 1 0 15.68 4.534a7.46 7.46 0 0 0-2.717-2.248ZM15.75 14.25a3.75 3.75 0 1 1-7.313-1.172c.628.465 1.35.81 2.133 1a5.99 5.99 0 0 1 1.925-3.546 3.75 3.75 0 0 1 3.255 3.718Z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-extrabold text-sm sm:text-base tracking-wider text-[#1C1917]">
                MICKLEHAM
              </span>
              <span className="font-bold text-[9px] sm:text-[10px] tracking-widest text-[#EA580C]">
                KEBAB &amp; GRILL
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-700">
            <Link href="/" className={navLinkClass("/")}>
              Home
            </Link>
            <Link href="/menu" className={navLinkClass("/menu")}>
              Menu
            </Link>
            <Link href="/reservation" className={navLinkClass("/reservation")}>
              Book Table
            </Link>
            <span className="text-gray-500 cursor-pointer hover:text-black transition-colors">
              Meal Deals
            </span>
            <span className="text-gray-500 cursor-pointer hover:text-black transition-colors">
              Our Story
            </span>
            <span className="text-gray-500 cursor-pointer hover:text-black transition-colors">
              Find Us
            </span>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/menu"
              className="bg-[#C2410C] hover:bg-[#9A3412] text-white px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors shadow-xs"
            >
              Order Online
            </Link>
            <button
              type="button"
              aria-label={`Open cart${itemCount > 0 ? ` with ${itemCount} items` : ""}`}
              onClick={() => setIsCartOpen(true)}
              className="relative text-lg"
            >
              🛒
              {itemCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-orange-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </>
  );
}
