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
    (expiresAt === null || expiresAt >= now.getTime())
  );
}

export function formatDiscount(promo: Pick<Promo, "discount_type" | "discount_value">) {
  return promo.discount_type === "percentage"
    ? `${promo.discount_value}% off`
    : `$${promo.discount_value.toFixed(2)} off`;
}
