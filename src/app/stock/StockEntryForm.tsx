"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronDown,
  ImagePlus,
  PackagePlus,
  Plus,
  Trash2,
  Wand2,
} from "lucide-react";
import type { StockItemInput } from "@/server/db/types";
import styles from "./Stock.module.css";

type PackagingRow = {
  id: string;
  parentUnit: string;
  childQuantity: string;
  childUnit: string;
  barcode: string;
};

type StockEntryFormProps = {
  onClose?: () => void;
  onSave?: (item: StockItemInput) => void | Promise<void>;
  categoryOptions?: string[];
  initialItem?: StockItemInput;
  mode?: "create" | "edit";
};

type SelectOption = {
  value: string;
  label: string;
};

const itemCategories = [
  "Pain Relief",
  "Allergy & Cold",
  "Gastrointestinal",
  "Vitamins & Supplements",
  "First Aid",
  "Skincare",
  "Personal Care",
  "Oral Care",
];

const unitOptions = ["tablet", "caplet", "blister", "box", "bottle", "sachet", "tube", "piece", "ml", "g"];
const packageOptions = ["box", "bottle", "tube", "strip", "carton", "blister", "sachet", "piece"];
const regulatoryFormOptions = ["ข.ย. 9", "ข.ย. 10", "ข.ย. 11"];

function generateBarcode(): string {
  const timePart = Date.now().toString().slice(-9);
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `${timePart}${randomPart}`.slice(0, 13).padStart(13, "2");
}

function createPackagingRow(): PackagingRow {
  return {
    id: crypto.randomUUID(),
    parentUnit: "box",
    childQuantity: "",
    childUnit: "blister",
    barcode: "",
  };
}

function optionList(values: string[]): SelectOption[] {
  return values.map((value) => ({ value, label: value }));
}

function useClickOutside<T extends HTMLElement>(onOutside: () => void) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    function handleMouseDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onOutside();
    }

    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [onOutside]);

  return ref;
}

function SearchableSelect({
  ariaLabel,
  value,
  options,
  onChange,
  allowCustom = false,
  customOptionLabel,
  onCommit,
}: {
  ariaLabel: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  allowCustom?: boolean;
  customOptionLabel?: (value: string) => string;
  onCommit?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false));
  const inputRef = useRef<HTMLInputElement | null>(null);
  const filteredOptions = options.filter((option) => option.label.toLowerCase().includes(search.trim().toLowerCase()));
  const customValue = search.trim();

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
  }, [open]);

  function choose(nextValue: string) {
    onChange(nextValue);
    setSearch("");
    setOpen(false);
    window.setTimeout(() => onCommit?.(), 0);
  }

  return (
    <div className={styles.searchSelect} ref={ref}>
      <div className={styles.searchSelectButton}>
        <input
          ref={inputRef}
          type="text"
          value={open ? search : value}
          placeholder={value || "Select"}
          readOnly={!open}
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={open}
          onFocus={() => {
            setSearch("");
            setOpen(true);
          }}
          onClick={() => {
            setSearch("");
            setOpen(true);
          }}
          onChange={(event) => {
            setSearch(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.stopPropagation();
              if (open && filteredOptions[0]) {
                choose(filteredOptions[0].value);
                return;
              }
              if (open && allowCustom && customValue) {
                choose(customValue);
                return;
              }
              setOpen(true);
            }
            if (event.key === "ArrowDown") {
              event.preventDefault();
              event.stopPropagation();
              setOpen(true);
            }
            if (event.key === "Escape") {
              event.preventDefault();
              setSearch("");
              setOpen(false);
            }
          }}
        />
        <button
          type="button"
          aria-label={`Open ${ariaLabel}`}
          onClick={() => {
            setSearch("");
            setOpen((current) => !current);
            window.setTimeout(() => inputRef.current?.focus(), 0);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.stopPropagation();
              setOpen(true);
            }
          }}
        >
          <ChevronDown className={open ? styles.searchSelectChevronOpen : ""} size={16} strokeWidth={2.2} />
        </button>
      </div>

      {open && (
        <div className={styles.searchSelectMenu}>
          <div className={styles.searchSelectOptions} role="listbox" aria-label={ariaLabel}>
            {filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option.value)}
              >
                {option.label}
              </button>
            ))}
            {allowCustom && customValue && filteredOptions.every((option) => option.value.toLowerCase() !== customValue.toLowerCase()) && (
              <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => choose(customValue)}>
                {customOptionLabel ? customOptionLabel(customValue) : `Use "${customValue}"`}
              </button>
            )}
            {filteredOptions.length === 0 && (!allowCustom || !customValue) && (
              <span className={styles.searchSelectEmpty}>No match</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function focusNextField(currentFlow: string) {
  const fields = Array.from(document.querySelectorAll<HTMLElement>("[data-stock-flow]"));
  const currentIndex = fields.findIndex((element) => element.dataset.stockFlow === currentFlow);
  const nextField = fields[currentIndex + 1];
  if (!nextField) return;
  const focusTarget = nextField.matches("input,button")
    ? nextField
    : nextField.querySelector<HTMLElement>("input,button");
  focusTarget?.focus();
}

function handleFlowEnter(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== "Enter") return;
  const target = event.target as HTMLElement;
  if (target.tagName === "BUTTON") return;
  const flow = event.currentTarget.dataset.stockFlow;
  if (!flow) return;
  event.preventDefault();
  focusNextField(flow);
}

function handleNumberText(value: string): string {
  return value.replace(/[^\d.]/g, "");
}

function mergeUniqueOptions(...optionGroups: string[][]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];

  optionGroups.flat().forEach((option) => {
    const cleanOption = option.trim();
    const key = cleanOption.toLowerCase();
    if (!cleanOption || seen.has(key)) return;
    seen.add(key);
    merged.push(cleanOption);
  });

  return merged;
}

