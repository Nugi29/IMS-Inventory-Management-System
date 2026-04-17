import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useLookup } from '../services/useLookup'
import { usePo } from '../services/usePo'
import { useGrn } from '../services/useGrn'

const ALL_SUPPLIERS = 'All Suppliers'
const ALL_STATUS = 'All Statuses'
const ITEMS_PER_PAGE = 5

const normalizeText = (value) => String(value || '').toLowerCase().replace(/\s+/g, ' ').trim()

const getLookupLabel = (item) => {
  if (typeof item === 'string') return item
  if (!item || typeof item !== 'object') return ''
  return item?.name || item?.supplier_name || item?.status_name || item?.label || item?.title || ''
}

const getLookupId = (item) => {
  if (!item || typeof item !== 'object') return null
  return item?.id ?? item?.supplier_id ?? item?.status_id ?? item?.grn_status_id ?? null
}

const getPoId = (po) => po?.id ?? po?.po_id ?? po?._id ?? ''
const getPoNumber = (po) => po?.po_no || po?.po_number || po?.name || `PO-${getPoId(po)}`

const getGrnId = (grn) => grn?.id ?? grn?.grn_id ?? grn?._id ?? ''
const getGrnNumber = (grn) => grn?.grn_no || grn?.grn_number || `GRN-${getGrnId(grn)}`

const getGrnPoId = (grn) => grn?.po_id ?? grn?.purchase_order_id ?? grn?.purchaseOrderId ?? grn?.po?.id ?? grn?.purchase_order?.id ?? ''
const getGrnSupplierId = (grn) => grn?.supplier_id ?? grn?.supplier?.id ?? grn?.po?.supplier_id ?? grn?.purchase_order?.supplier_id ?? ''
const getGrnStatus = (grn) => grn?.grn_status?.name || grn?.status || grn?.state || 'Draft'
const getGrnDate = (grn) => grn?.received_date || grn?.grn_date || grn?.receivedDate || grn?.createdAt || grn?.created_at || ''

const formatDateLabel = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString()
}

