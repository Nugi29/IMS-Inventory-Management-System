import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useLookup } from '../services/useLookup'
import { usePo } from '../services/usePo'
import { useGrn } from '../services/useGrn'

// ─── Constants ───────────────────────────────────────────────────────────────

const ALL_SUPPLIERS = 'All Suppliers'
const ALL_STATUS = 'All Statuses'
const ITEMS_PER_PAGE = 3
const GRN_STATUS = {
  DRAFT: 1,
  PARTIALLY_RECEIVED: 2,
  FULLY_RECEIVED: 3,
  CANCELLED: 4,
}

const PO_STATUS_TO_GRN_STATUS = {
  1: GRN_STATUS.DRAFT,
  3: GRN_STATUS.PARTIALLY_RECEIVED,
  4: GRN_STATUS.FULLY_RECEIVED,
  5: GRN_STATUS.CANCELLED,
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

const normalizeText = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

const getLookupLabel = (item) => {
  if (typeof item === 'string') return item
  if (!item || typeof item !== 'object') return ''
  return item?.name || item?.supplier_name || item?.status_name || item?.label || item?.title || ''
}

const getLookupId = (item) => {
  if (!item || typeof item !== 'object') return null
  return item?.id ?? item?.supplier_id ?? item?.status_id ?? item?.grn_status_id ?? null
}

// PO accessors
const getPoId = (po) => po?.id ?? po?.po_id ?? po?._id ?? ''
const getPoNumber = (po) => po?.po_no || po?.po_number || po?.name || `PO-${getPoId(po)}`

// GRN accessors
const getGrnId       = (grn) => grn?.id ?? grn?.grn_id ?? grn?._id ?? ''
const getGrnNumber   = (grn) => grn?.grn_no || grn?.grn_number || `GRN-${getGrnId(grn)}`
const getGrnPoId     = (grn) =>
  grn?.po_id ?? grn?.purchase_order_id ?? grn?.purchaseOrderId ??
  grn?.po?.id ?? grn?.purchase_order?.id ?? ''
const getGrnSupplierId = (grn) =>
  grn?.supplier_id ?? grn?.supplier?.id ??
  grn?.po?.supplier_id ?? grn?.purchase_order?.supplier_id ?? ''
const getGrnStatusId = (grn) => {
  const directGrnStatusId = Number(
    grn?.grn_status_id ?? grn?.grnStatusId ?? grn?.grn_status?.id,
  )

  if (Number.isFinite(directGrnStatusId) && directGrnStatusId > 0) {
    return directGrnStatusId
  }

  const poStatusId = Number(grn?.po_status_id ?? grn?.po_status?.id)
  if (Number.isFinite(poStatusId) && PO_STATUS_TO_GRN_STATUS[poStatusId]) {
    return PO_STATUS_TO_GRN_STATUS[poStatusId]
  }

  return null
}

const getGrnStatus = (grn, statusLabelById = {}) => {
  const statusId = getGrnStatusId(grn)
  if (statusId != null && statusLabelById[String(statusId)]) {
    return statusLabelById[String(statusId)]
  }
  return grn?.grn_status?.name || grn?.status || grn?.state || 'Draft'
}

const getGrnDate = (grn) =>
  grn?.received_date || grn?.grn_date || grn?.receivedDate ||
  grn?.createdAt     || grn?.created_at || ''

// Item accessors
const getItemReceivedQty = (item) =>
  Number(
    item?.received_quantity ?? item?.recieved_quantity ?? item?.recived_quantity ?? item?.received_qty ??
    item?.recieved_qty ?? item?.qty_received ?? item?.quantity_received ??
    item?.received ?? item?.quantity ?? 0,
  )

const getItemTotalQty = (item) =>
  Number(
    item?.total_quantity ?? item?.ordered_quantity ?? item?.po_quantity ??
    item?.ordered_qty ?? item?.qty_ordered ?? item?.requested_quantity ??
    item?.planned_quantity ?? item?.quantity ?? 0,
  )

const getItemCanonicalTotalQty = (item) => {
  const receivedQty = getItemReceivedQty(item)
  const reportedTotal = Math.max(0, getItemTotalQty(item))
  return Math.max(reportedTotal, receivedQty)
}

const getItemCumulativeBalanceQty = (item, cumulativeFromRelatedGrns = {}) => {
  const itemId = getItemId(item)
  const totalQty = getItemCanonicalTotalQty(item)
  const receivedQtyThisGrn = getItemReceivedQty(item)
  const receivedQtyRelatedGrns = Number(cumulativeFromRelatedGrns[itemId] || 0)
  const totalReceivedQty = receivedQtyThisGrn + receivedQtyRelatedGrns
  return Math.max(0, totalQty - totalReceivedQty)
}

const getItemUnitPrice = (item) =>
  Number(
    item?.purchase_price ?? item?.unit_price ?? item?.price ??
    item?.item_price ?? item?.cost_price ?? item?.expected_price ?? 0,
  )

const getItemId = (item) =>
  Number(item?.item_id ?? item?.item?.id ?? item?.itemId ?? item?.product_id ?? 0)

// ─── Formatters ───────────────────────────────────────────────────────────────

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
  if (normalized === 'draft')              return 'bg-slate-100 text-slate-700'
  if (normalized === 'partially received') return 'bg-amber-100 text-amber-800'
  if (normalized === 'fully received')     return 'bg-emerald-100 text-emerald-800'
  if (normalized === 'cancelled')          return 'bg-rose-100 text-rose-700'
  return 'bg-slate-100 text-slate-700'
}

// ─── Payload parsers ──────────────────────────────────────────────────────────

const parseCreatedGrnId = (payload) => {
  const firstObject = payload?.grnData || payload?.grn || payload?.data
  return firstObject?.id || firstObject?.grn_id || firstObject?._id || null
}

