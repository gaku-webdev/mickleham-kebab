import { supabase } from "@/lib/supabase";

export const instant = false;

export default async function AdminPage() {
  // Fetch orders on the server as a simple connection check
  const { data: orders, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return <p className="p-8 text-red-600">Could not load admin panel.</p>;
  }

  return (
    <main className="max-w-3xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-4">Admin Dashboard</h1>
      <p className="text-gray-600 mb-8">
        Placeholder admin page — {orders?.length || 0} orders currently in the database.
      </p>

      <div className="p-6 border rounded-lg bg-gray-50 text-sm text-gray-500">
        Order management, reservations, and menu controls coming soon.
      </div>
    </main>
  );
}