// This is a special API route that only Stripe's servers call directly.
// It is NOT called by our own browser code.

import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import Stripe from "stripe";

export async function POST(request: NextRequest) {
  // We need the RAW text of the request body (not parsed JSON),
  // because Stripe's signature check needs the exact original bytes.
  const body = await request.text();

  // Stripe sends a special header to prove the request really came
  // from Stripe, and not from someone pretending to be Stripe.
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    // This checks the signature using our webhook secret.
    // If someone faked this request, this line will throw an error.
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    // If the signature doesn't match, we reject the request completely.
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // We only care about ONE type of event: a successful checkout.
  // Stripe sends many other event types we can ignore for now.
  if (event.type === "checkout.session.completed") {
    let supabaseAdmin;
    try {
      supabaseAdmin = getSupabaseAdmin();
    } catch (error) {
      console.error("Could not initialize Supabase admin client:", error);
      return NextResponse.json(
        { error: "Server database configuration is incomplete." },
        { status: 500 }
      );
    }

    const session = event.data.object as Stripe.Checkout.Session;

    const lineItems = await stripe.checkout.sessions.listLineItems(
      session.id
    );
    const existingOrder = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("stripe_session_id", session.id)
      .maybeSingle();

    if (existingOrder.error) {
      console.error("Failed to check for an existing order:", existingOrder.error);
      return NextResponse.json(
        { error: "Could not check the saved order." },
        { status: 500 }
      );
    }

    const orderNumber = `MKG-${Math.floor(1000 + Math.random() * 9000)}`;
    const orderDetails = [
      session.metadata?.customerNote ?? "",
    ]
      .filter(Boolean)
      .join(" · ");

    let orderId = existingOrder.data?.id;
    if (!orderId) {
      const { data: newOrder, error: orderError } = await supabaseAdmin
        .from("orders")
        .insert({
          order_number: orderNumber,
          customer_name:
            session.metadata?.customerName ??
            session.customer_details?.name ??
            "Guest",
          customer_email:
            session.customer_details?.email ??
            session.metadata?.customerEmail ??
            "",
          customer_phone:
            session.customer_details?.phone ??
            session.metadata?.customerPhone ??
            "",
          order_type: session.metadata?.orderType ?? "Unknown",
          status: "pending",
          payment_status: "paid",
          stripe_session_id: session.id,
          subtotal: Number(session.metadata?.subtotalBeforeDiscountCents ?? 0) / 100,
          tax_amount: (session.total_details?.amount_tax ?? 0) / 100,
          total_amount: (session.amount_total ?? 0) / 100,
          promo_id: session.metadata?.promoId || null,
          promo_code: session.metadata?.promoCode || null,
          promo_discount_amount:
            Number(session.metadata?.promoDiscountCents ?? 0) / 100,
          pickup_time: session.metadata?.pickupTime || null,
          table_number: session.metadata?.tableNumber || null,
          guest_count: session.metadata?.guestCount
            ? Number(session.metadata.guestCount)
            : null,
          notes: orderDetails || null,
        })
        .select("id")
        .single();

      if (orderError || !newOrder) {
        console.error("Failed to save order:", orderError);
        return NextResponse.json(
          { error: "Could not save the order." },
          { status: 500 }
        );
      }
      orderId = newOrder.id;
    }

    const orderItemRows = lineItems.data.map((item) => {
      const quantity = item.quantity ?? 1;
      const amountSubtotal = item.amount_subtotal;
      const amountTotal = item.amount_total;
      return {
        order_id: orderId,
        stripe_line_item_id: item.id,
        item_name: item.description ?? "Order item",
        quantity,
        unit_price: amountSubtotal / quantity / 100,
        total_price: amountTotal / 100,
      };
    });

    if (orderItemRows.length) {
      const { error: itemsError } = await supabaseAdmin
        .from("order_items")
        .upsert(orderItemRows, {
          onConflict: "stripe_line_item_id",
          ignoreDuplicates: true,
        });

      if (itemsError) {
        console.error("Failed to save order items:", itemsError);
        return NextResponse.json(
          { error: "Could not save order items." },
          { status: 500 }
        );
      }
    }
  }

  return NextResponse.json({ received: true });
}