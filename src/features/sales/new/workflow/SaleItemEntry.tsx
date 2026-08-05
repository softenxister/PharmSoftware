import { localizeProductUnit } from '@/i18n/productUnits';
import { displayBatchField, nearestAvailableExpiryBatch } from '@/lib/batchPresentation';
import styles from '../NewSale.module.css';
import {
  availableStockForPack,
  buildProductDescription,
  formatBaht,
  normalizeThaiKeyboardNumericInput,
  sellPriceForPack,
  shouldUseSellPackDropdown,
  totalAvailableStockForPack,
} from './saleDraft';
import { CustomSelect, IconBin, IconChevronDown, IconSearch } from './SalePrimitives';
import type { Batch } from './saleTypes';
import type { SaleWorkflow } from './useSaleWorkflow';

function nearestExpiryBatch(batches: Batch[]): Batch | null {
  return nearestAvailableExpiryBatch(
    batches,
    (batch) => batch.exp,
    (batch) => batch.stock,
  );
}

export function SaleItemEntry({ sale }: { sale: SaleWorkflow }) {
  const {
    t,
    itemFieldRef,
    itemSearchInputRef,
    itemQuery,
    setItemQuery,
    setItemDropdownOpen,
    setHighlightedItemIndex,
    handleItemSearchKeyDown,
    preferences,
    itemDropdownOpen,
    itemMatches,
    itemSearchLoading,
    highlightedItemIndex,
    unpricedItemName,
    setUnpricedItemName,
    allergyWarningForItem,
    localizeUnit,
    storeSettings,
    openEditorForItem,
    editor,
    batchPickerRef,
    setEditor,
    handleSelectSellPack,
    qtyInputRef,
    commitEditorToCart,
    recommendedBatchId,
    handleSelectBatch,
    formatExpiry,
    appPreferences,
  } = sale;

  return (
    <>
      <div className={styles.searchSection} ref={itemFieldRef}>
        <div className={styles.itemSearchControl}>
          <div className={styles.itemSearchField}>
            <IconSearch className={styles.itemSearchIcon} />
            <input
              ref={itemSearchInputRef}
              autoFocus
              type="text"
              value={itemQuery}
              onChange={(event) => {
                setUnpricedItemName(null);
                setItemQuery(event.target.value);
                setItemDropdownOpen(true);
              }}
              onFocus={() => {
                setItemDropdownOpen(true);
                setHighlightedItemIndex(0);
              }}
              onKeyDown={handleItemSearchKeyDown}
              placeholder={t('newSale.searchItem')}
              aria-invalid={unpricedItemName ? true : undefined}
              aria-describedby={unpricedItemName ? 'item-sell-price-warning' : undefined}
              className={`${styles.itemSearchInput} ${preferences.showKeyboardHints ? styles.itemSearchInputWithHints : ''}`}
            />
            {preferences.showKeyboardHints && (
              <span className={styles.keyboardHint} aria-hidden="true">
                <kbd>↑↓</kbd> {t('newSale.browse')} <kbd>Enter</kbd> {t('newSale.add')} <kbd>Esc</kbd> {t('newSale.close')}
              </span>
            )}
          </div>
          {itemDropdownOpen && itemQuery.trim() && (
            <div className={styles.itemDropdownPanel}>
              {itemMatches.length === 0 && (
                <div className={styles.dropdownEmpty}>{itemSearchLoading ? 'Loading…' : t('newSale.noItem')}</div>
              )}
              {itemMatches.map((item, index) => {
                const nearest = nearestExpiryBatch(item.batches);
                const totalStock = item.batches.reduce((sum, batch) => sum + batch.stock, 0);
                const isHighlighted = index === highlightedItemIndex;
                const allergyWarning = allergyWarningForItem(item);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`${styles.itemOption} ${isHighlighted ? styles.itemOptionActive : ''}`}
                    aria-selected={isHighlighted}
                    onMouseEnter={() => setHighlightedItemIndex(index)}
                    onMouseMove={() => setHighlightedItemIndex(index)}
                    onClick={() => openEditorForItem(item)}
                  >
                    <img src={item.image} alt="" className={styles.itemOptionThumb} />
                    <div className={styles.itemOptionMeta}>
                      <span className={styles.itemOptionName}>
                        <span>{item.name}</span>
                        {allergyWarning && <strong className={styles.allergyWarning}>{allergyWarning}</strong>}
                      </span>
                      <span className={styles.itemOptionSub}>
                        {buildProductDescription({
                          brand: item.brand,
                          packLabel: localizeUnit(item.packLabel),
                          location: item.loc,
                          totalStock,
                          showLocation: storeSettings.showProductLocation,
                          showStock: preferences.showAvailableStock,
                        })}
                      </span>
                    </div>
                    <span className={styles.itemOptionPrice}>
                      <span>{nearest ? `฿${formatBaht(nearest.sellPrice)}` : t('newSale.outOfStock')}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {unpricedItemName && (
          <span
            id="item-sell-price-warning"
            className={styles.itemSellPriceWarning}
            role="alert"
            title={t('newSale.zeroSellPriceWarning')}
          >
            <span aria-hidden="true">⚠</span>
            {t('newSale.zeroSellPriceWarning')}
          </span>
        )}
      </div>

      {editor && (
        <div className={styles.editorBlock} ref={batchPickerRef}>
          <div className={styles.editorRows}>
            <div className={styles.editorPrimaryRow}>
              <button type="button" className={styles.binButton} onClick={() => setEditor(null)} aria-label={t('newSale.cancelItem')}>
                <IconBin />
              </button>
              <div className={styles.editorField}>
                <span className={styles.editorFieldLabel}>{t('newSale.item')}</span>
                <span className={styles.editorItemLine}>
                  <span className={styles.editorItemName} title={editor.item.name}>{editor.item.name}</span>
                  {allergyWarningForItem(editor.item) && <strong className={styles.allergyWarning}>{allergyWarningForItem(editor.item)}</strong>}
                </span>
                {storeSettings.showProductLocation && <span className={styles.editorFieldMeta}>{editor.item.loc}</span>}
              </div>

              <div className={styles.editorField}>
                <span className={styles.editorFieldLabel}>{t('newSale.pack')}</span>
                {shouldUseSellPackDropdown(editor.item.sellPacks.length) ? (
                  <CustomSelect
                    ariaLabel={t('newSale.sellUnit')}
                    value={editor.sellPack.key}
                    options={editor.item.sellPacks
                      .filter((pack) => editor.item.batches.some((batch) => availableStockForPack(batch, pack) > 0))
                      .map((pack) => ({ value: pack.key, label: localizeUnit(pack.label) }))}
                    onChange={(packKey) => {
                      const pack = editor.item.sellPacks.find((candidate) => candidate.key === packKey);
                      if (pack) handleSelectSellPack(pack);
                    }}
                    className={styles.sellPackSelect}
                  />
                ) : (
                  <span className={styles.singlePackValue} aria-label={t('newSale.sellUnit')} title={localizeUnit(editor.sellPack.relationLabel)}>
                    {localizeUnit(editor.sellPack.label)}
                  </span>
                )}
              </div>

              <div className={styles.editorField}>
                <span className={styles.editorFieldLabel}>{t('newSale.batch')}</span>
                <button
                  type="button"
                  className={styles.batchToggle}
                  onClick={() => setEditor({ ...editor, batchCardOpen: !editor.batchCardOpen })}
                  aria-haspopup="listbox"
                  aria-expanded={editor.batchCardOpen}
                >
                  <span>{displayBatchField(editor.batch.batchNo)}</span>
                  <IconChevronDown className={editor.batchCardOpen ? styles.chevronOpen : ''} />
                </button>
              </div>
            </div>

            <div className={styles.editorDivider} aria-hidden="true" />
            <div className={styles.editorSecondaryRow}>
              <div className={styles.editorPriceField}><strong>฿{formatBaht(sellPriceForPack(editor.batch, editor.sellPack))}</strong></div>
              <label className={styles.editorQuantityField}>
                <input
                  ref={qtyInputRef}
                  type="text"
                  inputMode="numeric"
                  aria-label={t('newSale.quantityShort')}
                  value={editor.qty}
                  onFocus={(event) => event.currentTarget.select()}
                  onKeyDown={(event) => {
                    if (event.key === ' ') {
                      event.preventDefault();
                      setEditor({ ...editor, qty: '' });
                    } else if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey) {
                      event.preventDefault();
                      commitEditorToCart();
                    }
                  }}
                  onChange={(event) => {
                    const digitsOnly = normalizeThaiKeyboardNumericInput(event.target.value).replace(/\D/g, '');
                    const maxQuantity = totalAvailableStockForPack(editor.item.batches, editor.sellPack);
                    const quantity = digitsOnly
                      ? String(Math.min(maxQuantity || 1, Math.max(1, parseInt(digitsOnly, 10))))
                      : '';
                    setEditor({ ...editor, qty: quantity });
                  }}
                  className={styles.qtyInputSmall}
                />
              </label>
              <button type="button" className={styles.addButton} onClick={commitEditorToCart}>
                <span className={styles.addButtonIcon} aria-hidden="true">+</span>
                <span>{t('newSale.add')}</span>
              </button>
            </div>
          </div>

          {editor.batchCardOpen && (
            <div className={styles.batchCard}>
              <p className={styles.batchCardLabel}>{t('newSale.chooseBatch')}</p>
              <div className={styles.batchOptions} role="listbox" aria-label={t('newSale.batch')}>
                {editor.item.batches.filter((batch) => availableStockForPack(batch, editor.sellPack) > 0).map((batch) => (
                  <button
                    key={batch.batchId}
                    type="button"
                    role="option"
                    aria-selected={batch.batchId === editor.batch.batchId}
                    className={`${styles.batchOption} ${batch.batchId === editor.batch.batchId ? styles.batchOptionActive : ''}`}
                    onClick={() => handleSelectBatch(batch)}
                  >
                    <span className={styles.batchOptionNo}>
                      {displayBatchField(batch.batchNo)}
                      {batch.batchId === recommendedBatchId && <span className={styles.recommendedTag}>{t('newSale.nearestExpiry')}</span>}
                    </span>
                    <span className={styles.batchOptionRow}><span className={styles.muted}>{t('newSale.expiryShort')}</span> {formatExpiry(batch.exp)}</span>
                    <span className={styles.batchOptionRow}><span className={styles.muted}>{t('newSale.sell')}</span> ฿{formatBaht(sellPriceForPack(batch, editor.sellPack))}</span>
                    {preferences.showAvailableStock && (
                      <span className={styles.batchOptionRow}>
                        <span className={styles.muted}>{t('nav.stock')}</span> {availableStockForPack(batch, editor.sellPack)} {localizeProductUnit(appPreferences.locale, editor.sellPack.unit, availableStockForPack(batch, editor.sellPack))}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
