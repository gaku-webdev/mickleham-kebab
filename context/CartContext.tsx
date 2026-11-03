"use client";
// This file runs in the browser, not on the server.
// We need this because the cart changes when the user clicks buttons.

import { createContext, useContext, useState, ReactNode } from "react";

// This describes what one item in the cart looks like.
type CartItem = {
  id: string;        // A unique id for this item + its options
  menuItemId: string; // The original id from the menu_items table
  name: string;
  price: number;
  quantity: number;
};

// This describes everything the cart can do.
type CartContextType = {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  total: number;
};

// Create an empty "box" that will hold the cart.
// Every page in the app can read from this box later.
const CartContext = createContext<CartContextType | null>(null);

// This component holds the real cart data.
// We will wrap the whole app with this, so every page can see the cart.
export function CartProvider({ children }: { children: ReactNode }) {
  // items = the list of things in the cart. Starts empty.
  const [items, setItems] = useState<CartItem[]>([]);

  // Add an item to the cart.
  function addItem(newItem: CartItem) {
    setItems((prev) => {
      // Check if this exact item is already in the cart.
      const existing = prev.find((i) => i.id === newItem.id);

      if (existing) {
        // If it's already there, just increase the quantity.
        // We make a NEW array instead of changing the old one directly.
        return prev.map((i) =>
          i.id === newItem.id
            ? { ...i, quantity: i.quantity + newItem.quantity }
            : i
        );
      }

      // If it's a new item, add it to the end of the list.
      return [...prev, newItem];
    });
  }

  // Remove an item from the cart completely.
  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  // Change how many of an item are in the cart.
  function updateQuantity(id: string, quantity: number) {
    // If the new quantity is 0 or less, just remove the item.
    if (quantity <= 0) {
      removeItem(id);
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, quantity } : i))
    );
  }

  // Add up the price of everything in the cart.
  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  // Share the cart data and functions with every page inside <CartProvider>.
  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, updateQuantity, total }}
    >
      {children}
    </CartContext.Provider>
  );
}

// This is how other pages will use the cart.
// Example: const { items, addItem } = useCart();
export function useCart() {
  const context = useContext(CartContext);
  // If someone tries to use this outside of CartProvider, show an error.
  if (!context) throw new Error("useCart must be used inside CartProvider");
  return context;
}