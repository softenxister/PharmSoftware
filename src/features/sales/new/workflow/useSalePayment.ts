import { useEffect, useMemo, useRef, useState } from 'react';
import type { StorePaymentMethod } from '@/config/preferences/storePosSettings';
import { calculateSalePricing } from './saleDraft';
import type { AppliedDiscount, DiscountType } from './saleTypes';

type PricingLine = {
  quantity: number;
  unitPrice: number;
  discountPercent: number;
};

type Params = {
  pricingLines: PricingLine[];
  lineCount: number;
  paymentMethod: StorePaymentMethod;
  billingDevice: string;
  cashDrawerDevice: string;
  autoOpenCashDrawer: boolean;
};

export function useSalePayment(params: Params) {
  const [discountOpen, setDiscountOpen] = useState(false);
  const [discountType, setDiscountType] = useState<DiscountType>('percent');
  const [discountInput, setDiscountInput] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<AppliedDiscount | null>(null);
  const [customerPayInput, setCustomerPayInput] = useState('');
  const [customerPayEdited, setCustomerPayEdited] = useState(false);
  const customerPayInputRef = useRef<HTMLInputElement | null>(null);

  const salePricing = useMemo(
    () => calculateSalePricing(params.pricingLines, appliedDiscount),
    [appliedDiscount, params.pricingLines],
  );
  const draftBillDiscount = useMemo((): AppliedDiscount | null => {
    const value = parseFloat(discountInput);
    if (Number.isNaN(value) || value <= 0) return appliedDiscount;
    return { type: discountType, value };
  }, [appliedDiscount, discountInput, discountType]);
  const draftPricing = useMemo(
    () => calculateSalePricing(params.pricingLines, draftBillDiscount),
    [draftBillDiscount, params.pricingLines],
  );
  const customerPaidAmount = parseFloat(customerPayInput);
  const liveChangeDue = Number.isNaN(customerPaidAmount)
    ? 0
    : Math.max(customerPaidAmount - draftPricing.netPayable, 0);

  useEffect(() => {
    if (!discountOpen) return;
    window.setTimeout(() => {
      customerPayInputRef.current?.focus();
      customerPayInputRef.current?.select();
    }, 0);
  }, [discountOpen]);

  useEffect(() => {
    if (!discountOpen || customerPayEdited) return;
    setCustomerPayInput(draftPricing.netPayable.toFixed(2));
  }, [customerPayEdited, discountOpen, draftPricing.netPayable]);

  function openDiscountDrawer() {
    if (params.lineCount === 0 || !Number.isFinite(salePricing.netPayable) || salePricing.netPayable <= 0) return;
    if (appliedDiscount) {
      setDiscountType(appliedDiscount.type);
      setDiscountInput(String(appliedDiscount.value));
    }
    setCustomerPayInput(salePricing.netPayable.toFixed(2));
    setCustomerPayEdited(false);
    setDiscountOpen(true);
  }

  function addCustomerCash(amount: number) {
    const currentPaid = parseFloat(customerPayInput);
    const basePaid = customerPayEdited && !Number.isNaN(currentPaid) ? currentPaid : 0;
    setCustomerPayEdited(true);
    setCustomerPayInput(String(basePaid + amount));
    window.setTimeout(() => customerPayInputRef.current?.focus(), 0);
  }

  function readDraftDiscount(): AppliedDiscount | null {
    const value = parseFloat(discountInput);
    return Number.isNaN(value) || value <= 0 ? null : { type: discountType, value };
  }

  function clearDiscount() {
    setAppliedDiscount(null);
    setDiscountInput('');
    setDiscountOpen(false);
  }

  function openCashDrawer(reason: string) {
    if (!params.autoOpenCashDrawer || params.cashDrawerDevice === 'No Cash Drawer') return;
    console.log('Opening cash drawer', {
      cashDrawerDevice: params.cashDrawerDevice,
      billingDevice: params.billingDevice,
      paymentMethod: params.paymentMethod,
      reason,
    });
  }

  return {
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
    customerPayEdited,
    setCustomerPayEdited,
    customerPayInputRef,
    subtotal: salePricing.grossSubtotal,
    itemDiscountAmount: salePricing.itemDiscountAmount,
    discountAmount: salePricing.billDiscountAmount,
    netPayable: salePricing.netPayable,
    draftNetPayable: draftPricing.netPayable,
    liveChangeDue,
    openDiscountDrawer,
    addCustomerCash,
    readDraftDiscount,
    clearDiscount,
    openCashDrawer,
  };
}
