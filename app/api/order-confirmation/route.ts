
import { NextRequest, NextResponse } from "next/server";
import { stripe, isStripeConfigured } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type Stripe from "stripe";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("session_id")?.trim();
  const orderNumber = searchParams.get("order_number")?.trim();

  if (!sessionId && !orderNumber) {
    return NextResponse.json(
      { error: "A session_id or order_number is required." },
      { status: 400 }
    );
  }

  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (err: unknown) {
    console.error("Supabase Admin init error:", err);
    return NextResponse.json(
      { error: "Database configuration error." },
      { status: 500 }
    );
  }

  try {
    // 1. If order_number is passed, query directly
    if (orderNumber) {
      const { data: order, error } = await supabaseAdmin
        .from("orders")
        .select("*")
        .eq("order_number", orderNumber)
        .maybeSingle();

      if (error || !order) {
        return NextResponse.json(
          { error: "Order not found." },
          { status: 404 }
        );
      }

      const { data: items } = await supabaseAdmin
        .from("order_items")
        .select("*")
        .eq("order_id", order.id);

      return NextResponse.json({ order, items: items ?? [] });
    }

    // 2. If sessionId is passed, first check if order already exists in Supabase
    if (sessionId) {
      const { data: existingOrder } = await supabaseAdmin
        .from("orders")
        .select("*")
        .eq("stripe_session_id", sessionId)
        .maybeSingle();

      if (existingOrder) {
        const { data: items } = await supabaseAdmin
          .from("order_items")
          .select("*")
          .eq("order_id", existingOrder.id);

        return NextResponse.json({ order: existingOrder, items: items ?? [] });
      }

      // 3. Not yet in Supabase (e.g. running in local development where Stripe webhooks can't reach localhost)
      if (!isStripeConfigured) {
        return NextResponse.json(
          { error: "Stripe configuration is missing on the server." },
          { status: 500 }
        );
      }

      let session: Stripe.Checkout.Session;
      try {
        session = await stripe.checkout.sessions.retrieve(sessionId, {
          expand: ["line_items"],
        });
      } catch (stripeErr: unknown) {
        console.error("Failed to retrieve Stripe session:", stripeErr);
        return NextResponse.json(
          { error: "Could not find a valid Stripe checkout session." },
          { status: 404 }
        );
      }

      // Check if session was paid or complete
      if (session.payment_status !== "paid" && session.status !== "complete") {
        return NextResponse.json(
          {
            error: "Payment has not been completed yet.",
            status: session.status,
            payment_status: session.payment_status,
          },
          { status: 400 }
        );
      }

      // Create the order in Supabase
      const newOrderNumber = `MKG-${Math.floor(1000 + Math.random() * 9000)}`;
      const subtotalCents = Number(
        session.metadata?.subtotalBeforeDiscountCents ??
        session.amount_subtotal ??
        session.amount_total ??
        0
      );

      const customerName =
        session.customer_details?.name ||
        session.metadata?.customerName ||
        "Valued Customer";
      const customerEmail =
        session.customer_details?.email ||
        session.metadata?.customerEmail ||
        "";
      const customerPhone =
        session.customer_details?.phone ||
        session.metadata?.customerPhone ||
        "";
      const orderType = session.metadata?.orderType || "Takeaway";
      const pickupTime = session.metadata?.pickupTime || "As soon as possible (about 20 min)";
      const tableNumber = session.metadata?.tableNumber || null;
      const guestCount = session.metadata?.guestCount
        ? Number(session.metadata.guestCount)
        : null;

      const { data: createdOrder, error: createError } = await supabaseAdmin
        .from("orders")
        .insert({
          order_number: newOrderNumber,
          customer_name: customerName,
          customer_email: customerEmail,
          customer_phone: customerPhone,
          order_type: orderType,
          status: "pending",
          payment_status: "paid",
          stripe_session_id: session.id,
          subtotal: subtotalCents / 100,
          tax_amount: (session.total_details?.amount_tax ?? 0) / 100,
          total_amount: (session.amount_total ?? 0) / 100,
          promo_id: session.metadata?.promoId || null,
          promo_code: session.metadata?.promoCode || null,
          promo_discount_amount:
            Number(session.metadata?.promoDiscountCents ?? 0) / 100,
          pickup_time: pickupTime,
          table_number: tableNumber,
          guest_count: guestCount,
          notes: session.metadata?.customerNote || null,
        })
        .select("*")
        .single();

      if (createError || !createdOrder) {
        console.error("Failed to insert order into Supabase:", createError);
        return NextResponse.json(
          { error: "Failed to persist order to database." },
          { status: 500 }
        );
      }

      // Insert line items
      const rawLineItems = session.line_items?.data ?? [];
      const orderItemRows = rawLineItems.map((item) => {
        const quantity = item.quantity ?? 1;
        const amountSubtotal = item.amount_subtotal;
        const amountTotal = item.amount_total;
        return {
          order_id: createdOrder.id,
          stripe_line_item_id: item.id,
          item_name: item.description ?? "Order item",
          quantity,
          unit_price: amountSubtotal / quantity / 100,
          total_price: amountTotal / 100,
        };
      });

      if (orderItemRows.length > 0) {
        const { error: itemsError } = await supabaseAdmin
          .from("order_items")
          .upsert(orderItemRows, {
            onConflict: "stripe_line_item_id",
            ignoreDuplicates: true,
          });

        if (itemsError) {
          console.error("Failed to insert order items:", itemsError);
        }
      }

      return NextResponse.json({
        order: createdOrder,
        items: orderItemRows,
      });
    }

    return NextResponse.json(
      { error: "Could not process order lookup." },
      { status: 400 }
    );
  } catch (err: unknown) {
    console.error("Order confirmation endpoint error:", err);
    const message =
      err instanceof Error ? err.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
