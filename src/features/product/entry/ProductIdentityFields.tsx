import type { KeyboardEvent } from "react";
import {
  PRODUCT_SUBUNIT_VALUES,
  PRODUCT_UNIT_VALUES,
  localizeProductUnit,
} from "@/i18n/productUnits";
import type { AppLocale } from "@/config/preferences/appPreferences";
import { usePreferences } from "@/app/providers/PreferencesProvider";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/forms/SearchableSelect";
import { decimalText } from "./productItemDraft";
import { ProductRegulatoryFields } from "./ProductRegulatoryFields";
import type { ProductItemDraftController } from "./useProductItemDraft";
import styles from "./ProductEntry.module.css";

function unitOptions(
  values: readonly string[],
  locale: AppLocale,
  currentValue?: string,
): SearchableSelectOption[] {
  return [...new Set([...values, ...(currentValue ? [currentValue] : [])])]
    .map((value) => ({ value, label: localizeProductUnit(locale, value) }));
}

type ProductIdentityFieldsProps = {
  controller: ProductItemDraftController;
  categoryOptions: SearchableSelectOption[];
  section?: "all" | "general" | "pricing-stock";
  onFlowEnter: (event: KeyboardEvent<HTMLElement>) => void;
  onFlowCommit: (field: string) => void;
  onSelectIdentity: (input: HTMLInputElement) => void;
};

export function ProductIdentityFields({
  controller,
  categoryOptions,
  section = "all",
  onFlowEnter,
  onFlowCommit,
  onSelectIdentity,
}: ProductIdentityFieldsProps) {
  const { t, preferences } = usePreferences();
  const { draft } = controller;
  const showGeneral = section === "all" || section === "general";
  const showPricingStock = section === "all" || section === "pricing-stock";
  const fieldClassName = section === "all"
    ? styles.field
    : `${styles.field} ${styles.editInsetRow}`;
  const listClassName = section === "pricing-stock" ? styles.editPricingStockList : "";

  return (
    <section
      className={`${styles.formPanel} ${section === "all" ? "" : styles.editTabPanel}`}
      aria-label={t("stockForm.itemDetail")}
    >
      <div
        className={`${styles.formGrid} ${section === "all" ? "" : styles.editInsetList} ${listClassName}`}
      >
        {showGeneral && <label className={fieldClassName} data-stock-flow="itemName" onKeyDown={onFlowEnter}>
          <span>{t("stock.itemName")}</span>
          <input
            value={draft.itemName}
            placeholder="Paracetamol 500 mg"
            onClick={(event) => onSelectIdentity(event.currentTarget)}
            onChange={(event) => controller.updateField("itemName", event.target.value)}
          />
        </label>}
        {showGeneral && <label className={fieldClassName} data-stock-flow="location" onKeyDown={onFlowEnter}>
          <span>{t("stockForm.location")}</span>
          <input
            value={draft.location}
            onChange={(event) => controller.updateField("location", event.target.value)}
          />
        </label>}
        {showGeneral && <label className={fieldClassName} data-stock-flow="manufacturer" onKeyDown={onFlowEnter}>
          <span>{t("stock.manufacturer")}</span>
          <input
            value={draft.manufacturer}
            onChange={(event) => controller.updateField("manufacturer", event.target.value)}
          />
        </label>}
        {showPricingStock && <label className={fieldClassName} data-stock-flow="sellPrice" onKeyDown={onFlowEnter}>
          <span>{t("stock.sellPrice")}</span>
          <input
            type="text"
            inputMode="decimal"
            value={draft.sellPrice}
            onChange={(event) => controller.updateField("sellPrice", decimalText(event.target.value))}
          />
        </label>}
        {showGeneral && <label className={fieldClassName} data-stock-flow="itemCategory">
          <span>{t("stock.category")}</span>
          <SearchableSelect
            compact
            ariaLabel={t("stock.category")}
            value={draft.itemCategory}
            options={categoryOptions}
            onChange={(value) => controller.updateField("itemCategory", value)}
            onCommit={() => onFlowCommit("itemCategory")}
          />
        </label>}
        {showPricingStock && <label className={fieldClassName} data-stock-flow="weightage" onKeyDown={onFlowEnter}>
          <span>{t("stockForm.amount")}</span>
          <input
            value={draft.weightage}
            placeholder="500"
            onChange={(event) => controller.updateField("weightage", event.target.value)}
          />
        </label>}
        {showPricingStock && <label className={fieldClassName} data-stock-flow="subUnit">
          <span>{t("stockForm.subUnit")}</span>
          <SearchableSelect
            compact
            ariaLabel={t("stockForm.subUnit")}
            value={draft.subUnit}
            options={unitOptions(PRODUCT_SUBUNIT_VALUES, preferences.locale, draft.subUnit)}
            onChange={(value) => controller.updateField("subUnit", value)}
            onCommit={() => onFlowCommit("subUnit")}
          />
        </label>}
        {showPricingStock && <label className={fieldClassName} data-stock-flow="unit">
          <span>{t("stockForm.unit")}</span>
          <SearchableSelect
            compact
            ariaLabel={t("stockForm.unit")}
            value={draft.unit}
            options={unitOptions(PRODUCT_UNIT_VALUES, preferences.locale, draft.unit)}
            onChange={(value) => controller.updateField("unit", value)}
            onCommit={() => onFlowCommit("unit")}
          />
        </label>}
        {showGeneral && <label className={fieldClassName} data-stock-flow="brandName" onKeyDown={onFlowEnter}>
          <span>{t("stockForm.brand")}</span>
          <input
            value={draft.brandName}
            onChange={(event) => controller.updateField("brandName", event.target.value)}
          />
        </label>}
        {section === "general" && (
          <ProductRegulatoryFields controller={controller} variant="edit-row" />
        )}
      </div>
    </section>
  );
}
