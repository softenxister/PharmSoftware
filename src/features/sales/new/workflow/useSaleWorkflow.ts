import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { usePreferences } from '@/app/providers/PreferencesProvider';
import { localizeUnitExpression } from '@/i18n/productUnits';
import type { PharmUser } from '@server/auth/pharmUser';
import {
  resolveConfiguredPaymentMethod,
  type StorePaymentMethod,
} from '@/config/preferences/storePosSettings';
import { usePosPreferences } from '@/hooks/usePosPreferences';
import { useStorePosSettings } from '@/hooks/useStorePosSettings';
import {
  calculateSalePricing,
  catalogItemForLine,
  formatBatchExpiry,
  hasPayableSale,
  lineUnitPrice,
  resolvePaidSaleNextStep,
} from './saleDraft';
import { matchedAllergyIngredients, mergeCatalogItems } from './saleCatalog';
import { resolveSaleShortcut, subscribeSaleShortcuts } from '../salesShortcuts';
import {
  OWNERS,
  PHARMACISTS,
  type AppliedDiscount,
  type BillStatus,
  type CatalogItem,
  type InvoiceCreated,
  type PurchaseMethod,
  type SaveMode,
} from './saleTypes';
import { useClickOutside } from './useClickOutside';
import { useSaleCatalog } from './useSaleCatalog';
import { useSaleCart } from './useSaleCart';
import { useSalePayment } from './useSalePayment';
import { useSaleRecommendations } from './useSaleRecommendations';
import {
  loadPendingSale,
  persistRecentSale,
  postSale,
  refreshSoldProductCatalog,
} from './salePersistence';

