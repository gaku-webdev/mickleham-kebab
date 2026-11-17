// Main site navigation, shared by the desktop header and the mobile menu.
export const NAV_LINKS = [
  { href: "/menu", label: "Menu" },
  { href: "/reservation", label: "Reservations" },
  { href: "/store-info", label: "Store Info" },
] as const;

export function isActivePath(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
