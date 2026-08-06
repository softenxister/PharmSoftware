export const PRODUCT_EDIT_TABS = [
  "general",
  "pricing-stock",
  "ingredients",
  "packaging",
] as const;

export type ProductEditTab = typeof PRODUCT_EDIT_TABS[number];

export function getAdjacentProductEditTab(
  currentTab: ProductEditTab,
  direction: -1 | 1,
): ProductEditTab {
  const currentIndex = PRODUCT_EDIT_TABS.indexOf(currentTab);
  const nextIndex = (currentIndex + direction + PRODUCT_EDIT_TABS.length)
    % PRODUCT_EDIT_TABS.length;
  return PRODUCT_EDIT_TABS[nextIndex];
}
