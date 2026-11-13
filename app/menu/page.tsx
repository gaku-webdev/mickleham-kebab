import { supabase } from "@/lib/supabase";
import MenuList from "@/components/menu/MenuList";

export const instant = false;

export default async function MenuPage() {
  const { data, error } = await supabase
  .from("menu_items")
  .select("*, categories(name)")
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
      imageUrl: String((item as { image_url?: string | null }).image_url ?? ""),
    };
  });

  return (
    <main className="min-h-screen bg-[#FAF7F2] px-4 pb-24 text-[#1C1917] sm:px-8">
      <div className="mx-auto max-w-6xl">
        <MenuList items={items} />
      </div>
    </main>
  );
}
