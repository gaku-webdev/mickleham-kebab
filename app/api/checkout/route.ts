// This is a server-only API endpoint. The browser will call this,
// but the code inside only ever runs on the server, never in the browser.
// That's important because we use the Stripe SECRET key here.

import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabase } from "@/lib/supabase";
import {
  validatePromoForCheckout,
  type CheckoutItemInput,
} from "@/lib/promo-checkout";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("items" in body) ||
    !Array.isArray(body.items) ||
    body.items.length === 0 ||
    body.items.length > 100 ||
    !("orderType" in body) ||
    (body.orderType !== "Takeaway" && body.orderType !== "Dine-In")
  ) {
    return NextResponse.json(
      { error: "The cart or order type is invalid." },
      { status: 400 }
    );
  }

  const items = body.items as CheckoutItemInput[];
  if (
    items.some(
      (item) =>
        !item ||
        typeof item.menuItemId !== "string" ||
        !item.menuItemId ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 99 ||
        typeof item.displayName !== "string" ||
        !item.displayName.trim() ||
        item.displayName.length > 200
    )
  ) {
    return NextResponse.json(
      { error: "The cart contains an invalid item." },
      { status: 400 }
    );
  }

  const orderType = body.orderType;
  const menuItemIds = items.map((item) => item.menuItemId);
  let lineItems: {
    price_data: {
      currency: "aud";
      product_data: { name: string };
      unit_amount: number;
    };
    quantity: number;
  }[];
  let promoMetadata: Record<string, string> = {};

  const promoCode =
    "promoCode" in body && typeof body.promoCode === "string"
      ? body.promoCode.trim()
      : "";

  if (promoCode) {
    const { data: validatedPromo, error: promoError } =
      await validatePromoForCheckout(promoCode, items);
    if (promoError || !validatedPromo) {
      return NextResponse.json(
        { error: promoError ?? "Could not apply this promo code." },
        { status: 400 }
      );
    }

    lineItems = validatedPromo.discountedItems.map((item) => ({
      price_data: {
        currency: "aud",
        product_data: {
          name: item.displayName,
        },
        unit_amount: item.unitAmountCents,
      },
      quantity: item.quantity,
    }));
    promoMetadata = {
      promoCode: validatedPromo.promo.code,
      promoDiscountCents: String(validatedPromo.discountCents),
    };
  } else {
    const { data: menuItems, error } = await supabase
      .from("menu_items")
      .select("id, base_price")
      .in("id", menuItemIds);

    if (error || !menuItems) {
      return NextResponse.json(
        { error: "Could not verify menu prices" },
        { status: 500 }
      );
    }

    const knownItems = items.flatMap((item) => {
      const menuItem = menuItems.find(
        (candidate) => candidate.id === item.menuItemId
      );
      return menuItem ? [{ item, menuItem }] : [];
    });
    if (knownItems.length !== items.length) {
      return NextResponse.json(
        { error: "A menu item in your cart is no longer available." },
        { status: 400 }
      );
    }

    lineItems = knownItems.map(({ item, menuItem }) => {
      return {
        price_data: {
          currency: "aud" as const,
          product_data: { name: item.displayName },
          unit_amount: Math.round(Number(menuItem.base_price) * 100),
        },
        quantity: item.quantity,
      };
    });
  }

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
      ...promoMetadata,
    },
  });

  // Send the Stripe checkout page URL back to the browser.
  return NextResponse.json({ url: session.url });
}