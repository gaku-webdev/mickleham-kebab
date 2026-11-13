"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import ItemCustomizeModal from "./ItemCustomizeModal";

type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl?: string;
};

const categoryGroups = [
  { label: "Meal Deals", matches: /meal deal|combo|kids meal/i },
  { label: "Kebabs", matches: /kebab/i },
  { label: "Burgers", matches: /burger/i },
  { label: "Grill Meals & Rice", matches: /grill|rice|biryani/i },
  { label: "Pide & HSP", matches: /pide|hsp/i },
  { label: "Sides & Wings", matches: /side|wing|extra|bread|salad|dip|container/i },
  { label: "Desserts & Shakes", matches: /dessert|shake/i },
  { label: "Drinks", matches: /drink|beverage/i },
];

function getCategoryGroup(category: string) {
  return categoryGroups.find((group) => group.matches.test(category))?.label;
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9A8B7D]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="10.8" cy="10.8" r="6.8" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  );
}

function OrderSummary({
  items,
  total,
}: {
  items: ReturnType<typeof useCart>["items"];
  total: number;
}) {
  const { orderType } = useCart();
  const itemCount = items.reduce((count, item) => count + item.quantity, 0);

  return (
    <aside className="hidden min-[700px]:block">
      <div className="sticky top-24 rounded-xl border border-[#E8DED2] bg-white p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-[#29231F]">Your order</h2>
          <span className="text-[11px] text-[#8B7D70]">
            {orderType ?? "Takeaway"}
          </span>
        </div>

        {items.length > 0 ? (
          <ul className="max-h-64 space-y-3 overflow-y-auto">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-3 text-xs"
              >
                <span className="min-w-0">
                  <span className="block font-semibold text-[#29231F]">
                    {item.quantity}× {item.name}
                  </span>
                  <span className="mt-0.5 block truncate text-[10px] text-[#8B7D70]">
                    {item.price.toFixed(2)} each
                  </span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-[#29231F]">
                  ${(item.price * item.quantity).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-2 text-xs leading-5 text-[#8B7D70]">
            Add an item to start your order.
          </p>
        )}

        <div className="mt-4 flex items-center justify-between border-t border-[#EEE7DF] pt-3 text-sm font-bold text-[#29231F]">
          <span>{itemCount > 0 ? "Subtotal" : "Total"}</span>
          <span className="tabular-nums">${total.toFixed(2)}</span>
        </div>
        <Link
          href={items.length > 0 ? "/checkout" : "/menu"}
          className={`mt-3 flex min-h-10 w-full items-center justify-center rounded-lg px-3 text-xs font-bold text-white transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-200 ${
            items.length > 0
              ? "bg-[#C9431D] hover:bg-[#A93417]"
              : "bg-stone-300"
          }`}
          aria-disabled={items.length === 0}
          tabIndex={items.length === 0 ? -1 : undefined}
        >
          {items.length > 0 ? "Go to checkout" : "Your order is empty"}
        </Link>
      </div>
    </aside>
  );
}

export default function MenuList({ items }: { items: MenuItem[] }) {
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const categories = Array.from(new Set(items.map((item) => item.category))).filter(
    Boolean
  );
  const categoryTabs = [
    ...categoryGroups
      .filter((group) => categories.some((category) => group.matches.test(category)))
      .map((group) => group.label),
    ...categories.filter((category) => !getCategoryGroup(category)),
  ];
  const initialCategory = categoryTabs.includes("Kebabs")
    ? "Kebabs"
    : categoryTabs[0] ?? "All";
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [searchTerm, setSearchTerm] = useState("");
  const { items: cartItems, total, setIsCartOpen } = useCart();
  const cartItemCount = cartItems.reduce(
    (count, item) => count + item.quantity,
    0
  );
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredItems = items.filter((item) => {
    const matchesCategory =
      activeCategory === "All" ||
      getCategoryGroup(item.category) === activeCategory ||
      item.category === activeCategory;
    const matchesSearch =
      !normalizedSearch ||
      `${item.name} ${item.description}`.toLowerCase().includes(normalizedSearch);

    return matchesCategory && matchesSearch;
  });

  return (
    <>
      <section aria-label="Menu">
        <div className="flex flex-col justify-between gap-4 py-5 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[#29231F]">
              Menu
            </h1>
            <p className="mt-1 text-xs text-[#786B5E]">
              Pickup in about 20 minutes · All prices in AUD
            </p>
          </div>
          <label className="relative block w-full sm:max-w-xs">
            <span className="sr-only">Search the menu</span>
            <SearchIcon />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search the menu"
              className="h-10 w-full rounded-lg border border-[#E2D6C9] bg-white pl-10 pr-3 text-xs text-[#29231F] outline-none transition placeholder:text-[#9A8B7D] focus:border-[#C2410C] focus:ring-2 focus:ring-orange-100"
            />
          </label>
        </div>

        <nav
          aria-label="Filter menu by category"
          className="-mx-4 flex gap-5 overflow-x-auto border-b border-[#E8DED2] px-4 sm:mx-0 sm:gap-6 sm:px-0"
        >
          {categoryTabs.map((category) => {
            const isActive = activeCategory === category;

            return (
              <button
                key={category}
                type="button"
                aria-pressed={isActive}
                onClick={() => setActiveCategory(category)}
                className={`relative min-h-10 shrink-0 whitespace-nowrap text-[11px] font-semibold transition-colors ${
                  isActive
                    ? "text-[#B93818]"
                    : "text-[#51473E] hover:text-[#B93818]"
                }`}
              >
                {category}
                {isActive && (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[#C9431D]" />
                )}
              </button>
            );
          })}
        </nav>

        <div className="grid gap-5 pt-4 min-[700px]:grid-cols-[minmax(0,1fr)_185px]">
          <div>
            <div className="mb-3 flex min-h-6 items-center justify-between gap-3">
              <h2 className="text-sm font-extrabold text-[#29231F]">
                {activeCategory === "All" ? "All items" : activeCategory}
              </h2>
              <span className="text-[10px] text-[#786B5E]">
                Freshly prepared
              </span>
            </div>

            {filteredItems.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {filteredItems.map((item) => {
                  const isVegetarian =
                    /falafel|veggie|vegetarian/i.test(
                      `${item.name} ${item.description}`
                    );

                  return (
                    <article
                      key={item.id}
                      className="group overflow-hidden rounded-xl border border-[#E8DED2] bg-white transition hover:-translate-y-0.5 hover:border-[#D9BBA7] hover:shadow-md"
                    >
                      <div className="relative aspect-[1.55] overflow-hidden bg-[#EDE3D7]">
                        <span className="absolute inset-0 flex items-center justify-center px-3 text-center font-mono text-[9px] tracking-wide text-[#9A8B7D]">
                          photo — {item.name}
                        </span>
                        {item.imageUrl && (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                            onError={(event) => event.currentTarget.remove()}
                          />
                        )}
                      </div>
                      <div className="flex min-h-[104px] flex-col p-3">
                        {isVegetarian && (
                          <span className="mb-1.5 w-fit rounded-full bg-[#E4F3E8] px-1.5 py-0.5 text-[8px] font-bold text-[#398052]">
                            Vegetarian
                          </span>
                        )}
                        <h3 className="text-[11px] font-bold leading-4 text-[#29231F]">
                          {item.name}
                        </h3>
                        {item.description && (
                          <p className="mt-1 line-clamp-2 text-[9px] leading-[1.45] text-[#786B5E]">
                            {item.description}
                          </p>
                        )}
                        <div className="mt-auto flex items-end justify-between pt-2">
                          <span className="text-[11px] font-extrabold tabular-nums text-[#29231F]">
                            ${item.price.toFixed(2)}
                          </span>
                          <button
                            type="button"
                            onClick={() => setSelectedItem(item)}
                            aria-label={`Add ${item.name} to your order`}
                            className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#C9431D] text-lg leading-none text-white transition hover:bg-[#A93417] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-200"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[#DCCFC2] bg-white px-5 py-10 text-center">
                <p className="text-sm font-semibold text-[#29231F]">
                  {items.length === 0
                    ? "Our menu is being prepared."
                    : "No dishes found."}
                </p>
                <p className="mt-1 text-xs text-[#786B5E]">
                  {items.length === 0
                    ? "Please check back soon."
                    : "Try another search or category."}
                </p>
              </div>
            )}
          </div>

          <OrderSummary items={cartItems} total={total} />
        </div>
      </section>

      {selectedItem && (
        <ItemCustomizeModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}

      {cartItemCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#E8DED2] bg-[#FAF7F2]/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(41,35,31,0.12)] backdrop-blur min-[700px]:hidden">
          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            className="flex min-h-11 w-full items-center justify-between gap-4 rounded-lg bg-[#C9431D] px-4 text-left text-white transition hover:bg-[#A93417] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-200"
          >
            <span className="text-xs font-bold">
              View order · {cartItemCount}{" "}
              {cartItemCount === 1 ? "item" : "items"}
            </span>
            <span className="text-xs font-extrabold tabular-nums">
              ${total.toFixed(2)}
            </span>
          </button>
        </div>
      )}
    </>
  );
}
