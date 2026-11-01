import { supabase } from "@/lib/supabase";

export const instant = false;

export default async function MenuPage() {
  const { data: items, error } = await supabase
    .from("menu_items")
    .select("*")
    .order("category");

  if (error) {
    return <p className="p-8 text-red-600">Could not load menu.</p>;
  }

  const categories = Array.from(new Set(items.map((i) => i.category)));

  return (
    <main className="max-w-3xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Our Menu</h1>

      {categories.map((category) => (
        <section key={category} className="mb-10">
          <h2 className="text-xl font-semibold mb-4">{category}</h2>
          <div className="grid gap-4">
            {items
              .filter((i) => i.category === category)
              .map((item) => (
                <div
                  key={item.id}
                  className="border rounded-lg p-4 flex justify-between"
                >
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-gray-600">
                      {item.description}
                    </p>
                  </div>
                  <p className="font-semibold whitespace-nowrap">
                    ${item.price.toFixed(2)}
                  </p>
                </div>
              ))}
          </div>
        </section>
      ))}
    </main>
  );
}