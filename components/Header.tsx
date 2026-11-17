"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/lib/auth-context";
import CartDrawer from "./cart/CartDrawer";
import MobileNav from "./MobileNav";
import { NAV_LINKS, isActivePath } from "./nav-links";

const MOBILE_NAV_ID = "mobile-nav";

export default function Header() {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const pathname = usePathname();
  const { items, total, isCartOpen, setIsCartOpen } = useCart();
  const { user, profile, isAdmin, signOut } = useAuth();
  const hasStaffAccess = profile?.role_id === 2 || profile?.role_id === 3;
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  // Close menus whenever the page changes (e.g. browser back/forward).
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setIsMobileNavOpen(false);
    setIsUserMenuOpen(false);
  }

  const closeMobileNav = useCallback(() => setIsMobileNavOpen(false), []);

  const navLinkClass = (href: string) =>
    isActivePath(pathname, href)
      ? "font-semibold text-[#C2410C]"
      : "text-gray-700 transition-colors hover:text-[#C2410C]";

  const displayName =
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "Account";

  if (pathname === "/checkout") {
    return (
      <header className="sticky top-0 z-40 w-full border-b border-[#EBE6DD] bg-white px-4 py-3.5 sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#C2410C] text-[10px] font-extrabold text-white">
              MK
            </span>
            <span className="text-sm font-extrabold text-[#29231F]">
              Mickleham Kebab &amp; Grill
            </span>
          </Link>
          <Link
            href="/menu"
            className="text-xs font-semibold text-[#C2410C] hover:text-[#9A3412] sm:text-sm"
          >
            ← Back to menu
          </Link>
        </div>
      </header>
    );
  }

  const dropdownItemClass =
    "flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-gray-700 hover:bg-orange-50 hover:text-orange-700 transition-colors";

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-[#EBE6DD] bg-[#FAF7F2] px-4 py-3.5 sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#EA580C] text-white shadow-xs">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M12.963 2.286a.75.75 0 0 0-1.071-.136 9.742 9.742 0 0 0-3.539 6.177 7.547 7.547 0 0 1-1.705-1.715.75.75 0 0 0-1.152-.082A9 9 0 1 0 15.68 4.534a7.46 7.46 0 0 1-2.717-2.248ZM15.75 14.25a3.75 3.75 0 1 1-7.313-1.172c.628.465 1.35.81 2.133 1a5.99 5.99 0 0 1 1.925-3.546 3.75 3.75 0 0 1 3.255 3.718Z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-extrabold tracking-wider text-[#1C1917] sm:text-base">
                MICKLEHAM
              </span>
              <span className="text-[9px] font-bold tracking-widest text-[#EA580C] sm:text-[10px]">
                KEBAB &amp; GRILL
              </span>
            </div>
          </Link>

          {/* Desktop nav links */}
          <nav
            aria-label="Main"
            className="hidden items-center gap-6 text-sm font-medium md:flex lg:gap-8"
          >
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`${navLinkClass(link.href)} whitespace-nowrap`}
                aria-current={isActivePath(pathname, link.href) ? "page" : undefined}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right action area */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Cart Button */}
            <button
              type="button"
              aria-label={`Open cart${itemCount > 0 ? ` with ${itemCount} items, $${total.toFixed(2)}` : ", empty"}`}
              aria-expanded={isCartOpen}
              onClick={() => setIsCartOpen(true)}
              className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 transition-colors ${
                itemCount > 0
                  ? "border-[#C2410C] bg-[#C2410C] text-white shadow-sm hover:bg-[#9A3412]"
                  : "border-[#E7DED4] bg-white text-[#29231F] hover:border-[#C2410C]"
              }`}
            >
              <span aria-hidden="true" className="text-lg">🛒</span>
              <span className="hidden text-xs font-bold sm:inline">Cart</span>
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-extrabold text-[#C2410C]">
                {itemCount}
              </span>
            </button>

            {/* Desktop account area */}
            <div className="hidden md:block">
              {user ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    aria-expanded={isUserMenuOpen}
                    aria-haspopup="menu"
                    className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 shadow-2xs transition-colors hover:bg-gray-50"
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-[11px] font-extrabold uppercase text-orange-700">
                      {displayName.charAt(0)}
                    </div>
                    <span className="max-w-[110px] truncate">{displayName}</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-3.5 w-3.5 text-gray-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>

                  {isUserMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsUserMenuOpen(false)}
                      />
                      <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-gray-150 bg-white py-1.5 shadow-lg animate-in fade-in zoom-in-95 duration-100">
                        <div className="border-b border-gray-100 px-3.5 py-2">
                          <p className="truncate text-xs font-bold text-gray-900">
                            {displayName}
                          </p>
                          <p className="truncate text-[11px] text-gray-500">
                            {user.email}
                          </p>
                        </div>

                        <Link
                          href="/orders"
                          onClick={() => setIsUserMenuOpen(false)}
                          className={dropdownItemClass}
                        >
                          <span className="text-base">📦</span> My Orders
                        </Link>
                        <Link
                          href="/reservations"
                          onClick={() => setIsUserMenuOpen(false)}
                          className={dropdownItemClass}
                        >
                          <span className="text-base">📅</span> My Reservations
                        </Link>

                        {hasStaffAccess && (
                          <div className="mt-1 border-t border-gray-100 pt-1">
                            <Link
                              href="/staff"
                              onClick={() => setIsUserMenuOpen(false)}
                              className={dropdownItemClass}
                            >
                              <span className="text-base">🧑‍🍳</span> Staff board
                            </Link>
                            {isAdmin && (
                              <Link
                                href="/admin"
                                onClick={() => setIsUserMenuOpen(false)}
                                className={dropdownItemClass}
                              >
                                <span className="text-base">⚙️</span> Admin
                              </Link>
                            )}
                          </div>
                        )}

                        <div className="mt-1 border-t border-gray-100 pt-1">
                          <button
                            type="button"
                            onClick={async () => {
                              setIsUserMenuOpen(false);
                              await signOut();
                            }}
                            className="flex w-full cursor-pointer items-center gap-2 px-3.5 py-2 text-left text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-4 w-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                              aria-hidden="true"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                              />
                            </svg>
                            Sign Out
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <Link
                  href="/login"
                  className="flex min-h-11 items-center whitespace-nowrap rounded-xl bg-[#1C1917] px-4 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-black"
                >
                  Sign in
                </Link>
              )}
            </div>

            {/* Mobile hamburger */}
            <button
              type="button"
              onClick={() => setIsMobileNavOpen((open) => !open)}
              aria-expanded={isMobileNavOpen}
              aria-controls={MOBILE_NAV_ID}
              aria-label={isMobileNavOpen ? "Close menu" : "Open menu"}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#E7DED4] bg-white text-[#1C1917] transition-colors hover:border-[#C2410C] md:hidden"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                {isMobileNavOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        <MobileNav
          id={MOBILE_NAV_ID}
          isOpen={isMobileNavOpen}
          onClose={closeMobileNav}
          pathname={pathname}
          isSignedIn={Boolean(user)}
          displayName={displayName}
          email={user?.email}
          hasStaffAccess={hasStaffAccess}
          isAdmin={isAdmin}
          onSignOut={signOut}
        />
      </header>
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </>
  );
}
