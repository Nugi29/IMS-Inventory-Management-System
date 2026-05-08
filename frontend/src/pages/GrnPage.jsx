import { useCallback, useEffect, useMemo, useState, useContext } from 'react'
import { useLocation } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useLookup } from '../services/useLookup'
import { usePo } from '../services/usePo'
import { useGrn } from '../services/useGrn'
import { downloadPDF, GrnDetailPDF } from '../components/ReportPDFs'
import { AppContext } from '../context/AppContext'


const ALL_SUPPLIERS = 'All Suppliers'
const ALL_STATUS = 'All Statuses'
const ITEMS_PER_PAGE = 4
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

const GRN_STATUS_TO_PO_STATUS = {
  [GRN_STATUS.DRAFT]: 1,
  [GRN_STATUS.PARTIALLY_RECEIVED]: 3,
  [GRN_STATUS.FULLY_RECEIVED]: 4,
  [GRN_STATUS.CANCELLED]: 5,
}

// â”€â”€â”€ Pure helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
const getPoStatusId = (po) => {
  const directPoStatusId = Number(po?.po_status_id ?? po?.poStatusId ?? po?.po_status?.id)
  return Number.isFinite(directPoStatusId) && directPoStatusId > 0 ? directPoStatusId : null
}

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

// â”€â”€â”€ Formatters â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  error?.message ||
  fallback

const getStatusChipClass = (status) => {
  const normalized = normalizeText(status)
  if (normalized === 'draft')              return 'bg-slate-100 text-slate-700'
  if (normalized === 'partially received') return 'bg-amber-100 text-amber-800'
  if (normalized === 'fully received')     return 'bg-emerald-100 text-emerald-800'
  if (normalized === 'cancelled')          return 'bg-rose-100 text-rose-700'
  return 'bg-slate-100 text-slate-700'
}

// â”€â”€â”€ Payload parsers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const parseCreatedGrnId = (payload) => {
  const firstObject = payload?.grnData || payload?.grn || payload?.data
  return firstObject?.id || firstObject?.grn_id || firstObject?._id || null
}

// â”€â”€â”€ PO line-item extraction â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    receivedQty: orderedQty,   // default â€” will be overwritten after previouslyReceived is known
    unitPrice,
    remarks:            '',
    previouslyReceived: 0,
    maxReceivable:      orderedQty,
  }
}

