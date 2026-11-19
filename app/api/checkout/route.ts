// This is a server-only API endpoint. The browser will call this,
// but the code inside only ever runs on the server, never in the browser.
// That's important because we use the Stripe SECRET key here.

import { NextRequest, NextResponse } from "next/server";
import { stripe, isStripeConfigured } from "@/lib/stripe";
import {
  getPricedCheckoutItems,
  validatePromoForCheckout,
  type CheckoutItemInput,
} from "@/lib/promo-checkout";

export async function POST(request: NextRequest) {
  if (!isStripeConfigured) {
    return NextResponse.json(
      {
        error:
          "Stripe card payments are not configured. Please add STRIPE_SECRET_KEY to your .env.local file.",
      },
      { status: 503 }
    );
  }

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
        item.displayName.length > 200 ||
        (item.selectedOptionIds !== undefined &&
          (!Array.isArray(item.selectedOptionIds) ||
            item.selectedOptionIds.length > 100 ||
            item.selectedOptionIds.some(
              (option) =>
                typeof option !== "string" ||
                !option.trim() ||
                option.length > 100
            )))
    )
  ) {
    return NextResponse.json(
      { error: "The cart contains an invalid item." },
      { status: 400 }
    );
  }

  const orderType = body.orderType;
  const customer =
    "customer" in body &&
    typeof body.customer === "object" &&
    body.customer !== null
      ? body.customer
      : null;
  const customerName =
    customer && "name" in customer && typeof customer.name === "string"
      ? customer.name.trim()
      : "";
  const customerPhone =
    customer && "phone" in customer && typeof customer.phone === "string"
      ? customer.phone.trim()
      : "";
  const customerEmail =
    customer && "email" in customer && typeof customer.email === "string"
      ? customer.email.trim()
      : "";

  if (
    !customerName ||
    customerName.length > 100 ||
    !/^[0-9+()\-\s]{8,20}$/.test(customerPhone) ||
    customerPhone.replace(/\D/g, "").length < 8 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)
  ) {
    return NextResponse.json(
      { error: "Enter a valid name, phone number, and email address." },
      { status: 400 }
    );
  }
  const pickupTime =
    "pickupTime" in body && typeof body.pickupTime === "string"
      ? body.pickupTime.trim()
      : "";
  const tableNumber =
    "tableNumber" in body && typeof body.tableNumber === "string"
      ? body.tableNumber.trim()
      : "";
  const guestCount =
    "guestCount" in body && Number.isInteger(body.guestCount)
      ? Number(body.guestCount)
      : 0;

  if (
    (orderType === "Takeaway" &&
      (!pickupTime || pickupTime.length > 80)) ||
    (orderType === "Dine-In" &&
      (!tableNumber || tableNumber.length > 20 || guestCount < 1 || guestCount > 30))
  ) {
    return NextResponse.json(
      { error: "Enter valid pickup or dine-in details." },
      { status: 400 }
    );
  }

  let lineItems: {
    price_data: {
      currency: "aud";
      product_data: { name: string };
      unit_amount: number;
    };
    quantity: number;
  }[];
  let promoMetadata: Record<string, string> = {};
  let stripeDiscountAmountCents = 0;
  let subtotalBeforeDiscountCents = 0;

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

    subtotalBeforeDiscountCents = validatedPromo.cartItems.reduce(
      (subtotal, item) =>
        subtotal + item.unitAmountCents * item.quantity,
      0
    );
    stripeDiscountAmountCents = validatedPromo.discountCents;
    lineItems = validatedPromo.cartItems.map((item) => ({
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
      promoId: validatedPromo.promo.id,
      promoCode: validatedPromo.promo.code,
      promoDiscountCents: String(validatedPromo.discountCents),
    };
  } else {
    const { items: pricedItems, error: pricingError } =
      await getPricedCheckoutItems(items);
    if (pricingError || !pricedItems) {
      return NextResponse.json(
        { error: pricingError ?? "Could not verify menu prices." },
        { status: 400 }
      );
    }

    lineItems = pricedItems.map((item) => {
      subtotalBeforeDiscountCents += item.unitAmountCents * item.quantity;
      return {
        price_data: {
          currency: "aud" as const,
          product_data: { name: item.displayName },
          unit_amount: item.unitAmountCents,
        },
        quantity: item.quantity,
      };
    });
  }

  // ---------- Ask Stripe to create a checkout session ----------
  // This creates a secure, hosted payment page on Stripe's own website.
  const origin =
    request.headers.get("origin") ||
    request.nextUrl.origin ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";

  try {
    const discounts =
      stripeDiscountAmountCents > 0
        ? [
            {
              coupon: (
                await stripe.coupons.create({
                  amount_off: stripeDiscountAmountCents,
                  currency: "aud",
                  duration: "once",
                })
              ).id,
            },
          ]
        : undefined;
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      discounts,
      customer_email: customerEmail,
      phone_number_collection: { enabled: true },
      success_url: `${origin}/order-confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/menu`,
      metadata: {
        orderType: orderType,
        customerName,
        customerPhone,
        customerEmail,
        subtotalBeforeDiscountCents: String(subtotalBeforeDiscountCents),
        pickupTime,
        tableNumber,
        guestCount: guestCount ? String(guestCount) : "",
        ...promoMetadata,
      },
    });

    // Send the Stripe checkout page URL back to the browser.
    return NextResponse.json({ url: session.url });
  } catch (stripeErr: unknown) {
    console.error("Stripe Checkout Error:", stripeErr);
    const message =
      stripeErr instanceof Error
        ? stripeErr.message
        : "Failed to create Stripe payment session.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}