export function useSaleWorkflow(user: PharmUser) {
  const navigate = useNavigate();
  const { t, formatDate, formatNumber, preferences: appPreferences } = usePreferences();
  const saleCatalog = useSaleCatalog(t);
  const {
    customers,
    customersLoaded,
    customerLoadError,
    customer,
    setCustomer,
    customerQuery,
    setCustomerQuery,
    customerDropdownOpen,
    setCustomerDropdownOpen,
    highlightedCustomerIndex,
    setHighlightedCustomerIndex,
    customerFieldRef,
    customerMatches,
    itemQuery,
    setItemQuery,
    itemDropdownOpen,
    setItemDropdownOpen,
    highlightedItemIndex,
    setHighlightedItemIndex,
    itemFieldRef,
    itemSearchInputRef,
    itemSearchLoading,
    catalog,
    setCatalog,
    itemSearchQuery,
    itemMatches,
    selectCustomer,
    handleCustomerSearchKeyDown,
  } = saleCatalog;
  const localizeUnit = (value: string) => localizeUnitExpression(appPreferences.locale, value);
  const paymentMethodLabel = (method: StorePaymentMethod) => t(method === 'Cash'
    ? 'pos.cash'
    : method === 'Bank transfer' ? 'pos.bankTransfer' : 'pos.creditCard');
  const allergyWarningForItem = (item: CatalogItem) => {
    const matches = matchedAllergyIngredients(customer, item);
    return matches.length > 0
      ? t('newSale.allergyWarning', { ingredients: matches.map((ingredient) => ingredient.canonicalName).join(', ') })
      : '';
  };
  const formatExpiry = (value: string) => formatBatchExpiry(appPreferences.locale, value);
  const [searchParams] = useSearchParams();
  const pendingBillId = searchParams.get('billId');
  const { preferences } = usePosPreferences(user);
  const { settings: storeSettings } = useStorePosSettings();
  const saleCart = useSaleCart({
    catalog,
    itemSearchQuery,
    itemMatches,
    highlightedItemIndex,
    setHighlightedItemIndex,
    setItemQuery,
    itemDropdownOpen,
    setItemDropdownOpen,
    itemSearchInputRef,
    preferences,
    navigateToSales: () => navigate('/sales'),
  });
  const {
    editor,
    setEditor,
    batchPickerRef,
    qtyInputRef,
    cartLines,
    setCartLines,
    cartQtyDrafts,
    setCartQtyDrafts,
    cartDisplayGroups,
    totalQty,
    reminderOpen,
    setReminderOpen,
    reminderRows,
    setReminderRows,
    reminderEligibleLines,
    heldItemId,
    pendingConfirmation,
    setPendingConfirmation,
    openEditorForItem,
    handleItemSearchKeyDown,
    handleSelectBatch,
    handleSelectSellPack,
    commitEditorToCart,
    removeCartLine,
    leaveUnsavedSale,
    confirmPendingAction,
    updateCartQty,
    openReminderCard,
    toggleReminderLine,
    setReminderTime,
    navigateReminderTime,
    changeReminderDose,
    handleTopItemTap,
    startHold,
    endHold,
  } = saleCart;

  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [editingBillNo, setEditingBillNo] = useState<string | null>(null);

  const [ownerId, setOwnerId] = useState(OWNERS[0].id);
  const [paymentMethod, setPaymentMethod] = useState<StorePaymentMethod>('Cash');
  const [purchaseMethod, setPurchaseMethod] = useState<PurchaseMethod>('pickup');
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const saveMenuRef = useClickOutside<HTMLDivElement>(() => setSaveMenuOpen(false));

  const [billDate, setBillDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [pharmacistId, setPharmacistId] = useState(PHARMACISTS[0].id);
  const [invoiceCreated, setInvoiceCreated] = useState<InvoiceCreated | null>(null);
  const [saleSubmitting, setSaleSubmitting] = useState(false);
  const [saleSubmitError, setSaleSubmitError] = useState('');
  const newSaleButtonRef = useRef<HTMLButtonElement | null>(null);
  const pendingStockRefreshIdsRef = useRef<string[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [billingDevice, setBillingDevice] = useState('Front Counter Thermal Printer');
  const [cashDrawerDevice, setCashDrawerDevice] = useState('Front Counter Cash Drawer');
  const [paperSize, setPaperSize] = useState(() => window.localStorage.getItem('pharm_receipt_paper_size') === '58' ? '58' : '80');
  const [autoOpenCashDrawer, setAutoOpenCashDrawer] = useState(true);
  const saleShortcutHandlerRef = useRef<(event: KeyboardEvent) => void>(() => undefined);

  useEffect(() => {
    setPaymentMethod((current) => resolveConfiguredPaymentMethod(current, storeSettings.paymentMethods));
  }, [storeSettings.paymentMethods]);

  const uniqueItemCount = cartDisplayGroups.length;
  const pricingLines = useMemo(() => cartLines.map((line) => ({
    quantity: line.qty,
    unitPrice: lineUnitPrice(line),
    discountPercent: catalogItemForLine(line, catalog)?.discountPercent ?? 0,
  })), [cartLines, catalog]);
  const salePayment = useSalePayment({
    pricingLines,
    lineCount: cartLines.length,
    paymentMethod,
    billingDevice,
    cashDrawerDevice,
    autoOpenCashDrawer,
  });
  const {
    discountOpen,
    setDiscountOpen,
    discountType,
    setDiscountType,
    discountInput,
    setDiscountInput,
    appliedDiscount,
    setAppliedDiscount,
    customerPayInput,
    setCustomerPayInput,
    setCustomerPayEdited,
    customerPayInputRef,
    subtotal,
    itemDiscountAmount,
    discountAmount,
    netPayable,
    draftNetPayable,
    liveChangeDue,
    openDiscountDrawer: openPaymentDrawer,
    addCustomerCash,
    readDraftDiscount,
    clearDiscount,
    openCashDrawer,
  } = salePayment;
  const canSaveSale = hasPayableSale(cartLines.length, netPayable);
  const canOpenInvoiceBreakdown = canSaveSale;
  const { topItems, topItemsLabel, recommendedBatchId } = useSaleRecommendations(
    catalog,
    customer,
    editor,
    t,
  );

  useEffect(() => {
    if (!invoiceCreated) return;
    window.setTimeout(() => {
      newSaleButtonRef.current?.focus();
    }, 0);
  }, [invoiceCreated]);

  useEffect(() => {
    let cancelled = false;
    if (!pendingBillId || !customersLoaded) return;

    async function loadPendingBill() {
      try {
        const pending = await loadPendingSale(pendingBillId);
        if (cancelled || !pending) return;
        const savedBill = pending.sale;
        setCatalog((currentCatalog) => mergeCatalogItems(currentCatalog, pending.catalog));

        setEditingBillId(savedBill.id);
        setEditingBillNo(savedBill.billNo);
        setOwnerId(savedBill.ownerId ?? OWNERS[0].id);
        setPaymentMethod(resolveConfiguredPaymentMethod(savedBill.paymentMethod ?? 'Cash', storeSettings.paymentMethods));
        setPurchaseMethod(savedBill.purchaseMethod ?? 'pickup');
        setBillDate(savedBill.billDate ?? savedBill.date.slice(0, 10));
        setPharmacistId(savedBill.pharmacistId ?? PHARMACISTS[0].id);
        setCustomer(customers.find((c) => c.id === savedBill.customerId) ?? null);
        setCustomerQuery('');
        setCartLines(savedBill.lines);
        setCartQtyDrafts({});
        setAppliedDiscount(savedBill.discount ?? null);
        if (savedBill.discount) {
          setDiscountType(savedBill.discount.type);
          setDiscountInput(String(savedBill.discount.value));
        }
      } catch (error) {
        if (!cancelled) {
          setSaleSubmitError(error instanceof Error ? error.message : 'Unable to load pending sale.');
        }
      }
    }

    void loadPendingBill();
    return () => {
      cancelled = true;
    };
  }, [customers, customersLoaded, pendingBillId, storeSettings.paymentMethods]);

  function openDiscountDrawer() {
    setSaleSubmitError('');
    openPaymentDrawer();
  }

  function handleCustomerPayEnter() {
    void submitInvoicePayment();
  }

  async function refreshSoldProductStock(productIds: string[]) {
    const ids = [...new Set(productIds.map((id) => id.trim()).filter(Boolean))];
    if (ids.length === 0) return;
    pendingStockRefreshIdsRef.current = ids;
    try {
      const refreshedCatalog = await refreshSoldProductCatalog(ids);
      setCatalog((currentCatalog) => mergeCatalogItems(currentCatalog, refreshedCatalog));
      pendingStockRefreshIdsRef.current = [];
    } catch (error) {
      console.error('Unable to refresh stock after the completed sale.', error);
    }
  }

  function resetForNewWalkIn() {
    if (pendingStockRefreshIdsRef.current.length > 0) {
      void refreshSoldProductStock(pendingStockRefreshIdsRef.current);
    }
    setCartLines([]);
    setCartQtyDrafts({});
    setReminderRows({});
    setReminderOpen(false);
    setEditor(null);
    setAppliedDiscount(null);
    setDiscountInput('');
    setCustomerPayInput('');
    setCustomerPayEdited(false);
    setCustomer(null);
    setCustomerQuery('');
    setItemQuery('');
    setItemDropdownOpen(false);
    setDiscountOpen(false);
    setInvoiceCreated(null);
    setSaleSubmitting(false);
    setSaleSubmitError('');
    setEditingBillId(null);
    setEditingBillNo(null);
    setBillDate(new Date().toISOString().slice(0, 10));
    window.setTimeout(() => {
      itemSearchInputRef.current?.focus();
    }, 0);
  }

  function persistSale(_mode: SaveMode, overrides: {
    id?: string;
    billNo?: string;
    createdAt?: string;
    discount?: AppliedDiscount | null;
    netPayable?: number;
    customerPaid?: number | null;
    changeDue?: number;
    status?: BillStatus;
  } = {}): InvoiceCreated {
    const effectiveNetPayable = overrides.netPayable ?? netPayable;
    const effectiveCustomerPaid = overrides.customerPaid !== undefined
      ? overrides.customerPaid
      : parseFloat(customerPayInput) || null;
    const effectiveChangeDue = overrides.changeDue ?? liveChangeDue;
    return persistRecentSale(window.localStorage, {
      id: overrides.id ?? editingBillId ?? undefined,
      billNo: overrides.billNo ?? editingBillNo ?? undefined,
      createdAt: overrides.createdAt,
      customer,
      itemCount: uniqueItemCount,
      paymentMethod,
      purchaseMethod,
      netPayable: effectiveNetPayable,
      status: overrides.status ?? 'paid',
      ownerId,
      billDate,
      pharmacistId,
      lines: cartLines,
      discount: overrides.discount ?? appliedDiscount,
      customerPaid: effectiveCustomerPaid,
      changeDue: effectiveChangeDue,
    });
  }

  async function submitInvoicePayment() {
    if (!canSaveSale || saleSubmitting) return;
    const nextDiscount = readDraftDiscount();
    const nextNetPayable = calculateSalePricing(pricingLines, nextDiscount).netPayable;
    const paid = parseFloat(customerPayInput);
    const nextChangeDue = Number.isNaN(paid) ? 0 : Math.max(paid - nextNetPayable, 0);

    setSaleSubmitting(true);
    setSaleSubmitError('');
    let savedSale;

    try {
      savedSale = await postSale({
        status: 'paid',
        id: editingBillId ?? undefined,
        billNo: editingBillNo ?? undefined,
        owner: {
          id: ownerId,
          name: OWNERS.find((owner) => owner.id === ownerId)?.name ?? ownerId,
        },
        pharmacist: {
          id: pharmacistId,
          name: PHARMACISTS.find((pharmacist) => pharmacist.id === pharmacistId)?.name ?? pharmacistId,
        },
        customer,
        paymentMethod,
        purchaseMethod,
        subtotal,
        netPayable: nextNetPayable,
        customerPaid: Number.isNaN(paid) ? null : paid,
        changeDue: nextChangeDue,
        discount: nextDiscount,
        lines: cartLines,
      });
    } catch (error) {
      setSaleSubmitError(error instanceof Error ? error.message : 'Unable to update stock for this sale.');
      setSaleSubmitting(false);
      return;
    }

    await refreshSoldProductStock(cartLines.map((line) => line.itemId));

    if (!Number.isNaN(paid) && paid >= nextNetPayable) {
      openCashDrawer('customer payment submitted');
    }

    const createdInvoice = persistSale('save-new', {
      id: savedSale?.id,
      billNo: savedSale?.billNo,
      createdAt: savedSale?.date,
      discount: nextDiscount,
      netPayable: nextNetPayable,
      customerPaid: Number.isNaN(paid) ? null : paid,
      changeDue: nextChangeDue,
      status: 'paid',
    });
    setAppliedDiscount(nextDiscount);
    setDiscountOpen(false);
    const nextStep = resolvePaidSaleNextStep('submit', createdInvoice.saleId);
    if (nextStep.kind === 'invoice-preview') setInvoiceCreated(createdInvoice);
    setSaleSubmitting(false);
  }

  async function handleSave(mode: SaveMode) {
    if (!canSaveSale || saleSubmitting) return;
    setSaleSubmitting(true);
    setSaleSubmitError('');

    try {
      const savedSale = await postSale({
        status: 'pending',
        id: editingBillId ?? undefined,
        billNo: editingBillNo ?? undefined,
        owner: {
          id: ownerId,
          name: OWNERS.find((owner) => owner.id === ownerId)?.name ?? ownerId,
        },
        pharmacist: {
          id: pharmacistId,
          name: PHARMACISTS.find((pharmacist) => pharmacist.id === pharmacistId)?.name ?? pharmacistId,
        },
        customer,
        paymentMethod,
        purchaseMethod,
        subtotal,
        netPayable,
        customerPaid: null,
        changeDue: 0,
        discount: appliedDiscount,
        lines: cartLines,
      });

      persistSale(mode, {
        id: savedSale?.id,
        billNo: savedSale?.billNo,
        createdAt: savedSale?.date,
        status: 'pending',
        customerPaid: null,
        changeDue: 0,
      });
      setSaveMenuOpen(false);
      if (mode === 'save-new') {
        resetForNewWalkIn();
        return;
      }
      navigate('/sales');
    } catch (error) {
      setSaleSubmitError(error instanceof Error ? error.message : 'Unable to save this sale.');
      setSaleSubmitting(false);
    }
  }

  function handleSaleShortcut(event: KeyboardEvent) {
    if (event.defaultPrevented || event.repeat) return;
    const action = resolveSaleShortcut(event, storeSettings.paymentMethods);
    if (!action) return;
    event.preventDefault();

    if (action.type === 'select-payment') {
      setPaymentMethod(action.method);
      return;
    }
    if (invoiceCreated || reminderOpen || settingsOpen || pendingConfirmation) return;
    if (action.type === 'save-pending') {
      if (!discountOpen) void handleSave('save');
      return;
    }
    if (!discountOpen) openDiscountDrawer();
  }

  useEffect(() => {
    saleShortcutHandlerRef.current = handleSaleShortcut;
  });

  useEffect(() => subscribeSaleShortcuts(
    window,
    (event) => saleShortcutHandlerRef.current(event),
  ), []);


  return {
    ...saleCatalog,
    ...saleCart,
    ...salePayment,
    t,
    formatDate,
    formatNumber,
    appPreferences,
    localizeUnit,
    paymentMethodLabel,
    allergyWarningForItem,
    formatExpiry,
    preferences,
    storeSettings,
    ownerId,
    setOwnerId,
    paymentMethod,
    setPaymentMethod,
    purchaseMethod,
    setPurchaseMethod,
    saveMenuOpen,
    setSaveMenuOpen,
    saveMenuRef,
    billDate,
    setBillDate,
    pharmacistId,
    setPharmacistId,
    uniqueItemCount,
    canSaveSale,
    canOpenInvoiceBreakdown,
    topItems,
    topItemsLabel,
    recommendedBatchId,
    invoiceCreated,
    saleSubmitting,
    saleSubmitError,
    setSaleSubmitError,
    newSaleButtonRef,
    settingsOpen,
    setSettingsOpen,
    billingDevice,
    setBillingDevice,
    cashDrawerDevice,
    setCashDrawerDevice,
    paperSize,
    setPaperSize,
    autoOpenCashDrawer,
    setAutoOpenCashDrawer,
    openDiscountDrawer,
    handleCustomerPayEnter,
    addCustomerCash,
    resetForNewWalkIn,
    submitInvoicePayment,
    clearDiscount,
    handleSave,
  };
}

export type SaleWorkflow = ReturnType<typeof useSaleWorkflow>;