// ─── PO line-item extraction ──────────────────────────────────────────────────

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
      'po_items', 'line_items', 'purchase_order_items',
      'poItems', 'poItemsData', 'item_details', 'itemDetails',
      'items', 'data', 'rows',
    ]

    prioritizedKeys.forEach((key) => {
      if (value[key] !== undefined) found.push(...extractArrays(value[key]))
    })

    Object.values(value).forEach((entry) => found.push(...extractArrays(entry)))
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
    if (
      entry.ordered_quantity != null || entry.po_quantity != null ||
      entry.qty != null || entry.quantity != null ||
      entry.pivot?.quantity != null
    ) score += 3
    if (
      entry.expected_price != null || entry.purchase_price != null ||
      entry.unit_price != null || entry.price != null ||
      entry.pivot?.unit_price != null
    ) score += 2
  })

  return score
}

const getPoSourceItems = (po) => {
  const candidates = [
    po?.po_items, po?.line_items, po?.poItems, po?.poItemsData,
    po?.purchase_order_items, po?.purchaseOrderItems,
    po?.item_details, po?.itemDetails, po?.items, po,
  ]

  const allArrays = candidates.flatMap((value) => extractArrays(value))
  if (!allArrays.length) return []

  let best      = allArrays[0]
  let bestScore = scoreLineItemArray(best)

  allArrays.forEach((arr) => {
    const score = scoreLineItemArray(arr)
    if (score > bestScore) { bestScore = score; best = arr }
  })

  return bestScore >= 0 ? best : []
}