export function StockEntryForm({
  onClose,
  onSave,
  categoryOptions = [],
  initialItem,
  mode = "create",
}: StockEntryFormProps) {
  const resolvedCategoryOptions = useMemo(
    () => mergeUniqueOptions(itemCategories, categoryOptions),
    [categoryOptions],
  );
  const [photoUrl, setPhotoUrl] = useState(initialItem?.photoUrl ?? "");
  const [barcode, setBarcode] = useState(initialItem?.barcode ?? "");
  const [itemName, setItemName] = useState(initialItem?.itemName ?? "");
  const [location, setLocation] = useState(initialItem?.location ?? "");
  const [manufacturer, setManufacturer] = useState(initialItem?.manufacturer ?? "");
  const [sellPrice, setSellPrice] = useState(initialItem?.sellPrice ?? "");
  const [itemCategory, setItemCategory] = useState(initialItem?.itemCategory ?? resolvedCategoryOptions[0] ?? "");
  const [weightage, setWeightage] = useState(initialItem?.weightage ?? "");
  const [subUnit, setSubUnit] = useState(initialItem?.subUnit ?? unitOptions[0]);
  const [unit, setUnit] = useState(initialItem?.unit ?? unitOptions[0]);
  const [brandName, setBrandName] = useState(initialItem?.brandName ?? "");
  const lotNo = initialItem?.lotNo ?? "";
  const expiryDate = initialItem?.expiryDate ?? "";
  const [regulatoryForms, setRegulatoryForms] = useState<string[]>(["ข.ย. 9"]);
  const [focusPackagingRowId, setFocusPackagingRowId] = useState<string | null>(null);
  const packagingRowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [packagingRows, setPackagingRows] = useState<PackagingRow[]>(() => {
    const rows = initialItem?.packagingRows.map((row, index) => ({
      ...row,
      id: `package-${index + 1}`,
    })) ?? [];
    return rows.length > 0 ? rows : [createPackagingRow()];
  });
  const isEditing = mode === "edit";

  useEffect(() => {
    if (!focusPackagingRowId) return;
    packagingRowRefs.current[focusPackagingRowId]?.querySelector<HTMLInputElement>("input")?.focus();
    setFocusPackagingRowId(null);
  }, [focusPackagingRowId, packagingRows]);

  const missingSaveFields = useMemo(() => {
    const price = Number(sellPrice);
    const missing: string[] = [];

    if (barcode.trim().length === 0) missing.push("barcode");
    if (itemName.trim().length === 0) missing.push("item name");
    if (!Number.isFinite(price) || price <= 0) missing.push("sell price");
    if (weightage.trim().length === 0) missing.push("weightage");

    return missing;
  }, [barcode, itemName, sellPrice, weightage]);
  const canSave = missingSaveFields.length === 0;

  const updatePackagingRow = (id: string, patch: Partial<PackagingRow>) => {
    setPackagingRows((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const addPackagingRow = (focusNewRow = false) => {
    const row = createPackagingRow();
    setPackagingRows((rows) => [...rows, row]);
    if (focusNewRow) setFocusPackagingRowId(row.id);
  };

  const handlePackagingEnter = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter") return;
    const target = event.target as HTMLElement;
    if (target.tagName === "BUTTON" || target.closest(`.${styles.searchSelect}`)) return;
    event.preventDefault();
    addPackagingRow(true);
  };

  const removePackagingRow = (id: string) => {
    setPackagingRows((rows) => (rows.length > 1 ? rows.filter((row) => row.id !== id) : rows));
  };

  const toggleRegulatoryForm = (form: string) => {
    if (form === "ข.ย. 9") return;
    setRegulatoryForms((current) => (
      current.includes(form) ? current.filter((entry) => entry !== form) : [...current, form]
    ));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSave) return;

    onSave?.({
      photoUrl,
      barcode,
      itemName,
      lotNo,
      expiryDate,
      location,
      manufacturer,
      sellPrice,
      itemCategory,
      weightage,
      subUnit,
      unit,
      brandName,
      packagingRows,
    });
  };

  return (
    <form className={`${styles.stockForm} ${styles.stockFormPortrait}`} onSubmit={handleSubmit} noValidate>
      <div className={styles.formHeader}>
        <div>
          <h1>{isEditing ? "Edit Item" : "Create New Item"}</h1>
        </div>
        <div className={styles.formHeaderActions}>
          {onClose ? (
            <button type="button" className={styles.moreButton} onClick={onClose}>
              <ArrowLeft size={17} />
              <span>Back</span>
            </button>
          ) : (
            <Link href="/stock" className={styles.moreButton}>
              <ArrowLeft size={17} />
              <span>Back</span>
            </Link>
          )}
          <button type="submit" className={styles.toolbarAddButton} disabled={!canSave}>
            <PackagePlus size={17} />
            <span>{isEditing ? "Save Changes" : "Create Item"}</span>
          </button>
        </div>
      </div>

      <div className={styles.formBody}>
        <section className={styles.photoPanel} aria-label="Product photo">
          <div className={styles.photoPreview}>
            {photoUrl.trim() ? (
              <img src={photoUrl} alt="Product preview" />
            ) : (
              <span>
                <ImagePlus size={30} />
              </span>
            )}
          </div>
          <label className={styles.field}>
            <span>Photo</span>
            <input
              type="text"
              value={photoUrl}
              placeholder="https://example.com/photo.jpg"
              onChange={(event) => setPhotoUrl(event.target.value)}
            />
          </label>

          <label className={styles.field} data-stock-flow="barcode" onKeyDown={handleFlowEnter}>
            <span>Barcode</span>
            <span className={styles.inlineField}>
              <input
                type="text"
                value={barcode}
                readOnly={isEditing}
                onChange={(event) => setBarcode(event.target.value)}
              />
              {!isEditing && (
                <button type="button" onClick={() => setBarcode(generateBarcode())} title="Generate barcode">
                  <Wand2 size={15} />
                </button>
              )}
            </span>
          </label>
        </section>

        <section className={styles.formPanel} aria-label="Item detail">
          <div className={styles.formGrid}>
            <label className={styles.field} data-stock-flow="itemName" onKeyDown={handleFlowEnter}>
              <span>Item name</span>
              <input
                value={itemName}
                placeholder="Paracetamol 500 mg"
                onChange={(event) => setItemName(event.target.value)}
              />
            </label>

            <label className={styles.field} data-stock-flow="location" onKeyDown={handleFlowEnter}>
              <span>Location</span>
              <input value={location} onChange={(event) => setLocation(event.target.value)} />
            </label>

            <label className={styles.field} data-stock-flow="manufacturer" onKeyDown={handleFlowEnter}>
              <span>Manufacturer</span>
              <input value={manufacturer} onChange={(event) => setManufacturer(event.target.value)} />
            </label>

            <label className={styles.field} data-stock-flow="sellPrice" onKeyDown={handleFlowEnter}>
              <span>Sell price</span>
              <input
                type="text"
                inputMode="decimal"
                value={sellPrice}
                onChange={(event) => setSellPrice(handleNumberText(event.target.value))}
              />
            </label>

            <label className={styles.field} data-stock-flow="itemCategory">
              <span>Item category</span>
              <SearchableSelect
                ariaLabel="Item category"
                value={itemCategory}
                options={optionList(resolvedCategoryOptions)}
                onChange={setItemCategory}
                allowCustom
                customOptionLabel={(value) => `Add category "${value}"`}
                onCommit={() => focusNextField("itemCategory")}
              />
            </label>

            <label className={styles.field} data-stock-flow="weightage" onKeyDown={handleFlowEnter}>
              <span>Amount</span>
              <input
                value={weightage}
                placeholder="500"
                onChange={(event) => setWeightage(event.target.value)}
              />
            </label>

            <label className={styles.field} data-stock-flow="subUnit">
              <span>Sub unit</span>
              <SearchableSelect
                ariaLabel="Sub unit"
                value={subUnit}
                options={optionList(unitOptions)}
                onChange={setSubUnit}
                allowCustom
                onCommit={() => focusNextField("subUnit")}
              />
            </label>

            <label className={styles.field} data-stock-flow="unit">
              <span>Unit</span>
              <SearchableSelect
                ariaLabel="Unit"
                value={unit}
                options={optionList(unitOptions)}
                onChange={setUnit}
                allowCustom
                onCommit={() => focusNextField("unit")}
              />
            </label>

            <label className={styles.field} data-stock-flow="brandName" onKeyDown={handleFlowEnter}>
              <span>Brand name</span>
              <input value={brandName} onChange={(event) => setBrandName(event.target.value)} />
            </label>
          </div>
        </section>
      </div>

      <section className={styles.packagingPanel} aria-label="Packaging conversion">
        <div className={styles.packagingHeader}>
          <div>
            <h2>Packaging in</h2>
          </div>
          <button type="button" className={styles.moreButton} onClick={() => addPackagingRow(true)}>
            <Plus size={16} />
            <span>Add Row</span>
          </button>
        </div>

        <div className={styles.packagingRows}>
          {packagingRows.map((row) => (
            <div
              className={styles.packagingRow}
              key={row.id}
              onKeyDown={handlePackagingEnter}
              ref={(element) => {
                packagingRowRefs.current[row.id] = element;
              }}
            >
              <label className={styles.field}>
                <span>Package</span>
                <SearchableSelect
                  ariaLabel="Package"
                  value={row.parentUnit}
                  options={optionList(packageOptions)}
                  onChange={(value) => updatePackagingRow(row.id, { parentUnit: value })}
                  allowCustom
                />
              </label>

              <label className={styles.field}>
                <span>Sub value</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={row.childQuantity}
                  onChange={(event) => updatePackagingRow(row.id, { childQuantity: event.target.value.replace(/\D/g, "") })}
                />
              </label>

              <label className={styles.field}>
                <span>Sub unit</span>
                <SearchableSelect
                  ariaLabel="Sub unit"
                  value={row.childUnit}
                  options={optionList(unitOptions)}
                  onChange={(value) => updatePackagingRow(row.id, { childUnit: value })}
                  allowCustom
                />
              </label>

              <label className={styles.field}>
                <span>Barcode</span>
                <span className={styles.inlineField}>
                  <input
                    value={row.barcode}
                    onChange={(event) => updatePackagingRow(row.id, { barcode: event.target.value })}
                  />
                  <button type="button" onClick={() => updatePackagingRow(row.id, { barcode: generateBarcode() })} title="Generate barcode">
                    <Wand2 size={15} />
                  </button>
                </span>
              </label>

              <button
                type="button"
                className={styles.removeRowButton}
                onClick={() => removePackagingRow(row.id)}
                aria-label="Remove packaging row"
                title="Remove row"
                disabled={packagingRows.length === 1}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.regulatoryFormsPanel} aria-label="Pharmacy drug purchase and sales records">
        <div className={styles.regulatoryFormsHeader}>
          <h2>Pharmacy Drug Purchase &amp; Sales Records</h2>
        </div>
        <div className={styles.packagingRegulatoryOptions}>
          {regulatoryFormOptions.map((form) => (
            <label key={form} className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={form === "ข.ย. 9" || regulatoryForms.includes(form)}
                disabled={form === "ข.ย. 9"}
                onChange={() => toggleRegulatoryForm(form)}
              />
              <span>{form}</span>
            </label>
          ))}
        </div>
      </section>
    </form>
  );
}
