// This file sets up Stripe so our server code can talk to Stripe's API.
// It must only be used on the SERVER (inside API routes), never in
// a "use client" file, because it uses the SECRET key.

import Stripe from "stripe";

// Create one Stripe client, using the secret key from .env.local.
// The "!" tells TypeScript "trust me, this value will exist".
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);