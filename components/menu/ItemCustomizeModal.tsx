"use client";

import { useState } from "react";
import { useCart } from "@/context/CartContext";

export type MenuOptionGroup = {
  id: string;
  name: string;
  selectionType: string;
  minSelections: number;
  maxSelections: number | null;
  isRequired: boolean;
  choices: {
    id: string;
    name: string;
    priceAdjustment: number;
  }[];
};

type MenuItem = {
  id: string;
  name: string;
  price: number;
  category: string;
  customizationGroups: MenuOptionGroup[];
};

type Props = {
  item: MenuItem;
  onClose: () => void;
};

function getMinimum(group: MenuOptionGroup) {
  return Math.max(group.minSelections, group.isRequired ? 1 : 0);
}

function getMaximum(group: MenuOptionGroup) {
  const configuredMaximum =
    group.maxSelections ?? Number.POSITIVE_INFINITY;
  return group.selectionType === "single"
    ? Math.min(configuredMaximum, 1)
    : configuredMaximum;
}

function formatAdjustment(amount: number) {
  if (amount === 0) return "Included";
  return `${amount > 0 ? "+" : "−"}$${Math.abs(amount).toFixed(2)}`;
}

export default function ItemCustomizeModal({ item, onClose }: Props) {
  const { addItem } = useCart();
  const [selectedByGroup, setSelectedByGroup] = useState<
    Record<string, string[]>
  >({});
  const [quantity, setQuantity] = useState(1);

  const selectedChoices = item.customizationGroups.flatMap((group) =>
    group.choices.filter((choice) =>
      (selectedByGroup[group.id] ?? []).includes(choice.id)
    )
  );
  const selectedOptionIds = selectedChoices.map((choice) => choice.id);
  const unitPrice =
    item.price +
    selectedChoices.reduce((total, choice) => total + choice.priceAdjustment, 0);
  const validSelection = item.customizationGroups.every((group) => {
    const count = selectedByGroup[group.id]?.length ?? 0;
    return count >= getMinimum(group) && count <= getMaximum(group);
  });
  const canAdd =
    validSelection && Number.isFinite(unitPrice) && unitPrice >= 0;

  function setChoiceSelected(
    group: MenuOptionGroup,
    choiceId: string,
    isSelected: boolean
  ) {
    setSelectedByGroup((current) => {
      const currentChoices = current[group.id] ?? [];
      let nextChoices: string[];

      if (group.selectionType === "single") {
        nextChoices = isSelected ? [choiceId] : [];
      } else if (isSelected) {
        nextChoices = currentChoices.includes(choiceId)
          ? currentChoices
          : [...currentChoices, choiceId];
      } else {
        nextChoices = currentChoices.filter((id) => id !== choiceId);
      }

      return { ...current, [group.id]: nextChoices };
    });
  }

  function handleAddToCart() {
    if (!canAdd) return;

    const details =
      selectedChoices.length > 0
        ? ` (${selectedChoices.map((choice) => choice.name).join(", ")})`
        : "";
    const cartItemId = [item.id, ...[...selectedOptionIds].sort()].join("-");

    addItem({
      id: cartItemId,
      menuItemId: item.id,
      name: `${item.name}${details}`,
      price: unitPrice,
      quantity,
      selectedOptionIds,
    });

    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="customize-item-title"
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="shrink-0 border-b border-stone-100 px-5 pb-5 pt-4 sm:px-7 sm:pt-6">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-stone-200 sm:hidden" />
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-700">
                {item.category}
              </p>
              <h2
                id="customize-item-title"
                className="mt-1 text-2xl font-extrabold tracking-tight text-stone-900"
              >
                {item.name}
              </h2>
              <p className="mt-1 text-sm text-stone-500">
                Choose from the available options.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close customization"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-100 text-xl text-stone-600 transition hover:bg-stone-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-200"
            >
              ×
            </button>
          </div>
          <p className="mt-4 text-lg font-bold tabular-nums text-stone-900">
            ${unitPrice.toFixed(2)}
            <span className="ml-1 text-sm font-normal text-stone-500">
              each
            </span>
          </p>
        </div>

        <div className="overflow-y-auto px-5 py-5 sm:px-7">
          {item.customizationGroups.map((group) => {
            const selectedIds = selectedByGroup[group.id] ?? [];
            const minimum = getMinimum(group);
            const maximum = getMaximum(group);

            return (
              <fieldset
                key={group.id}
                className="mb-6 last:mb-0"
                disabled={group.choices.length === 0}
              >
                <legend className="text-sm font-bold text-stone-900">
                  {group.name}
                </legend>
                <p className="mb-3 mt-1 text-xs text-stone-500">
                  {group.isRequired ? "Required" : "Optional"}
                  {minimum > 0 ? ` · Select at least ${minimum}` : ""}
                  {Number.isFinite(maximum) ? ` · Up to ${maximum}` : ""}
                </p>
                {group.choices.length > 0 ? (
                  <div className="space-y-2">
                    {group.choices.map((choice) => {
                      const isSelected = selectedIds.includes(choice.id);
                      const limitReached =
                        selectedIds.length >= maximum && !isSelected;

                      return (
                        <label
                          key={choice.id}
                          className={`flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded-xl border px-4 py-3 transition ${
                            isSelected
                              ? "border-orange-600 bg-orange-50"
                              : "border-stone-200 hover:border-orange-300"
                          } ${limitReached ? "cursor-not-allowed opacity-50" : ""}`}
                        >
                          <span className="text-sm font-medium text-stone-800">
                            {choice.name}
                          </span>
                          <span className="flex shrink-0 items-center gap-3">
                            <span className="text-xs font-semibold text-stone-600">
                              {formatAdjustment(choice.priceAdjustment)}
                            </span>
                            <input
                              type={
                                group.selectionType === "single"
                                  ? "radio"
                                  : "checkbox"
                              }
                              name={`option-group-${group.id}`}
                              checked={isSelected}
                              disabled={limitReached}
                              onChange={(event) =>
                                setChoiceSelected(
                                  group,
                                  choice.id,
                                  event.target.checked
                                )
                              }
                              className="h-4 w-4 accent-orange-600"
                            />
                          </span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                    No options are currently available.
                  </p>
                )}
              </fieldset>
            );
          })}

          <div className="flex items-center justify-between border-t border-stone-100 pt-5">
            <div>
              <p className="text-sm font-bold text-stone-900">Quantity</p>
              <p className="mt-0.5 text-xs text-stone-500">
                How many would you like?
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Decrease quantity"
                onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 text-lg font-semibold text-stone-700 transition hover:border-orange-300 hover:text-orange-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-200"
              >
                −
              </button>
              <span className="min-w-5 text-center font-bold tabular-nums text-stone-900">
                {quantity}
              </span>
              <button
                type="button"
                aria-label="Increase quantity"
                onClick={() => setQuantity((current) => current + 1)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 text-lg font-semibold text-stone-700 transition hover:border-orange-300 hover:text-orange-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-200"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-stone-100 bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 sm:px-7">
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={!canAdd}
            className="flex min-h-14 w-full items-center justify-between rounded-xl bg-orange-700 px-5 text-base font-bold text-white shadow-lg shadow-orange-700/20 transition hover:bg-orange-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span>Add to cart</span>
            <span className="tabular-nums">
              ${(unitPrice * quantity).toFixed(2)}
            </span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="mt-2 min-h-10 w-full text-sm font-semibold text-stone-500 transition hover:text-stone-800"
          >
            Keep browsing
          </button>
        </div>
      </section>
    </div>
  );
}
