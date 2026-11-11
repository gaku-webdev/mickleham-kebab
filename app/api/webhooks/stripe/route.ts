// This is a special API route that only Stripe's servers call directly.
// It is NOT called by our own browser code.

import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabase } from "@/lib/supabase";
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
    const session = event.data.object as Stripe.Checkout.Session;

    const lineItems = await stripe.checkout.sessions.listLineItems(
      session.id
    );

    // Build a simple list of items as plain text, since there's no
    // dedicated order_items table being used here yet.
    const itemsSummary = lineItems.data
      .map((item) => `${item.quantity}x ${item.description}`)
      .join(", ");

    const orderNumber = `MKG-${Math.floor(1000 + Math.random() * 9000)}`;

    // These column names now match the ACTUAL orders table structure
    // (the one Ritesh set up), not the earlier simple version.
    const { error } = await supabase.from("orders").insert({
      order_number: orderNumber,
      customer_name: session.customer_details?.name ?? "Guest",
      customer_email: session.customer_details?.email ?? "",
      customer_phone: session.customer_details?.phone ?? "",
      order_type: session.metadata?.orderType ?? "Unknown",
      status: "pending",
      payment_status: "paid",
      stripe_session_id: session.id,
      subtotal: (session.amount_subtotal ?? 0) / 100,
      tax_amount: 0,
      total_amount: (session.amount_total ?? 0) / 100,
      notes: itemsSummary,
    });

    if (error) {
      console.error("Failed to save order:", error);
    }
  }

  // IMPORTANT: Always return a 200 response to Stripe quickly,
  // even if something above failed. If we don't, Stripe will think
  // the webhook failed and will keep retrying it.
  return NextResponse.json({ received: true });
}