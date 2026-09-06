import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { usePreferences } from '@/app/providers/PreferencesProvider';
import {
  useUnsavedChangesGuard,
  useUnsavedChangesNavigation,
} from '@/app/providers/UnsavedChangesProvider';
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
  normalizeThaiKeyboardNumericInput,
  resolvePaidSaleNextStep,
  totalAvailableStockForPack,
} from './saleDraft';
import { matchedAllergyIngredients, mergeCatalogItems } from './saleCatalog';
import { resolveSaleShortcut, subscribeSaleShortcuts } from '../salesShortcuts';
import {
  OWNERS,
  PHARMACISTS,
  type CatalogItem,
  type InvoiceCreated,
  type PurchaseMethod,
  type SaveMode,
} from './saleTypes';
import { useClickOutside } from './useClickOutside';
import { useSaleCatalog } from './useSaleCatalog';
import { useSaleCart } from './useSaleCart';
import { useSalePayment } from './useSalePayment';
import { usePendingSaleLifecycle } from './usePendingSaleLifecycle';
import { useSaleRecommendations } from './useSaleRecommendations';
import {
  postSale,
  refreshSoldProductCatalog,
  SaleWriteError,
} from './salePersistence';

export function useSaleWorkflow(user: PharmUser) {
  const navigate = useNavigate();
  const { t, formatDate, formatNumber, preferences: appPreferences } = usePreferences();
  const saleCatalog = useSaleCatalog(t);
  const {
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
  const pendingBillId = searchParams.get('billId')?.trim() || null;
  const { preferences } = usePosPreferences(user);
  const { settings: storeSettings, isReady: storeSettingsReady } = useStorePosSettings();
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
    unpricedItemName,
    setUnpricedItemName,
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
  const unsavedSaleNavigation = useUnsavedChangesNavigation();
  const pendingSale = usePendingSaleLifecycle({
    requestedSaleId: pendingBillId,
    dependenciesReady: storeSettingsReady,
    enabledPaymentMethods: storeSettings.paymentMethods,
  });
  const editingBillId = pendingSale.session?.saleId ?? null;
  const editingBillNo = pendingSale.session?.billNo ?? null;
  const hydratedPendingSaleRef = useRef(pendingSale.session);

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
  const [saveAndLeaveError, setSaveAndLeaveError] = useState('');
  const [paymentMethodDialogOpen, setPaymentMethodDialogOpen] = useState(false);
  const [deleteBillConfirmationOpen, setDeleteBillConfirmationOpen] = useState(false);
  const [deleteBillSubmitting, setDeleteBillSubmitting] = useState(false);
  const [deleteBillError, setDeleteBillError] = useState('');
  const [pendingSaleConflict, setPendingSaleConflict] = useState('');
  const newSaleButtonRef = useRef<HTMLButtonElement | null>(null);
  const pendingStockRefreshIdsRef = useRef<string[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [billingDeviceOverride, setBillingDeviceOverride] = useState<string | null>(null);
  const [cashDrawerDeviceOverride, setCashDrawerDeviceOverride] = useState<string | null>(null);
  const [paperSizeOverride, setPaperSizeOverride] = useState<string | null>(null);
  const [autoOpenCashDrawerOverride, setAutoOpenCashDrawerOverride] = useState<boolean | null>(null);
  const saleShortcutHandlerRef = useRef<(event: KeyboardEvent) => void>(() => undefined);

  const billingDevice = billingDeviceOverride ?? storeSettings.billingDevice;
  const cashDrawerDevice = cashDrawerDeviceOverride ?? storeSettings.cashDrawerDevice;
  const paperSize = paperSizeOverride ?? storeSettings.paperSize;
  const autoOpenCashDrawer = autoOpenCashDrawerOverride ?? storeSettings.autoOpenCashDrawer;

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
  const saleIsPayable = hasPayableSale(cartLines.length, netPayable);
  const currentPendingSaleDraft = useMemo(() => ({
    ownerId,
    paymentMethod,
    purchaseMethod,
    billDate,
    pharmacistId,
    customer,
    lines: cartLines,
    discount: appliedDiscount,
  }), [
    appliedDiscount,
    billDate,
    cartLines,
    customer,
    ownerId,
    paymentMethod,
    pharmacistId,
    purchaseMethod,
  ]);
  const pendingSaleChanged = pendingSale.session !== null
    && pendingSale.hasMeaningfulChanges(currentPendingSaleDraft);
  const hasUnsavedSaleChanges = editingBillId === null
    ? pendingBillId === null && cartLines.length > 0
    : pendingSaleChanged;
  const canSaveSale = saleIsPayable && (
    pendingBillId === null || (pendingSale.loadState === 'opened' && pendingSaleChanged)
  );
  const canOpenInvoiceBreakdown = saleIsPayable;
  useUnsavedChangesGuard(
    preferences.confirmDestructiveActions && hasUnsavedSaleChanges && invoiceCreated === null,
  );
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
    const opened = pendingSale.opened;
    if (!opened || hydratedPendingSaleRef.current === opened.session) return;
    hydratedPendingSaleRef.current = opened.session;
    setCatalog((currentCatalog) => mergeCatalogItems(currentCatalog, opened.catalog));
    setOwnerId(opened.draft.ownerId);
    setPaymentMethod(opened.draft.paymentMethod);
    setPurchaseMethod(opened.draft.purchaseMethod);
    setBillDate(opened.draft.billDate);
    setPharmacistId(opened.draft.pharmacistId);
    setCustomer(opened.draft.customer);
    setCustomerQuery('');
    setCartLines(opened.draft.lines);
    setCartQtyDrafts({});
    setAppliedDiscount(opened.draft.discount);
    setDiscountType(opened.draft.discount?.type ?? 'percent');
    setDiscountInput(opened.draft.discount ? String(opened.draft.discount.value) : '');
  }, [pendingSale.opened, setCartLines, setCatalog, setCustomer]);

  function openInvoiceBreakdown() {
    if (!canOpenInvoiceBreakdown || saleSubmitting) return;
    setSaleSubmitError('');
    if (preferences.showPaymentMethodAfterNetTotal) {
      setPaymentMethodDialogOpen(true);
      return;
    }
    openPaymentDrawer();
  }

  function choosePaymentMethodForInvoice(method: StorePaymentMethod) {
    setPaymentMethod(method);
    setPaymentMethodDialogOpen(false);
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
    setUnpricedItemName(null);
    setDiscountOpen(false);
    setInvoiceCreated(null);
    setSaleSubmitting(false);
    setSaleSubmitError('');
    setPendingSaleConflict('');
    hydratedPendingSaleRef.current = null;
    pendingSale.clear();
    setBillingDeviceOverride(null);
    setCashDrawerDeviceOverride(null);
    setPaperSizeOverride(null);
    setAutoOpenCashDrawerOverride(null);
    setBillDate(new Date().toISOString().slice(0, 10));
    window.setTimeout(() => {
      itemSearchInputRef.current?.focus();
    }, 0);
  }

  async function submitInvoicePayment() {
    if (!saleIsPayable || saleSubmitting) return;
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
        billDate,
        subtotal,
        netPayable: nextNetPayable,
        customerPaid: Number.isNaN(paid) ? null : paid,
        changeDue: nextChangeDue,
        discount: nextDiscount,
        lines: cartLines,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update stock for this sale.';
      setSaleSubmitError(message);
      if (error instanceof SaleWriteError && error.code === 'PENDING_SALE_CONFLICT') {
        setPendingSaleConflict(message);
        setDiscountOpen(false);
        setPaymentMethodDialogOpen(false);
      }
      setSaleSubmitting(false);
      return;
    }

    await refreshSoldProductStock(cartLines.map((line) => line.itemId));

    if (!Number.isNaN(paid) && paid >= nextNetPayable) {
      void openCashDrawer();
    }

    const createdInvoice: InvoiceCreated = {
      saleId: savedSale.id,
      invoiceNo: savedSale.billNo,
      amountPaid: Number.isNaN(paid) ? nextNetPayable : paid,
      netTotal: nextNetPayable,
      changeDue: nextChangeDue,
      paymentMode: paymentMethod,
      createdAt: savedSale.date,
    };
    setAppliedDiscount(nextDiscount);
    setDiscountOpen(false);
    const nextStep = resolvePaidSaleNextStep('submit', createdInvoice.saleId);
    if (nextStep.kind === 'invoice-preview') setInvoiceCreated(createdInvoice);
    setSaleSubmitting(false);
  }

  async function persistPendingSale(mode: SaveMode, reportInLeaveDialog = false): Promise<boolean> {
    if (!canSaveSale || saleSubmitting) return false;
    setSaleSubmitting(true);
    setSaleSubmitError('');
    if (reportInLeaveDialog) setSaveAndLeaveError('');

    try {
      const result = await pendingSale.save(currentPendingSaleDraft, { subtotal, netPayable });
      if (result.kind === 'cancelled') return false;
      if (result.kind !== 'saved') {
        setSaleSubmitError(result.message);
        if (result.kind === 'conflict') setPendingSaleConflict(result.message);
        if (reportInLeaveDialog) setSaveAndLeaveError(result.message);
        setSaleSubmitting(false);
        return false;
      }
      setSaveMenuOpen(false);
      if (mode === 'save-new') {
        resetForNewWalkIn();
        unsavedSaleNavigation.navigateWithoutPrompt(() => navigate('/sales/new', { replace: true }));
        return true;
      }
      setSaleSubmitting(false);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save this sale.';
      setSaleSubmitError(message);
      if (reportInLeaveDialog) setSaveAndLeaveError(message);
      setSaleSubmitting(false);
      return false;
    }
  }

  async function handleSave(mode: SaveMode) {
    const saved = await persistPendingSale(mode);
    if (!saved || mode === 'save-new') return;
    unsavedSaleNavigation.navigateWithoutPrompt(() => navigate('/sales'));
  }

  async function saveAndLeave() {
    const saved = await persistPendingSale('save', true);
    if (saved) unsavedSaleNavigation.confirmNavigation();
  }

  async function confirmDeletePendingBill() {
    if (!editingBillId || deleteBillSubmitting) return;
    setDeleteBillSubmitting(true);
    setDeleteBillError('');
    try {
      const result = await pendingSale.remove();
      if (result.kind === 'cancelled') return;
      if (result.kind !== 'deleted') {
        setDeleteBillError(result.message);
        if (result.kind === 'conflict') {
          setPendingSaleConflict(result.message);
          setDeleteBillConfirmationOpen(false);
        }
        setDeleteBillSubmitting(false);
        return;
      }
      setDeleteBillConfirmationOpen(false);
      unsavedSaleNavigation.navigateWithoutPrompt(() => navigate('/sales/new'));
    } catch (error) {
      setDeleteBillError(error instanceof Error ? error.message : t('newSale.deleteBillError'));
      setDeleteBillSubmitting(false);
    }
  }

  function requestDeletePendingBill() {
    setDeleteBillError('');
    setDeleteBillConfirmationOpen(true);
  }

  function removeSaleLine(cartKey: string) {
    const removesLastPendingLine = editingBillId !== null
      && cartDisplayGroups.length === 1
      && cartDisplayGroups[0]?.key === cartKey;
    if (removesLastPendingLine) {
      requestDeletePendingBill();
      return;
    }
    removeCartLine(cartKey);
  }

  function dismissLeaveConfirmation() {
    setSaveAndLeaveError('');
    unsavedSaleNavigation.cancelNavigation();
  }

  function leaveWithoutSaving() {
    setSaveAndLeaveError('');
    unsavedSaleNavigation.confirmNavigation();
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
    if (invoiceCreated || reminderOpen || settingsOpen || pendingConfirmation || paymentMethodDialogOpen) return;
    if (action.type === 'save-pending') {
      if (!discountOpen) void handleSave('save');
      return;
    }
    if (!discountOpen) openInvoiceBreakdown();
  }

  useEffect(() => {
    saleShortcutHandlerRef.current = handleSaleShortcut;
  });

  useEffect(() => subscribeSaleShortcuts(
    window,
    (event) => saleShortcutHandlerRef.current(event),
  ), []);


  return {
    toolbar: {
      t,
      ownerId,
      paymentMethod,
      paymentMethods: storeSettings.paymentMethods,
      showKeyboardHints: preferences.showKeyboardHints,
      paymentMethodLabel,
      purchaseMethod,
      saveMenuOpen,
      saveMenuRef,
      canSaveSale,
      leaveSale: leaveUnsavedSale,
      chooseOwner: setOwnerId,
      choosePaymentMethod: setPaymentMethod,
      openReminder: openReminderCard,
      toggleFulfilment: () => setPurchaseMethod((current) => (
        current === 'pickup' ? 'delivery' : 'pickup'
      )),
      save: handleSave,
      toggleSaveMenu: () => setSaveMenuOpen((open) => !open),
      canDeleteBill: editingBillId !== null,
      deleteBillSubmitting,
      requestDeleteBill: requestDeletePendingBill,
      openSettings: () => setSettingsOpen(true),
    },
    customerField: {
      t,
      billDate,
      customerFieldRef,
      customer,
      formatNumber,
      customerQuery,
      customerDropdownOpen,
      customerMatches,
      customerLoadError,
      highlightedCustomerIndex,
      pharmacistId,
      changeBillDate: setBillDate,
      clearCustomer: () => {
        setCustomer(null);
        setCustomerQuery('');
      },
      changeCustomerQuery: (value: string) => {
        setCustomerQuery(value);
        setCustomerDropdownOpen(true);
      },
      focusCustomerSearch: () => {
        setCustomerDropdownOpen(true);
        setHighlightedCustomerIndex(0);
      },
      handleCustomerSearchKeyDown,
      highlightCustomer: setHighlightedCustomerIndex,
      selectCustomer,
      choosePharmacist: setPharmacistId,
    },
    itemEntry: {
      t,
      itemFieldRef,
      itemSearchInputRef,
      itemQuery,
      itemDropdownOpen,
      itemMatches,
      itemSearchLoading,
      highlightedItemIndex,
      unpricedItemName,
      editor,
      batchPickerRef,
      qtyInputRef,
      recommendedBatchId,
      showKeyboardHints: preferences.showKeyboardHints,
      showAvailableStock: preferences.showAvailableStock,
      showProductLocation: storeSettings.showProductLocation,
      locale: appPreferences.locale,
      allergyWarningForItem,
      localizeUnit,
      formatExpiry,
      changeItemQuery: (value: string) => {
        setUnpricedItemName(null);
        setItemQuery(value);
        setItemDropdownOpen(true);
      },
      focusItemSearch: () => {
        setItemDropdownOpen(true);
        setHighlightedItemIndex(0);
      },
      handleItemSearchKeyDown,
      highlightItem: setHighlightedItemIndex,
      openItem: openEditorForItem,
      closeEditor: () => setEditor(null),
      toggleBatchPicker: () => {
        if (editor) setEditor({ ...editor, batchCardOpen: !editor.batchCardOpen });
      },
      chooseSellPack: handleSelectSellPack,
      changeEditorQuantity: (value: string) => {
        if (!editor) return;
        const digitsOnly = normalizeThaiKeyboardNumericInput(value).replace(/\D/g, '');
        const maxQuantity = totalAvailableStockForPack(editor.item.batches, editor.sellPack);
        const quantity = digitsOnly
          ? String(Math.min(maxQuantity || 1, Math.max(1, parseInt(digitsOnly, 10))))
          : '';
        setEditor({ ...editor, qty: quantity });
      },
      addEditorToCart: commitEditorToCart,
      chooseBatch: handleSelectBatch,
    },
    cartTable: {
      t,
      cartDisplayGroups,
      catalog,
      cartQtyDrafts,
      showProductLocation: storeSettings.showProductLocation,
      allergyWarningForItem,
      localizeUnit,
      formatExpiry,
      removeLine: removeSaleLine,
      updateQuantity: updateCartQty,
      changeQuantity: (groupKey: string, value: string) => {
        const digitsOnly = normalizeThaiKeyboardNumericInput(value).replace(/\D/g, '');
        if (!digitsOnly) {
          setCartQtyDrafts((drafts) => ({ ...drafts, [groupKey]: '' }));
          return;
        }
        setCartQtyDrafts((drafts) => ({ ...drafts, [groupKey]: digitsOnly }));
        updateCartQty(groupKey, parseInt(digitsOnly, 10));
      },
      clearEmptyQuantity: (groupKey: string) => setCartQtyDrafts((drafts) => {
        if (drafts[groupKey] !== '') return drafts;
        const next = { ...drafts };
        delete next[groupKey];
        return next;
      }),
    },
    productBrowser: {
      t,
      topItems,
      topItemsLabel,
      heldItemId,
      localizeUnit,
      showProductLocation: storeSettings.showProductLocation,
      showAvailableStock: preferences.showAvailableStock,
      startHold,
      endHold,
      openItem: handleTopItemTap,
    },
    summaryBar: {
      t,
      totalQty,
      uniqueItemCount,
      appliedDiscount,
      netPayable,
      showKeyboardHints: preferences.showKeyboardHints,
      canOpenInvoiceBreakdown,
      openInvoiceBreakdown,
    },
    reminderPanel: {
      t,
      reminderOpen,
      reminderEligibleLines,
      catalog,
      reminderRows,
      formatNumber,
      localizeUnit,
      showProductLocation: storeSettings.showProductLocation,
      closeReminder: () => setReminderOpen(false),
      toggleReminderLine,
      chooseReminderTime: setReminderTime,
      navigateReminderTime,
      changeReminderDose,
    },
    settingsDialog: {
      t,
      settingsOpen,
      billingDevice,
      paperSize,
      cashDrawerDevice,
      autoOpenCashDrawer,
      billingDeviceIsOverridden: billingDeviceOverride !== null,
      paperSizeIsOverridden: paperSizeOverride !== null,
      cashDrawerDeviceIsOverridden: cashDrawerDeviceOverride !== null,
      autoOpenCashDrawerIsOverridden: autoOpenCashDrawerOverride !== null,
      closeSettings: () => setSettingsOpen(false),
      chooseBillingDevice: setBillingDeviceOverride,
      choosePaperSize: setPaperSizeOverride,
      chooseCashDrawer: setCashDrawerDeviceOverride,
      toggleAutoCashDrawer: setAutoOpenCashDrawerOverride,
      resetBillingDevice: () => setBillingDeviceOverride(null),
      resetPaperSize: () => setPaperSizeOverride(null),
      resetCashDrawer: () => setCashDrawerDeviceOverride(null),
      resetAutoCashDrawer: () => setAutoOpenCashDrawerOverride(null),
      openPosPreferences: () => navigate('/settings'),
    },
    paymentPanel: {
      t,
      discountOpen,
      subtotal,
      itemDiscountAmount,
      discountAmount,
      discountType,
      discountInput,
      draftNetPayable,
      customerPayInputRef,
      customerPayInput,
      paymentMethod,
      liveChangeDue,
      autoOpenCashDrawer,
      cashDrawerDevice,
      saleSubmitError,
      appliedDiscount,
      saleSubmitting,
      closePayment: () => setDiscountOpen(false),
      chooseDiscountType: setDiscountType,
      changeDiscountInput: setDiscountInput,
      changeCustomerPayment: (value: string) => {
        setSaleSubmitError('');
        setCustomerPayEdited(true);
        setCustomerPayInput(value);
      },
      handleCustomerPayEnter,
      addCustomerCash,
      clearDiscount,
      submitInvoicePayment,
    },
    completionDialog: {
      t,
      hardwareError: salePayment.hardwareError,
      hardwarePending: salePayment.hardwarePending,
      invoiceCreated,
      paymentMethodLabel,
      formatDate,
      paperSize,
      newSaleButtonRef,
      startNewSale: resetForNewWalkIn,
    },
    paymentMethodDialog: {
      open: paymentMethodDialogOpen,
      methods: storeSettings.paymentMethods,
      selectedMethod: paymentMethod,
      paymentMethodLabel,
      title: t('newSale.choosePaymentMethod'),
      description: t('newSale.choosePaymentMethodHint'),
      closeLabel: t('newSale.close'),
      onCancel: () => setPaymentMethodDialogOpen(false),
      onChoose: choosePaymentMethodForInvoice,
    },
    confirmationDialog: {
      open: pendingConfirmation !== null || deleteBillConfirmationOpen || unsavedSaleNavigation.navigationBlocked,
      title: pendingConfirmation
        ? t('newSale.removeQuestion')
        : deleteBillConfirmationOpen
          ? t('newSale.deleteBillQuestion')
        : t('newSale.leaveQuestion'),
      description: pendingConfirmation
        ? t('newSale.removeDescription', { name: pendingConfirmation.itemName })
        : deleteBillConfirmationOpen
          ? deleteBillError || t('newSale.deleteBillDescription', { billNo: editingBillNo ?? '' })
        : saveAndLeaveError || t('newSale.leaveDescription'),
      cancelLabel: t(
        pendingConfirmation || deleteBillConfirmationOpen
          ? 'newSale.keepWorking'
          : 'newSale.leaveSale',
      ),
      confirmLabel: pendingConfirmation
        ? t('newSale.removeItem')
        : deleteBillConfirmationOpen
          ? t(deleteBillSubmitting ? 'newSale.deletingBill' : 'newSale.deleteBill')
        : t(saleSubmitting ? 'newSale.savingAndLeaving' : 'newSale.saveAndLeave'),
      confirmTone: pendingConfirmation || deleteBillConfirmationOpen ? 'danger' as const : 'primary' as const,
      confirmDisabled: !pendingConfirmation && !deleteBillConfirmationOpen && !canSaveSale,
      busy: (deleteBillConfirmationOpen && deleteBillSubmitting)
        || (unsavedSaleNavigation.navigationBlocked && saleSubmitting),
      dismiss: pendingConfirmation
        ? () => setPendingConfirmation(null)
        : deleteBillConfirmationOpen
          ? () => setDeleteBillConfirmationOpen(false)
        : dismissLeaveConfirmation,
      cancel: pendingConfirmation
        ? () => setPendingConfirmation(null)
        : deleteBillConfirmationOpen
          ? () => setDeleteBillConfirmationOpen(false)
        : leaveWithoutSaving,
      confirm: pendingConfirmation
        ? confirmPendingAction
        : deleteBillConfirmationOpen
          ? () => void confirmDeletePendingBill()
        : () => void saveAndLeave(),
    },
    pendingSaleStatus: {
      t,
      loading: pendingBillId !== null && pendingSale.loadState === 'loading',
      unavailable: pendingSale.unavailable,
      conflictMessage: pendingSaleConflict,
      retry: () => {
        setPendingSaleConflict('');
        pendingSale.retry();
      },
      returnToSales: () => unsavedSaleNavigation.navigateWithoutPrompt(() => navigate('/sales')),
      startNewSale: () => {
        resetForNewWalkIn();
        unsavedSaleNavigation.navigateWithoutPrompt(() => navigate('/sales/new', { replace: true }));
      },
      dismissConflict: () => setPendingSaleConflict(''),
    },
  };
}

type SaleWorkflow = ReturnType<typeof useSaleWorkflow>;
export type SaleToolbarModel = SaleWorkflow['toolbar'];
export type SaleCustomerFieldModel = SaleWorkflow['customerField'];
export type SaleItemEntryModel = SaleWorkflow['itemEntry'];
export type SaleCartTableModel = SaleWorkflow['cartTable'];
export type SaleProductBrowserModel = SaleWorkflow['productBrowser'];
export type SaleSummaryBarModel = SaleWorkflow['summaryBar'];
export type SaleReminderPanelModel = SaleWorkflow['reminderPanel'];
export type SaleSettingsDialogModel = SaleWorkflow['settingsDialog'];
export type SalePaymentPanelModel = SaleWorkflow['paymentPanel'];
export type SaleCompletionDialogModel = SaleWorkflow['completionDialog'];
export type PaymentMethodDialogModel = SaleWorkflow['paymentMethodDialog'];
export type PendingSaleStatusModel = SaleWorkflow['pendingSaleStatus'];
