// This file sets up Stripe so our server code can talk to Stripe's API.
// It must only be used on the SERVER (inside API routes), never in
// a "use client" file, because it uses the SECRET key.

import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY?.trim() || "";

export const stripe = new Stripe(key || "sk_test_placeholder_key");

export const isStripeConfigured = Boolean(
  key && !key.includes("placeholder")
);
