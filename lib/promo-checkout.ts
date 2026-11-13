import { supabase } from "@/lib/supabase";
import {
  calculatePromoDiscount,
  getEligiblePromoItems,
  isPromoCurrentlyActive,
  type Promo,
  type PromoCartItem,
} from "@/lib/promos";

export interface CheckoutItemInput {
  menuItemId: string;
  quantity: number;
  displayName: string;
}

export interface ValidatedPromo {
  promo: Promo;
  cartItems: PromoCartItem[];
  discountCents: number;
  eligibleSubtotalCents: number;
  discountedItems: ReturnType<typeof calculatePromoDiscount>["discountedItems"];
}

export async function validatePromoForCheckout(
  code: string,
  incomingItems: CheckoutItemInput[],
  now = new Date()
): Promise<{ data: ValidatedPromo | null; error: string | null }> {
  const normalizedCode = code.trim().toUpperCase();
  if (!normalizedCode) return { data: null, error: "Enter a promo code." };

  const { data: promoData, error: promoError } = await supabase
    .from("promos")
    .select(
      "id, title, description, code, discount_type, discount_value, is_active, starts_at, expires_at, applies_to_all, category_ids, menu_item_ids, active_days, daily_start_time, daily_end_time, schedule_timezone"
    )
    .eq("code", normalizedCode)
    .maybeSingle();

  if (promoError) {
    return { data: null, error: "Could not verify this promo code." };
  }
  if (!promoData) {
    return { data: null, error: "That promo code was not found." };
  }

  const promo = promoData as Promo;
  if (!isPromoCurrentlyActive(promo, now)) {
    return {
      data: null,
      error: "This promotion is not active at the current date or time.",
    };
  }

  const menuItemIds = [...new Set(incomingItems.map((item) => item.menuItemId))];
  const { data: menuData, error: menuError } = await supabase
    .from("menu_items")
    .select("id, category_id, base_price")
    .in("id", menuItemIds);

  if (menuError || !menuData) {
    return { data: null, error: "Could not verify the items in your cart." };
  }
  if (
    incomingItems.some(
      (item) => !menuData.some((candidate) => candidate.id === item.menuItemId)
    )
  ) {
    return {
      data: null,
      error: "A menu item in your cart is no longer available.",
    };
  }

  const cartItems: PromoCartItem[] = incomingItems.map((item) => {
    const menuItem = menuData.find((candidate) => candidate.id === item.menuItemId);
    return {
      menuItemId: item.menuItemId,
      categoryId: String(menuItem?.category_id ?? ""),
      quantity: item.quantity,
      unitAmountCents: Math.round(Number(menuItem?.base_price ?? 0) * 100),
      displayName: item.displayName,
    };
  });

  if (cartItems.some((item) => item.unitAmountCents < 0)) {
    return { data: null, error: "A menu item in your cart is no longer available." };
  }

  if (getEligiblePromoItems(promo, cartItems).length === 0) {
    return {
      data: null,
      error: "This promotion does not apply to any items in your cart.",
    };
  }

  const {
    discountCents,
    eligibleSubtotalCents,
    discountedItems,
  } = calculatePromoDiscount(promo, cartItems);

  return {
    data: {
      promo,
      cartItems,
      discountCents,
      eligibleSubtotalCents,
      discountedItems,
    },
    error: null,
  };
}