const formatCurrency = (value) => {
  const amount = Number(value || 0)
  return `Rs ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const getStatusChipClass = (status) => {
  const normalized = normalizeText(status)

  if (normalized.includes('received') && normalized.includes('part')) {
    return 'bg-amber-100 text-amber-700'
  }
  if (normalized.includes('received') || normalized.includes('confirmed') || normalized.includes('completed')) {
    return 'bg-emerald-100 text-emerald-700'
  }
  if (normalized.includes('cancel')) {
    return 'bg-rose-100 text-rose-700'
  }
  return 'bg-slate-100 text-slate-700'
}

const parseCreatedGrnId = (payload) => {
  const firstObject = payload?.grnData || payload?.grn || payload?.data
  return firstObject?.id || firstObject?.grn_id || firstObject?._id || null
}

const extractArrays = (value) => {
  const found = []
  if (!value) return found

  if (Array.isArray(value)) {
    found.push(value)
    return found
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return extractArrays(parsed)
    } catch {
      return found
    }
  }

  if (typeof value === 'object') {
    const prioritizedKeys = [
      'po_items',
      'line_items',
      'purchase_order_items',
      'poItems',
      'poItemsData',
      'item_details',
      'itemDetails',
      'items',
      'data',
      'rows',
    ]

    prioritizedKeys.forEach((key) => {
      if (value[key] !== undefined) {
        found.push(...extractArrays(value[key]))
      }
    })

    Object.values(value).forEach((entry) => {
      found.push(...extractArrays(entry))
    })
  }

  return found
}

const scoreLineItemArray = (arrayValue) => {
  if (!Array.isArray(arrayValue) || !arrayValue.length) return -1

  let score = 0
  const sample = arrayValue.slice(0, Math.min(arrayValue.length, 5))

  sample.forEach((entry) => {
    if (!entry || typeof entry !== 'object') return

    if (entry.item_id != null || entry.itemId != null || entry.item?.id != null) score += 2
    if (entry.ordered_quantity != null || entry.po_quantity != null || entry.qty != null || entry.quantity != null || entry.pivot?.quantity != null) score += 3
    if (entry.expected_price != null || entry.purchase_price != null || entry.unit_price != null || entry.price != null || entry.pivot?.unit_price != null) score += 2
  })

  return score
}

const getPoSourceItems = (po) => {
  const candidates = [
    po?.po_items,
    po?.line_items,
    po?.poItems,
    po?.poItemsData,
    po?.purchase_order_items,
    po?.purchaseOrderItems,
    po?.item_details,
    po?.itemDetails,
    po?.items,
    po,
  ]

  const allArrays = candidates.flatMap((value) => extractArrays(value))
  if (!allArrays.length) return []

  let best = allArrays[0]
  let bestScore = scoreLineItemArray(best)

  allArrays.forEach((arr) => {
    const score = scoreLineItemArray(arr)
    if (score > bestScore) {
      bestScore = score
      best = arr
    }
  })

  return bestScore >= 0 ? best : []
}

const normalizePoReceivingItem = (item, index) => {
  const orderedQty = Number(item?.ordered_quantity ?? item?.po_quantity ?? item?.qty ?? item?.quantity ?? item?.pivot?.ordered_quantity ?? item?.pivot?.po_quantity ?? item?.pivot?.qty ?? item?.pivot?.quantity ?? 0)
  const unitPrice = Number(item?.expected_price ?? item?.purchase_price ?? item?.unit_price ?? item?.price ?? item?.pivot?.expected_price ?? item?.pivot?.purchase_price ?? item?.pivot?.unit_price ?? item?.pivot?.price ?? 0)

  return {
    key: String(item?.id || item?.po_item_id || item?.item_id || item?.item?.id || `line-${index + 1}`),
    itemId: Number(item?.item_id || item?.item?.id || item?.itemId || item?.product_id || item?.inventory_item_id || item?.stock_item_id || item?.pivot?.item_id || item?.pivot?.itemId || 0),
    name: item?.item?.item_name || item?.item?.name || item?.item_name || item?.item_description || item?.description || item?.name || 'Unknown Item',
    sku: item?.item?.sku || item?.sku || item?.item_code || item?.itemCode || '-',
    orderedQty,
    receivedQty: orderedQty,
    unitPrice,
    remarks: '',
  }
}

export const GrnPage = () => {
  const location = useLocation()
  const sourcePo = location.state?.source === 'po' ? location.state?.po : null

  const { pos, isLoadingPos, reloadPos } = usePo()
  const { suppliers: supplierLookup = [], loadLookupData } = useLookup()
  const {
    grns,
    isLoadingGrns,
    reloadGrns,
    getGrnItems,
    createGrn,
    getGrnsByStatus,
    getGrnsBySupplier,
    deleteGrn,
  } = useGrn()

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSupplier, setSelectedSupplier] = useState(ALL_SUPPLIERS)
  const [selectedStatus, setSelectedStatus] = useState(ALL_STATUS)

  const [selectedPoId, setSelectedPoId] = useState(String(getPoId(sourcePo) || ''))
  const [selectedGrnId, setSelectedGrnId] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const [isCreatingFromPo, setIsCreatingFromPo] = useState(false)
  const [isRefreshingByFilter, setIsRefreshingByFilter] = useState(false)

  const [poReceivingItems, setPoReceivingItems] = useState([])
  const [grnItems, setGrnItems] = useState([])
  const [isLoadingItems, setIsLoadingItems] = useState(false)

  useEffect(() => {
    loadLookupData()
    reloadPos()
    reloadGrns()
  }, [loadLookupData, reloadPos, reloadGrns])

  useEffect(() => {
    if (!sourcePo) return

    const sourcePoId = String(getPoId(sourcePo) || '')
    if (sourcePoId) {
      setSelectedPoId(sourcePoId)
    }
  }, [sourcePo])

  const suppliers = useMemo(() => {
    return supplierLookup
      .map((supplier) => ({ id: getLookupId(supplier), label: getLookupLabel(supplier) }))
      .filter((supplier) => supplier.id && supplier.label)
  }, [supplierLookup])

  const supplierLabelById = useMemo(() => {
    return Object.fromEntries(suppliers.map((supplier) => [String(supplier.id), supplier.label]))
  }, [suppliers])

  const poNumberById = useMemo(() => {
    return Object.fromEntries(pos.map((po) => [String(getPoId(po)), getPoNumber(po)]).filter(([id, value]) => id && value))
  }, [pos])

  const poById = useMemo(() => {
    return Object.fromEntries(pos.map((po) => [String(getPoId(po)), po]))
  }, [pos])

  const selectedPo = useMemo(() => {
    if (!selectedPoId) return null
    return poById[String(selectedPoId)] || null
  }, [poById, selectedPoId])

  const poOptions = useMemo(() => {
    return pos.map((po) => ({ id: String(getPoId(po)), number: getPoNumber(po) })).filter((po) => po.id)
  }, [pos])

  useEffect(() => {
    if (!selectedPo) {
      setPoReceivingItems([])
      return
    }

    const lines = getPoSourceItems(selectedPo)
      .map(normalizePoReceivingItem)
      .filter((line) => line.itemId && line.orderedQty > 0)

    setPoReceivingItems(lines)
  }, [selectedPo])

  const statusOptions = useMemo(() => {
    const statusSet = new Set(grns.map((grn) => getGrnStatus(grn)).filter(Boolean))
    return Array.from(statusSet)
  }, [grns])

  const getGrnSupplierName = useCallback((grn) => {
    const supplierId = getGrnSupplierId(grn)
    if (supplierId && supplierLabelById[String(supplierId)]) {
      return supplierLabelById[String(supplierId)]
    }

    return grn?.supplier?.name
      || grn?.supplier_name
      || grn?.purchase_order?.supplier?.name
      || grn?.po?.supplier?.name
      || '-'
  }, [supplierLabelById])

  const getGrnPoNumber = useCallback((grn) => {
    const poId = getGrnPoId(grn)
    if (poId && poNumberById[String(poId)]) {
      return poNumberById[String(poId)]
    }

    return grn?.purchase_order?.po_no || grn?.po?.po_no || grn?.po_number || '-'
  }, [poNumberById])

  const filteredGrns = useMemo(() => {
    const normalizedSearch = normalizeText(searchTerm)

    return grns.filter((grn) => {
      const grnNumber = normalizeText(getGrnNumber(grn))
      const poNumber = normalizeText(getGrnPoNumber(grn))
      const supplierName = normalizeText(getGrnSupplierName(grn))
      const status = getGrnStatus(grn)
      const supplierId = String(getGrnSupplierId(grn) || '')

      const matchesSearch = !normalizedSearch
        || grnNumber.includes(normalizedSearch)
        || poNumber.includes(normalizedSearch)
        || supplierName.includes(normalizedSearch)

      const matchesSupplier = selectedSupplier === ALL_SUPPLIERS || supplierId === String(selectedSupplier)
      const matchesStatus = selectedStatus === ALL_STATUS || status === selectedStatus

      return matchesSearch && matchesSupplier && matchesStatus
    })
  }, [grns, searchTerm, selectedSupplier, selectedStatus, getGrnPoNumber, getGrnSupplierName])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, selectedSupplier, selectedStatus])

  const totalPages = Math.max(1, Math.ceil(filteredGrns.length / ITEMS_PER_PAGE))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const paginatedGrns = filteredGrns.slice(startIndex, endIndex)

  const selectedGrn = useMemo(() => {
    if (!selectedGrnId) return null
    return grns.find((grn) => String(getGrnId(grn)) === String(selectedGrnId)) || null
  }, [grns, selectedGrnId])

  const receivingMetrics = useMemo(() => {
    const lineCount = poReceivingItems.length
    const discrepantCount = poReceivingItems.filter((line) => Number(line.receivedQty) < Number(line.orderedQty)).length
    const overCount = poReceivingItems.filter((line) => Number(line.receivedQty) > Number(line.orderedQty)).length
    const totalOrdered = poReceivingItems.reduce((sum, line) => sum + Number(line.orderedQty || 0), 0)
    const totalReceived = poReceivingItems.reduce((sum, line) => sum + Number(line.receivedQty || 0), 0)

    return {
      lineCount,
      discrepantCount,
      overCount,
      totalOrdered,
      totalReceived,
      isPartial: discrepantCount > 0,
    }
  }, [poReceivingItems])

  const plannedReceiptTotal = useMemo(() => {
    return poReceivingItems.reduce((sum, line) => sum + (Number(line.receivedQty || 0) * Number(line.unitPrice || 0)), 0)
  }, [poReceivingItems])

  const grnTotals = useMemo(() => {
    const subtotal = grnItems.reduce((sum, item) => {
      const qty = Number(item?.received_quantity ?? item?.quantity ?? 0)
      const price = Number(item?.purchase_price ?? item?.unit_price ?? item?.price ?? 0)
      return sum + qty * price
    }, 0)

    return {
      subtotal,
      grandTotal: subtotal,
    }
  }, [grnItems])

  useEffect(() => {
    let isCancelled = false

    const loadItems = async () => {
      if (!selectedGrnId) {
        setGrnItems([])
        setIsLoadingItems(false)
        return
      }

      setIsLoadingItems(true)
      const items = await getGrnItems(selectedGrnId)
      if (!isCancelled) {
        setGrnItems(items)
        setIsLoadingItems(false)
      }
    }

    loadItems()

    return () => {
      isCancelled = true
    }
  }, [selectedGrnId, getGrnItems])

  const refreshByServerFilter = async (nextStatus, nextSupplier) => {
    if (!nextStatus && !nextSupplier) {
      await reloadGrns()
      return
    }

    setIsRefreshingByFilter(true)

    try {
      const statusIsSelected = nextStatus && nextStatus !== ALL_STATUS
      const supplierIsSelected = nextSupplier && nextSupplier !== ALL_SUPPLIERS

      if (statusIsSelected && supplierIsSelected) {
        await Promise.all([
          getGrnsByStatus(nextStatus),
          getGrnsBySupplier(nextSupplier),
        ])
        await reloadGrns()
        return
      }

      if (statusIsSelected) {
        await getGrnsByStatus(nextStatus)
        await reloadGrns()
        return
      }

      if (supplierIsSelected) {
        await getGrnsBySupplier(nextSupplier)
        await reloadGrns()
      }
    } finally {
      setIsRefreshingByFilter(false)
    }
  }

  const clearFilters = () => {
    setSearchTerm('')
    setSelectedSupplier(ALL_SUPPLIERS)
    setSelectedStatus(ALL_STATUS)
    setCurrentPage(1)
  }

  const updateReceivingLine = (key, field, value) => {
    setPoReceivingItems((prev) => prev.map((line) => {
      if (line.key !== key) return line

      if (field === 'receivedQty') {
        const parsed = Number(value)
        if (Number.isNaN(parsed)) {
          return { ...line, receivedQty: '' }
        }

        return { ...line, receivedQty: Math.max(0, parsed) }
      }

      return { ...line, [field]: value }
    }))
  }

  const handleCreateFromPo = async () => {
    if (!selectedPo) {
      toast.error('Select a purchase order first')
      return
    }

    if (!poReceivingItems.length) {
      toast.error('Selected purchase order has no receivable items')
      return
    }

    if (receivingMetrics.overCount > 0) {
      toast.error('Received quantity cannot be more than ordered quantity')
      return
    }

    const receivableItems = poReceivingItems
      .filter((line) => Number(line.receivedQty) > 0)
      .map((line) => ({
        item_id: Number(line.itemId),
        quantity: Number(line.receivedQty),
        purchase_price: Number(line.unitPrice || 0),
      }))

    if (!receivableItems.length) {
      toast.error('Enter at least one received quantity greater than zero')
      return
    }

    const supplierId = selectedPo?.supplier_id ?? selectedPo?.supplier?.id ?? selectedPo?.supplierId
    if (!supplierId) {
      toast.error('Selected PO is missing supplier information')
      return
    }

    setIsCreatingFromPo(true)

    const result = await createGrn({
      supplier_id: Number(supplierId),
      purchase_order_id: Number(selectedPoId),
      status: receivingMetrics.isPartial ? 'partially received' : 'received',
      total_amount: plannedReceiptTotal,
      items: receivableItems,
    })

    setIsCreatingFromPo(false)

    if (!result.success) {
      toast.error(result.message || 'Failed to create GRN')
      return
    }

    const nextCreatedId = parseCreatedGrnId(result.data)
    if (nextCreatedId) {
      setSelectedGrnId(String(nextCreatedId))
    }

    toast.success(receivingMetrics.isPartial ? 'Partial receipt GRN created successfully' : 'GRN created successfully')
  }

  const handleDeleteSelected = async () => {
    if (!selectedGrn) {
      toast.error('Select a GRN to delete')
      return
    }

    const result = await deleteGrn(selectedGrn)
    if (!result.success) {
      toast.error(result.message || 'Failed to delete GRN')
      return
    }

    toast.success(result.message || 'GRN deleted')
    setSelectedGrnId('')
    setGrnItems([])
  }

  return (
    <main className="ml-0 mt-0 p-4 sm:p-6 lg:p-8 min-h-screen">
      <header className="mb-6 flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-on-surface">Goods Received Notes</h2>
          <p className="text-sm text-slate-500 font-medium">Receive PO items, support partial receipts, and track GRN records.</p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleDeleteSelected}
            className="px-5 py-3 rounded-xl font-semibold text-sm border border-slate-200 bg-white text-slate-600 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-colors"
          >
            Delete GRN
          </button>
          <button
            type="button"
            onClick={handleCreateFromPo}
            disabled={isCreatingFromPo || !selectedPoId || !poReceivingItems.length}
            className={`bg-blue-600 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 shadow-sm hover:bg-blue-700 transition-all active:scale-95 duration-150 whitespace-nowrap ${isCreatingFromPo || !selectedPoId || !poReceivingItems.length ? 'bg-slate-400 hover:bg-slate-400 cursor-not-allowed' : ''}`}
          >
            {isCreatingFromPo ? 'Creating...' : receivingMetrics.isPartial ? 'Confirm Partial Receipt' : 'Confirm Full Receipt'}
          </button>
        </div>
      </header>

      <section className="bg-white border border-slate-200 dark:border-slate-800 rounded-4xl shadow-sm overflow-hidden p-4 sm:p-6 mb-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-5 relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" data-icon="search">search</span>
            <input
              className="w-full bg-white border border-slate-200 dark:border-slate-800 rounded-xl pl-12 pr-4 py-4 text-sm shadow-sm focus:ring-2 focus:ring-primary/20 outline-none"
              placeholder="Search GRN / PO / Supplier"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              type="text"
            />
          </div>

          <div className="lg:col-span-3">
            <select
              className="appearance-none bg-white border border-slate-200 dark:border-slate-800 rounded-xl px-6 pr-12 py-4 text-sm shadow-sm focus:ring-2 focus:ring-primary/20 outline-none min-w-50"
              value={selectedStatus}
              onChange={async (event) => {
                const next = event.target.value
                setSelectedStatus(next)
                await refreshByServerFilter(next, selectedSupplier)
              }}
            >
              <option value={ALL_STATUS}>{ALL_STATUS}</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-3">
            <select
              className="appearance-none bg-white border border-slate-200 dark:border-slate-800 rounded-xl px-6 pr-12 py-4 text-sm shadow-sm focus:ring-2 focus:ring-primary/20 outline-none min-w-50"
              value={selectedSupplier}
              onChange={async (event) => {
                const next = event.target.value
                setSelectedSupplier(next)
                await refreshByServerFilter(selectedStatus, next)
              }}
            >
              <option value={ALL_SUPPLIERS}>{ALL_SUPPLIERS}</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={String(supplier.id)}>{supplier.label}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="lg:col-span-1 px-4 py-3 rounded-xl font-semibold text-sm border border-slate-200 bg-white text-slate-600 hover:text-primary hover:border-primary/40 transition-colors"
            onClick={clearFilters}
          >
            Reset
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <section className="lg:col-span-4 space-y-6">
          <div className="bg-white border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Create From Purchase Order</h3>
            <div>
              <label className="block text-sm font-semibold text-on-surface mb-2">Select Purchase Order</label>
              <select
                className="w-full bg-white border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-4 text-sm shadow-sm focus:ring-2 focus:ring-primary/20 outline-none"
                value={selectedPoId}
                onChange={(event) => setSelectedPoId(event.target.value)}
                disabled={isLoadingPos}
              >
                <option value="">Select PO</option>
                {poOptions.map((po) => (
                  <option key={po.id} value={po.id}>{po.number}</option>
                ))}
              </select>
            </div>

          </div>

          <div className="bg-white border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">PO Receiving Planner</h3>
                <p className="text-xs text-slate-500 mt-1">Adjust received quantities before creating the GRN.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPoReceivingItems((prev) => prev.map((line) => ({ ...line, receivedQty: line.orderedQty })))
                }}
                disabled={!selectedPo || !poReceivingItems.length}
                className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-[11px] font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Full Receive
              </button>
            </div>

            {selectedPo && receivingMetrics.discrepantCount > 0 && (
              <div className="mx-4 mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-800">{receivingMetrics.discrepantCount} line(s) are below ordered quantity. This GRN will be marked as partially received.</p>
              </div>
            )}

            {selectedPo && receivingMetrics.overCount > 0 && (
              <div className="mx-4 mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4">
                <p className="text-sm font-semibold text-rose-700">Received quantity cannot exceed ordered quantity. Reduce over-received lines to continue.</p>
              </div>
            )}

            <div className="overflow-x-auto p-4">
              <table className="w-full text-left border-separate border-spacing-y-1">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-widest">
                    <th className="px-4 py-3">Item</th>
                    <th className="px-4 py-3 text-center">Ordered</th>
                    <th className="px-4 py-3 text-center">Received</th>
                    <th className="px-4 py-3 text-center">Balance</th>
                    <th className="px-4 py-3 text-right">Unit Price</th>
                    <th className="px-4 py-3">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {!selectedPo && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">Select a purchase order to plan receiving quantities.</td>
                    </tr>
                  )}

                  {selectedPo && !poReceivingItems.length && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">No PO line items were found for this purchase order.</td>
                    </tr>
                  )}

                  {poReceivingItems.map((line) => {
                    const received = Number(line.receivedQty || 0)
                    const ordered = Number(line.orderedQty || 0)
                    const balance = ordered - received
                    const isDiscrepant = balance > 0
                    const isOver = balance < 0

                    return (
                      <tr key={line.key} className={`${isOver ? 'bg-rose-50/60' : isDiscrepant ? 'bg-amber-50/60' : 'bg-slate-50/60'} hover:bg-slate-100/50 transition-colors`}>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">{line.name}</p>
                          <p className="text-xs text-slate-500">SKU: {line.sku}</p>
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-slate-700">{ordered}</td>
                        <td className="px-4 py-3 text-center">
                          <input
                            className={`w-24 rounded-lg border px-2 py-1 text-center font-semibold ${isOver ? 'border-rose-300 bg-rose-50 text-rose-700' : isDiscrepant ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-slate-200 bg-white text-slate-700'}`}
                            type="number"
                            min={0}
                            value={line.receivedQty}
                            onChange={(event) => updateReceivingLine(line.key, 'receivedQty', event.target.value)}
                          />
                        </td>
                        <td className={`px-4 py-3 text-center font-semibold ${isOver ? 'text-rose-700' : isDiscrepant ? 'text-amber-700' : 'text-emerald-700'}`}>
                          {balance}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-700">{formatCurrency(line.unitPrice)}</td>
                        <td className="px-4 py-3">
                          <input
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm"
                            placeholder={isDiscrepant ? 'Reason for short receive...' : 'Optional note'}
                            value={line.remarks}
                            onChange={(event) => updateReceivingLine(line.key, 'remarks', event.target.value)}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="lg:col-span-8 space-y-6">
          <div className="bg-white border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">GRN Registry</h3>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700">
                {isLoadingGrns || isRefreshingByFilter ? 'Loading...' : `${filteredGrns.length} Records`}
              </span>
            </div>

            <div className="overflow-x-auto p-4">
              <table className="w-full text-left border-separate border-spacing-y-1">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-widest">
                    <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-wider">ID</th>
                    <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-wider">Date</th>
                    <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-wider">Supplier</th>
                    <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-wider">PO</th>
                    <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-wider">Total Amount</th>
                    <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-wider text-center">Status</th>
                    <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-wider text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {isLoadingGrns && (
                    <tr>
                      <td colSpan={7} className="px-6 py-10 text-center text-slate-500">Loading GRNs...</td>
                    </tr>
                  )}

                  {!isLoadingGrns && paginatedGrns.map((grn, index) => {
                    const id = String(getGrnId(grn))
                    const selected = id === String(selectedGrnId)
                    const rowBg = index % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'

                    return (
                      <tr key={id} className={`${rowBg} hover:bg-slate-100/60 transition-colors group ${selected ? 'ring-1 ring-primary/30' : ''}`}>
                        <td className="px-6 py-4 rounded-l-xl text-sm font-bold text-slate-700">{getGrnNumber(grn)}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{formatDateLabel(getGrnDate(grn))}</td>
                        <td className="px-6 py-4 text-sm text-slate-700">{getGrnSupplierName(grn)}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{getGrnPoNumber(grn)}</td>
                        <td className="px-6 py-4 text-sm font-bold text-slate-900">{formatCurrency(grn?.total_amount || 0)}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest ${getStatusChipClass(getGrnStatus(grn))}`}>
                            {getGrnStatus(grn)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right rounded-r-xl">
                          <button
                            className="p-2 hover:bg-white rounded-lg transition-colors text-slate-400 hover:text-primary"
                            type="button"
                            onClick={() => setSelectedGrnId(id)}
                            aria-label={`Select ${getGrnNumber(grn)}`}
                          >
                            <span className="material-symbols-outlined text-xl" data-icon="visibility">visibility</span>
                          </button>
                        </td>
                      </tr>
                    )
                  })}

                  {!isLoadingGrns && !filteredGrns.length && (
                    <tr>
                      <td colSpan={7} className="px-6 py-14 text-center text-slate-500">
                        <p className="text-sm font-semibold text-on-surface">No GRNs found</p>
                        <p className="text-xs mt-1">Try changing filters or create a new GRN from a purchase order.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between p-6 gap-4 mt-2">
              <p className="text-xs text-slate-500 font-medium">
                Showing <span className="font-bold text-on-surface">{filteredGrns.length ? `${startIndex + 1} - ${Math.min(endIndex, filteredGrns.length)}` : 0}</span> of <span className="font-bold text-on-surface">{filteredGrns.length}</span> items
              </p>
              <div className="flex items-center gap-2">
                <button
                  className={`p-2 rounded-lg border border-slate-200 transition-all ${safeCurrentPage === 1 ? 'bg-slate-50 text-slate-400 cursor-not-allowed opacity-50' : 'bg-slate-50 text-slate-600 hover:bg-primary hover:text-white'}`}
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(1, Math.min(prev, totalPages) - 1))}
                  disabled={safeCurrentPage === 1}
                  aria-label="Previous page"
                >
                  <span className="material-symbols-outlined" data-icon="chevron_left">chevron_left</span>
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, index) => {
                    const pageNumber = index + 1
                    const isActive = pageNumber === safeCurrentPage

                    return (
                      <button
                        key={pageNumber}
                        className={`w-8 h-8 rounded-lg text-xs font-bold ${isActive ? 'bg-primary text-white' : 'bg-slate-50 text-slate-600 hover:bg-primary hover:text-white border border-slate-200'}`}
                        type="button"
                        onClick={() => setCurrentPage(pageNumber)}
                        aria-label={`Page ${pageNumber}`}
                      >
                        {pageNumber}
                      </button>
                    )
                  })}
                </div>

                <button
                  className={`p-2 rounded-lg border border-slate-200 transition-all ${safeCurrentPage === totalPages ? 'bg-slate-50 text-slate-400 cursor-not-allowed opacity-50' : 'bg-slate-50 text-slate-600 hover:bg-primary hover:text-white'}`}
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, Math.min(prev, totalPages) + 1))}
                  disabled={safeCurrentPage === totalPages}
                  aria-label="Next page"
                >
                  <span className="material-symbols-outlined" data-icon="chevron_right">chevron_right</span>
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between gap-3">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Selected GRN Items</h3>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700">
                {selectedGrnId ? `${grnItems.length} Items` : 'Select a GRN'}
              </span>
            </div>

            <div className="overflow-x-auto p-4">
              <table className="w-full text-left border-separate border-spacing-y-1">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-widest">
                    <th className="px-4 py-3">Item</th>
                    <th className="px-4 py-3 text-center">Received</th>
                    <th className="px-4 py-3 text-right">Price</th>
                    <th className="px-4 py-3 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {isLoadingItems && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-500">Loading GRN items...</td>
                    </tr>
                  )}

                  {!isLoadingItems && !selectedGrnId && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-500">Select a GRN from registry to view item details.</td>
                    </tr>
                  )}

                  {!isLoadingItems && selectedGrnId && !grnItems.length && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-500">No items found for this GRN.</td>
                    </tr>
                  )}

                  {!isLoadingItems && grnItems.map((item, index) => {
                    const receivedQty = Number(item?.received_quantity ?? item?.quantity ?? 0)
                    const unitPrice = Number(item?.purchase_price ?? item?.unit_price ?? item?.price ?? 0)
                    const subtotal = receivedQty * unitPrice

                    return (
                      <tr key={`${item?.id || item?.grn_item_id || index}`} className="bg-slate-50/60 hover:bg-slate-100/50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-bold text-on-surface">{item?.item?.item_name || item?.item?.name || item?.item_name || item?.description || `Item #${item?.item_id || '-'}`}</p>
                          <p className="text-xs text-slate-400 font-medium">SKU: {item?.item?.sku || item?.sku || '-'}</p>
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-slate-700">{receivedQty}</td>
                        <td className="px-4 py-3 text-right font-medium">{formatCurrency(unitPrice)}</td>
                        <td className="px-4 py-3 text-right font-bold">{formatCurrency(subtotal)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-6 bg-slate-50/60 flex flex-col sm:flex-row justify-between gap-4">
              <p className="text-sm text-slate-500 font-medium">Selected GRN totals for quick verification.</p>
              <div className="space-y-1 text-sm min-w-48">
                <div className="flex justify-between gap-8">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="font-bold text-slate-900">{formatCurrency(grnTotals.subtotal)}</span>
                </div>
                <div className="flex justify-between gap-8 pt-1 border-t border-slate-200">
                  <span className="font-bold text-slate-900">Grand Total</span>
                  <span className="text-lg font-black text-blue-600">{formatCurrency(grnTotals.grandTotal)}</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
