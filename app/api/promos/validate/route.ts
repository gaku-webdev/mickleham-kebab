import { NextRequest, NextResponse } from "next/server";
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
    !("code" in body) ||
    typeof body.code !== "string" ||
    !("items" in body) ||
    !Array.isArray(body.items) ||
    body.items.length === 0 ||
    body.items.length > 100
  ) {
    return NextResponse.json(
      { error: "Enter a promo code and a valid cart." },
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
        typeof item.displayName !== "string"
    )
  ) {
    return NextResponse.json(
      { error: "The cart contains an invalid item." },
      { status: 400 }
    );
  }

  const { data, error } = await validatePromoForCheckout(body.code, items);
  if (error || !data) {
    return NextResponse.json(
      { error: error ?? "Could not apply this promo code." },
      { status: 400 }
    );
  }

  const subtotalCents = data.cartItems.reduce(
    (sum, item) => sum + item.unitAmountCents * item.quantity,
    0
  );
  return NextResponse.json({
    code: data.promo.code,
    title: data.promo.title,
    subtotalCents,
    eligibleSubtotalCents: data.eligibleSubtotalCents,
    discountCents: data.discountCents,
    totalCents: subtotalCents - data.discountCents,
  });
}
