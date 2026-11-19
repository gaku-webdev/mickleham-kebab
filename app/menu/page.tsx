import { supabase } from "@/lib/supabase";
import MenuList from "@/components/menu/MenuList";
import type { MenuOptionGroup } from "@/components/menu/ItemCustomizeModal";

export const instant = false;

export default async function MenuPage() {
  const { data, error } = await supabase
    .from("menu_items")
    .select("*, categories(name)")
    .eq("is_available", true)
    .order("category_id");

  if (error) {
    return <p className="p-8 text-red-600">Could not load menu.</p>;
  }

  const menuData = data ?? [];
  const itemIds = menuData.map((item) => item.id);
  const groupsByItemId = new Map<string, MenuOptionGroup[]>();

  if (itemIds.length > 0) {
    const { data: links, error: linksError } = await supabase
      .from("menu_item_option_groups")
      .select("menu_item_id, option_group_id, display_order")
      .in("menu_item_id", itemIds)
      .order("display_order");

    if (linksError || !links) {
      return (
        <p className="p-8 text-red-600">
          Could not load menu customizations.
        </p>
      );
    }

    const groupIds = [...new Set(links.map((link) => link.option_group_id))];
    if (groupIds.length > 0) {
      const [
        { data: groupData, error: groupError },
        { data: choiceData, error: choiceError },
      ] = await Promise.all([
        supabase
          .from("option_groups")
          .select(
            "id, name, selection_type, min_selections, max_selections, is_required"
          )
          .in("id", groupIds),
        supabase
          .from("option_choices")
          .select("id, option_group_id, name, price_adjustment")
          .in("option_group_id", groupIds)
          .eq("is_available", true)
          .order("name"),
      ]);

      if (groupError || !groupData || choiceError || !choiceData) {
        return (
          <p className="p-8 text-red-600">
            Could not load menu customizations.
          </p>
        );
      }

      const groupsById = new Map(
        groupData.map((group) => [group.id, group])
      );
      const choicesByGroupId = new Map<
        string,
        (typeof choiceData)[number][]
      >();
      for (const choice of choiceData) {
        const groupChoices = choicesByGroupId.get(choice.option_group_id) ?? [];
        groupChoices.push(choice);
        choicesByGroupId.set(choice.option_group_id, groupChoices);
      }

      for (const link of links) {
        const group = groupsById.get(link.option_group_id);
        if (!group) {
          return (
            <p className="p-8 text-red-600">
              Could not load menu customizations.
            </p>
          );
        }

        const itemGroups = groupsByItemId.get(link.menu_item_id) ?? [];
        itemGroups.push({
          id: group.id,
          name: group.name,
          selectionType: group.selection_type,
          minSelections: Number(group.min_selections ?? 0),
          maxSelections:
            group.max_selections == null
              ? null
              : Number(group.max_selections),
          isRequired: Boolean(group.is_required),
          choices: (choicesByGroupId.get(group.id) ?? []).map((choice) => ({
            id: choice.id,
            name: choice.name,
            priceAdjustment: Number(choice.price_adjustment),
          })),
        });
        groupsByItemId.set(link.menu_item_id, itemGroups);
      }
    }
  }

  const items = menuData.map((item) => {
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
      customizationGroups: groupsByItemId.get(item.id) ?? [],
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