const normalizePoReceivingItem = (item, index) => {
  const orderedQty = Number(
    item?.ordered_quantity ?? item?.po_quantity ?? item?.qty ??
    item?.quantity ?? item?.pivot?.ordered_quantity ?? item?.pivot?.po_quantity ??
    item?.pivot?.qty ?? item?.pivot?.quantity ?? 0,
  )
  const unitPrice = Number(
    item?.expected_price ?? item?.purchase_price ?? item?.unit_price ??
    item?.price ?? item?.pivot?.expected_price ?? item?.pivot?.purchase_price ??
    item?.pivot?.unit_price ?? item?.pivot?.price ?? 0,
  )

  return {
    key: String(item?.id || item?.po_item_id || item?.item_id || item?.item?.id || `line-${index + 1}`),
    itemId: Number(
      item?.item_id || item?.item?.id || item?.itemId || item?.product_id ||
      item?.inventory_item_id || item?.stock_item_id ||
      item?.pivot?.item_id || item?.pivot?.itemId || 0,
    ),
    name:
      item?.item?.item_name || item?.item?.name || item?.item_name ||
      item?.item_description || item?.description || item?.name || 'Unknown Item',
    sku: item?.item?.sku || item?.sku || item?.item_code || item?.itemCode || '-',
    orderedQty,
    receivedQty: orderedQty,   // default — will be overwritten after previouslyReceived is known
    unitPrice,
    remarks:            '',
    previouslyReceived: 0,
    maxReceivable:      orderedQty,
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export const GrnPage = () => {
  const location = useLocation()
  const sourcePo = location.state?.source === 'po' ? (location.state?.po ?? null) : null

  const { pos = [], isLoadingPos, reloadPos }     = usePo()
  const {
    suppliers: supplierLookup = [],
    grnStatuses: grnStatusLookup = [],
    loadLookupData,
  } = useLookup()
  const {
    grns = [],
    isLoadingGrns,
    reloadGrns,
    getGrnItems,
    createGrn,
    getGrnsByStatus,
    getGrnsBySupplier,
    deleteGrn,
  } = useGrn()

  const [searchTerm,       setSearchTerm]       = useState('')
  const [selectedSupplier, setSelectedSupplier] = useState(ALL_SUPPLIERS)
  const [selectedStatus,   setSelectedStatus]   = useState(ALL_STATUS)

  const [selectedPoId,  setSelectedPoId]  = useState(() => String(getPoId(sourcePo) || ''))
  const [selectedGrnId, setSelectedGrnId] = useState('')
  const [currentPage,   setCurrentPage]   = useState(1)

  const [isCreatingFromPo,     setIsCreatingFromPo]     = useState(false)
  const [isRefreshingByFilter, setIsRefreshingByFilter] = useState(false)

  const [poReceivingItems,   setPoReceivingItems]   = useState([])
  const [receivedByItem,     setReceivedByItem]     = useState({})
  const [grnItems,           setGrnItems]           = useState([])
  const [relatedGrnsCumulativeReceivedByItem, setRelatedGrnsCumulativeReceivedByItem] = useState({})
  const [isLoadingItems,     setIsLoadingItems]     = useState(false)
  const [isLoadingPoReceipts,setIsLoadingPoReceipts]= useState(false)

  useEffect(() => {
    loadLookupData()
    reloadPos()
    reloadGrns()
  }, [loadLookupData, reloadPos, reloadGrns])

  const sourcePoPrimary = useMemo(() => String(getPoId(sourcePo) || ''), [sourcePo])
  useEffect(() => {
    if (sourcePoPrimary) setSelectedPoId(sourcePoPrimary)
  }, [sourcePoPrimary])

  const suppliers = useMemo(() =>
    supplierLookup
      .map((s) => ({ id: getLookupId(s), label: getLookupLabel(s) }))
      .filter((s) => s.id && s.label),
  [supplierLookup])

  const statusOptions = useMemo(() =>
    grnStatusLookup
      .map((s) => ({ id: getLookupId(s), label: getLookupLabel(s) }))
      .filter((s) => s.id && s.label),
  [grnStatusLookup])

  const statusLabelById = useMemo(() =>
    Object.fromEntries(statusOptions.map((s) => [String(s.id), s.label])),
  [statusOptions])

  const supplierLabelById = useMemo(() =>
    Object.fromEntries(suppliers.map((s) => [String(s.id), s.label])),
  [suppliers])

  const poNumberById = useMemo(() =>
    Object.fromEntries(
      pos
        .map((po) => [String(getPoId(po)), getPoNumber(po)])
        .filter(([id, num]) => id && num),
    ),
  [pos])

  const poById = useMemo(() =>
    Object.fromEntries(pos.map((po) => [String(getPoId(po)), po])),
  [pos])

  const poOptions = useMemo(() =>
    pos
      .map((po) => ({ id: String(getPoId(po)), number: getPoNumber(po) }))
      .filter((po) => po.id),
  [pos])

  const selectedPo = useMemo(() =>
    selectedPoId ? (poById[String(selectedPoId)] ?? null) : null,
  [poById, selectedPoId])

  const resolveStatusIdByKeywords = useCallback((keywords) => {
    if (!Array.isArray(keywords) || !keywords.length) return null
    const normed      = keywords.map(normalizeText)
    const exactMatch  = statusOptions.find((s) => normed.includes(normalizeText(s.label)))
    if (exactMatch) return Number(exactMatch.id)
    const fuzzyMatch  = statusOptions.find((s) => normed.some((k) => normalizeText(s.label).includes(k)))
    return fuzzyMatch ? Number(fuzzyMatch.id) : null
  }, [statusOptions])

  const getGrnSupplierName = useCallback((grn) => {
    const supplierId = getGrnSupplierId(grn)
    if (supplierId && supplierLabelById[String(supplierId)]) {
      return supplierLabelById[String(supplierId)]
    }
    return grn?.supplier?.name || grn?.supplier_name ||
      grn?.purchase_order?.supplier?.name || grn?.po?.supplier?.name || '-'
  }, [supplierLabelById])

  const getGrnPoNumber = useCallback((grn) => {
    const poId = getGrnPoId(grn)
    if (poId && poNumberById[String(poId)]) return poNumberById[String(poId)]
    return grn?.purchase_order?.po_no || grn?.po?.po_no || grn?.po_number || '-'
  }, [poNumberById])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (!selectedPoId) {
        setReceivedByItem({})
        setIsLoadingPoReceipts(false)
        return
      }

      setIsLoadingPoReceipts(true)

      try {
        const relatedGrns = grns.filter(
          (grn) => String(getGrnPoId(grn) || '') === String(selectedPoId),
        )

        const receivedMap = {}

        if (relatedGrns.length) {
          const itemGroups = await Promise.all(
            relatedGrns.map((grn) =>
              getGrnItems(getGrnId(grn)).catch(() => []),
            ),
          )

          itemGroups.flat().forEach((item) => {
            const itemId = getItemId(item)
            if (!itemId) return
            receivedMap[itemId] = (receivedMap[itemId] || 0) + getItemReceivedQty(item)
          })
        }

        if (!cancelled) setReceivedByItem(receivedMap)
      } catch {
        if (!cancelled) setReceivedByItem({})
      } finally {
        if (!cancelled) setIsLoadingPoReceipts(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [selectedPoId, grns, getGrnItems])

  useEffect(() => {
    if (!selectedPo) {
      setPoReceivingItems([])
      return
    }

    const lines = getPoSourceItems(selectedPo)
      .map(normalizePoReceivingItem)
      .filter((line) => line.itemId && Number(line.orderedQty) > 0)
      .map((line) => {
        const previouslyReceived = Number(receivedByItem[line.itemId] || 0)
        const maxReceivable      = Math.max(0, Number(line.orderedQty) - previouslyReceived)
        return { ...line, previouslyReceived, maxReceivable, receivedQty: maxReceivable }
      })

    setPoReceivingItems(lines)
  }, [selectedPo, receivedByItem])

  const filteredGrns = useMemo(() => {
    const normalizedSearch = normalizeText(searchTerm)

    return grns.filter((grn) => {
      const grnNumber    = normalizeText(getGrnNumber(grn))
      const poNumber     = normalizeText(getGrnPoNumber(grn))
      const supplierName = normalizeText(getGrnSupplierName(grn))
      const supplierId   = String(getGrnSupplierId(grn) || '')
      const grnStatusId  = String(getGrnStatusId(grn) || '')
      const statusLabel  = getGrnStatus(grn, statusLabelById)

      const matchesSearch = !normalizedSearch ||
        grnNumber.includes(normalizedSearch)    ||
        poNumber.includes(normalizedSearch)     ||
        supplierName.includes(normalizedSearch)

      const matchesSupplier = selectedSupplier === ALL_SUPPLIERS ||
        supplierId === String(selectedSupplier)

      const matchesStatus = selectedStatus === ALL_STATUS ||
        grnStatusId === String(selectedStatus) ||
        normalizeText(statusLabel) === normalizeText(
          statusLabelById[String(selectedStatus)] || selectedStatus,
        )

      return matchesSearch && matchesSupplier && matchesStatus
    })
  }, [grns, searchTerm, selectedSupplier, selectedStatus, getGrnPoNumber, getGrnSupplierName, statusLabelById])

  // Reset to page 1 when filters change
  useEffect(() => { setCurrentPage(1) }, [searchTerm, selectedSupplier, selectedStatus])

  const totalPages       = Math.max(1, Math.ceil(filteredGrns.length / ITEMS_PER_PAGE))
  const safeCurrentPage  = Math.min(Math.max(1, currentPage), totalPages)
  const startIndex       = (safeCurrentPage - 1) * ITEMS_PER_PAGE
  const paginatedGrns    = filteredGrns.slice(startIndex, startIndex + ITEMS_PER_PAGE)

  const selectedGrn = useMemo(() =>
    selectedGrnId
      ? (grns.find((grn) => String(getGrnId(grn)) === String(selectedGrnId)) ?? null)
      : null,
  [grns, selectedGrnId])

  const receivingMetrics = useMemo(() => {
    const receivableLines  = poReceivingItems.filter((l) => Number(l.maxReceivable || 0) > 0)
    const discrepantCount  = receivableLines.filter(
      (l) => Number(l.receivedQty || 0) < Number(l.maxReceivable || 0),
    ).length
    const overCount = poReceivingItems.filter(
      (l) => Number(l.receivedQty || 0) > Number(l.maxReceivable || 0),
    ).length

    const isPartial = receivableLines.length > 0 && discrepantCount > 0 && overCount === 0

    return { discrepantCount, overCount, isPartial, receivableLines: receivableLines.length }
  }, [poReceivingItems])

  const plannedReceiptTotal = useMemo(() =>
    poReceivingItems.reduce(
      (sum, l) => sum + Number(l.receivedQty || 0) * Number(l.unitPrice || 0),
      0,
    ),
  [poReceivingItems])

  const grnTotals = useMemo(() => {
    const totalQty    = grnItems.reduce((s, i) => s + getItemCanonicalTotalQty(i), 0)
    const receivedQty = grnItems.reduce((s, i) => s + getItemReceivedQty(i), 0)

    const cumulativeReceivedFromRelated = Object.values(relatedGrnsCumulativeReceivedByItem).reduce((s, v) => s + v, 0)
    const totalCumulativeReceivedQty = receivedQty + cumulativeReceivedFromRelated

    const subtotal = grnItems.reduce((s, i) => {
      const price = getItemUnitPrice(i)
      return s + getItemReceivedQty(i) * price
    }, 0)

    const balanceValue = grnItems.reduce((s, i) => {
      const price      = getItemUnitPrice(i)
      const cumulativeBalanceQty = getItemCumulativeBalanceQty(i, relatedGrnsCumulativeReceivedByItem)
      return s + cumulativeBalanceQty * price
    }, 0)

    const overReceivedValue = grnItems.reduce((s, i) => {
      const price    = getItemUnitPrice(i)
      const overQty  = Math.max(0, getItemReceivedQty(i) - getItemCanonicalTotalQty(i))
      return s + overQty * price
    }, 0)

    const balanceQty      = Math.max(0, totalQty - totalCumulativeReceivedQty)
    const overReceivedQty = Math.max(0, receivedQty - totalQty)

    return {
      totalQty, receivedQty, balanceQty, overReceivedQty,
      subtotal, balanceValue, overReceivedValue,
      grandTotal: subtotal,
    }
  }, [grnItems, relatedGrnsCumulativeReceivedByItem])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (!selectedGrnId) {
        setGrnItems([])
        setIsLoadingItems(false)
        return
      }

      setIsLoadingItems(true)
      try {
        const items = await getGrnItems(selectedGrnId)
        if (!cancelled) setGrnItems(items ?? [])
      } catch {
        if (!cancelled) setGrnItems([])
      } finally {
        if (!cancelled) setIsLoadingItems(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [selectedGrnId, getGrnItems])

  useEffect(() => {
    let cancelled = false

    const loadRelated = async () => {
      if (!selectedGrn) {
        setRelatedGrnsCumulativeReceivedByItem({})
        return
      }

      const selectedPoId = getGrnPoId(selectedGrn)
      if (!selectedPoId) {
        setRelatedGrnsCumulativeReceivedByItem({})
        return
      }

      const relatedGrns = grns.filter(
        (grn) => String(getGrnPoId(grn) || '') === String(selectedPoId) &&
                 String(getGrnId(grn)) !== String(selectedGrnId),
      )

      if (!relatedGrns.length) {
        setRelatedGrnsCumulativeReceivedByItem({})
        return
      }

      try {
        const itemGroups = await Promise.all(
          relatedGrns.map((grn) =>
            getGrnItems(getGrnId(grn)).catch(() => []),
          ),
        )

        if (cancelled) return

        const cumulativeByItem = {}
        itemGroups.flat().forEach((item) => {
          const itemId = getItemId(item)
          const receivedQty = getItemReceivedQty(item)
          if (!itemId || receivedQty <= 0) return
          cumulativeByItem[itemId] = (cumulativeByItem[itemId] || 0) + receivedQty
        })

        if (!cancelled) {
          setRelatedGrnsCumulativeReceivedByItem(cumulativeByItem)
        }
      } catch {
        if (!cancelled) {
          setRelatedGrnsCumulativeReceivedByItem({})
        }
      }
    }

    loadRelated()
    return () => { cancelled = true }
  }, [selectedGrn, selectedGrnId, grns, getGrnItems, getGrnPoId])

  const refreshByServerFilter = useCallback(async (nextStatus, nextSupplier) => {
    const statusSelected   = nextStatus   && nextStatus   !== ALL_STATUS
    const supplierSelected = nextSupplier && nextSupplier !== ALL_SUPPLIERS

    if (!statusSelected && !supplierSelected) {
      await reloadGrns()
      return
    }

    setIsRefreshingByFilter(true)
    try {
      await Promise.all([
        statusSelected   ? getGrnsByStatus(nextStatus)     : Promise.resolve(),
        supplierSelected ? getGrnsBySupplier(nextSupplier) : Promise.resolve(),
      ])
      await reloadGrns()
    } finally {
      setIsRefreshingByFilter(false)
    }
  }, [getGrnsByStatus, getGrnsBySupplier, reloadGrns])

  const updateReceivingLine = useCallback((key, field, value) => {
    setPoReceivingItems((prev) =>
      prev.map((line) => {
        if (line.key !== key) return line

        if (field === 'receivedQty') {
          if (value === '' || value === null || value === undefined) {
            return { ...line, receivedQty: '' }
          }
          const parsed       = Number(value)
          if (Number.isNaN(parsed)) return { ...line, receivedQty: '' }
          const maxReceivable = Number(line.maxReceivable || 0)
          return { ...line, receivedQty: Math.min(maxReceivable, Math.max(0, parsed)) }
        }

        return { ...line, [field]: value }
      }),
    )
  }, [])

  const handleCreateFromPo = async () => {
    if (!selectedPo) {
      toast.error('Select a purchase order first')
      return
    }
    if (!poReceivingItems.length) {
      toast.error('Selected purchase order has no receivable items')
      return
    }
    if (!poReceivingItems.some((l) => Number(l.maxReceivable || 0) > 0)) {
      toast.error('All items in this purchase order are already fully received')
      return
    }
    if (receivingMetrics.overCount > 0) {
      toast.error('Received quantity cannot exceed remaining receivable quantity')
      return
    }

    const receivableItems = poReceivingItems
      .filter((l) => Number(l.receivedQty) > 0)
      .map((l) => {
        const totalQty = Number(l.orderedQty || 0)
        const currentReceiptQty = Number(l.receivedQty || 0)
        const cumulativeReceivedQty = Number(l.previouslyReceived || 0) + currentReceiptQty
        const balanceQty = Math.max(0, totalQty - cumulativeReceivedQty)

        return {
          item_id: Number(l.itemId),
          quantity: currentReceiptQty,
          purchase_price: Number(l.unitPrice || 0),
          total_quantity: totalQty,
          balance_quantity: balanceQty,
          remaining_quantity: balanceQty,
          recived_quantity: currentReceiptQty,
          received_quantity: currentReceiptQty,
        }
      })

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

    const hasBalanceAfterReceipt = poReceivingItems.some((line) => {
      const totalQty = Number(line.orderedQty || 0)
      const cumulativeReceivedQty = Number(line.previouslyReceived || 0) + Number(line.receivedQty || 0)
      const balanceQty = Math.max(0, totalQty - cumulativeReceivedQty)
      return balanceQty > 0
    })

    const partialGrnStatusId = resolveStatusIdByKeywords(['Partially Received', 'partially received']) ?? GRN_STATUS.PARTIALLY_RECEIVED
    const receivedGrnStatusId = resolveStatusIdByKeywords(['Fully Received', 'fully received']) ?? GRN_STATUS.FULLY_RECEIVED
    const chosenGrnStatusId = hasBalanceAfterReceipt ? partialGrnStatusId : receivedGrnStatusId
    const chosenPoStatusId = {
      [GRN_STATUS.DRAFT]: 1,
      [GRN_STATUS.PARTIALLY_RECEIVED]: 3,
      [GRN_STATUS.FULLY_RECEIVED]: 4,
      [GRN_STATUS.CANCELLED]: 5,
    }[chosenGrnStatusId] ?? 3

    try {
      const result = await createGrn({
        supplier_id:       Number(supplierId),
        purchase_order_id: Number(selectedPoId),
        po_status_id:      chosenPoStatusId,
        grn_status_id:     chosenGrnStatusId,
        status: hasBalanceAfterReceipt ? 'Partially Received' : 'Fully Received',
        grn_status: hasBalanceAfterReceipt ? 'Partially Received' : 'Fully Received',
        grn_date: new Date().toISOString(),
        total_amount: plannedReceiptTotal,
        items: receivableItems,
      })

      if (!result.success) {
        toast.error(result.message || 'Failed to create GRN')
        return
      }

      setReceivedByItem((prev) => {
        const next = { ...prev }
        receivableItems.forEach((entry) => {
          const itemId = Number(entry?.item_id || 0)
          const receivedQty = Number(
            entry?.received_quantity ?? entry?.recived_quantity ?? entry?.quantity ?? 0,
          )
          if (!itemId || receivedQty <= 0) return
          next[itemId] = Number(next[itemId] || 0) + receivedQty
        })
        return next
      })

      await reloadGrns()

      const nextCreatedId = parseCreatedGrnId(result.data)
      if (nextCreatedId) setSelectedGrnId(String(nextCreatedId))

      toast.success(
        hasBalanceAfterReceipt
          ? 'Partial receipt GRN created successfully'
          : 'GRN created successfully',
      )
    } finally {
      setIsCreatingFromPo(false)
    }
  }

  const handleDeleteSelected = async () => {
    if (!selectedGrn) {
      toast.error('Select a GRN to delete')
      return
    }

    if (!window.confirm(`Delete ${getGrnNumber(selectedGrn)}? This action cannot be undone.`)) return

    const result = await deleteGrn(selectedGrn)
    if (!result.success) {
      toast.error(result.message || 'Failed to delete GRN')
      return
    }

    setSelectedGrnId('')
    setGrnItems([])
    toast.success(result.message || 'GRN deleted successfully')
  }

  const clearFilters = () => {
    setSearchTerm('')
    setSelectedSupplier(ALL_SUPPLIERS)
    setSelectedStatus(ALL_STATUS)
    setCurrentPage(1)
  }

  const confirmButtonLabel = isCreatingFromPo
    ? 'Creating…'
    : receivingMetrics.isPartial
      ? 'Confirm Partial Receipt'
      : 'Confirm Full Receipt'

  const confirmButtonDisabled =
    isCreatingFromPo || !selectedPoId || !poReceivingItems.length ||
    receivingMetrics.overCount > 0

  return (
    <main className="ml-0 mt-0 p-4 sm:p-6 lg:p-8 min-h-screen">

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8 items-center">
        <div className="lg:col-span-8 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" data-icon="search">search</span>
            <input
              className="w-full bg-white border border-slate-200 dark:border-slate-800 rounded-xl pl-12 pr-4 py-4 text-sm shadow-sm focus:ring-2 focus:ring-primary/20 outline-none"
              placeholder="Search by GRN, PO or supplier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              type="text"
              aria-label="Filter GRNs"
            />
          </div>
          <div className="relative">
            <select
              className="appearance-none bg-white border border-slate-200 dark:border-slate-800 rounded-xl px-6 pr-12 py-4 text-sm shadow-sm focus:ring-2 focus:ring-primary/20 outline-none min-w-50"
              value={selectedStatus}
              onChange={async (e) => {
                const next = e.target.value
                setSelectedStatus(next)
                await refreshByServerFilter(next, selectedSupplier)
              }}
              aria-label="Filter by GRN status"
            >
              <option value={ALL_STATUS}>{ALL_STATUS}</option>
              {statusOptions.map((s) => (
                <option key={s.id} value={String(s.id)}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="relative">
            <select
              className="appearance-none bg-white border border-slate-200 dark:border-slate-800 rounded-xl px-6 pr-12 py-4 text-sm shadow-sm focus:ring-2 focus:ring-primary/20 outline-none min-w-50"
              value={selectedSupplier}
              onChange={async (e) => {
                const next = e.target.value
                setSelectedSupplier(next)
                await refreshByServerFilter(selectedStatus, next)
              }}
              aria-label="Filter by supplier"
            >
              <option value={ALL_SUPPLIERS}>{ALL_SUPPLIERS}</option>
              {suppliers.map((s) => (
                <option key={s.id} value={String(s.id)}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="lg:col-span-4 flex items-center justify-between gap-3">
          <button
            type="button"
            className="px-4 py-3 rounded-xl font-semibold text-sm border border-slate-200 bg-white text-slate-600 hover:text-primary hover:border-primary/40 transition-colors"
            onClick={clearFilters}
          >
            Reset Filters
          </button>
          <button
            type="button"
            onClick={handleDeleteSelected}
            disabled={!selectedGrn}
            className="px-4 py-3 rounded-xl font-semibold text-sm border border-slate-200 bg-white text-slate-600 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Delete GRN
          </button>
          <button
            type="button"
            onClick={handleCreateFromPo}
            disabled={confirmButtonDisabled}
            className={`px-5 py-3 rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95 duration-150 whitespace-nowrap text-sm ${
              confirmButtonDisabled
                ? 'bg-slate-400 text-white cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {confirmButtonLabel}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        <section className="lg:col-span-6 space-y-6">

          <div className="bg-white border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
              Create From Purchase Order
            </h3>
            <div>
              <label className="block text-sm font-semibold text-on-surface mb-2">
                Select Purchase Order
              </label>
              <select
                className="w-full bg-white border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-4 text-sm shadow-sm focus:ring-2 focus:ring-primary/20 outline-none"
                value={selectedPoId}
                onChange={(e) => setSelectedPoId(e.target.value)}
                disabled={isLoadingPos}
              >
                <option value="">— Select PO —</option>
                {poOptions.map((po) => (
                  <option key={po.id} value={po.id}>{po.number}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-white border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                  PO Receiving Planner
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Adjust received quantities before creating the GRN.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setPoReceivingItems((prev) =>
                    prev.map((l) => ({ ...l, receivedQty: l.maxReceivable })),
                  )
                }
                disabled={!selectedPo || !poReceivingItems.length}
                className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-[11px] font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Full Receive
              </button>
            </div>

            {selectedPo && isLoadingPoReceipts && (
              <div className="mx-4 mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm font-semibold text-blue-700">
                  Loading previous receipts for this purchase order…
                </p>
              </div>
            )}

            {selectedPo && !isLoadingPoReceipts && receivingMetrics.discrepantCount > 0 && (
              <div className="mx-4 mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-800">
                  {receivingMetrics.discrepantCount} line(s) are below the remaining receivable
                  quantity. This GRN will be marked as <strong>Partially Received</strong>.
                </p>
              </div>
            )}

            {selectedPo && !isLoadingPoReceipts && receivingMetrics.overCount > 0 && (
              <div className="mx-4 mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4">
                <p className="text-sm font-semibold text-rose-700">
                  Received quantity cannot exceed the remaining receivable quantity.
                  Reduce over-received lines to continue.
                </p>
              </div>
            )}

            <div className="overflow-x-auto p-4">
              <table className="w-full text-left border-separate border-spacing-y-1">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-widest">
                    <th className="px-4 py-3">Item</th>
                    <th className="px-4 py-3 text-center">Ordered</th>
                    <th className="px-4 py-3 text-center">Prev. Received</th>
                    <th className="px-4 py-3 text-center">Receive Now</th>
                    <th className="px-4 py-3 text-center">Balance After</th>
                    <th className="px-4 py-3 text-right">Unit Price</th>
                  </tr>
                </thead>
                <tbody>
                  {!selectedPo && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                        Select a purchase order to plan receiving quantities.
                      </td>
                    </tr>
                  )}
                  {selectedPo && isLoadingPoReceipts && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                        Loading…
                      </td>
                    </tr>
                  )}
                  {selectedPo && !isLoadingPoReceipts && !poReceivingItems.length && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                        No PO line items found for this purchase order.
                      </td>
                    </tr>
                  )}

                  {!isLoadingPoReceipts && poReceivingItems.map((line) => {
                    const receiveNow        = Number(line.receivedQty || 0)
                    const maxReceivable     = Number(line.maxReceivable || 0)
                    const balanceAfter      = maxReceivable - receiveNow
                    const isOver            = receiveNow > maxReceivable
                    const isDiscrepant      = !isOver && balanceAfter > 0

                    return (
                      <tr
                        key={line.key}
                        className={`${
                          isOver       ? 'bg-rose-50/60'  :
                          isDiscrepant ? 'bg-amber-50/60' :
                                         'bg-slate-50/60'
                        } hover:bg-slate-100/50 transition-colors`}
                      >
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">{line.name}</p>
                          <p className="text-xs text-slate-500">SKU: {line.sku}</p>
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-slate-700">
                          {line.orderedQty}
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-slate-700">
                          {line.previouslyReceived}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            className={`w-24 rounded-lg border px-2 py-1 text-center font-semibold ${
                              isOver
                                ? 'border-rose-300 bg-rose-50 text-rose-700'
                                : isDiscrepant
                                  ? 'border-amber-300 bg-amber-50 text-amber-800'
                                  : 'border-slate-200 bg-white text-slate-700'
                            }`}
                            type="number"
                            min={0}
                            max={maxReceivable}
                            value={line.receivedQty}
                            onChange={(e) => updateReceivingLine(line.key, 'receivedQty', e.target.value)}
                          />
                          <p className="text-[11px] text-slate-400 mt-1">Max {maxReceivable}</p>
                        </td>
                        <td className={`px-4 py-3 text-center font-semibold ${
                          isOver       ? 'text-rose-700'   :
                          isDiscrepant ? 'text-amber-700'  :
                                         'text-emerald-700'
                        }`}>
                          {isOver ? `Over by ${receiveNow - maxReceivable}` : balanceAfter}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-700">
                          {formatCurrency(line.unitPrice)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="lg:col-span-6 space-y-6">

          <div className="bg-white border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">GRN Registry</h3>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700">
                {isLoadingGrns || isRefreshingByFilter
                  ? 'Loading…'
                  : `${filteredGrns.length} Records`}
              </span>
            </div>

            <div className="overflow-x-auto p-4">
              <table className="w-full text-left border-separate border-spacing-y-1">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-widest">
                    <th className="px-6 py-5 text-[10px]">ID</th>
                    <th className="px-6 py-5 text-[10px]">PO</th>
                    <th className="px-6 py-5 text-[10px]">Date</th>
                    <th className="px-6 py-5 text-[10px]">Supplier</th>
                    <th className="px-6 py-5 text-[10px]">Status</th>
                    <th className="px-6 py-5 text-[10px]">Total</th>
                    <th className="px-6 py-5 text-[10px] text-right">View</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {(isLoadingGrns || isRefreshingByFilter) && (
                    <tr>
                      <td colSpan={7} className="px-6 py-10 text-center text-slate-500">
                        Loading GRNs…
                      </td>
                    </tr>
                  )}

                  {!isLoadingGrns && !isRefreshingByFilter && paginatedGrns.map((grn, index) => {
                    const id       = String(getGrnId(grn))
                    const selected = id === String(selectedGrnId)
                    const rowBg    = index % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'

                    return (
                      <tr
                        key={id}
                        className={`${rowBg} hover:bg-slate-100/60 transition-colors ${
                          selected ? 'ring-1 ring-primary/30' : ''
                        }`}
                      >
                        <td className="px-6 py-4 rounded-l-xl text-sm font-bold text-slate-700">
                          {getGrnNumber(grn)}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{getGrnPoNumber(grn)}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{formatDateLabel(getGrnDate(grn))}</td>
                        <td className="px-6 py-4 text-sm text-slate-700">{getGrnSupplierName(grn)}</td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`inline-flex px-2.5 py-1 rounded-full font-semibold text-xs ${getStatusChipClass(getGrnStatus(grn, statusLabelById))}`}>
                            {getGrnStatus(grn, statusLabelById)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-slate-900">
                          {formatCurrency(grn?.total_amount || 0)}
                        </td>
                        <td className="px-6 py-4 text-right rounded-r-xl">
                          <button
                            className="p-2 hover:bg-white rounded-lg transition-colors text-slate-400 hover:text-primary"
                            type="button"
                            onClick={() => setSelectedGrnId(id)}
                            aria-label={`View ${getGrnNumber(grn)}`}
                          >
                            <span className="material-symbols-outlined text-xl">visibility</span>
                          </button>
                        </td>
                      </tr>
                    )
                  })}

                  {!isLoadingGrns && !isRefreshingByFilter && !filteredGrns.length && (
                    <tr>
                      <td colSpan={7} className="px-6 py-14 text-center text-slate-500">
                        <p className="text-sm font-semibold text-on-surface">No GRNs found</p>
                        <p className="text-xs mt-1">
                          Try changing filters or create a new GRN from a purchase order.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between p-6 gap-4 mt-2">
              <p className="text-xs text-slate-500 font-medium">
                Showing{' '}
                <span className="font-bold text-on-surface">
                  {filteredGrns.length
                    ? `${startIndex + 1}–${Math.min(startIndex + ITEMS_PER_PAGE, filteredGrns.length)}`
                    : 0}
                </span>{' '}
                of{' '}
                <span className="font-bold text-on-surface">{filteredGrns.length}</span>
              </p>
              <div className="flex items-center gap-2">
                <button
                  className={`p-2 rounded-lg border border-slate-200 transition-all ${
                    safeCurrentPage === 1
                      ? 'bg-slate-50 text-slate-400 cursor-not-allowed opacity-50'
                      : 'bg-slate-50 text-slate-600 hover:bg-primary hover:text-white'
                  }`}
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safeCurrentPage === 1}
                  aria-label="Previous page"
                >
                  <span className="material-symbols-outlined">chevron_left</span>
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => {
                    const page     = i + 1
                    const isActive = page === safeCurrentPage
                    return (
                      <button
                        key={page}
                        className={`w-8 h-8 rounded-lg text-xs font-bold ${
                          isActive
                            ? 'bg-primary text-white'
                            : 'bg-slate-50 text-slate-600 hover:bg-primary hover:text-white border border-slate-200'
                        }`}
                        type="button"
                        onClick={() => setCurrentPage(page)}
                        aria-label={`Page ${page}`}
                      >
                        {page}
                      </button>
                    )
                  })}
                </div>

                <button
                  className={`p-2 rounded-lg border border-slate-200 transition-all ${
                    safeCurrentPage === totalPages
                      ? 'bg-slate-50 text-slate-400 cursor-not-allowed opacity-50'
                      : 'bg-slate-50 text-slate-600 hover:bg-primary hover:text-white'
                  }`}
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safeCurrentPage === totalPages}
                  aria-label="Next page"
                >
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between gap-3">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                Selected GRN Items
              </h3>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700">
                {selectedGrnId ? `${grnItems.length} Items` : 'Select a GRN'}
              </span>
            </div>

            <div className="overflow-x-auto p-4">
              <table className="w-full text-left border-separate border-spacing-y-1">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-widest">
                    <th className="px-4 py-3">Item</th>
                    <th className="px-4 py-3 text-center">Total</th>
                    <th className="px-4 py-3 text-center">Received</th>
                    <th className="px-4 py-3 text-center">Balance</th>
                    <th className="px-4 py-3 text-right">Price</th>
                    <th className="px-4 py-3 text-right">Subtotal</th>
                    <th className="px-4 py-3 text-right">Balance Value</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {isLoadingItems && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        Loading GRN items…
                      </td>
                    </tr>
                  )}
                  {!isLoadingItems && !selectedGrnId && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        Select a GRN from the registry to view item details.
                      </td>
                    </tr>
                  )}
                  {!isLoadingItems && selectedGrnId && !grnItems.length && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        No items found for this GRN.
                      </td>
                    </tr>
                  )}

                  {!isLoadingItems && grnItems.map((item, index) => {
                    const totalQty       = getItemCanonicalTotalQty(item)
                    const receivedQty    = getItemReceivedQty(item)
                    const cumulativeBalanceQty = getItemCumulativeBalanceQty(item, relatedGrnsCumulativeReceivedByItem)
                    const rawBalance     = totalQty - receivedQty
                    const overQty        = Math.max(0, -rawBalance)
                    const unitPrice      = getItemUnitPrice(item)
                    const subtotal       = receivedQty * unitPrice
                    const balanceValue   = cumulativeBalanceQty * unitPrice
                    const overValue      = overQty * unitPrice

                    return (
                      <tr
                        key={item?.id || item?.grn_item_id || index}
                        className="bg-slate-50/60 hover:bg-slate-100/50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <p className="font-bold text-on-surface">
                            {item?.item?.item_name || item?.item?.name || item?.item_name ||
                              item?.description || `Item #${item?.item_id || '-'}`}
                          </p>
                          <p className="text-xs text-slate-400 font-medium">
                            SKU: {item?.item?.sku || item?.item?.code || item?.sku || item?.code || '-'}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-slate-600">{totalQty}</td>
                        <td className="px-4 py-3 text-center font-bold text-slate-700">{receivedQty}</td>
                        <td className="px-4 py-3 text-center font-bold">
                          {overQty > 0 ? (
                            <span className="text-rose-700">Over by {overQty}</span>
                          ) : (
                            <span className={cumulativeBalanceQty > 0 ? 'text-amber-700' : 'text-emerald-700'}>
                              {cumulativeBalanceQty}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">{formatCurrency(unitPrice)}</td>
                        <td className="px-4 py-3 text-right font-bold">{formatCurrency(subtotal)}</td>
                        <td className="px-4 py-3 text-right font-bold">
                          {overQty > 0 ? (
                            <span className="text-rose-700">Over {formatCurrency(overValue)}</span>
                          ) : (
                            <span className={cumulativeBalanceQty > 0 ? 'text-amber-700' : 'text-emerald-700'}>
                              {formatCurrency(balanceValue)}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-6 bg-slate-50/60 flex flex-col sm:flex-row justify-between gap-4">
              <p className="text-sm text-slate-500 font-medium">
                Selected GRN totals for quantity, value, and pending balance.
              </p>
              <div className="space-y-1 text-sm min-w-64">
                {[
                  { label: 'Total Quantity',      value: grnTotals.totalQty,         color: 'text-slate-900' },
                  { label: 'Received Quantity',   value: grnTotals.receivedQty,      color: 'text-emerald-700' },
                  {
                    label: 'Balance Quantity',
                    value: grnTotals.balanceQty,
                    color: grnTotals.balanceQty > 0 ? 'text-amber-700' : 'text-emerald-700',
                  },
                  {
                    label: 'Over Received Qty',
                    value: grnTotals.overReceivedQty,
                    color: grnTotals.overReceivedQty > 0 ? 'text-rose-700' : 'text-emerald-700',
                  },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex justify-between gap-8">
                    <span className="text-slate-500">{label}</span>
                    <span className={`font-bold ${color}`}>{value}</span>
                  </div>
                ))}

                <div className="flex justify-between gap-8">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="font-bold text-slate-900">{formatCurrency(grnTotals.subtotal)}</span>
                </div>
                <div className="flex justify-between gap-8">
                  <span className="text-slate-500">Balance Value</span>
                  <span className={`font-bold ${grnTotals.balanceValue > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                    {formatCurrency(grnTotals.balanceValue)}
                  </span>
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