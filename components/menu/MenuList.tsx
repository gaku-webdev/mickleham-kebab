"use client";
// This file needs "use client" because it uses useState (for the modal)
// and onClick (for button clicks). The page.tsx file does not need this,
// because it only fetches data - it never changes after loading.

import { useState } from "react";
import ItemCustomizeModal from "./ItemCustomizeModal";

// This describes one menu item, matching our menu_items table.
type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
};

// This component receives the full list of items from the page,
// and handles showing them + opening the modal.
export default function MenuList({ items }: { items: MenuItem[] }) {
  // This remembers WHICH item the user clicked on.
  // If it's null, no modal is open.
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);

  // Build the list of unique categories, same as before.
  const categories = Array.from(new Set(items.map((i) => i.category)));

  return (
    <>
      {categories.map((category) => (
        <section key={category} className="mb-10">
          <h2 className="text-xl font-semibold mb-4">{category}</h2>
          <div className="grid gap-4">
            {items
              .filter((i) => i.category === category)
              .map((item) => (
                <button
                  key={item.id}
                  // Clicking an item sets it as "selected",
                  // which makes the modal appear below.
                  onClick={() => setSelectedItem(item)}
                  className="border rounded-lg p-4 flex justify-between text-left"
                >
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-gray-600">
                      {item.description}
                    </p>
                  </div>
                  <p className="font-semibold whitespace-nowrap">
                    ${item.price.toFixed(2)}
                  </p>
                </button>
              ))}
          </div>
        </section>
      ))}

      {/* Only show the modal if the user has clicked an item. */}
      {selectedItem && (
        <ItemCustomizeModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          // Setting it back to null closes the modal.
        />
      )}
    </>
  );
}