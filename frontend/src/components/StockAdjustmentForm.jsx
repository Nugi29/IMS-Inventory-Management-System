import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useItem } from '../services/useItem'
import { useStockMovement } from '../services/useStockMovement'

const toNumber = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const getItemName = (item) => item?.item_name || item?.name || 'Unnamed Item'
const getItemSku = (item) => item?.sku || item?.item_code || 'No SKU'
const getCurrentStock = (item) => toNumber(item?.current_stock ?? item?.quantity)

export const StockAdjustmentForm = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const returnPath = location.state?.from || '/stock-movement'

  const { items = [], isLoadingItems } = useItem()
  const { createAdjustment } = useStockMovement()

  const [formData, setFormData] = useState({
    item_id: '',
    quantity: '',
    reason: '',
  })
  const [isSaving, setIsSaving] = useState(false)

  const selectedItem = useMemo(
    () => items.find((item) => Number(item?.id) === Number(formData.item_id)) || null,
    [items, formData.item_id],
  )

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const itemId = Number(formData.item_id)
    const quantity = Number(formData.quantity)

    if (!itemId) {
      toast.error('Please select an item.')
      return
    }

    if (!Number.isFinite(quantity) || quantity === 0) {
      toast.error('Enter a non-zero quantity.')
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

  return (
    <main className="h-full overflow-hidden bg-linear-to-br from-slate-100 via-white to-blue-50 p-3 sm:p-4">
      <section className="mx-auto flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-200/70 bg-white/95 shadow-xl shadow-slate-300/30 backdrop-blur-sm">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-7 sm:py-5">
          <div>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              Record Stock Adjustment
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Saves directly to stock adjustment records in the database.
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
          <div className="space-y-4 overflow-y-auto">
            <div className="space-y-2">
              <label htmlFor="item_id" className="text-xs font-semibold uppercase tracking-wide text-slate-600">Item</label>
              <select
                id="item_id"
                name="item_id"
                value={formData.item_id}
                onChange={handleChange}
                disabled={isLoadingItems || isSaving}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-slate-100"
              >
                <option value="">Select item</option>
                {items.map((item) => (
                  <option key={item?.id} value={item?.id}>
                    {getItemName(item)} ({getItemSku(item)})
                  </option>
                ))}
              </select>
            </div>

            {selectedItem && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current Stock</p>
                <p className="text-lg font-bold text-slate-900">{getCurrentStock(selectedItem)}</p>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="quantity" className="text-xs font-semibold uppercase tracking-wide text-slate-600">Adjustment Quantity</label>
              <input
                id="quantity"
                name="quantity"
                type="number"
                value={formData.quantity}
                onChange={handleChange}
                placeholder="Use positive to increase, negative to decrease"
                disabled={isSaving}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-slate-100"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="reason" className="text-xs font-semibold uppercase tracking-wide text-slate-600">Reason</label>
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
            </div>
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
            <button
              type="submit"
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Adjustment'}
            </button>
          </div>
        </form>
      </section>
    </main>
  )
}

export default StockAdjustmentForm
