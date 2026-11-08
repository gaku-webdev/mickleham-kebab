import { supabase } from "@/lib/supabase";
import MenuList from "@/components/menu/MenuList";

export const instant = false;

export default async function MenuPage() {
  const { data, error } = await supabase
  .from("menu_items")
  .select("id, name, description, base_price, categories(name)")
  .order("category_id");

  if (error) {
    return <p className="p-8 text-red-600">Could not load menu.</p>;
  }

  const items = (data ?? []).map((item) => {
    const categoryRelation = item.categories as
      | { name?: string }
      | { name?: string }[]
      | null;
    const category = Array.isArray(categoryRelation)
      ? categoryRelation[0]?.name
      : categoryRelation?.name;

    return {
      id: item.id,
      name: item.name,
      description: item.description ?? "",
      price: Number(item.base_price),
      category: category ?? "",
    };
  });

  return (
    <main className="min-h-screen bg-[#FAF7F2] px-4 py-8 text-[#1C1917] sm:px-8 sm:py-12">
      <div className="mx-auto max-w-4xl">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#EA580C]">
          Mickleham Kebab &amp; Grill
        </p>
        <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">Our Menu</h1>
        <p className="mt-2 mb-8 text-sm text-gray-600">Freshly prepared, your way.</p>

        <div className="rounded-2xl border border-[#EBE6DD] bg-white p-5 shadow-sm sm:p-6">
          <MenuList items={items} />
        </div>
      </div>
    </main>
  );
}
