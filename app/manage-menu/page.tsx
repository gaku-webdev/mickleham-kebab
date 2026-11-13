"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import Loader from "@/components/Loader";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

type Category = {
  id: string;
  name: string;
};

type MenuItem = {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  categoryId: string;
  imageUrl: string;
};

type MenuItemForm = {
  name: string;
  description: string;
  price: string;
  categoryId: string;
  imageUrl: string;
};

const emptyForm: MenuItemForm = {
  name: "",
  description: "",
  price: "",
  categoryId: "",
  imageUrl: "",
};

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

function createUniqueSlug(
  name: string,
  existingItems: Pick<MenuItem, "id" | "slug">[],
  editingId: string | null
) {
  const baseSlug =
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "menu-item";

  const takenSlugs = new Set(
    existingItems
      .filter((item) => item.id !== editingId)
      .map((item) => item.slug.toLowerCase())
  );

  if (!takenSlugs.has(baseSlug)) {
    return baseSlug;
  }

  let counter = 2;
  while (takenSlugs.has(`${baseSlug}-${counter}`)) {
    counter += 1;
  }
  return `${baseSlug}-${counter}`;
}

export default function ManageMenuPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [permissionLoading, setPermissionLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [itemsByCategory, setItemsByCategory] = useState<
    Record<string, MenuItem[]>
  >({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItemCount, setMenuItemCount] = useState(0);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set()
  );
  const [loadingCategories, setLoadingCategories] = useState<Set<string>>(
    new Set()
  );
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MenuItemForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadMenu = useCallback(async () => {
    setLoadError("");

    const [{ data: categoryData, error: categoryError }, itemCountResult] =
      await Promise.all([
        supabase.from("categories").select("id, name").order("name"),
        supabase
          .from("menu_items")
          .select("id", { count: "exact", head: true }),
      ]);

    if (categoryError || itemCountResult.error) {
      setLoadError(
        categoryError?.message ??
          itemCountResult.error?.message ??
          "Could not load menu data."
      );
      return false;
    }

    const loadedCategories = (categoryData ?? []).map((category) => ({
      id: String(category.id),
      name: String(category.name),
    }));
    setCategories(loadedCategories);
    setMenuItemCount(itemCountResult.count ?? 0);
    return true;
  }, []);

  const loadCategoryItems = useCallback(
    async (categoryId: string, force = false) => {
      if (!force && itemsByCategory[categoryId]) return true;

      setLoadingCategories((current) => new Set(current).add(categoryId));
      const { data, error } = await supabase
        .from("menu_items")
        .select("*")
        .eq("category_id", categoryId)
        .order("name");

      setLoadingCategories((current) => {
        const next = new Set(current);
        next.delete(categoryId);
        return next;
      });

      if (error) {
        setLoadError(error.message);
        return false;
      }

      const loadedItems = (data ?? []).map((row) => {
        const item = row as Record<string, unknown>;
        return {
          id: String(item.id),
          name: String(item.name ?? ""),
          slug: String(item.slug ?? ""),
          description: String(item.description ?? ""),
          price: Number(item.base_price ?? 0),
          categoryId:
            item.category_id == null ? "" : String(item.category_id),
          imageUrl: String(item.image_url ?? ""),
        };
      });
      setItemsByCategory((current) => ({
        ...current,
        [categoryId]: loadedItems,
      }));
      return true;
    },
    [itemsByCategory]
  );

  const refreshAfterMutation = useCallback(
    async (categoryIds: string[]) => {
      const refreshCategories = new Set([
        ...expandedCategories,
        ...categoryIds,
      ]);
      const categoriesLoaded = await loadMenu();
      const categoryIdsToRefresh = [...refreshCategories].filter((id) =>
        categories.some((category) => category.id === id)
      );

      if (categoriesLoaded) {
        await Promise.all(
          categoryIdsToRefresh.map((id) => loadCategoryItems(id, true))
        );
      }

      setExpandedCategories(refreshCategories);
      router.refresh();
    },
    [categories, expandedCategories, loadCategoryItems, loadMenu, router]
  );

  useEffect(() => {
    let active = true;

    async function checkAccess() {
      if (authLoading) return;
      if (!user) {
        if (active) {
          setIsAuthorized(false);
          setPermissionLoading(false);
        }
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

      const authorized = isAdminOrStaff(data);
      setIsAuthorized(authorized);
      setPermissionLoading(false);

      if (authorized) {
        await loadMenu();
      }
    }

    void checkAccess();
    return () => {
      active = false;
    };
  }, [authLoading, loadMenu, user]);

  const allLoadedItems = useMemo(
    () => Object.values(itemsByCategory).flat(),
    [itemsByCategory]
  );

  const filteredItemsByCategory = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return Object.fromEntries(
      Object.entries(itemsByCategory).map(([categoryId, items]) => [
        categoryId,
        query
          ? items.filter((item) => {
              const category =
                categories.find((candidate) => candidate.id === item.categoryId)
                  ?.name ?? "";
              return `${item.name} ${item.description} ${category}`
                .toLocaleLowerCase()
                .includes(query);
            })
          : items,
      ])
    );
  }, [categories, itemsByCategory, search]);

  function toggleCategory(categoryId: string) {
    const isExpanded = expandedCategories.has(categoryId);
    setExpandedCategories((current) => {
      const next = new Set(current);
      if (isExpanded) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });

    if (!isExpanded) void loadCategoryItems(categoryId);
  }

  function startNewItem() {
    setEditingId(null);
    setShowForm(true);
    setForm({ ...emptyForm, categoryId: categories[0]?.id ?? "" });
    setActionError("");
    setNotice("");
  }

  function startEditing(item: MenuItem) {
    setEditingId(item.id);
    setShowForm(true);
    setForm({
      name: item.name,
      description: item.description,
      price: String(item.price),
      categoryId: item.categoryId,
      imageUrl: item.imageUrl,
    });
    setActionError("");
    setNotice("");
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setActionError("");
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionError("");
    setNotice("");

    const price = Number(form.price);
    if (!form.name.trim()) {
      setActionError("Enter a name for this menu item.");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setActionError("Enter a valid price of 0 or more.");
      return;
    }
    if (!form.categoryId) {
      setActionError("Choose a category before saving.");
      return;
    }
    if (form.imageUrl.trim()) {
      try {
        const imageUrl = new URL(form.imageUrl.trim());
        if (imageUrl.protocol !== "http:" && imageUrl.protocol !== "https:") {
          setActionError(
            "Use an image URL that starts with http:// or https://."
          );
          return;
        }
      } catch {
        setActionError("Enter a valid image URL.");
        return;
      }
    }

    setSaving(true);
    const { data: slugData, error: slugError } = await supabase
      .from("menu_items")
      .select("id, slug");
    if (slugError) {
      setActionError(slugError.message);
      setSaving(false);
      return;
    }

    const existingSlugs = (slugData ?? []).map((row) => ({
      id: String(row.id),
      slug: String(row.slug ?? ""),
    }));
    const previousCategoryId = allLoadedItems.find(
      (item) => item.id === editingId
    )?.categoryId;
    const values: Record<string, string | number | null> = {
      name: form.name.trim(),
      slug: createUniqueSlug(form.name, existingSlugs, editingId),
      description: form.description.trim() || null,
      base_price: price,
      category_id: form.categoryId,
    };
    if (
      form.imageUrl.trim() ||
      (editingId &&
        allLoadedItems.find((item) => item.id === editingId)?.imageUrl)
    ) {
      values.image_url = form.imageUrl.trim() || null;
    }

    const result = editingId
      ? await supabase.from("menu_items").update(values).eq("id", editingId)
      : await supabase.from("menu_items").insert(values);

    if (result.error) {
      setActionError(
        result.error.message.includes("image_url")
          ? `${result.error.message} Add an image_url column to menu_items to save menu images.`
          : result.error.message
      );
      setSaving(false);
      return;
    }

    await refreshAfterMutation(
      [previousCategoryId, form.categoryId].filter(
        (categoryId): categoryId is string => Boolean(categoryId)
      )
    );
    setSaving(false);
    const successMessage = editingId
      ? "Menu item updated."
      : "Menu item added.";
    closeForm();
    setNotice(successMessage);
  }

  async function handleDelete(item: MenuItem) {
    if (
      !window.confirm(
        `Remove "${item.name}" from the menu? This action cannot be undone.`
      )
    ) {
      return;
    }

    setDeletingId(item.id);
    setActionError("");
    setNotice("");
    const { error } = await supabase
      .from("menu_items")
      .delete()
      .eq("id", item.id);

    if (error) {
      setActionError(error.message);
      setDeletingId(null);
      return;
    }

    await refreshAfterMutation([item.categoryId]);
    if (editingId === item.id) closeForm();
    setNotice(`${item.name} was removed from the menu.`);
    setDeletingId(null);
  }

  if (authLoading || permissionLoading) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center bg-[#FAF7F2] px-4 text-[#1C1917]">
        <Loader label="Checking permissions..." />
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
              ? "You need an admin or staff role to manage menu items."
              : "Sign in with an admin or staff account to manage the menu."}
          </p>
          {loadError && (
            <p className="mt-4 rounded-xl bg-red-50 p-3 text-left text-sm text-red-700">
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
              Manage menu
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Keep item names, descriptions, prices, categories, and images up
              to date.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/menu"
              className="rounded-xl border border-[#E7E1D8] bg-white px-4 py-3 text-sm font-semibold text-[#4B4039] transition hover:bg-[#F7F3ED]"
            >
              View customer menu
            </Link>
            <button
              type="button"
              onClick={startNewItem}
              className="rounded-xl bg-[#C2410C] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#9A3412]"
            >
              + Add menu item
            </button>
          </div>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#EBE6DD] bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Menu items
            </p>
            <p className="mt-2 text-3xl font-extrabold text-[#C2410C]">
              {menuItemCount}
            </p>
          </div>
          <div className="rounded-2xl border border-[#EBE6DD] bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Categories
            </p>
            <p className="mt-2 text-3xl font-extrabold text-[#C2410C]">
              {categories.length}
            </p>
          </div>
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

        {showForm ? (
          <form
            onSubmit={handleSave}
            className="mb-7 rounded-2xl border border-[#EBE6DD] bg-white p-5 shadow-sm sm:p-6"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">
                  {editingId ? "Edit menu item" : "Add a menu item"}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Changes are saved directly to your menu.
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
                Item name
                <input
                  autoFocus
                  required
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                  placeholder="e.g. Chicken kebab"
                  className={inputClassName}
                />
              </label>
              <label className="text-sm font-semibold text-[#413830]">
                Category
                <select
                  required
                  value={form.categoryId}
                  onChange={(event) =>
                    setForm({ ...form, categoryId: event.target.value })
                  }
                  className={inputClassName}
                >
                  <option value="">Choose a category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                {categories.length === 0 && (
                  <span className="mt-1 block text-xs font-normal text-amber-700">
                    Add a category in your database before creating menu items.
                  </span>
                )}
              </label>
              <label className="text-sm font-semibold text-[#413830]">
                Price
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500">
                    $
                  </span>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={form.price}
                    onChange={(event) =>
                      setForm({ ...form, price: event.target.value })
                    }
                    placeholder="0.00"
                    className={`${inputClassName} pl-8`}
                  />
                </div>
              </label>
              <label className="text-sm font-semibold text-[#413830] sm:col-span-2">
                Description
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(event) =>
                    setForm({ ...form, description: event.target.value })
                  }
                  placeholder="Describe the ingredients or what makes this item special"
                  className={`${inputClassName} resize-y`}
                />
              </label>
              <label className="text-sm font-semibold text-[#413830] sm:col-span-2">
                Image URL
                <input
                  type="url"
                  value={form.imageUrl}
                  onChange={(event) =>
                    setForm({ ...form, imageUrl: event.target.value })
                  }
                  placeholder="https://example.com/menu-item.jpg"
                  className={inputClassName}
                />
                <span className="mt-1 block text-xs font-normal text-gray-500">
                  Use a publicly accessible image link.
                </span>
                {form.imageUrl && (
                  <img
                    src={form.imageUrl}
                    alt={`${form.name || "Menu item"} preview`}
                    className="mt-3 h-32 w-40 rounded-xl border border-[#EBE6DD] object-cover"
                  />
                )}
              </label>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={closeForm}
                className="rounded-xl border border-[#E7E1D8] px-4 py-2.5 text-sm font-semibold text-[#4B4039] hover:bg-[#F7F3ED]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || categories.length === 0}
                className="rounded-xl bg-[#C2410C] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#9A3412] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving
                  ? (
                      <Loader
                        size="sm"
                        label="Saving..."
                        inline
                        className="text-white"
                      />
                    )
                  : editingId
                  ? "Save changes"
                  : "Add item"}
              </button>
            </div>
          </form>
        ) : null}

        <section className="rounded-2xl border border-[#EBE6DD] bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold">Menu by category</h2>
              <p className="mt-1 text-sm text-gray-500">
                Open a category to load and manage its menu items.
              </p>
            </div>
            <label className="sr-only" htmlFor="menu-search">
              Search menu items
            </label>
            <input
              id="menu-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search menu..."
              className="w-full rounded-xl border border-[#E7E1D8] px-3.5 py-2.5 text-sm outline-none focus:border-[#C2410C] sm:max-w-xs"
            />
          </div>

          {categories.length ? (
            <div className="space-y-3">
              {categories
                .filter((category) => {
                  const query = search.trim().toLocaleLowerCase();
                  const items = filteredItemsByCategory[category.id] ?? [];
                  return (
                    !query ||
                    category.name.toLocaleLowerCase().includes(query) ||
                    items.length > 0
                  );
                })
                .map((category) => {
                  const isExpanded = expandedCategories.has(category.id);
                  const categoryItems =
                    filteredItemsByCategory[category.id] ?? [];
                  const loadedItems = itemsByCategory[category.id];
                  const loading = loadingCategories.has(category.id);

                  return (
                    <section
                      key={category.id}
                      className="overflow-hidden rounded-xl border border-[#EEE9E1]"
                    >
                      <button
                        type="button"
                        onClick={() => toggleCategory(category.id)}
                        aria-expanded={isExpanded}
                        className="flex w-full items-center justify-between gap-4 bg-[#FCFAF7] px-4 py-4 text-left transition hover:bg-[#F7F3ED]"
                      >
                        <span className="font-bold">{category.name}</span>
                        <span className="flex items-center gap-3 text-sm text-gray-500">
                          {loadedItems
                            ? `${loadedItems.length} ${
                                loadedItems.length === 1 ? "item" : "items"
                              }`
                            : "Open to load items"}
                          <span aria-hidden="true">
                            {isExpanded ? "−" : "+"}
                          </span>
                        </span>
                      </button>
                      {isExpanded && (
                        <div className="divide-y divide-[#EEE9E1] px-4">
                          {loading ? (
                            <div className="py-6">
                              <Loader size="sm" label="Loading menu items..." />
                            </div>
                          ) : categoryItems.length ? (
                            categoryItems.map((item) => (
                              <article
                                key={item.id}
                                className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center"
                              >
                                {item.imageUrl ? (
                                  <img
                                    src={item.imageUrl}
                                    alt=""
                                    className="h-20 w-24 shrink-0 rounded-xl border border-[#EBE6DD] object-cover"
                                  />
                                ) : (
                                  <div className="flex h-20 w-24 shrink-0 items-center justify-center rounded-xl bg-[#F7F3ED] text-xs font-semibold uppercase tracking-wide text-[#8A796A]">
                                    No image
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <h3 className="font-bold">{item.name}</h3>
                                    <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-[#9A3412]">
                                      {category.name}
                                    </span>
                                  </div>
                                  <p className="mt-1 line-clamp-2 text-sm text-gray-600">
                                    {item.description || "No description"}
                                  </p>
                                </div>
                                <p className="font-bold tabular-nums">
                                  ${item.price.toFixed(2)}
                                </p>
                                <div className="flex gap-2 sm:ml-2">
                                  <button
                                    type="button"
                                    onClick={() => startEditing(item)}
                                    className="rounded-lg border border-[#E7E1D8] px-3 py-2 text-sm font-semibold hover:bg-[#F7F3ED]"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleDelete(item)}
                                    disabled={deletingId === item.id}
                                    className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                                  >
                                    {deletingId === item.id
                                      ? (
                                          <Loader
                                            size="sm"
                                            label="Removing..."
                                            inline
                                            className="text-white"
                                          />
                                        )
                                      : "Remove"}
                                  </button>
                                </div>
                              </article>
                            ))
                          ) : (
                            <p className="py-6 text-center text-sm text-gray-500">
                              {loadedItems
                                ? search.trim()
                                  ? "No menu items match your search."
                                  : "No menu items in this category."
                                : "Open this category to load its menu items."}
                            </p>
                          )}
                        </div>
                      )}
                    </section>
                  );
                })}
            </div>
          ) : (
            <div className="py-12 text-center">
              <p className="font-semibold text-[#413830]">
                {menuItemCount
                  ? "No categories are available."
                  : "Your menu is empty."}
              </p>
              {!menuItemCount && (
                <p className="mt-2 text-sm text-gray-500">
                  Add your first item to get started.
                </p>
              )}
            </div>
          )}
          {categories.length > 0 &&
            search.trim() &&
            categories.every(
              (category) =>
                !category.name.toLocaleLowerCase().includes(
                  search.trim().toLocaleLowerCase()
                ) &&
                !(filteredItemsByCategory[category.id]?.length ?? 0)
            ) && (
              <p className="py-8 text-center text-sm text-gray-500">
              No loaded menu items match your search. Open categories to
              search their items.
              </p>
            )}
        </section>
      </div>
    </main>
  );
}