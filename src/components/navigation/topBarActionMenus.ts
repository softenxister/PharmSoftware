import type { TranslationKey } from "@/i18n/i18n";

export type TopBarActionMenuIcon =
  | "plus"
  | "migration"
  | "discount"
  | "adjustment"
  | "min-max";

export type TopBarActionMenuItem = {
  labelKey: TranslationKey;
  href: string;
  icon: TopBarActionMenuIcon;
};

export const topBarActionMenus = {
  "nav.sales": [
    { labelKey: "nav.newSale", href: "/sales/new", icon: "plus" },
  ],
  "nav.purchase": [
    { labelKey: "purchase.new", href: "/purchase/new", icon: "plus" },
  ],
  "nav.stock": [
    { labelKey: "stock.migration", href: "/stock/migration", icon: "migration" },
    { labelKey: "stock.discounts", href: "/stock/discounts", icon: "discount" },
    { labelKey: "stock.adjustment", href: "/stock/adjustment", icon: "adjustment" },
    { labelKey: "stock.minMax", href: "/stock/min-max", icon: "min-max" },
  ],
  "nav.member": [
    { labelKey: "member.create", href: "/member?create=1", icon: "plus" },
  ],
} satisfies Partial<Record<TranslationKey, TopBarActionMenuItem[]>>;
