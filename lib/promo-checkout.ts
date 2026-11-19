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
  selectedOptionIds?: string[];
}

export interface ValidatedPromo {
  promo: Promo;
  cartItems: PromoCartItem[];
  discountCents: number;
  eligibleSubtotalCents: number;
  discountedItems: ReturnType<typeof calculatePromoDiscount>["discountedItems"];
}

export async function getPricedCheckoutItems(
  incomingItems: CheckoutItemInput[]
): Promise<{ items: PromoCartItem[] | null; error: string | null }> {
  const menuItemIds = [...new Set(incomingItems.map((item) => item.menuItemId))];
  const { data: menuData, error: menuError } = await supabase
    .from("menu_items")
    .select("id, category_id, base_price")
    .in("id", menuItemIds)
    .eq("is_available", true);

  if (menuError || !menuData) {
    return { items: null, error: "Could not verify the items in your cart." };
  }
  if (incomingItems.some((item) => !menuData.some((menu) => menu.id === item.menuItemId))) {
    return {
      items: null,
      error: "A menu item in your cart is no longer available.",
    };
  }

  const { data: groupLinks, error: groupLinkError } = await supabase
    .from("menu_item_option_groups")
    .select("menu_item_id, option_group_id")
    .in("menu_item_id", menuItemIds);

  if (groupLinkError || !groupLinks) {
    return { items: null, error: "Could not verify the options in your cart." };
  }

  const optionGroupIds = [...new Set(groupLinks.map((link) => link.option_group_id))];
  let optionGroups: {
    id: string;
    name: string;
    selection_type: string;
    min_selections: number | null;
    max_selections: number | null;
    is_required: boolean;
  }[] = [];
  let choices: {
    id: string;
    option_group_id: string;
    name: string;
    price_adjustment: number | string;
    is_available: boolean;
  }[] = [];

  if (optionGroupIds.length > 0) {
    const [
      { data: groupData, error: groupError },
      { data: choiceData, error: choiceError },
    ] = await Promise.all([
      supabase
        .from("option_groups")
        .select(
          "id, name, selection_type, min_selections, max_selections, is_required"
        )
        .in("id", optionGroupIds),
      supabase
        .from("option_choices")
        .select("id, option_group_id, name, price_adjustment, is_available")
        .in("option_group_id", optionGroupIds)
        .eq("is_available", true),
    ]);

    if (groupError || !groupData || choiceError || !choiceData) {
      return { items: null, error: "Could not verify the options in your cart." };
    }
    optionGroups = groupData;
    choices = choiceData;
  }

  const items: PromoCartItem[] = [];
  for (const item of incomingItems) {
    const menuItem = menuData.find((menu) => menu.id === item.menuItemId);
    if (!menuItem) continue;

    const linkedGroupIds = new Set(
      groupLinks
        .filter((link) => link.menu_item_id === item.menuItemId)
        .map((link) => link.option_group_id)
    );
    let unitAmountCents = Math.round(Number(menuItem.base_price) * 100);
    if (!Number.isFinite(unitAmountCents)) {
      return {
        items: null,
        error: `The menu price for ${item.displayName} is invalid.`,
      };
    }
    const selectedIds = item.selectedOptionIds ?? [];
    const seenOptions = new Set<string>();
    for (const selectedOptionId of selectedIds) {
      if (seenOptions.has(selectedOptionId)) {
        return {
          items: null,
          error: `The selected options for ${item.displayName} contain a duplicate.`,
        };
      }
      seenOptions.add(selectedOptionId);
      const matchingChoice = choices.find(
        (choice) =>
          choice.id === selectedOptionId &&
          linkedGroupIds.has(choice.option_group_id)
      );
      if (!matchingChoice) {
        return {
          items: null,
          error: `A selected option is no longer available for ${item.displayName}.`,
        };
      }

      const adjustmentCents = Math.round(
        Number(matchingChoice.price_adjustment) * 100
      );
      if (!Number.isFinite(adjustmentCents)) {
        return {
          items: null,
          error: `The selected options for ${item.displayName} have an invalid price.`,
        };
      }
      unitAmountCents += adjustmentCents;
    }

    for (const groupId of linkedGroupIds) {
      const group = optionGroups.find((candidate) => candidate.id === groupId);
      if (!group) {
        return {
          items: null,
          error: `Could not verify the options for ${item.displayName}.`,
        };
      }

      const selectedCount = selectedIds.filter((selectedId) =>
        choices.some(
          (choice) =>
            choice.id === selectedId && choice.option_group_id === groupId
        )
      ).length;
      const minimum = Math.max(
        Number(group.min_selections ?? 0),
        group.is_required ? 1 : 0
      );
      const configuredMaximum = Number(
        group.max_selections ?? Number.MAX_SAFE_INTEGER
      );
      const maximum =
        group.selection_type === "single"
          ? Math.min(configuredMaximum, 1)
          : configuredMaximum;

      if (
        !Number.isInteger(minimum) ||
        !Number.isInteger(maximum) ||
        minimum < 0 ||
        maximum < minimum
      ) {
        return {
          items: null,
          error: `The option group "${group.name}" is not configured correctly.`,
        };
      }
      if (selectedCount < minimum) {
        return {
          items: null,
          error: `Choose at least ${minimum} option(s) for "${group.name}".`,
        };
      }
      if (selectedCount > maximum) {
        return {
          items: null,
          error: `Choose no more than ${maximum} option(s) for "${group.name}".`,
        };
      }
    }

    if (!Number.isFinite(unitAmountCents) || unitAmountCents < 0) {
      return {
        items: null,
        error: `The selected options for ${item.displayName} have an invalid price.`,
      };
    }
    items.push({
      menuItemId: item.menuItemId,
      categoryId: String(menuItem.category_id ?? ""),
      quantity: item.quantity,
      unitAmountCents,
      displayName: item.displayName,
    });
  }

  return { items, error: null };
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

  const { items: cartItems, error: cartError } =
    await getPricedCheckoutItems(incomingItems);
  if (cartError || !cartItems) return { data: null, error: cartError };

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
