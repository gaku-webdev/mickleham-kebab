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
    <main className="max-w-3xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Our Menu</h1>

      {/* Hand the data over to the client component, */}
      {/* which handles clicks and the modal. */}
      <MenuList items={items} />
    </main>
  );
}