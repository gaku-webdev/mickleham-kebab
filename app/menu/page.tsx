import { supabase } from "@/lib/supabase";
import MenuList from "@/components/menu/MenuList";

export const instant = false;

export default async function MenuPage() {
  // This part still runs on the server, fetching the data.
  const { data: items, error } = await supabase
  .from("menu_items")
  .select("*, categories(name, slug)")
  .order("category_id");

  if (error) {
    return <p className="p-8 text-red-600">Could not load menu.</p>;
  }

  return (
    <main className="max-w-3xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Our Menu</h1>

      {/* Hand the data over to the client component, */}
      {/* which handles clicks and the modal. */}
      <MenuList items={items} />
    </main>
  );
}