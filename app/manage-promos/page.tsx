"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import {
  formatDiscount,
  isPromoCurrentlyActive,
  type DiscountType,
  type Promo,
} from "@/lib/promos";

type PromoForm = {
  title: string;
  description: string;
  code: string;
  discountType: DiscountType;
  discountValue: string;
  isActive: boolean;
  startsAt: string;
  expiresAt: string;
  appliesToAll: boolean;
  categoryIds: string[];
  menuItemIds: string[];
  activeDays: number[];
  dailyStartTime: string;
  dailyEndTime: string;
  scheduleTimezone: string;
};

type Category = { id: string; name: string };
type MenuItem = { id: string; name: string; category_id: string | null };

const emptyForm: PromoForm = {
  title: "",
  description: "",
  code: "",
  discountType: "percentage",
  discountValue: "",
  isActive: true,
  startsAt: "",
  expiresAt: "",
  appliesToAll: false,
  categoryIds: [],
  menuItemIds: [],
  activeDays: [],
  dailyStartTime: "",
  dailyEndTime: "",
  scheduleTimezone: "Australia/Melbourne",
};

const daysOfWeek = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

const timeZones = [
  "Australia/Melbourne",
  "Australia/Sydney",
  "Australia/Brisbane",
  "Australia/Adelaide",
  "Australia/Perth",
  "Australia/Darwin",
  "Pacific/Auckland",
];

const inputClassName =
  "mt-1.5 w-full rounded-xl border border-[#E7E1D8] bg-white px-3.5 py-3 text-sm text-[#29231F] outline-none transition focus:border-[#C2410C] focus:ring-2 focus:ring-orange-100";

function isAdminOrStaff(
  record: {
    role_id?: number | null;
    user_roles?: { role_name?: string } | { role_name?: string }[] | null;
  } | null
) {
  const relation = record?.user_roles;
  const roleName = Array.isArray(relation)
    ? relation[0]?.role_name
    : relation?.role_name;

  return (
    record?.role_id === 2 ||
    record?.role_id === 3 ||
    roleName === "admin" ||
    roleName === "staff"
  );
}

function toLocalDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

function toPromoForm(promo: Promo): PromoForm {
  return {
    title: promo.title,
    description: promo.description,
    code: promo.code,
    discountType: promo.discount_type,
    discountValue: String(promo.discount_value),
    isActive: promo.is_active,
    startsAt: toLocalDateTime(promo.starts_at),
    expiresAt: toLocalDateTime(promo.expires_at),
    appliesToAll: promo.applies_to_all ?? false,
    categoryIds: promo.category_ids ?? [],
    menuItemIds: promo.menu_item_ids ?? [],
    activeDays: promo.active_days ?? [],
    dailyStartTime: promo.daily_start_time?.slice(0, 5) ?? "",
    dailyEndTime: promo.daily_end_time?.slice(0, 5) ?? "",
    scheduleTimezone: promo.schedule_timezone || "Australia/Melbourne",
  };
}

function toISOStringOrNull(value: string) {
  return value ? new Date(value).toISOString() : null;
}

