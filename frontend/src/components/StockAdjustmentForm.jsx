import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useItem } from '../services/useItem'
import { useStockMovement } from '../services/useStockMovement'

const toNumber = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const normalizeText = (value) => String(value || '').toLowerCase().trim()
const getItemName = (item) => item?.item_name || item?.name || 'Unnamed Item'
const getItemSku = (item) => item?.sku || item?.item_code || 'No SKU'
const getCurrentStock = (item) => toNumber(item?.current_stock ?? item?.quantity)
const getItemCategory = (item) => item?.category?.name || item?.category_name || 'Uncategorized'
const getItemSupplier = (item) => item?.supplier?.name || item?.supplier_name || '-'
const getItemStatus = (item) => item?.stock_status || '-'
const getMovementReason = (movement) => movement?.reason || movement?.remarks || movement?.note || movement?.description || movement?.stock_adjustment?.reason || ''
const getMovementDateTime = (movement) => movement?.movement_time || movement?.created_at || movement?.createdAt || movement?.updated_at || movement?.updatedAt || ''
const getMovementUser = (movement) => movement?.user?.name || movement?.performed_by?.name || movement?.performed_by_name || movement?.created_by_name || movement?.created_by || 'System'

const formatDateTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

export const StockAdjustmentForm = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const returnPath = location.state?.from || '/stock-movement'
  const mode = location.state?.mode === 'view' ? 'view' : 'create'
  const selectedAdjustment = location.state?.adjustment || null
  const isViewMode = mode === 'view'

  const { items = [], isLoadingItems } = useItem()
  const { createAdjustment } = useStockMovement()

  const [formData, setFormData] = useState({
    item_id: isViewMode
      ? String(
        selectedAdjustment?.item?.id
        ?? selectedAdjustment?.item_id
        ?? selectedAdjustment?.stock_adjustment?.item_id
        ?? '',
      )
      : '',
    quantity: isViewMode
      ? String(Math.abs(toNumber(
        selectedAdjustment?.quantity_change
        ?? selectedAdjustment?.adjustment_qty
        ?? selectedAdjustment?.quantity
        ?? selectedAdjustment?.qty,
      )))
      : '',
    reason: isViewMode ? getMovementReason(selectedAdjustment) : '',
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [isSaving, setIsSaving] = useState(false)

  const categories = useMemo(() => {
    const unique = new Set()
    items.forEach((item) => {
      const category = getItemCategory(item)
      if (category) unique.add(category)
    })
    return [...unique].sort((a, b) => a.localeCompare(b))
  }, [items])

  const filteredItems = useMemo(() => {
    const query = normalizeText(searchTerm)

    return items.filter((item) => {
      const itemName = normalizeText(getItemName(item))
      const sku = normalizeText(getItemSku(item))
      const category = getItemCategory(item)

      const matchesCategory = selectedCategory === 'all' || category === selectedCategory
      const matchesSearch = !query || itemName.includes(query) || sku.includes(query)

      return matchesCategory && matchesSearch
    })
  }, [items, searchTerm, selectedCategory])

  const selectedItem = useMemo(
    () => items.find((item) => Number(item?.id) === Number(formData.item_id)) || null,
    [items, formData.item_id],
  )

  const enteredQuantity = toNumber(formData.quantity)
  const selectedItemStock = getCurrentStock(selectedItem)
  const wouldOverAdjust = !isViewMode && selectedItem && enteredQuantity > selectedItemStock
  const remainingStock = !isViewMode && selectedItem
    ? Math.max(0, selectedItemStock - enteredQuantity)
    : null

  const handleSelectItem = (itemId) => {
    setFormData((prev) => ({ ...prev, item_id: String(itemId) }))
  }

  const applyReasonTemplate = (template) => {
    setFormData((prev) => ({ ...prev, reason: template }))
  }

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const itemId = Number(formData.item_id)
    const enteredQuantity = Number(formData.quantity)
    const quantity = -Math.abs(enteredQuantity)

    if (!itemId) {
      toast.error('Please select an item.')
      return
    }

    if (!Number.isFinite(enteredQuantity) || enteredQuantity <= 0) {
      toast.error('Enter a quantity greater than zero.')
      return
    }

    if (selectedItem && enteredQuantity > getCurrentStock(selectedItem)) {
      toast.error('Adjustment quantity cannot be greater than current stock.')
      return
    }

    if (!String(formData.reason || '').trim()) {
      toast.error('Reason is required.')
      return
    }

    setIsSaving(true)
    const result = await createAdjustment({
      item_id: itemId,
      quantity,
      reason: formData.reason.trim(),
    })
    setIsSaving(false)

    if (!result.success) {
      toast.error(result.message)
      return
    }

    toast.success(result.message)
    navigate('/stock-movement', { replace: true })
  }

  const detailItem = selectedItem || selectedAdjustment?.item || null
  const detailDateTime = selectedAdjustment ? formatDateTime(getMovementDateTime(selectedAdjustment)) : '-'
  const detailUser = selectedAdjustment ? getMovementUser(selectedAdjustment) : '-'
  const detailAdjustmentId = selectedAdjustment?.stock_adjustment_id
    || selectedAdjustment?.stock_adjustment?.id
    || selectedAdjustment?.id
    || selectedAdjustment?.movement_id
    || '-'

  return (
    <main className="h-full overflow-hidden bg-linear-to-br from-slate-100 via-white to-blue-50 p-3 sm:p-4">
      <section className="mx-auto flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-200/70 bg-white/95 shadow-xl shadow-slate-300/30 backdrop-blur-sm">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-7 sm:py-5">
          <div>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              {isViewMode ? 'Stock Adjustment Details' : 'Record Stock Adjustment'}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {isViewMode
                ? 'Review the selected stock adjustment record.'
                : 'Saves directly to stock adjustment records in the database.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(returnPath)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Cancel
          </button>
        </header>

        <form className="flex h-full min-h-0 flex-col gap-4 px-5 py-4 sm:px-7 sm:py-5" onSubmit={handleSubmit}>
          {isViewMode && !selectedAdjustment && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Adjustment details are unavailable. Please open a record from the Stock Management table.
            </div>
          )}

          <div className="space-y-4 overflow-y-auto">
            {!isViewMode && (
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-2">
                  <label htmlFor="itemSearch" className="text-xs font-semibold uppercase tracking-wide text-slate-600">Find Item</label>
                  <input
                    id="itemSearch"
                    type="text"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search by item name or SKU"
                    autoFocus
                    disabled={isLoadingItems || isSaving}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-slate-100"
                  />
                </div>

                <div className="w-full space-y-2 sm:w-60">
                  <label htmlFor="categoryFilter" className="text-xs font-semibold uppercase tracking-wide text-slate-600">Category</label>
                  <select
                    id="categoryFilter"
                    value={selectedCategory}
                    onChange={(event) => setSelectedCategory(event.target.value)}
                    disabled={isLoadingItems || isSaving}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-slate-100"
                  >
                    <option value="all">All Categories</option>
                    {categories.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="text-xs text-slate-500">
                Showing {filteredItems.length} of {items.length} items. Click a row to select.
              </p>

              <div className="max-h-44 overflow-auto rounded-xl border border-slate-200 bg-white">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2">SKU</th>
                      <th className="px-3 py-2">Category</th>
                      <th className="px-3 py-2">Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-4 text-center text-slate-500">No items match your search.</td>
                      </tr>
                    ) : (
                      filteredItems.map((item) => {
                        const isSelected = Number(formData.item_id) === Number(item?.id)

                        return (
                          <tr
                            key={item?.id}
                            onClick={() => handleSelectItem(item?.id)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                handleSelectItem(item?.id)
                              }
                            }}
                            tabIndex={0}
                            role="button"
                            className={`cursor-pointer border-t border-slate-100 transition ${isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                          >
                            <td className="px-3 py-2 font-medium text-slate-800">{getItemName(item)}</td>
                            <td className="px-3 py-2 text-slate-600">{getItemSku(item)}</td>
                            <td className="px-3 py-2 text-slate-600">{getItemCategory(item)}</td>
                            <td className="px-3 py-2 text-slate-800">{getCurrentStock(item)}</td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {selectedItem ? (
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Selected Item Preview</p>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">Name</p>
                      <p className="font-medium text-slate-800">{getItemName(selectedItem)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">SKU</p>
                      <p className="font-medium text-slate-800">{getItemSku(selectedItem)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">Category</p>
                      <p className="font-medium text-slate-800">{getItemCategory(selectedItem)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">Stock</p>
                      <p className="font-semibold text-slate-900">{getCurrentStock(selectedItem)}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500">Select an item from the table above to preview its details here.</p>
              )}
              </div>
            )}

            {isViewMode && selectedAdjustment && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected Item Details</p>
                <div className="mt-3 overflow-auto rounded-lg border border-slate-200 bg-white">
                  <table className="min-w-full text-sm">
                    <tbody>
                      <tr className="border-b border-slate-100">
                        <td className="px-3 py-2 text-slate-500">Name</td>
                        <td className="px-3 py-2 font-medium text-slate-800">{getItemName(detailItem)}</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="px-3 py-2 text-slate-500">SKU</td>
                        <td className="px-3 py-2 text-slate-800">{getItemSku(detailItem)}</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="px-3 py-2 text-slate-500">Category</td>
                        <td className="px-3 py-2 text-slate-800">{getItemCategory(detailItem)}</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="px-3 py-2 text-slate-500">Supplier</td>
                        <td className="px-3 py-2 text-slate-800">{getItemSupplier(detailItem)}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 text-slate-500">Current Stock</td>
                        <td className="px-3 py-2 font-semibold text-slate-900">{getCurrentStock(detailItem)} ({getItemStatus(detailItem)})</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {isViewMode && selectedAdjustment && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Adjustment Record</p>
                <div className="mt-3 overflow-auto rounded-lg border border-slate-200 bg-white">
                  <table className="min-w-full text-sm">
                    <tbody>
                      <tr className="border-b border-slate-100">
                        <td className="px-3 py-2 text-slate-500">Adjustment ID</td>
                        <td className="px-3 py-2 font-medium text-slate-800">{detailAdjustmentId}</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="px-3 py-2 text-slate-500">Adjusted Quantity</td>
                        <td className="px-3 py-2 text-slate-800">-{Math.abs(toNumber(formData.quantity))}</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="px-3 py-2 text-slate-500">Created At</td>
                        <td className="px-3 py-2 text-slate-800">{detailDateTime}</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="px-3 py-2 text-slate-500">User</td>
                        <td className="px-3 py-2 text-slate-800">{detailUser}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 text-slate-500">Reason</td>
                        <td className="px-3 py-2 text-slate-800 whitespace-pre-wrap">{formData.reason || '-'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {!isViewMode && (
              <div className="space-y-2">
              <label htmlFor="quantity" className="text-xs font-semibold uppercase tracking-wide text-slate-600">Decrease Quantity</label>
              <input
                id="quantity"
                name="quantity"
                type="number"
                min={1}
                step={1}
                value={formData.quantity}
                onChange={handleChange}
                placeholder="Enter quantity to reduce stock"
                disabled={isSaving || !selectedItem}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-slate-100"
              />
              {!selectedItem && <p className="text-xs text-amber-600">Select an item first to enter quantity.</p>}
              {selectedItem && (
                <p className={`text-xs ${wouldOverAdjust ? 'text-rose-600' : 'text-slate-500'}`}>
                  Current stock: {selectedItemStock}. Remaining after adjustment: {remainingStock}.
                </p>
              )}
              </div>
            )}

            {!isViewMode && (
              <div className="space-y-2">
              <label htmlFor="reason" className="text-xs font-semibold uppercase tracking-wide text-slate-600">Reason</label>
              <div className="flex flex-wrap gap-2">
                {['Damaged item', 'Expired item', 'Missing/Lost item', 'Manual stock correction'].map((template) => (
                  <button
                    key={template}
                    type="button"
                    onClick={() => applyReasonTemplate(template)}
                    disabled={isSaving}
                    className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:bg-slate-100"
                  >
                    {template}
                  </button>
                ))}
              </div>
              <textarea
                id="reason"
                name="reason"
                rows={4}
                value={formData.reason}
                onChange={handleChange}
                placeholder="Explain why this adjustment is needed"
                disabled={isSaving}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-slate-100"
              />
              <p className="text-xs text-slate-500">{String(formData.reason || '').length}/255 characters</p>
              </div>
            )}
          </div>

          <div className="mt-auto flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => navigate(returnPath)}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              disabled={isSaving}
            >
              Back
            </button>
            {!isViewMode && (
              <button
                type="submit"
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                disabled={isSaving || !formData.item_id || wouldOverAdjust}
              >
                {isSaving ? 'Saving...' : 'Save Adjustment'}
              </button>
            )}
          </div>
        </form>
      </section>
    </main>
  )
}

export default StockAdjustmentForm