// â”€â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const GrnPage = () => {
  const { userData } = useContext(AppContext)
  const location = useLocation()
  const sourcePo = location.state?.source === 'po' ? (location.state?.po ?? null) : null

  const { pos = [], isLoadingPos, reloadPos, updatePo }     = usePo()
  const {
    suppliers: supplierLookup = [],
    grnStatuses: grnStatusLookup = [],
    poStatuses: poStatusLookup = [],
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
    sendGrnEmail,
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
  const [isSendingEmail,     setIsSendingEmail]     = useState(false)

  useEffect(() => {
    loadLookupData()
    reloadPos()
    reloadGrns()
  }, [loadLookupData, reloadPos, reloadGrns])

  const sourcePoPrimary = useMemo(() => String(getPoId(sourcePo) || ''), [sourcePo])
  useEffect(() => {
    if (sourcePoPrimary) setSelectedPoId(sourcePoPrimary)
  }, [sourcePoPrimary])

  const sourceGrnId = location.state?.grnId ?? ''
  useEffect(() => {
    if (sourceGrnId) {
      setSelectedGrnId(String(sourceGrnId))
      // Optional: scroll to details
      setTimeout(() => {
        document.getElementById('grn-item-detail')?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    }
  }, [sourceGrnId])

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

  const poStatusOptions = useMemo(() =>
    poStatusLookup
      .map((s) => ({ id: getLookupId(s), label: getLookupLabel(s) }))
      .filter((s) => s.id && s.label),
  [poStatusLookup])

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

  const poOptions = useMemo(() => {
    const allowedStatusKeywords = ['sent', 'partially received']
    const allowedStatusIds = poStatusOptions
      .filter((s) => {
        const label = normalizeText(s.label)
        return allowedStatusKeywords.some(k => label.includes(k))
      })
      .map((s) => String(s.id))

    return pos
      .filter((po) => {
        const statusId = String(getPoStatusId(po) || '')
        return allowedStatusIds.includes(statusId)
      })
      .map((po) => ({ id: String(getPoId(po)), number: getPoNumber(po) }))
      .filter((po) => po.id)
  }, [pos, poStatusOptions])

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
        supplierName.includes(normalizedSearch) ||
        normalizeText(statusLabel).includes(normalizedSearch) ||
        grnStatusId.includes(normalizedSearch)

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

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

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

    const balanceQty      = Math.max(0, totalQty - totalCumulativeReceivedQty)

    return {
      totalQty, receivedQty, balanceQty,
      subtotal, balanceValue,
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
                 Number(getGrnId(grn)) < Number(selectedGrnId),
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
  }, [selectedGrn, selectedGrnId, grns, getGrnItems])

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
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to apply filters right now'))
      await reloadGrns().catch(() => {})
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
    if (receivingMetrics.receivableLines === 0) {
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
    const chosenPoStatusId = GRN_STATUS_TO_PO_STATUS[chosenGrnStatusId] ?? 3
    const statusLabel = hasBalanceAfterReceipt ? 'Partially Received' : 'Fully Received'

    try {
      const result = await createGrn({
        supplier_id:       Number(supplierId),
        purchase_order_id: Number(selectedPoId),
        po_status_id:      chosenPoStatusId,
        grn_status_id:     chosenGrnStatusId,
        status: statusLabel,
        grn_status: statusLabel,
        grn_date: new Date().toISOString(),
        total_amount: plannedReceiptTotal,
        items: receivableItems,
      })

      if (!result.success) {
        toast.error(result.message || 'Failed to create GRN')
        return
      }

      const currentPoStatusId = getPoStatusId(selectedPo)
      if (currentPoStatusId !== Number(chosenPoStatusId)) {
        try {
          const syncResult = await updatePo({ ...selectedPo, po_status_id: chosenPoStatusId })
          if (!syncResult.success) {
            toast.warn(syncResult.message || 'GRN was created, but the linked PO status could not be synced')
          }
        } catch (error) {
          toast.warn(getErrorMessage(error, 'GRN was created, but PO status sync failed'))
        }
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

      try {
        await reloadGrns()
      } catch (error) {
        toast.warn(getErrorMessage(error, 'GRN created, but list refresh failed'))
      }

      const nextCreatedId = parseCreatedGrnId(result.data)
      if (nextCreatedId) setSelectedGrnId(String(nextCreatedId))

      toast.success(
        hasBalanceAfterReceipt
          ? 'Partial receipt GRN created successfully'
          : 'GRN created successfully',
      )
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to create GRN'))
    } finally {
      setIsCreatingFromPo(false)
    }
  }

  const handleDeleteSelected = async () => {
    if (!selectedGrn) {
      toast.error('Select a GRN to delete')
      return
    }

    if (!window.confirm(`Are you sure you want to delete ${getGrnNumber(selectedGrn)}? This action cannot be undone.`)) {
      return
    }

    try {
      const result = await deleteGrn(selectedGrn)
      if (!result.success) {
        toast.error(result.message || 'Failed to delete GRN')
        return
      }

      setSelectedGrnId('')
      setGrnItems([])
      setRelatedGrnsCumulativeReceivedByItem({})
      setReceivedByItem({})
      toast.success(result.message || 'GRN deleted successfully')
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to delete GRN'))
    }
  }

  const clearFilters = () => {
    setSearchTerm('')
    setSelectedSupplier(ALL_SUPPLIERS)
    setSelectedStatus(ALL_STATUS)
    setCurrentPage(1)
  }

  const exportCsv = () => {
    if (!filteredGrns.length) {
      toast.error('No GRN data to export.')
      return
    }

    const rows = filteredGrns.map((grn) => ({
      grn_no: getGrnNumber(grn),
      po_no: getGrnPoNumber(grn),
      date: formatDateLabel(getGrnDate(grn)),
      supplier: getGrnSupplierName(grn),
      status: getGrnStatus(grn, statusLabelById),
      total_amount: Number(grn?.total_amount || 0).toFixed(2),
    }))

    const headers = Object.keys(rows[0])
    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        headers.map((key) => `"${String(row[key] ?? '').replaceAll('"', '""')}"`).join(',')
      ),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `grns-${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handlePrintGrnDetail = async () => {
    if (!selectedGrnId || !selectedGrn) {
      toast.error('Please select a GRN to print.');
      return;
    }
    
    try {
      const items = grnItems.map(item => {
        const totalQty    = getItemCanonicalTotalQty(item)
        const receivedQty = getItemReceivedQty(item)
        const cumulativeBalanceQty = getItemCumulativeBalanceQty(item, relatedGrnsCumulativeReceivedByItem)
        const unitPrice   = getItemUnitPrice(item)
        const subtotal    = receivedQty * unitPrice
        const balanceValue = cumulativeBalanceQty * unitPrice

        return {
          name: item?.item?.item_name || item?.item?.name || item?.item_name || item?.description || `Item #${item?.item_id || '-'}`,
          sku: item?.item?.sku || item?.item?.code || item?.sku || item?.code || '-',
          totalQty,
          receivedQty,
          balanceQty: cumulativeBalanceQty,
          unitPrice,
          subtotal,
          balanceValue
        }
      });
      
      const supplierName = getGrnSupplierName(selectedGrn);
      const poNumber = getGrnPoNumber(selectedGrn);
      const grnDate = getGrnDate(selectedGrn);
      const grnStatus = getGrnStatus(selectedGrn, statusLabelById);
      const userName = userData?.name || userData?.first_name || userData?.email || 'Unknown User';
      const userRole = userData?.role?.name || 'Staff';

      await downloadPDF(GrnDetailPDF, { 
        grn: selectedGrn, 
        items, 
        totals: grnTotals, 
        supplierName, 
        poNumber,
        grnDate,
        grnStatus,
        userName,
        userRole
      }, `${getGrnNumber(selectedGrn)}.pdf`);
    } catch (error) {
      toast.error('Failed to generate PDF: ' + error.message);
    }
  }

  const handleSendGrnEmail = async () => {
    if (!selectedGrnId || !selectedGrn) {
      toast.error('Please select a GRN to send via email.');
      return;
    }

    const supplierId = getGrnSupplierId(selectedGrn);
    const supplierFromLookup = supplierLookup.find(s => String(getLookupId(s)) === String(supplierId));
    const email = supplierFromLookup?.email || selectedGrn?.supplier?.email;
    
    if (!email) {
      toast.error('Supplier email address not found. Please update supplier details.');
      return;
    }
    
    setIsSendingEmail(true);
    try {
      const items = grnItems.map(item => {
        const totalQty    = getItemCanonicalTotalQty(item)
        const receivedQty = getItemReceivedQty(item)
        const cumulativeBalanceQty = getItemCumulativeBalanceQty(item, relatedGrnsCumulativeReceivedByItem)
        const unitPrice   = getItemUnitPrice(item)
        const subtotal    = receivedQty * unitPrice
        const balanceValue = cumulativeBalanceQty * unitPrice

        return {
          name: item?.item?.item_name || item?.item?.name || item?.item_name || item?.description || `Item #${item?.item_id || '-'}`,
          sku: item?.item?.sku || item?.item?.code || item?.sku || item?.code || '-',
          totalQty,
          receivedQty,
          balanceQty: cumulativeBalanceQty,
          unitPrice,
          subtotal,
          balanceValue
        }
      });
      
      const supplierName = getGrnSupplierName(selectedGrn);
      const poNumber = getGrnPoNumber(selectedGrn);
      const grnDate = getGrnDate(selectedGrn);
      const grnStatus = getGrnStatus(selectedGrn, statusLabelById);
      const userName = userData?.name || userData?.first_name || userData?.email || 'Unknown User';
      const userRole = userData?.role?.name || 'Staff';

      const result = await sendGrnEmail({
        grn: {
          ...selectedGrn,
          grn_no: getGrnNumber(selectedGrn),
          supplier: {
            ...(supplierFromLookup || selectedGrn?.supplier || {}),
            name: supplierName,
            email: email
          },
          poNumber,
          grn_date: grnDate,
          status: grnStatus
        },
        items,
        totals: grnTotals,
        userName,
        userRole
      });

      if (result.success) {
        toast.success(result.message || 'GRN receipt sent to supplier email successfully');
      } else {
        toast.error(result.message || 'Failed to send GRN email');
      }
    } catch (error) {
      toast.error('Error: ' + error.message);
    } finally {
      setIsSendingEmail(false);
    }
  }

  const confirmButtonLabel = isCreatingFromPo
    ? 'Creating...'
    : receivingMetrics.isPartial
      ? 'Confirm Partial Receipt'
      : 'Confirm Full Receipt'

  const confirmButtonDisabled =
    isCreatingFromPo || !selectedPoId || !poReceivingItems.length ||
    receivingMetrics.receivableLines === 0 || receivingMetrics.overCount > 0

  const resetButtonClass =
    'w-full px-4 py-3 rounded-xl font-semibold text-sm border border-slate-200 bg-white text-slate-500 hover:text-primary hover:border-primary/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed sm:w-auto'

  return (
    <main className="ml-0 mt-0 p-4 sm:p-6 lg:p-8 min-h-screen">
      <div className="grid grid-cols-1 gap-6">

        {/* LEFT â€” Create from PO + Receiving Planner */}
        <section className="w-full space-y-5">

          {/* PO selector card */}
          <div className="rounded-3xl border border-slate-200/80 bg-white/95 p-5 shadow-sm backdrop-blur-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">
              Create From Purchase Order
            </p>
            <label className="block text-sm font-semibold text-on-surface mb-1.5">
              Select Purchase Order
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-stretch">
              <div className="relative sm:col-span-7">
                <select
                  className="w-full appearance-none bg-white border border-slate-200 rounded-xl pl-10 pr-10 py-3.5 text-sm shadow-sm focus:ring-2 focus:ring-primary/20 outline-none cursor-pointer"
                  value={selectedPoId}
                  onChange={(e) => setSelectedPoId(e.target.value)}
                  disabled={isLoadingPos}
                >
                  <option value="">Select PO</option>
                  {poOptions.map((po) => (
                    <option key={po.id} value={po.id}>{po.number}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPoId('')}
                disabled={!selectedPoId || isLoadingPos || isCreatingFromPo}
                className={`sm:col-span-1 ${resetButtonClass}`}
              >
                Reset
              </button>
              <button
                type="button"
                onClick={handleCreateFromPo}
                disabled={confirmButtonDisabled}
                className={`sm:col-span-4 px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 duration-150 whitespace-nowrap text-sm ${
                  confirmButtonDisabled
                    ? 'border border-slate-200 bg-slate-200 text-slate-500 cursor-not-allowed'
                    : 'border border-[#004ac6] bg-primary bg-[#004ac6] text-white hover:bg-[#003ea8]'
                }`}
              >
                {confirmButtonLabel}
              </button>
            </div>

            {/* Planned Receipt Total Badge */}
            {selectedPo && !isLoadingPoReceipts && poReceivingItems.length > 0 && (
              <div className="mt-3 flex items-center justify-between rounded-xl bg-primary/5 border border-primary/15 px-4 py-2.5">
                <span className="text-xs font-semibold text-primary/70">Planned Receipt Total</span>
                <span className="text-sm font-black text-primary">{formatCurrency(plannedReceiptTotal)}</span>
              </div>
            )}
          </div>

          {/* PO Receiving Planner card */}
          <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/95 shadow-sm backdrop-blur-sm">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  PO Receiving Planner
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Adjust quantities before confirming receipt.
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
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-[11px] font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]" data-icon="done_all">done_all</span>
                Full Receive
              </button>
            </div>

            {/* Alerts */}
            {selectedPo && isLoadingPoReceipts && (
              <div className="mx-4 mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-500 text-[18px]" data-icon="sync">sync</span>
                <p className="text-sm font-semibold text-blue-700">Loading previous receipts...</p>
              </div>
            )}
            {selectedPo && !isLoadingPoReceipts && receivingMetrics.discrepantCount > 0 && (
              <div className="mx-4 mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-2">
                <span className="material-symbols-outlined text-amber-500 text-[18px] mt-0.5" data-icon="warning">warning</span>
                <p className="text-sm font-semibold text-amber-800">
                  {receivingMetrics.discrepantCount} line(s) below remaining receivable -{' '}
                  <strong>Partial Receipt</strong>.
                </p>
              </div>
            )}
            {selectedPo && !isLoadingPoReceipts && receivingMetrics.overCount > 0 && (
              <div className="mx-4 mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 flex items-start gap-2">
                <span className="material-symbols-outlined text-rose-500 text-[18px] mt-0.5" data-icon="error">error</span>
                <p className="text-sm font-semibold text-rose-700">
                  Received quantity exceeds remaining receivable. Please reduce over-received lines.
                </p>
              </div>
            )}

            {/* Planner table */}
            <div className="overflow-x-auto p-3">
              <table className="w-full text-left border-separate border-spacing-y-1">
                <thead className="sticky top-0 z-10">
                  <tr className="text-on-surface-variant">
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Item</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-center">Item ID</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-center">SKU</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-center">Ordered</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-center">Prev. Rcvd</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-center">Receive Now</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-center">Remaining</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {!selectedPo && (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center">
                        <span className="material-symbols-outlined text-slate-300 text-[40px] block mb-2" data-icon="receipt_long">receipt_long</span>
                        <p className="text-sm text-slate-400">Select a purchase order to begin.</p>
                      </td>
                    </tr>
                  )}
                  {selectedPo && isLoadingPoReceipts && (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-400">Loading...</td>
                    </tr>
                  )}
                  {selectedPo && !isLoadingPoReceipts && !poReceivingItems.length && (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-400">
                        No receivable line items found for this PO.
                      </td>
                    </tr>
                  )}

                  {!isLoadingPoReceipts && poReceivingItems.map((line) => {
                    const receiveNow    = Number(line.receivedQty || 0)
                    const maxReceivable = Number(line.maxReceivable || 0)
                    const isOver        = receiveNow > maxReceivable
                    const isDiscrepant  = !isOver && (maxReceivable - receiveNow) > 0

                    return (
                      <tr
                        key={line.key}
                        className={`${
                          isOver       ? 'bg-rose-50/70'  :
                          isDiscrepant ? 'bg-amber-50/60' :
                                         'bg-slate-50/50'
                        } hover:bg-slate-100/60 transition-colors`}
                      >
                        <td className="px-4 py-3 rounded-l-xl">
                          <p className="font-semibold text-on-surface text-sm">{line.name}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{line.sku}</p>
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-slate-500 text-sm">{line.itemId}</td>
                        <td className="px-4 py-3 text-center font-semibold text-slate-500 text-sm">{line.sku}</td>
                        <td className="px-4 py-3 text-center font-semibold text-slate-600 text-sm">{line.orderedQty}</td>
                        <td className="px-4 py-3 text-center font-semibold text-slate-500 text-sm">{line.previouslyReceived}</td>
                        <td className="px-4 py-3 text-center">
                          <input
                            className={`w-24 rounded-lg border px-2 py-1.5 text-center text-sm font-semibold focus:outline-none focus:ring-2 transition-colors ${
                              isOver
                                ? 'border-rose-300 bg-rose-50 text-rose-700 focus:ring-rose-300'
                                : isDiscrepant
                                  ? 'border-amber-300 bg-amber-50 text-amber-800 focus:ring-amber-300'
                                  : 'border-slate-200 bg-white text-slate-700 focus:ring-primary/20'
                            }`}
                            type="number"
                            min={0}
                            max={maxReceivable}
                            value={line.receivedQty}
                            onChange={(e) => updateReceivingLine(line.key, 'receivedQty', e.target.value)}
                          />
                          <p className="text-[10px] text-slate-400 mt-1">max {maxReceivable}</p>
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-slate-600 text-sm">{Math.max(0, maxReceivable - receiveNow)}</td>
                        <td className="px-4 py-3 text-right rounded-r-xl">
                          <p className="font-bold text-slate-800 text-sm">{formatCurrency(Number(receiveNow) * Number(line.unitPrice || 0))}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{formatCurrency(line.unitPrice)} x {receiveNow}</p>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* RIGHT  GRN Registry + GRN Items Detail */}
        <section className="w-full space-y-5">

          {/* GRN Registry card */}
          <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/95 shadow-sm backdrop-blur-sm">
            <div className="px-5 py-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">GRN Registry</p>

              </div>

              <div className="grid grid-cols-1 gap-3 xl:grid-cols-12 xl:items-center">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:col-span-9 xl:grid-cols-12">
                  <div className="relative sm:col-span-2 xl:col-span-6">
                    <span className="material-symbols-outlined absolute left-4 top-3 text-slate-400" data-icon="search">search</span>

                    <input
                      className="w-full bg-white border border-slate-200 rounded-xl pl-12 pr-4 py-3.5 text-sm shadow-sm focus:ring-2 focus:ring-primary/20 outline-none placeholder:text-slate-400"
                      placeholder="Search by GRN, PO or supplier..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      type="text"
                      aria-label="Filter GRNs"
                    />
                  </div>

                  <div className="relative xl:col-span-3">
                    <select
                      className="w-full appearance-none bg-white border border-slate-200 rounded-xl pl-4 pr-10 py-3.5 text-sm shadow-sm focus:ring-2 focus:ring-primary/20 outline-none cursor-pointer"
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

                  <div className="relative xl:col-span-3">
                    <select
                      className="w-full appearance-none bg-white border border-slate-200 rounded-xl pl-4 pr-10 py-3.5 text-sm shadow-sm focus:ring-2 focus:ring-primary/20 outline-none cursor-pointer"
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

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end xl:col-span-3">
                  <button
                    type="button"
                    className={resetButtonClass}
                    onClick={clearFilters}
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteSelected}
                    disabled={!selectedGrn}
                    className="w-full px-4 py-3 rounded-xl font-semibold text-sm border border-slate-200 bg-white text-slate-500 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed sm:w-auto"
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[18px]" data-icon="delete">delete</span>
                      Delete
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Table Header Info Bar */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-b border-slate-100 bg-slate-50/60 mt-2">
                <p className="text-xs font-semibold text-slate-500 tracking-wide uppercase">
                    {filteredGrns.length} GRN{filteredGrns.length !== 1 ? 's' : ''} found
                </p>
                <p className="text-xs text-slate-400">
                    Page <span className="font-bold text-slate-600">{safeCurrentPage}</span> of <span className="font-bold text-slate-600">{totalPages}</span>
                </p>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[800px] md:min-w-0">
                    {/* ... table content remains same ... */}
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">GRN No.</th>
                            <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">PO</th>
                            <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Date</th>
                            <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Supplier</th>
                            <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-center">Status</th>
                            <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {(isLoadingGrns || isRefreshingByFilter) && (
                            <tr>
                                <td colSpan={6} className="px-6 py-16 text-center">
                                    <span className="material-symbols-outlined animate-spin text-primary text-2xl block mx-auto mb-2">sync</span>
                                    <p className="text-sm text-slate-500 font-medium">Loading GRNs...</p>
                                </td>
                            </tr>
                        )}
    
                        {!isLoadingGrns && !isRefreshingByFilter && paginatedGrns.map((grn) => {
                            const id       = String(getGrnId(grn))
                            const selected = id === String(selectedGrnId)
                            const status   = getGrnStatus(grn, statusLabelById)
    
                            return (
                                <tr
                                    key={id}
                                    className={`transition-colors cursor-pointer group ${
                                        selected
                                            ? 'bg-primary/5'
                                            : 'hover:bg-slate-50/80'
                                    }`}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => setSelectedGrnId(id)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault()
                                            setSelectedGrnId(id)
                                        }
                                    }}
                                >
                                    <td className="px-6 py-4">
                                        <p className="font-semibold text-sm text-slate-800 leading-snug">{getGrnNumber(grn)}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-sm text-slate-600">{getGrnPoNumber(grn)}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-sm text-slate-600">{formatDateLabel(getGrnDate(grn))}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-sm font-semibold text-slate-800">{getGrnSupplierName(grn)}</p>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight ${getStatusChipClass(status)}`}>
                                            {status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className="font-bold text-slate-800 text-sm">{formatCurrency(grn?.total_amount || 0)}</span>
                                    </td>
                                </tr>
                            )
                        })}
    
                        {!isLoadingGrns && !isRefreshingByFilter && !filteredGrns.length && (
                            <tr>
                                <td colSpan={6} className="px-6 py-20 text-center">
                                    <span className="material-symbols-outlined text-4xl text-slate-300 block mb-3">inventory_2</span>
                                    <p className="text-sm font-semibold text-slate-600">No GRNs found</p>
                                    <p className="text-xs text-slate-400 mt-1">Try changing your filters or create a new GRN.</p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 bg-slate-50/60 border-t border-slate-100 gap-4">
                {/* Count */}
                <p className="text-xs text-slate-500 font-medium shrink-0">
                    Showing{' '}
                    <span className="font-bold text-slate-700">
                        {filteredGrns.length ? `${startIndex + 1}–${Math.min(startIndex + ITEMS_PER_PAGE, filteredGrns.length)}` : 0}
                    </span>
                    {' '}of{' '}
                    <span className="font-bold text-slate-700">{filteredGrns.length}</span>
                    {' '}GRNs
                </p>

                {/* Page Numbers */}
                <div className="flex items-center gap-1">
                    {/* Prev */}
                    <button
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        disabled={safeCurrentPage === 1}
                        type="button"
                        className={`p-1.5 rounded-lg border transition-all ${safeCurrentPage === 1 ? 'border-slate-200 bg-white text-slate-300 cursor-not-allowed' : 'border-slate-200 bg-white text-slate-600 hover:bg-primary hover:text-white hover:border-primary'}`}
                        aria-label="Previous page"
                    >
                        <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                    </button>

                    {/* Windowed page numbers */}
                    {(() => {
                        const maxVisible = 7
                        let pages = []
                        if (totalPages <= maxVisible) {
                            pages = Array.from({ length: totalPages }, (_, i) => i + 1)
                        } else {
                            const half = Math.floor(maxVisible / 2)
                            let start = Math.max(2, safeCurrentPage - half)
                            let end = Math.min(totalPages - 1, start + maxVisible - 3)
                            if (end === totalPages - 1) start = Math.max(2, end - (maxVisible - 3))

                            pages = [1]
                            if (start > 2) pages.push('...')
                            for (let p = start; p <= end; p++) pages.push(p)
                            if (end < totalPages - 1) pages.push('...')
                            pages.push(totalPages)
                        }

                        return pages.map((page, idx) =>
                            page === '...'
                                ? <span key={`ellipsis-${idx}`} className="px-1 text-slate-400 text-xs select-none">···</span>
                                : (
                                    <button
                                        key={page}
                                        onClick={() => setCurrentPage(page)}
                                        type="button"
                                        className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-bold transition-all border ${page === safeCurrentPage ? 'bg-primary text-white border-primary shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-primary hover:text-white hover:border-primary'}`}
                                    >
                                        {page}
                                    </button>
                                )
                        )
                    })()}

                    {/* Next */}
                    <button
                        onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                        disabled={safeCurrentPage === totalPages}
                        type="button"
                        className={`p-1.5 rounded-lg border transition-all ${safeCurrentPage === totalPages ? 'border-slate-200 bg-white text-slate-300 cursor-not-allowed' : 'border-slate-200 bg-white text-slate-600 hover:bg-primary hover:text-white hover:border-primary'}`}
                        aria-label="Next page"
                    >
                        <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                    </button>
                </div>

                {/* Export */}
                {userData?.role?.name?.toLowerCase() === 'admin' && (
                    <button
                        type="button"
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition-colors shrink-0"
                        onClick={exportCsv}
                        aria-label="Export GRNs to CSV"
                    >
                        <span className="material-symbols-outlined text-[16px]">download</span>
                        Export CSV
                    </button>
                )}
            </div>
          </div>

          {/* Selected GRN Items card */}
          <div id="grn-item-detail" className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/95 shadow-sm backdrop-blur-sm">
            <div className="flex flex-col items-start justify-between gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Selected GRN - Item Detail</p>
                {selectedGrn && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    {getGrnNumber(selectedGrn)} · {getGrnSupplierName(selectedGrn)}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {selectedGrn && (
                  <button
                    onClick={handleSendGrnEmail}
                    disabled={isSendingEmail}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider border border-primary/20 bg-primary/5 text-primary hover:bg-primary hover:!text-white hover:border-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Send GRN via email"
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {isSendingEmail ? 'sync' : 'mail'}
                    </span>
                    {isSendingEmail ? 'Sending...' : 'Send Email'}
                  </button>
                )}
                {selectedGrn && (
                  <button
                    onClick={handlePrintGrnDetail}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider border border-primary/20 bg-primary/5 text-primary hover:bg-primary hover:!text-white hover:border-primary transition-all"
                    aria-label="Print GRN details"
                  >
                    <span className="material-symbols-outlined text-[14px]">print</span>
                    Print
                  </button>
                )}
                <span className={`px-3 py-1.5 rounded-full text-[11px] font-bold ${selectedGrnId ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                  {selectedGrnId ? `${grnItems.length} Items` : 'No GRN Selected'}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto p-3">
              <table className="w-full text-left border-separate border-spacing-y-1">
                <thead>
                  <tr className="text-on-surface-variant">
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider">Item</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-center">Item ID</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider">SKU</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-center">Total</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-center">Rcvd</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-center">Balance</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-right">Price</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-right">Subtotal</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-right">Bal. Value</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {isLoadingItems && (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-400">Loading GRN items...</td>
                    </tr>
                  )}
                  {!isLoadingItems && !selectedGrnId && (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center">
                        <span className="material-symbols-outlined text-slate-300 text-[40px] block mb-2" data-icon="list_alt">list_alt</span>
                        <p className="text-sm text-slate-400">Select a GRN from the registry to view items.</p>
                      </td>
                    </tr>
                  )}
                  {!isLoadingItems && selectedGrnId && !grnItems.length && (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-400">
                        No items found for this GRN.
                      </td>
                    </tr>
                  )}

                  {!isLoadingItems && grnItems.map((item, index) => {
                    const totalQty    = getItemCanonicalTotalQty(item)
                    const receivedQty = getItemReceivedQty(item)
                    const cumulativeBalanceQty = getItemCumulativeBalanceQty(item, relatedGrnsCumulativeReceivedByItem)
                    const rawBalance  = totalQty - receivedQty
                    const overQty     = Math.max(0, -rawBalance)
                    const unitPrice   = getItemUnitPrice(item)
                    const subtotal    = receivedQty * unitPrice
                    const balanceValue = cumulativeBalanceQty * unitPrice
                    const overValue   = overQty * unitPrice

                    return (
                      <tr
                        key={item?.id || item?.grn_item_id || index}
                        className="bg-slate-50/50 hover:bg-slate-100/60 transition-colors"
                      >
                        <td className="px-4 py-3.5 rounded-l-xl">
                          <p className="font-bold text-on-surface">
                            {item?.item?.item_name || item?.item?.name || item?.item_name ||
                              item?.description || `Item #${item?.item_id || '-'}`}
                          </p>
                        </td>
                        <td className="px-4 py-3.5 text-center font-semibold text-slate-500 text-sm">{item?.item_id || '-'}</td>
                        <td className="px-4 py-3.5 text-slate-500 text-sm">{item?.item?.sku || item?.item?.code || item?.sku || item?.code || '-'}</td>
                        <td className="px-4 py-3.5 text-center font-semibold text-slate-500">{totalQty}</td>
                        <td className="px-4 py-3.5 text-center font-bold text-emerald-700">{receivedQty}</td>
                        <td className="px-4 py-3.5 text-center font-bold">
                          {overQty > 0 ? (
                            <span className="inline-flex items-center gap-1 text-rose-600">
                              <span className="material-symbols-outlined text-[14px]" data-icon="arrow_upward">arrow_upward</span>
                              {overQty}
                            </span>
                          ) : (
                            <span className={cumulativeBalanceQty > 0 ? 'text-amber-700' : 'text-emerald-700'}>
                              {cumulativeBalanceQty}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right font-medium text-slate-600">{formatCurrency(unitPrice)}</td>
                        <td className="px-4 py-3.5 text-right font-bold text-slate-800">{formatCurrency(subtotal)}</td>
                        <td className="px-4 py-3.5 text-right font-bold rounded-r-xl">
                          {overQty > 0 ? (
                            <span className="text-rose-600">+{formatCurrency(overValue)}</span>
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

            {/* Totals Summary Panel */}
            <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4">
              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  { label: 'Total Qty',    value: grnTotals.totalQty,    color: 'text-on-surface',   bg: 'bg-white' },
                  { label: 'Received Qty', value: grnTotals.receivedQty, color: 'text-emerald-700',  bg: 'bg-emerald-50' },
                  {
                    label: 'Balance Qty',
                    value: grnTotals.balanceQty,
                    color: grnTotals.balanceQty > 0 ? 'text-amber-700' : 'text-emerald-700',
                    bg:    grnTotals.balanceQty > 0 ? 'bg-amber-50'    : 'bg-emerald-50',
                  },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} className={`${bg} rounded-xl px-4 py-3 border border-slate-200`}>
                    <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1">{label}</p>
                    <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5 text-sm text-left">
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="font-bold text-slate-800">{formatCurrency(grnTotals.subtotal)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Balance Value</span>
                  <span className={`font-bold ${grnTotals.balanceValue > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                    {formatCurrency(grnTotals.balanceValue)}
                  </span>
                </div>
                <div className="flex justify-between gap-4 pt-2 border-t border-slate-200">
                  <span className="font-bold text-on-surface">Grand Total</span>
                  <span className="text-lg font-black text-primary">{formatCurrency(grnTotals.grandTotal)}</span>
                </div>
              </div>
            </div>
          </div>

        </section>
      </div>
    </main>
  )
}
