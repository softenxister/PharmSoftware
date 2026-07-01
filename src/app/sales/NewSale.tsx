"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Search,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import styles from "./NewSale.module.css";
import { customers, salesProducts, type Customer, type ProductBatch, type SalesProduct } from "./salesData";

type SaleLine = {
  id: string;
  product: SalesProduct;
  batch: ProductBatch;
  quantity: number;
};

type DiscountType = "percent" | "fixed";

const thb = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const today = "2026-07-01";

function getBestBatch(product: SalesProduct) {
  return [...product.batches]
    .filter(batch => batch.availableStock > 0)
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))[0] ?? product.batches[0];
}

function customerInitials(customer: Customer) {
  return customer.name
    .split(" ")
    .map(part => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function productMatches(product: SalesProduct, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return false;

  return [
    product.shortCode,
    product.internalCode,
    product.barcode,
    product.categoryShortcut,
    product.category,
    product.itemName,
    product.brandName,
  ].some(value => value.toLowerCase().includes(needle));
}

export function NewSale() {
  const [owner, setOwner] = useState("Main Branch");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [purchaseMethod, setPurchaseMethod] = useState("Pickup");
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const [billDate, setBillDate] = useState(today);
  const [pharmacistName, setPharmacistName] = useState("John Doe");
  const [customerQuery, setCustomerQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [productQuery, setProductQuery] = useState("");
  const [lines, setLines] = useState<SaleLine[]>([]);
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [discountType, setDiscountType] = useState<DiscountType>("percent");
  const [discountInput, setDiscountInput] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState({ type: "fixed" as DiscountType, value: 0 });
  const [previewProduct, setPreviewProduct] = useState<SalesProduct | null>(null);
  const quantityRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const longPressTimer = useRef<number | null>(null);

  const customerMatches = useMemo(() => {
    const query = customerQuery.trim().toLowerCase();
    if (!query) return [];
    return customers
      .filter(customer => `${customer.name} ${customer.mobile}`.toLowerCase().includes(query))
      .slice(0, 5);
  }, [customerQuery]);

  const productMatchesList = useMemo(() => {
    const query = productQuery.trim();
    if (!query) return [];
    return salesProducts.filter(product => productMatches(product, query)).slice(0, 8);
  }, [productQuery]);

  const recommendations = useMemo(() => {
    if (selectedCustomer?.isMember && selectedCustomer.frequentProductIds.length > 0) {
      const memberProducts = selectedCustomer.frequentProductIds
        .map(id => salesProducts.find(product => product.id === id))
        .filter((product): product is SalesProduct => Boolean(product));

      return [
        ...memberProducts,
        ...salesProducts.filter(product => !selectedCustomer.frequentProductIds.includes(product.id)),
      ].slice(0, 10);
    }

    return [...salesProducts].sort((a, b) => b.weeklySold - a.weeklySold).slice(0, 10);
  }, [selectedCustomer]);

  const subtotal = lines.reduce((sum, line) => sum + line.batch.sellPriceThb * line.quantity, 0);
  const totalQuantity = lines.reduce((sum, line) => sum + line.quantity, 0);
  const uniqueItems = new Set(lines.map(line => line.product.id)).size;
  const discountAmount =
    appliedDiscount.type === "percent"
      ? Math.min(subtotal, subtotal * (appliedDiscount.value / 100))
      : Math.min(subtotal, appliedDiscount.value);
  const netPayable = Math.max(0, subtotal - discountAmount);

  useEffect(() => {
    if (!activeLineId) return;
    quantityRefs.current[activeLineId]?.focus();
    quantityRefs.current[activeLineId]?.select();
  }, [activeLineId]);

  const addProduct = (product: SalesProduct) => {
    const batch = getBestBatch(product);
    const id = `${product.id}-${Date.now()}`;
    setLines(current => [...current, { id, product, batch, quantity: 1 }]);
    setActiveLineId(id);
    setProductQuery("");
  };

  const updateLine = (lineId: string, patch: Partial<SaleLine>) => {
    setLines(current => current.map(line => (line.id === lineId ? { ...line, ...patch } : line)));
  };

  const removeLine = (lineId: string) => {
    setLines(current => current.filter(line => line.id !== lineId));
    setActiveLineId(current => (current === lineId ? null : current));
  };

  const applyDiscount = () => {
    const numericValue = Number(discountInput.replace(/[^\d.]/g, ""));
    setAppliedDiscount({
      type: discountType,
      value: Number.isFinite(numericValue) ? numericValue : 0,
    });
  };

  const startLongPress = (product: SalesProduct) => {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => setPreviewProduct(product), 450);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  };

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <div className={styles.breadcrumb}>
          <span>Sales</span>
          <ChevronRight size={14} />
          <span className={styles.breadcrumbCurrent}>New</span>
        </div>

        <section className={styles.panel}>
          <div className={styles.topActions}>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Owner</label>
              <select className={styles.select} value={owner} onChange={event => setOwner(event.target.value)}>
                <option>Main Branch</option>
                <option>Silom Branch</option>
                <option>Warehouse Counter</option>
              </select>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Payment method</label>
              <select
                className={styles.select}
                value={paymentMethod}
                onChange={event => setPaymentMethod(event.target.value)}
              >
                <option>Cash</option>
                <option>PromptPay</option>
                <option>Credit Card</option>
                <option>Transfer</option>
              </select>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Purchase method</label>
              <select
                className={styles.select}
                value={purchaseMethod}
                onChange={event => setPurchaseMethod(event.target.value)}
              >
                <option>Pickup</option>
                <option>Delivery</option>
              </select>
            </div>

            <div className={styles.saveGroup}>
              <button className={styles.saveButton} type="button">
                Save
              </button>
              <button
                aria-label="Open save options"
                className={styles.saveArrow}
                type="button"
                onClick={() => setSaveMenuOpen(open => !open)}
              >
                <ChevronDown size={16} />
              </button>
              {saveMenuOpen && (
                <div className={styles.saveMenu}>
                  {["Save", "Save & Print", "Save as Draft", "Save & Create New"].map(action => (
                    <button key={action} type="button" onClick={() => setSaveMenuOpen(false)}>
                      {action}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button className={styles.iconButton} type="button" aria-label="Sale settings">
              <Settings size={17} />
            </button>
          </div>

          <div className={styles.billRow}>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Bill date</label>
              <input
                className={styles.input}
                type="date"
                value={billDate}
                onChange={event => setBillDate(event.target.value)}
              />
            </div>

            <div className={`${styles.fieldGroup} ${styles.customerSearch}`}>
              <label className={styles.fieldLabel}>Customer</label>
              <input
                className={styles.input}
                placeholder="Search name or mobile number"
                value={customerQuery}
                onChange={event => setCustomerQuery(event.target.value)}
              />
              {customerMatches.length > 0 && (
                <div className={styles.customerResults}>
                  {customerMatches.map(customer => (
                    <button
                      className={styles.resultButton}
                      key={customer.id}
                      type="button"
                      onClick={() => {
                        setSelectedCustomer(customer);
                        setCustomerQuery("");
                      }}
                    >
                      <span className={styles.avatar}>
                        {customer.avatarUrl ? <img alt="" src={customer.avatarUrl} /> : customerInitials(customer)}
                      </span>
                      <span>
                        <span className={styles.primaryText}>{customer.name}</span>
                        <br />
                        <span className={styles.secondaryText}>{customer.mobile || "No mobile number"}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {selectedCustomer && (
                <div className={styles.selectedCustomer}>
                  <span className={styles.avatar}>
                    {selectedCustomer.avatarUrl ? (
                      <img alt="" src={selectedCustomer.avatarUrl} />
                    ) : (
                      customerInitials(selectedCustomer)
                    )}
                  </span>
                  <span>
                    <span className={styles.primaryText}>{selectedCustomer.name}</span>
                    <br />
                    <span className={styles.secondaryText}>
                      {selectedCustomer.mobile || "No mobile number"} {selectedCustomer.isMember ? " | Member" : ""}
                    </span>
                  </span>
                </div>
              )}
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Pharmacist name</label>
              <input
                className={styles.input}
                value={pharmacistName}
                onChange={event => setPharmacistName(event.target.value)}
              />
            </div>
          </div>
        </section>

        <section className={`${styles.panel} ${styles.searchPanel}`}>
          <div className={styles.searchHeader}>
            <div className={styles.itemSearchBox}>
              <label className={styles.fieldLabel}>Item search</label>
              <div className={styles.searchInputWrap}>
                <span className={styles.searchIcon}>
                  <Search size={17} />
                </span>
                <input
                  className={styles.searchInput}
                  placeholder="Search short code, internal code, barcode, category, or product name"
                  value={productQuery}
                  onChange={event => setProductQuery(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === "Enter" && productMatchesList[0]) {
                      event.preventDefault();
                      addProduct(productMatchesList[0]);
                    }
                  }}
                />
              </div>
              {productMatchesList.length > 0 && (
                <div className={styles.searchResults}>
                  {productMatchesList.map(product => (
                    <button
                      className={styles.resultButton}
                      key={product.id}
                      type="button"
                      onClick={() => addProduct(product)}
                    >
                      <span className={styles.avatar}>
                        <img alt="" src={product.imageUrl} />
                      </span>
                      <span>
                        <span className={styles.primaryText}>{product.itemName}</span>
                        <span className={styles.productResultMeta}>
                          <span>{product.brandName}</span>
                          <span>{product.unit}</span>
                          <span>{product.location}</span>
                          <span>{product.barcode}</span>
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              className={styles.addButton}
              type="button"
              disabled={!productMatchesList[0]}
              onClick={() => productMatchesList[0] && addProduct(productMatchesList[0])}
            >
              <Plus size={16} />
              Add
            </button>
          </div>

          <div className={styles.searchHint}>
            Try <span className={styles.pill}>gy</span>
            <span className={styles.pill}>g+99</span>
            <span className={styles.pill}>93483924388</span>
            <span className={styles.pill}>c</span>
            <span className={styles.pill}>paracetamol</span>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.salesTable}>
              <thead>
                <tr>
                  <th></th>
                  <th>Item name</th>
                  <th>Unit / pack</th>
                  <th>Location</th>
                  <th>Batch</th>
                  <th>Expiry date</th>
                  <th>Selling price</th>
                  <th>Quantity</th>
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 && (
                  <tr>
                    <td colSpan={8}>
                      <div className={styles.emptyState}>
                        Search or tap a recommended item to start a new bill.
                      </div>
                    </td>
                  </tr>
                )}

                {lines.map(line => (
                  <Fragment key={line.id}>
                    <tr onClick={() => setActiveLineId(line.id)}>
                      <td>
                        <button
                          className={styles.deleteButton}
                          type="button"
                          aria-label={`Remove ${line.product.itemName}`}
                          onClick={event => {
                            event.stopPropagation();
                            removeLine(line.id);
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                      <td>
                        <div className={styles.itemCell}>
                          <img
                            alt={line.product.itemName}
                            className={styles.itemThumb}
                            src={line.product.imageUrl}
                          />
                          <div>
                            <div className={styles.primaryText}>{line.product.itemName}</div>
                            <div className={styles.secondaryText}>{line.product.brandName}</div>
                          </div>
                        </div>
                      </td>
                      <td>{line.product.unit}</td>
                      <td>{line.product.location}</td>
                      <td>
                        <select
                          className={styles.compactSelect}
                          value={line.batch.batchNo}
                          onChange={event => {
                            const selectedBatch = line.product.batches.find(
                              batch => batch.batchNo === event.target.value,
                            );
                            if (selectedBatch) {
                              updateLine(line.id, { batch: selectedBatch });
                              setActiveLineId(line.id);
                            }
                          }}
                        >
                          {line.product.batches.map(batch => (
                            <option key={batch.batchNo}>{batch.batchNo}</option>
                          ))}
                        </select>
                      </td>
                      <td>{line.batch.expiryDate}</td>
                      <td className={styles.priceCell}>{thb.format(line.batch.sellPriceThb)}</td>
                      <td>
                        <input
                          ref={element => {
                            quantityRefs.current[line.id] = element;
                          }}
                          className={styles.compactInput}
                          min={1}
                          max={line.batch.availableStock}
                          type="number"
                          value={line.quantity}
                          onChange={event => {
                            const nextQty = Math.max(
                              1,
                              Math.min(line.batch.availableStock, Number(event.target.value) || 1),
                            );
                            updateLine(line.id, { quantity: nextQty });
                          }}
                        />
                      </td>
                    </tr>
                    {activeLineId === line.id && (
                      <tr className={styles.batchCardRow} key={`${line.id}-batch`}>
                        <td colSpan={8}>
                          <div className={styles.batchCard}>
                            {line.product.batches.map(batch => (
                              <button
                                className={`${styles.batchOption} ${
                                  batch.batchNo === line.batch.batchNo ? styles.batchSelected : ""
                                }`}
                                key={batch.batchNo}
                                type="button"
                                onClick={() => {
                                  updateLine(line.id, { batch });
                                  setActiveLineId(line.id);
                                }}
                              >
                                <div className={styles.batchTitle}>{batch.batchNo}</div>
                                <div className={styles.batchMeta}>
                                  Exp {batch.expiryDate}
                                  <br />
                                  {thb.format(batch.sellPriceThb)} | Stock {batch.availableStock}
                                </div>
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={`${styles.panel} ${styles.recommendSection}`}>
          <div className={styles.recommendTop}>
            <h2 className={styles.sectionTitle}>
              {selectedCustomer?.isMember ? "Frequently purchased by this customer" : "Best-selling this week"}
            </h2>
            <span className={styles.sectionMeta}>Tap to add. Hold image to preview.</span>
          </div>
          <div className={styles.recommendGrid}>
            {recommendations.map(product => (
              <button
                className={styles.productCard}
                key={product.id}
                type="button"
                onClick={() => addProduct(product)}
              >
                <img
                  alt={product.itemName}
                  className={styles.productImage}
                  src={product.imageUrl}
                  onMouseDown={() => startLongPress(product)}
                  onMouseUp={cancelLongPress}
                  onMouseLeave={cancelLongPress}
                  onTouchStart={() => startLongPress(product)}
                  onTouchEnd={cancelLongPress}
                />
                <div className={styles.cardName}>{product.itemName}</div>
                <div className={styles.cardMeta}>
                  {product.brandName}
                  <br />
                  {product.unit} | {product.location}
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className={styles.summaryBar}>
        <div className={styles.summaryItem}>
          <div className={styles.summaryLabel}>Total quantity</div>
          <div className={styles.summaryValue}>{totalQuantity}</div>
        </div>
        <div className={styles.summaryItem}>
          <div className={styles.summaryLabel}>Unique items</div>
          <div className={styles.summaryValue}>{uniqueItems}</div>
        </div>
        <button className={styles.summaryPayable} type="button" onClick={() => setInvoiceOpen(true)}>
          <div className={styles.summaryLabel}>Net payable</div>
          <div className={styles.summaryValue}>{thb.format(netPayable)}</div>
        </button>
      </div>

      {invoiceOpen && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true">
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Invoice breakdown</h2>
              <button className={styles.closeButton} type="button" onClick={() => setInvoiceOpen(false)}>
                <X size={17} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.breakdownRow}>
                <span>Subtotal</span>
                <span className={styles.breakdownAmount}>{thb.format(subtotal)}</span>
              </div>
              <div className={styles.breakdownRow}>
                <span>Total quantity</span>
                <span className={styles.breakdownAmount}>{totalQuantity}</span>
              </div>
              <div className={styles.breakdownRow}>
                <span>Total unique items</span>
                <span className={styles.breakdownAmount}>{uniqueItems}</span>
              </div>
              <div className={styles.breakdownRow}>
                <span>Discount</span>
                <span className={styles.breakdownAmount}>-{thb.format(discountAmount)}</span>
              </div>

              <div className={styles.discountBox}>
                <label className={styles.fieldLabel}>Manual discount</label>
                <div className={styles.discountControls}>
                  <select
                    className={styles.select}
                    value={discountType}
                    onChange={event => setDiscountType(event.target.value as DiscountType)}
                  >
                    <option value="percent">Percentage</option>
                    <option value="fixed">Fixed THB</option>
                  </select>
                  <input
                    className={styles.input}
                    placeholder={discountType === "percent" ? "10%" : "50 THB"}
                    value={discountInput}
                    onChange={event => setDiscountInput(event.target.value)}
                  />
                  <button className={styles.applyButton} type="button" onClick={applyDiscount}>
                    Apply
                  </button>
                </div>
              </div>

              <div className={`${styles.breakdownRow} ${styles.netRow}`}>
                <span>Net payable amount</span>
                <span className={styles.breakdownAmount}>{thb.format(netPayable)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {previewProduct && (
        <div className={styles.previewBackdrop} role="dialog" aria-modal="true" onClick={() => setPreviewProduct(null)}>
          <div className={styles.previewModal}>
            <img alt={previewProduct.itemName} className={styles.previewImage} src={previewProduct.imageUrl} />
            <h2 className={styles.previewName}>{previewProduct.itemName}</h2>
            <div className={styles.previewMeta}>
              {previewProduct.brandName} | {previewProduct.unit} | {previewProduct.location}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
