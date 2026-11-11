// This is a server-only API endpoint. The browser will call this,
// but the code inside only ever runs on the server, never in the browser.
// That's important because we use the Stripe SECRET key here.

import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabase } from "@/lib/supabase";

// This describes what the browser sends us: just a list of cart item ids
// and quantities. NOT the price - we never trust a price sent from the browser.
type IncomingItem = {
  menuItemId: string;
  quantity: number;
  // We also receive the display name (with options like "Large, extra cheese")
  // just so Stripe can show something nice on the checkout page.
  displayName: string;
};

export async function POST(request: NextRequest) {
  // Read the JSON body the browser sent us.
  const body = await request.json();
  const items: IncomingItem[] = body.items;
  const orderType: string = body.orderType;

  // If the cart is empty, there's nothing to check out.
  if (!items || items.length === 0) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }

  // ---------- Look up the REAL prices from Supabase ----------
  // We never trust a price the browser sends us. Instead, we take the
  // menuItemId for each cart line and look up today's real price.
  const menuItemIds = items.map((item) => item.menuItemId);

  const { data: menuItems, error } = await supabase
    .from("menu_items")
    .select("id, base_price")   // ← "price" を "base_price" に
    .in("id", menuItemIds);


  if (error || !menuItems) {
    return NextResponse.json(
      { error: "Could not verify menu prices" },
      { status: 500 }
    );
  }

  // ---------- Build Stripe "line items" using the verified prices ----------
  // A line item is Stripe's way of saying "this product, at this price,
  // this many times".
  const lineItems = items.map((item) => {
    // Find the real price for this specific menu item.
    const menuItem = menuItems.find((m) => m.id === item.menuItemId);

    if (!menuItem) {
      // This would only happen if the browser sent a fake/invalid id.
      throw new Error(`Menu item ${item.menuItemId} not found`);
    }

    return {
      price_data: {
        currency: "aud",
        product_data: {
          name: item.displayName,
        },
        // Stripe wants the price in CENTS, not dollars.
        // $12.50 becomes 1250.
        unit_amount: Math.round(Number(menuItem.base_price) * 100),

      },
      quantity: item.quantity,
    };
  });

  // ---------- Ask Stripe to create a checkout session ----------
  // This creates a secure, hosted payment page on Stripe's own website.
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    // After payment, Stripe will send the customer back to our site.
    // {CHECKOUT_SESSION_ID} gets replaced by Stripe with the real session id.
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/order-confirmation?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/menu`,
    // We attach the order type so we can read it back later,
    // when Stripe tells us the payment succeeded.
    metadata: {
      orderType: orderType,
    },
  });

  // Send the Stripe checkout page URL back to the browser.
  return NextResponse.json({ url: session.url });
}