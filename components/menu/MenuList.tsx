"use client";
// This file needs "use client" because it uses useState (for the modal)
// and onClick (for button clicks). The page.tsx file does not need this,
// because it only fetches data - it never changes after loading.

import { useState } from "react";
import ItemCustomizeModal from "./ItemCustomizeModal";

type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl?: string;
};

export default function MenuList({ items }: { items: MenuItem[] }) {
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const categories = Array.from(new Set(items.map((i) => i.category)));
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredItems = items.filter((item) => {
    const matchesCategory =
      activeCategory === "All" || item.category === activeCategory;
    const matchesSearch =
      !normalizedSearch ||
      `${item.name} ${item.description}`.toLowerCase().includes(normalizedSearch);

    return matchesCategory && matchesSearch;
  });

  return (
    <>
      <div className="mb-7 space-y-5">
        <label className="relative block">
          <span className="sr-only">Search menu</span>
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <circle cx="10.8" cy="10.8" r="6.8" />
            <path d="m16 16 4.5 4.5" />
          </svg>
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search dishes..."
            className="w-full rounded-xl border border-stone-200 bg-stone-50 py-3 pl-12 pr-4 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-100"
          />
        </label>

        <nav aria-label="Filter menu by category" className="flex gap-2 overflow-x-auto pb-1">
          {["All", ...categories].map((category) => {
            const isActive = activeCategory === category;

            return (
              <button
                key={category}
                type="button"
                aria-pressed={isActive}
                onClick={() => setActiveCategory(category)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  isActive
                    ? "bg-[#1C1917] text-white"
                    : "border border-stone-200 bg-white text-stone-600 hover:border-orange-300 hover:text-orange-700"
                }`}
              >
                {category}
              </button>
            );
          })}
        </nav>
      </div>

      {filteredItems.length > 0 ? (
        <div className="grid gap-8 sm:grid-cols-2">
          {filteredItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedItem(item)}
              aria-label={`Customize ${item.name}, $${item.price.toFixed(2)}`}
              className="group flex min-h-32 w-full items-center gap-4 rounded-2xl border border-stone-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-200"
            >
              {item.imageUrl && (
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="h-24 w-24 shrink-0 rounded-xl object-cover"
                />
              )}
              {!item.imageUrl && (
                <span
                  aria-hidden="true"
                  className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-50 to-amber-100 text-orange-700"
                >
                  <svg
                    className="h-9 w-9"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M7 3v7m-3-7v4a3 3 0 0 0 6 0V3m-3 7v11" />
                    <path d="M17 3v18m0-18c2 2 3 5 3 8h-3" />
                  </svg>
                </span>
              )}
              <span className="min-w-0 flex-1 self-stretch">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-orange-700">
                  {item.category}
                </span>
                <span className="block font-bold text-stone-900 transition-colors group-hover:text-orange-700">
                  {item.name}
                </span>
                {item.description && (
                  <span className="mt-1 block text-sm leading-5 text-stone-500">
                    {item.description}
                  </span>
                )}
              </span>
              <span className="flex shrink-0 flex-col items-end gap-3 self-stretch">
                <span className="font-bold tabular-nums text-stone-900">
                  ${item.price.toFixed(2)}
                </span>
                <span
                  aria-hidden="true"
                  className="mt-auto flex h-8 w-8 items-center justify-center rounded-full bg-orange-50 text-lg font-medium text-orange-700 transition-colors group-hover:bg-orange-600 group-hover:text-white"
                >
                  +
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-6 py-12 text-center">
          <p className="font-semibold text-stone-800">
            {items.length === 0 ? "Our menu is being prepared." : "No dishes found."}
          </p>
          <p className="mt-1 text-sm text-stone-500">
            {items.length === 0
              ? "Please check back soon."
              : "Try another search or choose a different category."}
          </p>
        </div>
      )}

      {selectedItem && (
        <ItemCustomizeModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </>
  );
}