export default function ManagePromosPage() {
  const { user, loading: authLoading } = useAuth();
  const [permissionLoading, setPermissionLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PromoForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function checkAccessAndLoadPromos() {
      if (authLoading) return;
      if (!user) {
        setPermissionLoading(false);
        return;
      }

      setPermissionLoading(true);
      const { data, error } = await supabase
        .from("users")
        .select("role_id, user_roles(role_name)")
        .eq("id", user.id)
        .single();

      if (!active) return;
      if (error) {
        setLoadError(error.message);
        setIsAuthorized(false);
        setPermissionLoading(false);
        return;
      }

      if (!isAdminOrStaff(data)) {
        setIsAuthorized(false);
        setPermissionLoading(false);
        return;
      }

      setIsAuthorized(true);
      const [
        { data: promoData, error: promoError },
        { data: categoryData, error: categoryError },
        { data: menuData, error: menuError },
      ] = await Promise.all([
        supabase
          .from("promos")
          .select(
            "id, title, description, code, discount_type, discount_value, is_active, starts_at, expires_at, applies_to_all, category_ids, menu_item_ids, active_days, daily_start_time, daily_end_time, schedule_timezone"
          )
          .order("starts_at", { ascending: false }),
        supabase.from("categories").select("id, name").order("display_order"),
        supabase
          .from("menu_items")
          .select("id, name, category_id")
          .order("name"),
      ]);

      if (!active) return;
      if (promoError || categoryError || menuError) {
        setLoadError(
          promoError?.message ??
            categoryError?.message ??
            menuError?.message ??
            "Could not load promo management data."
        );
      } else {
        setPromos((promoData ?? []) as Promo[]);
        setCategories(
          (categoryData ?? []).map((category) => ({
            id: String(category.id),
            name: String(category.name),
          }))
        );
        setMenuItems(
          (menuData ?? []).map((item) => ({
            id: String(item.id),
            name: String(item.name),
            category_id:
              item.category_id == null ? null : String(item.category_id),
          }))
        );
      }
      setPermissionLoading(false);
    }

    void checkAccessAndLoadPromos();
    return () => {
      active = false;
    };
  }, [authLoading, user]);

  function startNewPromo() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
    setActionError("");
    setNotice("");
  }

  function startEditing(promo: Promo) {
    setEditingId(promo.id);
    setForm(toPromoForm(promo));
    setShowForm(true);
    setActionError("");
    setNotice("");
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionError("");
    setNotice("");

    const discountValue = Number(form.discountValue);
    if (!form.title.trim() || !form.description.trim() || !form.code.trim()) {
      setActionError("Enter a title, description, and promo code.");
      return;
    }
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      setActionError("Enter a discount value greater than zero.");
      return;
    }
    if (form.discountType === "percentage" && discountValue > 100) {
      setActionError("A percentage discount cannot be greater than 100.");
      return;
    }
    if (
      !form.appliesToAll &&
      form.categoryIds.length === 0 &&
      form.menuItemIds.length === 0
    ) {
      setActionError("Choose at least one eligible category or menu item.");
      return;
    }

    if (Boolean(form.dailyStartTime) !== Boolean(form.dailyEndTime)) {
      setActionError("Set both daily schedule times, or leave both blank.");
      return;
    }
    if (
      form.dailyStartTime &&
      form.dailyEndTime &&
      form.dailyStartTime >= form.dailyEndTime
    ) {
      setActionError("The daily end time must be after the start time.");
      return;
    }

    const startsAt = toISOStringOrNull(form.startsAt);
    const expiresAt = toISOStringOrNull(form.expiresAt);
    if (startsAt && expiresAt && startsAt >= expiresAt) {
      setActionError("The expiry date must be after the start date.");
      return;
    }

    setSaving(true);
    const values = {
      title: form.title.trim(),
      description: form.description.trim(),
      code: form.code.trim().toUpperCase(),
      discount_type: form.discountType,
      discount_value: discountValue,
      is_active: form.isActive,
      starts_at: startsAt,
      expires_at: expiresAt,
      applies_to_all: form.appliesToAll,
      category_ids: form.appliesToAll ? [] : form.categoryIds,
      menu_item_ids: form.appliesToAll ? [] : form.menuItemIds,
      active_days: form.activeDays,
      daily_start_time: form.dailyStartTime || null,
      daily_end_time: form.dailyEndTime || null,
      schedule_timezone: form.scheduleTimezone,
    };

    const result = editingId
      ? await supabase.from("promos").update(values).eq("id", editingId)
      : await supabase
          .from("promos")
          .insert({ id: crypto.randomUUID(), ...values });

    if (result.error) {
      setActionError(result.error.message);
      setSaving(false);
      return;
    }

    const { data, error } = await supabase
      .from("promos")
      .select(
        "id, title, description, code, discount_type, discount_value, is_active, starts_at, expires_at, applies_to_all, category_ids, menu_item_ids, active_days, daily_start_time, daily_end_time, schedule_timezone"
      )
      .order("starts_at", { ascending: false });

    if (error) {
      setActionError(error.message);
      setSaving(false);
      return;
    }

    setPromos((data ?? []) as Promo[]);
    setSaving(false);
    closeForm();
    setNotice(editingId ? "Promotion updated." : "Promotion created.");
  }

  async function handleDelete(promo: Promo) {
    if (
      !window.confirm(
        `Delete "${promo.title}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    setDeletingId(promo.id);
    setActionError("");
    setNotice("");
    const { error } = await supabase
      .from("promos")
      .delete()
      .eq("id", promo.id);

    if (error) {
      setActionError(error.message);
      setDeletingId(null);
      return;
    }

    setPromos((current) => current.filter((item) => item.id !== promo.id));
    if (editingId === promo.id) closeForm();
    setNotice(`${promo.title} was deleted.`);
    setDeletingId(null);
  }

  if (authLoading || permissionLoading) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center bg-[#FAF7F2] px-4 text-[#1C1917]">
        <p className="rounded-2xl border border-[#EBE6DD] bg-white px-6 py-5 text-sm font-semibold text-gray-600 shadow-sm">
          Checking permissions...
        </p>
      </main>
    );
  }

  if (!user || !isAuthorized) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center bg-[#FAF7F2] px-4 text-[#1C1917]">
        <section className="w-full max-w-md rounded-2xl border border-[#EBE6DD] bg-white p-8 text-center shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C2410C]">
            Mickleham Kebab &amp; Grill
          </p>
          <h1 className="mt-3 text-2xl font-extrabold">
            {user ? "Access denied" : "Sign in required"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            {user
              ? "You need an admin or staff role to manage promotions."
              : "Sign in with an admin or staff account to manage promotions."}
          </p>
          {loadError && (
            <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-left text-sm text-red-700">
              {loadError}
            </p>
          )}
          <Link
            href={user ? "/admin" : "/login"}
            className="mt-6 inline-flex rounded-xl bg-[#C2410C] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#9A3412]"
          >
            {user ? "Back to admin" : "Sign in"}
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FAF7F2] px-4 py-8 text-[#1C1917] sm:px-8 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              href="/admin"
              className="text-sm font-semibold text-[#9A3412] hover:underline"
            >
              ← Admin dashboard
            </Link>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-[#EA580C]">
              Mickleham Kebab &amp; Grill
            </p>
            <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">
              Manage promotions
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Create and update promo codes shown on the homepage.
            </p>
          </div>
          <button
            type="button"
            onClick={startNewPromo}
            className="rounded-xl bg-[#C2410C] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#9A3412]"
          >
            + Add promotion
          </button>
        </div>

        {(loadError || actionError || notice) && (
          <div
            role={loadError || actionError ? "alert" : "status"}
            className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
              loadError || actionError
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-green-200 bg-green-50 text-green-800"
            }`}
          >
            {loadError || actionError || notice}
            {(loadError || actionError) && (
              <button
                type="button"
                onClick={() => {
                  setLoadError("");
                  setActionError("");
                }}
                className="ml-3 font-semibold underline"
              >
                Dismiss
              </button>
            )}
          </div>
        )}

        {showForm && (
          <form
            onSubmit={handleSave}
            className="mb-7 rounded-2xl border border-[#EBE6DD] bg-white p-5 shadow-sm sm:p-6"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">
                  {editingId ? "Edit promotion" : "Add a promotion"}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Set the promo details and when it should appear.
                </p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                aria-label="Close form"
                className="rounded-lg px-2 py-1 text-xl leading-none text-gray-500 hover:bg-gray-100"
              >
                ×
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-[#413830]">
                Promotion title
                <input
                  autoFocus
                  required
                  value={form.title}
                  onChange={(event) =>
                    setForm({ ...form, title: event.target.value })
                  }
                  className={inputClassName}
                />
              </label>
              <label className="text-sm font-semibold text-[#413830]">
                Promo code
                <input
                  required
                  value={form.code}
                  onChange={(event) =>
                    setForm({ ...form, code: event.target.value })
                  }
                  className={inputClassName}
                />
              </label>
              <label className="text-sm font-semibold text-[#413830]">
                Discount type
                <select
                  value={form.discountType}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      discountType: event.target.value as DiscountType,
                    })
                  }
                  className={inputClassName}
                >
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed amount</option>
                </select>
              </label>
              <label className="text-sm font-semibold text-[#413830]">
                Discount value
                <input
                  required
                  type="number"
                  min="0.01"
                  max={form.discountType === "percentage" ? "100" : undefined}
                  step="0.01"
                  inputMode="decimal"
                  value={form.discountValue}
                  onChange={(event) =>
                    setForm({ ...form, discountValue: event.target.value })
                  }
                  className={inputClassName}
                />
              </label>
              <label className="text-sm font-semibold text-[#413830] sm:col-span-2">
                Description
                <textarea
                  required
                  rows={3}
                  value={form.description}
                  onChange={(event) =>
                    setForm({ ...form, description: event.target.value })
                  }
                  className={`${inputClassName} resize-y`}
                />
              </label>
              <label className="text-sm font-semibold text-[#413830]">
                Starts at
                <input
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(event) =>
                    setForm({ ...form, startsAt: event.target.value })
                  }
                  className={inputClassName}
                />
              </label>
              <label className="text-sm font-semibold text-[#413830]">
                Expires at
                <input
                  type="datetime-local"
                  value={form.expiresAt}
                  onChange={(event) =>
                    setForm({ ...form, expiresAt: event.target.value })
                  }
                  className={inputClassName}
                />
              </label>
              <label className="flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm font-semibold text-[#413830] sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.appliesToAll}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      appliesToAll: event.target.checked,
                      categoryIds: [],
                      menuItemIds: [],
                    })
                  }
                  className="h-4 w-4 accent-[#C2410C]"
                />
                Apply to all menu items and categories
              </label>
              <fieldset
                disabled={form.appliesToAll}
                className={`rounded-xl border border-[#EEE9E1] p-4 sm:col-span-2 ${
                  form.appliesToAll ? "opacity-50" : ""
                }`}
              >
                <legend className="px-1 text-sm font-bold text-[#413830]">
                  Eligible categories
                </legend>
                <p className="mb-3 text-xs font-normal text-gray-500">
                  The discount applies to items in any selected category or to
                  any individually selected item below.
                </p>
                {categories.length ? (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {categories.map((category) => (
                      <label
                        key={category.id}
                        className="flex items-center gap-2 text-sm font-medium"
                      >
                        <input
                          type="checkbox"
                          checked={form.categoryIds.includes(category.id)}
                          onChange={(event) =>
                            setForm({
                              ...form,
                              categoryIds: event.target.checked
                                ? [...form.categoryIds, category.id]
                                : form.categoryIds.filter(
                                    (id) => id !== category.id
                                  ),
                            })
                          }
                          className="h-4 w-4 accent-[#C2410C]"
                        />
                        {category.name}
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-amber-700">
                    No menu categories are available.
                  </p>
                )}
              </fieldset>
              <fieldset
                disabled={form.appliesToAll}
                className={`rounded-xl border border-[#EEE9E1] p-4 sm:col-span-2 ${
                  form.appliesToAll ? "opacity-50" : ""
                }`}
              >
                <legend className="px-1 text-sm font-bold text-[#413830]">
                  Eligible individual menu items
                </legend>
                <p className="mb-3 text-xs font-normal text-gray-500">
                  Use this for a promotion that applies to one specific dish,
                  such as the Family Feast Platter.
                </p>
                {menuItems.length ? (
                  <div className="grid max-h-56 gap-2 overflow-y-auto sm:grid-cols-2">
                    {menuItems.map((item) => {
                      const categoryName =
                        categories.find(
                          (category) => category.id === item.category_id
                        )?.name ?? "Uncategorized";
                      return (
                        <label
                          key={item.id}
                          className="flex items-start gap-2 text-sm font-medium"
                        >
                          <input
                            type="checkbox"
                            checked={form.menuItemIds.includes(item.id)}
                            onChange={(event) =>
                              setForm({
                                ...form,
                                menuItemIds: event.target.checked
                                  ? [...form.menuItemIds, item.id]
                                  : form.menuItemIds.filter(
                                      (id) => id !== item.id
                                    ),
                              })
                            }
                            className="mt-0.5 h-4 w-4 accent-[#C2410C]"
                          />
                          <span>
                            {item.name}
                            <span className="ml-1 text-xs font-normal text-gray-500">
                              · {categoryName}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-amber-700">
                    Add a menu item before targeting an individual dish.
                  </p>
                )}
              </fieldset>
              <fieldset className="rounded-xl border border-[#EEE9E1] p-4 sm:col-span-2">
                <legend className="px-1 text-sm font-bold text-[#413830]">
                  Recurring schedule
                </legend>
                <p className="mb-3 text-xs font-normal text-gray-500">
                  Leave every day unchecked for no weekday restriction. Leave
                  both times blank for all day.
                </p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {daysOfWeek.map((day) => (
                    <label
                      key={day.value}
                      className="flex items-center gap-2 text-sm font-medium"
                    >
                      <input
                        type="checkbox"
                        checked={form.activeDays.includes(day.value)}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            activeDays: event.target.checked
                              ? [...form.activeDays, day.value].sort()
                              : form.activeDays.filter(
                                  (value) => value !== day.value
                                ),
                          })
                        }
                        className="h-4 w-4 accent-[#C2410C]"
                      />
                      {day.label}
                    </label>
                  ))}
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <label className="text-sm font-semibold text-[#413830]">
                    Daily start time
                    <input
                      type="time"
                      value={form.dailyStartTime}
                      onChange={(event) =>
                        setForm({ ...form, dailyStartTime: event.target.value })
                      }
                      className={inputClassName}
                    />
                  </label>
                  <label className="text-sm font-semibold text-[#413830]">
                    Daily end time
                    <input
                      type="time"
                      value={form.dailyEndTime}
                      onChange={(event) =>
                        setForm({ ...form, dailyEndTime: event.target.value })
                      }
                      className={inputClassName}
                    />
                  </label>
                  <label className="text-sm font-semibold text-[#413830]">
                    Time zone
                    <select
                      value={form.scheduleTimezone}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          scheduleTimezone: event.target.value,
                        })
                      }
                      className={inputClassName}
                    >
                      {timeZones.map((timeZone) => (
                        <option key={timeZone} value={timeZone}>
                          {timeZone.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </fieldset>
              <label className="flex items-center gap-3 text-sm font-semibold text-[#413830] sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) =>
                    setForm({ ...form, isActive: event.target.checked })
                  }
                  className="h-4 w-4 accent-[#C2410C]"
                />
                Promotion is enabled
              </label>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={closeForm}
                className="rounded-xl border border-[#E7E1D8] px-4 py-2.5 text-sm font-semibold text-[#4B4039] transition hover:bg-[#F7F3ED]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-[#C2410C] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#9A3412] disabled:cursor-wait disabled:opacity-60"
              >
                {saving ? "Saving..." : editingId ? "Save changes" : "Add promotion"}
              </button>
            </div>
          </form>
        )}

        <section className="rounded-2xl border border-[#EBE6DD] bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-bold">All promotions</h2>
          {promos.length ? (
            <div className="mt-4 divide-y divide-[#EBE6DD]">
              {promos.map((promo) => {
                const active = isPromoCurrentlyActive(promo);
                return (
                  <article
                    key={promo.id}
                    className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold">{promo.title}</h3>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            active
                              ? "bg-green-50 text-green-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {active ? "Active" : promo.is_active ? "Scheduled / expired" : "Disabled"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-600">
                        {formatDiscount(promo)} · Code{" "}
                        <span className="font-mono font-semibold">{promo.code}</span>
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        {promo.description}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {promo.applies_to_all
                          ? "Applies to all menu items and categories"
                          : `Categories: ${
                              promo.category_ids
                                .map(
                                  (id) =>
                                    categories.find(
                                      (category) => category.id === id
                                    )?.name ?? id
                                )
                                .join(", ") || "none"
                            } · Items: ${
                              promo.menu_item_ids
                                .map(
                                  (id) =>
                                    menuItems.find((item) => item.id === id)
                                      ?.name ?? id
                                )
                                .join(", ") || "none"
                            }`}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {promo.active_days.length
                          ? promo.active_days
                              .map(
                                (day) =>
                                  daysOfWeek.find(
                                    (candidate) => candidate.value === day
                                  )?.label
                              )
                              .filter(Boolean)
                              .join(", ")
                          : "Every day"}
                        {promo.daily_start_time && promo.daily_end_time
                          ? ` · ${promo.daily_start_time.slice(0, 5)}–${promo.daily_end_time.slice(0, 5)}`
                          : " · All day"}
                        {" · "}
                        {promo.schedule_timezone}
                      </p>
                    </div>
                    <div className="flex gap-2 sm:ml-2">
                      <button
                        type="button"
                        onClick={() => startEditing(promo)}
                        className="rounded-lg border border-[#E7E1D8] px-3 py-2 text-sm font-semibold hover:bg-[#F7F3ED]"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(promo)}
                        disabled={deletingId === promo.id}
                        className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                      >
                        {deletingId === promo.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 py-8 text-center text-sm text-gray-500">
              No promotions have been added yet.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
