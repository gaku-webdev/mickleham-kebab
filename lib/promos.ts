export type DiscountType = "percentage" | "fixed";

export interface Promo {
  id: string;
  title: string;
  description: string;
  code: string;
  discount_type: DiscountType;
  discount_value: number;
  is_active: boolean;
  starts_at: string | null;
  expires_at: string | null;
  applies_to_all: boolean;
  category_ids: string[];
  menu_item_ids: string[];
  active_days: number[];
  daily_start_time: string | null;
  daily_end_time: string | null;
  schedule_timezone: string;
}

export interface PromoCartItem {
  menuItemId: string;
  categoryId: string;
  quantity: number;
  unitAmountCents: number;
  displayName: string;
}

export interface DiscountedLineItem {
  displayName: string;
  quantity: number;
  unitAmountCents: number;
  eligible: boolean;
}

export function isPromoScheduleActive(
  promo: Pick<
    Promo,
    | "active_days"
    | "daily_start_time"
    | "daily_end_time"
    | "schedule_timezone"
  >,
  now = new Date()
): boolean {
  if (promo.active_days.length > 0 || promo.daily_start_time || promo.daily_end_time) {
    try {
      const parts = new Intl.DateTimeFormat("en-AU", {
        timeZone: promo.schedule_timezone,
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      }).formatToParts(now);
      const values = Object.fromEntries(
        parts.map((part) => [part.type, part.value])
      );
      const weekdays: Record<string, number> = {
        Sun: 0,
        Mon: 1,
        Tue: 2,
        Wed: 3,
        Thu: 4,
        Fri: 5,
        Sat: 6,
      };
      const currentDay = weekdays[values.weekday];

      if (
        promo.active_days.length > 0 &&
        !promo.active_days.includes(currentDay)
      ) {
        return false;
      }

      if (promo.daily_start_time || promo.daily_end_time) {
        if (!promo.daily_start_time || !promo.daily_end_time) return false;
        const currentTime = `${values.hour}:${values.minute}:${values.second}`;
        if (
          currentTime < promo.daily_start_time ||
          currentTime >= promo.daily_end_time
        ) {
          return false;
        }
      }
    } catch {
      return false;
    }
  }

  return true;
}

export function isPromoCurrentlyActive(
  promo: Promo,
  now = new Date()
): boolean {
  const startsAt = promo.starts_at ? new Date(promo.starts_at).getTime() : null;
  const expiresAt = promo.expires_at
    ? new Date(promo.expires_at).getTime()
    : null;

  return (
    promo.is_active &&
    (startsAt === null || startsAt <= now.getTime()) &&
    (expiresAt === null || expiresAt >= now.getTime()) &&
    isPromoScheduleActive(promo, now)
  );
}

export function getEligiblePromoItems(
  promo: Promo,
  items: PromoCartItem[]
): PromoCartItem[] {
  if (promo.applies_to_all) return items;

  const categoryIds = new Set(promo.category_ids ?? []);
  const menuItemIds = new Set(promo.menu_item_ids ?? []);

  return items.filter(
    (item) =>
      (categoryIds.size > 0 && categoryIds.has(item.categoryId)) ||
      (menuItemIds.size > 0 && menuItemIds.has(item.menuItemId))
  );
}

export function calculatePromoDiscount(
  promo: Promo,
  items: PromoCartItem[]
): {
  discountCents: number;
  eligibleSubtotalCents: number;
  discountedItems: DiscountedLineItem[];
} {
  const eligibleItems = getEligiblePromoItems(promo, items);
  const eligibleSubtotalCents = eligibleItems.reduce(
    (sum, item) => sum + item.unitAmountCents * item.quantity,
    0
  );
  const discountCents =
    promo.discount_type === "percentage"
      ? Math.round((eligibleSubtotalCents * Number(promo.discount_value)) / 100)
      : Math.min(
          Math.round(Number(promo.discount_value) * 100),
          eligibleSubtotalCents
        );

  const lineDiscounts = eligibleItems.map((item) => {
    const lineSubtotalCents = item.unitAmountCents * item.quantity;
    const exactShare =
      eligibleSubtotalCents > 0
        ? (discountCents * lineSubtotalCents) / eligibleSubtotalCents
        : 0;
    return {
      item,
      lineSubtotalCents,
      discountCents: Math.floor(exactShare),
      remainder: exactShare % 1,
    };
  });

  let remainingCents =
    discountCents -
    lineDiscounts.reduce((sum, line) => sum + line.discountCents, 0);
  const remainderOrder = [...lineDiscounts].sort(
    (left, right) => right.remainder - left.remainder
  );
  for (const line of remainderOrder) {
    if (remainingCents <= 0) break;
    if (line.discountCents < line.lineSubtotalCents) {
      line.discountCents += 1;
      remainingCents -= 1;
    }
  }

  const discountsByItem = new Map(
    lineDiscounts.map(({ item, discountCents: lineDiscountCents }) => [
      item,
      lineDiscountCents,
    ])
  );
  const discountedItems = items.flatMap((item) => {
    const lineDiscountCents = discountsByItem.get(item) ?? 0;
    if (lineDiscountCents === 0) {
      return [
        {
          displayName: item.displayName,
          quantity: item.quantity,
          unitAmountCents: item.unitAmountCents,
          eligible: false,
        },
      ];
    }

    const perUnitDiscount = Math.floor(lineDiscountCents / item.quantity);
    const extraDiscountUnits = lineDiscountCents % item.quantity;
    const lines: DiscountedLineItem[] = [];
    const regularUnits = item.quantity - extraDiscountUnits;

    if (regularUnits > 0) {
      lines.push({
        displayName: item.displayName,
        quantity: regularUnits,
        unitAmountCents: item.unitAmountCents - perUnitDiscount,
        eligible: true,
      });
    }
    if (extraDiscountUnits > 0) {
      lines.push({
        displayName: item.displayName,
        quantity: extraDiscountUnits,
        unitAmountCents: item.unitAmountCents - perUnitDiscount - 1,
        eligible: true,
      });
    }
    return lines;
  });

  return { discountCents, eligibleSubtotalCents, discountedItems };
}

export function formatDiscount(
  promo: Pick<Promo, "discount_type" | "discount_value">
) {
  return promo.discount_type === "percentage"
    ? `${promo.discount_value}% off`
    : `$${promo.discount_value.toFixed(2)} off`;
}
