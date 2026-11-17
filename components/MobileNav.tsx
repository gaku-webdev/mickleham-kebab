"use client";

import { useEffect } from "react";
import Link from "next/link";
import { NAV_LINKS, isActivePath } from "./nav-links";

interface MobileNavProps {
  id: string;
  isOpen: boolean;
  onClose: () => void;
  pathname: string;
  isSignedIn: boolean;
  displayName: string;
  email?: string;
  hasStaffAccess: boolean;
  isAdmin: boolean;
  onSignOut: () => Promise<unknown>;
}

// Full-width panel that drops down under the header on small screens (< md).
export default function MobileNav({
  id,
  isOpen,
  onClose,
  pathname,
  isSignedIn,
  displayName,
  email,
  hasStaffAccess,
  isAdmin,
  onSignOut,
}: MobileNavProps) {
  // Close with Escape, and stop the page behind from scrolling while open.
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const linkClass = (href: string) =>
    `flex min-h-12 items-center rounded-lg px-3 text-base font-semibold transition-colors ${
      isActivePath(pathname, href)
        ? "bg-orange-50 text-[#C2410C]"
        : "text-[#1C1917] hover:bg-[#F3EEE6]"
    }`;

  return (
    <div className="md:hidden">
      {/* Backdrop - tap outside the panel to close */}
      <div
        className="fixed inset-0 top-16 z-30 bg-black/30"
        onClick={onClose}
        aria-hidden="true"
      />

      <nav
        id={id}
        aria-label="Main menu"
        className="absolute inset-x-0 top-full z-40 max-h-[calc(100dvh-4rem)] overflow-y-auto border-b border-[#EBE6DD] bg-[#FAF7F2] px-4 pb-6 pt-2 shadow-lg"
      >
        <ul className="flex flex-col gap-1">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                onClick={onClose}
                className={linkClass(link.href)}
                aria-current={isActivePath(pathname, link.href) ? "page" : undefined}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-4 border-t border-[#EBE6DD] pt-4">
          {isSignedIn ? (
            <>
              <div className="px-3 pb-3">
                <p className="truncate text-sm font-bold text-[#1C1917]">
                  {displayName}
                </p>
                {email && (
                  <p className="truncate text-xs text-gray-500">{email}</p>
                )}
              </div>
              <ul className="flex flex-col gap-1">
                <li>
                  <Link href="/orders" onClick={onClose} className={linkClass("/orders")}>
                    My Orders
                  </Link>
                </li>
                <li>
                  <Link
                    href="/reservations"
                    onClick={onClose}
                    className={linkClass("/reservations")}
                  >
                    My Reservations
                  </Link>
                </li>
                {hasStaffAccess && (
                  <li>
                    <Link href="/staff" onClick={onClose} className={linkClass("/staff")}>
                      Staff board
                    </Link>
                  </li>
                )}
                {isAdmin && (
                  <li>
                    <Link href="/admin" onClick={onClose} className={linkClass("/admin")}>
                      Admin
                    </Link>
                  </li>
                )}
              </ul>
              <button
                type="button"
                onClick={async () => {
                  onClose();
                  await onSignOut();
                }}
                className="mt-3 flex min-h-12 w-full items-center rounded-lg px-3 text-left text-base font-semibold text-red-600 transition-colors hover:bg-red-50"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              onClick={onClose}
              className="flex min-h-12 w-full items-center justify-center rounded-lg bg-[#1C1917] px-4 text-base font-semibold text-white transition-colors hover:bg-black"
            >
              Sign in
            </Link>
          )}
        </div>
      </nav>
    </div>
  );
}
