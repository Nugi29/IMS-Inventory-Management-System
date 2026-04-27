import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useItem } from '../services/useItem'
import { useLookup } from '../services/useLookup'
import { usePo } from '../services/usePo'

const SHIPPING_TERMS = [
    'FOB Origin',
    'FOB Destination',
    'CIF - Cost, Insurance and Freight',
    'EXW - Ex Works',
]

const formatDateInput = (value) => {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return date.toISOString().slice(0, 10)
}

const formatCurrency = (value) => {
    const amount = Number(value || 0)
    return `Rs ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const normalizeMatchValue = (value) => String(value || '').trim().toLowerCase()

const getOrderTimestamp = (dateInput) => {
    if (!dateInput) return new Date().toISOString()

    const [year, month, day] = String(dateInput).split('-').map(Number)
    if (!year || !month || !day) return new Date().toISOString()

    const now = new Date()
    const localDateTime = new Date(
        year,
        month - 1,
        day,
        now.getHours(),
        now.getMinutes(),
        now.getSeconds(),
        now.getMilliseconds(),
    )

    return localDateTime.toISOString()
}

const PO_OVERRIDE_KEY_PREFIX = 'po_form_override_'

const getPoOverride = (poId) => {
    if (!poId) return null
    try {
        const raw = window.sessionStorage.getItem(`${PO_OVERRIDE_KEY_PREFIX}${poId}`)
        if (!raw) return null
        const parsed = JSON.parse(raw)
        return parsed && typeof parsed === 'object' ? parsed : null
    } catch {
        return null
    }
}

const setPoOverride = (poId, payload) => {
    if (!poId || !payload) return
    try {
        window.sessionStorage.setItem(`${PO_OVERRIDE_KEY_PREFIX}${poId}`, JSON.stringify(payload))
    } catch {
        // Ignore storage failures and keep normal UX flow.
    }
}

const buildPoLinePayloadItem = (item) => {
    const quantity = Number(item.quantity)
    const unitPrice = Number(item.unitPrice)
    const lineTotal = quantity * unitPrice

    return {
        item_id: Number(item.itemId),
        item_description: item.description.trim(),
        sku: item.sku.trim(),
        quantity,
        ordered_quantity: quantity,
        po_quantity: quantity,
        qty: quantity,
        expected_price: unitPrice,
        unit_price: unitPrice,
        price: unitPrice,
        line_total: lineTotal,
        total_price: lineTotal,
    }
}

const buildPoLinePayload = (items) => items.map(buildPoLinePayloadItem)

const scoreLineItemArray = (arrayValue) => {
    if (!Array.isArray(arrayValue) || !arrayValue.length) return -1

    let score = 0
    const sample = arrayValue.slice(0, Math.min(arrayValue.length, 5))

    sample.forEach((entry) => {
        if (!entry || typeof entry !== 'object') return

        if (entry.item_id != null || entry.itemId != null || entry.item?.id != null) score += 2
        if (entry.ordered_quantity != null || entry.po_quantity != null || entry.qty != null || entry.quantity != null || entry.pivot?.quantity != null) score += 3
        if (entry.expected_price != null || entry.unit_price != null || entry.price != null || entry.unitPrice != null || entry.pivot?.unit_price != null) score += 2
        if (entry.line_total != null || entry.total_price != null) score += 1
    })

    return score
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

const normalizeLineItem = (item, index) => ({
    key: String(item?.id || item?.po_item_id || item?.item_id || item?.item?.id || `line-${index + 1}`),
    itemId: String(item?.item_id || item?.item?.item_id || item?.item?.id || item?.itemId || item?.product_id || item?.inventory_item_id || item?.stock_item_id || item?.pivot?.item_id || item?.pivot?.itemId || ''),
    description: item?.description || item?.item_description || item?.item_name || item?.item?.item_name || item?.item?.name || item?.name || '',
    sku: item?.sku || item?.item_code || item?.itemCode || item?.item?.sku || item?.item?.item_code || item?.item?.itemCode || item?.code || '',
    quantity: Number(item?.ordered_quantity ?? item?.po_quantity ?? item?.qty ?? item?.quantity ?? item?.pivot?.ordered_quantity ?? item?.pivot?.po_quantity ?? item?.pivot?.qty ?? item?.pivot?.quantity ?? 0),
    unitPrice: Number(item?.expected_price ?? item?.unit_price ?? item?.price ?? item?.unitPrice ?? item?.pivot?.expected_price ?? item?.pivot?.unit_price ?? item?.pivot?.price ?? item?.pivot?.unitPrice ?? 0),
})

const emptyLineItem = (index) => ({
    key: `line-${Date.now()}-${index}`,
    itemId: '',
    description: '',
    sku: '',
    quantity: 0,
    unitPrice: 0,
})

const createClearedLineItem = (line) => ({
    ...line,
    itemId: '',
    description: '',
    sku: '',
    quantity: 0,
    unitPrice: 0,
})

const getLookupLabel = (item) => {
    if (typeof item === 'string') return item
    if (!item || typeof item !== 'object') return ''
    return item?.name || item?.supplier_name || item?.status_name || item?.label || item?.title || ''
}

const getLookupId = (item) => {
    if (!item || typeof item !== 'object') return ''
    return item?.id ?? item?.supplier_id ?? item?.po_status_id ?? item?.status_id ?? item?.value ?? item?.key ?? ''
}

const getItemId = (item) => item?.id ?? item?.item_id ?? item?._id ?? ''
const getItemLabel = (item) => item?.item_name || item?.name || item?.item_description || item?.description || ''
const getItemSku = (item) => item?.sku || item?.item_code || ''
const getItemPrice = (item) => Number(item?.selling_price ?? item?.unit_price ?? item?.price ?? 0)
const getItemSupplierId = (item) => item?.supplier?.id ?? item?.supplier?.supplier_id ?? item?.supplier_id ?? item?.supplierId ?? ''

const ensureEmptyLineItem = (items) => {
    if (items.some((line) => !line.itemId)) {
        return items
    }

    return [...items, emptyLineItem(items.length + 1)]
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

export const PoForm = () => {
    const navigate = useNavigate()
    const location = useLocation()
    const { items, isLoadingItems, reloadItems } = useItem()

    const { pos, isLoadingPos, reloadPos, getPoById, addPo, updatePo, deletePo } = usePo()
    const {
        suppliers: supplierLookup = [],
        poStatuses: poStatusLookup = [],
        loadLookupData,
        isLoadingLookup,
    } = useLookup()

    const mode = location.state?.mode === 'update' ? 'update' : location.state?.mode === 'view' ? 'view' : 'add'
    const selectedPo = location.state?.po
    const preselectedItem = mode === 'add' ? location.state?.preselectedItem : null
    const selectedPoId = String(location.state?.poId || selectedPo?.id || selectedPo?.po_id || selectedPo?._id || '')
    const [freshPoById, setFreshPoById] = useState(null)
    const [isLoadingFreshPo, setIsLoadingFreshPo] = useState(false)
    const [hasAppliedPreselectedItem, setHasAppliedPreselectedItem] = useState(false)

    const latestPo = useMemo(() => {
        if (!selectedPoId) return null

        return pos.find((po) => String(po?.id || po?.po_id || po?._id || '') === selectedPoId) || null
    }, [pos, selectedPoId])

    const effectivePo = useMemo(() => {
        if (mode === 'add') return selectedPo
        const basePo = freshPoById || latestPo
        if (!basePo || !selectedPoId) return basePo

        const override = getPoOverride(selectedPoId)
        if (!override) return basePo

        return {
            ...basePo,
            ...override,
            total_amount: override.total_amount ?? basePo.total_amount,
            po_items: override.po_items ?? override.items ?? basePo.po_items,
            line_items: override.line_items ?? override.items ?? basePo.line_items,
            items: override.items ?? basePo.items,
        }
    }, [mode, freshPoById, latestPo, selectedPo, selectedPoId])

    const [formData, setFormData] = useState({
        id: '',
        supplierId: '',
        poStatusId: '',
        orderDate: new Date().toISOString().slice(0, 10),
        notes: '',
        shippingTerms: SHIPPING_TERMS[0],
        searchTerm: '',
    })

    const [lineItems, setLineItems] = useState(() => [emptyLineItem(1)])
    const [pendingAction, setPendingAction] = useState(null)

    useEffect(() => {
        loadLookupData()
        reloadItems()
    }, [loadLookupData, reloadItems])

    useEffect(() => {
        if (mode === 'add') return
        reloadPos()
    }, [mode, reloadPos])

    useEffect(() => {
        let isCancelled = false

        const loadFreshPo = async () => {
            if (mode === 'add' || !selectedPoId) {
                setFreshPoById(null)
                return
            }

            setIsLoadingFreshPo(true)
            const po = await getPoById(selectedPoId)
            if (!isCancelled) {
                setFreshPoById(po)
                setIsLoadingFreshPo(false)
            }
        }

        loadFreshPo()

        return () => {
            isCancelled = true
        }
    }, [mode, selectedPoId, getPoById])

    useEffect(() => {
        if (!effectivePo || mode === 'add') return

        setFormData((prev) => ({
            ...prev,
            id: effectivePo?.id || effectivePo?.po_id || prev.id,
            supplierId: effectivePo?.supplier?.id || effectivePo?.supplier?.supplier_id || effectivePo?.supplier_id || effectivePo?.supplierId || prev.supplierId,
            poStatusId: effectivePo?.po_status?.id || effectivePo?.po_status_id || effectivePo?.poStatusId || prev.poStatusId,
            orderDate: formatDateInput(effectivePo?.createdAt || effectivePo?.order_date || effectivePo?.orderDate) || prev.orderDate,
            notes: effectivePo?.internal_notes || effectivePo?.internalNotes || effectivePo?.notes || '',
            shippingTerms: effectivePo?.shipping_terms || effectivePo?.shippingTerms || prev.shippingTerms,
        }))

        const normalized = getPoSourceItems(effectivePo).map(normalizeLineItem).map((line, index) => ({ ...line, key: `${line.key}-${index}` }))
        setLineItems(ensureEmptyLineItem(normalized.length ? normalized : [emptyLineItem(1)]))
    }, [effectivePo, mode])

    const isHydratingPo = mode !== 'add' && (isLoadingPos || isLoadingFreshPo) && !effectivePo

    const itemOptions = useMemo(() => {
        const mapped = items
            .map((item) => ({
                id: String(getItemId(item)),
                label: getItemLabel(item),
                sku: getItemSku(item),
                price: getItemPrice(item),
                supplierId: String(getItemSupplierId(item)),
            }))
            .filter((item) => item.id && item.label)

        return [...new Map(mapped.map((item) => [item.id, item])).values()]
    }, [items])

    const supplierItemOptions = useMemo(() => {
        if (!formData.supplierId) return []
        return itemOptions.filter((item) => !item.supplierId || String(item.supplierId) === String(formData.supplierId))
    }, [itemOptions, formData.supplierId])

    const selectedItemIds = useMemo(
        () => lineItems.map((line) => String(line.itemId || '')).filter(Boolean),
        [lineItems],
    )

    const itemMap = useMemo(
        () => Object.fromEntries(itemOptions.map((item) => [String(item.id), item])),
        [itemOptions],
    )

    useEffect(() => {
        if (mode !== 'add') return
        if (hasAppliedPreselectedItem) return
        if (!preselectedItem || typeof preselectedItem !== 'object') {
            setHasAppliedPreselectedItem(true)
            return
        }
        if (!itemOptions.length) return

        const preselectedId = String(preselectedItem?.id || '')
        const preselectedSku = normalizeMatchValue(preselectedItem?.sku)
        const preselectedName = normalizeMatchValue(preselectedItem?.item_name || preselectedItem?.name || preselectedItem?.label)

        const matchedItem = itemOptions.find((option) => preselectedId && String(option.id) === preselectedId)
            || itemOptions.find((option) => preselectedSku && normalizeMatchValue(option.sku) === preselectedSku)
            || itemOptions.find((option) => preselectedName && normalizeMatchValue(option.label) === preselectedName)

        if (!matchedItem) {
            setHasAppliedPreselectedItem(true)
            return
        }

        const matchedSupplierId = String(
            preselectedItem?.supplier_id
            || preselectedItem?.supplierId
            || matchedItem?.supplierId
            || '',
        )

        const requestedQuantity = Number(preselectedItem?.suggestedQuantity ?? 1)
        const defaultQuantity = Number.isFinite(requestedQuantity) && requestedQuantity > 0 ? Math.floor(requestedQuantity) : 1

        setFormData((prev) => ({
            ...prev,
            supplierId: prev.supplierId || matchedSupplierId,
        }))

        setLineItems((prev) => {
            const existingLineIndex = prev.findIndex((line) => String(line.itemId) === String(matchedItem.id))
            const replacement = {
                key: existingLineIndex >= 0 ? prev[existingLineIndex].key : `line-${Date.now()}-preselected`,
                itemId: String(matchedItem.id),
                description: matchedItem.label,
                sku: matchedItem.sku,
                quantity:
                    existingLineIndex >= 0 && Number(prev[existingLineIndex].quantity) > 0
                        ? Number(prev[existingLineIndex].quantity)
                        : defaultQuantity,
                unitPrice:
                    existingLineIndex >= 0 && Number(prev[existingLineIndex].unitPrice) > 0
                        ? Number(prev[existingLineIndex].unitPrice)
                        : Number(matchedItem.price) || 0,
            }

            let nextItems

            if (existingLineIndex >= 0) {
                nextItems = prev.map((line, index) => (index === existingLineIndex ? replacement : line))
            } else {
                const emptyLineIndex = prev.findIndex((line) => !line.itemId)
                if (emptyLineIndex >= 0) {
                    nextItems = prev.map((line, index) => (index === emptyLineIndex ? replacement : line))
                } else {
                    nextItems = [replacement, ...prev]
                }
            }

            return ensureEmptyLineItem(nextItems)
        })

        setHasAppliedPreselectedItem(true)
    }, [mode, hasAppliedPreselectedItem, preselectedItem, itemOptions])

    useEffect(() => {
        if (!itemOptions.length) return

        setLineItems((prev) => prev.map((line) => {
            if (line.itemId && itemMap[String(line.itemId)]) {
                const selected = itemMap[String(line.itemId)]
                return {
                    ...line,
                    description: line.description || selected.label,
                    sku: line.sku || selected.sku,
                    unitPrice: Number(line.unitPrice) > 0 ? Number(line.unitPrice) : (Number(selected.price) || 0),
                }
            }

            const normalizedSku = normalizeMatchValue(line.sku)
            const normalizedDesc = normalizeMatchValue(line.description)

            const bySku = normalizedSku
                ? itemOptions.find((option) => normalizeMatchValue(option.sku) === normalizedSku)
                : null
            const byName = normalizedDesc
                ? itemOptions.find((option) => normalizeMatchValue(option.label) === normalizedDesc)
                : null

            const matched = bySku || byName
            if (!matched) {
                if (!line.itemId && !line.description && !line.sku) {
                    return {
                        ...line,
                        quantity: 0,
                        unitPrice: 0,
                    }
                }
                return line
            }

            return {
                ...line,
                itemId: String(matched.id),
                description: line.description || matched.label,
                sku: line.sku || matched.sku,
                unitPrice: Number(line.unitPrice) > 0 ? Number(line.unitPrice) : Number(matched.price) || 0,
            }
        }))
    }, [itemOptions, itemMap])

    const getResolvedSku = (line) => {
        if (line?.sku) return line.sku

        const byId = line?.itemId ? itemMap[String(line.itemId)] : null
        if (byId?.sku) return byId.sku

        if (line?.description) {
            const byName = itemOptions.find((option) => normalizeMatchValue(option.label) === normalizeMatchValue(line.description))
            if (byName?.sku) return byName.sku
        }

        return ''
    }

    useEffect(() => {
        if (!formData.supplierId) return

        setLineItems((prev) => prev.map((line) => {
            if (!line.itemId) return line

            const selectedItem = itemMap[String(line.itemId)]
            if (!selectedItem) return line

            if (!selectedItem.supplierId) {
                return line
            }

            if (String(selectedItem.supplierId) === String(formData.supplierId)) {
                return line
            }

            return createClearedLineItem(line)
        }))
    }, [formData.supplierId, itemMap])

    const suppliers = useMemo(() => {
        const lookupSuppliers = supplierLookup
            .map((supplier) => ({ id: getLookupId(supplier), label: getLookupLabel(supplier) }))
            .filter((supplier) => supplier.id && supplier.label)

        return [...new Map(lookupSuppliers.map((supplier) => [String(supplier.id), supplier])).values()]
    }, [supplierLookup])

    const poStatuses = useMemo(() => {
        const lookupStatuses = poStatusLookup
            .map((status) => ({ id: getLookupId(status), label: getLookupLabel(status) }))
            .filter((status) => status.id && status.label)

        return [...new Map(lookupStatuses.map((status) => [String(status.id), status])).values()]
    }, [poStatusLookup])

    const selectedStatusLabel = useMemo(() => {
        const selectedStatus = poStatuses.find((status) => String(status.id) === String(formData.poStatusId))
        return selectedStatus?.label || 'Draft'
    }, [poStatuses, formData.poStatusId])

    const isDraftStatusSelected = useMemo(
        () => String(selectedStatusLabel).toLowerCase().includes('draft'),
        [selectedStatusLabel],
    )

    const defaultSentStatusId = useMemo(() => {
        const sentStatus = poStatuses.find((status) => String(status.label).toLowerCase().includes('sent'))
        return sentStatus?.id || ''
    }, [poStatuses])

    const defaultDraftStatusId = useMemo(() => {
        const draftStatus = poStatuses.find((status) => String(status.label).toLowerCase().includes('draft'))
        return draftStatus?.id || ''
    }, [poStatuses])

    useEffect(() => {
        if (mode !== 'add') return
        if (formData.poStatusId) return

        if (!defaultSentStatusId) return

        setFormData((prev) => ({ ...prev, poStatusId: String(defaultSentStatusId) }))
    }, [mode, formData.poStatusId, defaultSentStatusId])

    const filteredItems = useMemo(() => {
        const search = formData.searchTerm.trim().toLowerCase()
        if (!search) return lineItems

        return lineItems.filter((item) => {
            const selectedItem = itemMap[String(item.itemId)]
            const desc = (selectedItem?.label || item.description || '').toLowerCase()
            const sku = item.sku.toLowerCase()
            return desc.includes(search) || sku.includes(search)
        })
    }, [lineItems, formData.searchTerm, itemMap])

    const totals = useMemo(() => {
        const subtotal = lineItems.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0)
        const computedTotal = subtotal
        const totalFromPo = Number(effectivePo?.total_amount ?? effectivePo?.totalAmount ?? effectivePo?.amount ?? 0)
        const hasLineValues = lineItems.some((item) => Number(item.quantity) > 0 && Number(item.unitPrice) > 0)
        const total = hasLineValues || mode === 'add' ? computedTotal : (totalFromPo || computedTotal)
        const units = lineItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)

        return { subtotal, total, units }
    }, [lineItems, effectivePo, mode])

    const isSavingDraft = pendingAction === 'save-draft'
    const isSending = pendingAction === 'send'
    const isSaving = pendingAction === 'save' || isSavingDraft || isSending
    const isDeleting = pendingAction === 'delete'
    const isBusy = isLoadingLookup || isLoadingItems || isLoadingPos || isLoadingFreshPo || isSaving || isDeleting
    const isReadOnly = mode === 'view'
    const isFormDisabled = isBusy || isReadOnly

    if (isHydratingPo) {
        return (
            <main className="h-full overflow-hidden bg-linear-to-br from-slate-100 via-white to-blue-50 p-3 sm:p-4">
                <section className="mx-auto flex h-full w-full max-w-7xl items-center justify-center rounded-3xl border border-slate-200/70 bg-white/95 shadow-xl shadow-slate-300/30 backdrop-blur-sm">
                    <div className="px-6 py-10 text-center">
                        <p className="text-sm font-semibold text-slate-700">Loading latest purchase order...</p>
                        <p className="mt-1 text-xs text-slate-500">Refreshing the record before edit.</p>
                    </div>
                </section>
            </main>
        )
    }

    const handleChange = (event) => {
        const { name, value } = event.target
        setFormData((prev) => ({ ...prev, [name]: value }))
    }

    const handleLineItemChange = (key, field, value) => {
        setLineItems((prev) => prev.map((item) => {
            if (item.key !== key) return item

            if (field === 'itemId') {
                const selectedItem = itemMap[String(value)]
                const duplicateItem = prev.some((line) => line.key !== key && String(line.itemId) === String(value))

                if (duplicateItem) {
                    toast.error('This item is already selected in another row')
                    return item
                }

                if (!selectedItem) {
                    return createClearedLineItem(item)
                }

                return {
                    ...item,
                    itemId: String(selectedItem.id),
                    description: selectedItem.label,
                    sku: selectedItem.sku,
                    unitPrice: Number(selectedItem.price) || 0,
                }
            }

            if (field === 'quantity' || field === 'unitPrice') {
                return { ...item, [field]: Number(value) }
            }
            return { ...item, [field]: value }
        }))

        if (field !== 'itemId' || !value) return

        setLineItems((prev) => {
            const hasEmptyLine = prev.some((line) => !line.itemId)
            if (hasEmptyLine) return prev
            return [...prev, emptyLineItem(prev.length + 1)]
        })
    }

    const handleRemoveItem = (key) => {
        setLineItems((prev) => {
            const nextItems = prev.filter((item) => item.key !== key)
            if (!nextItems.length) {
                return [emptyLineItem(1)]
            }

            return ensureEmptyLineItem(nextItems)
        })
    }

    const submitPo = async (event, { saveAsDraft = false, forceStatusId = '' } = {}) => {
        if (event) event.preventDefault()

        const validItems = lineItems.filter(
            (item) => item.itemId && Number(item.quantity) > 0 && Number(item.unitPrice) > 0,
        )

        if (!formData.supplierId) {
            toast.error('Please select supplier')
            return
        }

        if (!formData.orderDate) {
            toast.error('Order date is required')
            return
        }

        if (!validItems.length) {
            toast.error('Add at least one item with quantity and price greater than zero')
            return
        }

        let poStatusId = forceStatusId || formData.poStatusId

        if (mode === 'add') {
            poStatusId = saveAsDraft
                ? (defaultDraftStatusId || formData.poStatusId)
                : (defaultSentStatusId || formData.poStatusId)
        }

        if (!poStatusId) {
            toast.error(saveAsDraft ? 'Draft status is not available' : 'Please select purchase order status')
            return
        }

        const linePayload = buildPoLinePayload(validItems)

        const payload = {
            supplier_id: Number(formData.supplierId),
            po_status_id: Number(poStatusId),
            order_date: getOrderTimestamp(formData.orderDate),
            shipping_terms: formData.shippingTerms,
            internal_notes: formData.notes.trim(),
            total_amount: totals.total,
            items: linePayload,
            po_items: linePayload,
            line_items: linePayload,
            createdAt: getOrderTimestamp(formData.orderDate),
        }

        if (mode === 'update') {
            payload.id = Number(formData.id || effectivePo?.id || effectivePo?.po_id)
            if (!payload.id) {
                toast.error('Missing purchase order id for update')
                return
            }
        }

        const nextAction = forceStatusId ? 'send' : (saveAsDraft ? 'save-draft' : 'save')
        setPendingAction(nextAction)
        let response
        try {
            response = mode === 'update' ? await updatePo(payload) : await addPo(payload)
        } finally {
            setPendingAction(null)
        }

        if (!response.success) {
            toast.error(response.message)
            return
        }

        if (mode === 'update' && payload.id) {
            setPoOverride(String(payload.id), payload)
        }

        toast.success(response.message)
        navigate('/po')
    }

    const handleDelete = async () => {
        const poId = Number(formData.id || effectivePo?.id || effectivePo?.po_id)

        if (!poId) {
            toast.error('Missing purchase order id for deletion')
            return
        }

        if (!window.confirm('Are you sure you want to delete this purchase order? This action cannot be undone.')) {
            return
        }

        setPendingAction('delete')
        let response
        try {
            response = await deletePo({ id: poId })
        } finally {
            setPendingAction(null)
        }

        if (!response.success) {
            toast.error(response.message)
            return
        }

        toast.success(response.message)
        navigate('/po')
    }

    return (
        <main className="h-full overflow-hidden bg-linear-to-br from-slate-100 via-white to-blue-50 p-3 sm:p-4">
            <section className="mx-auto flex h-full w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-slate-200/70 bg-white/95 shadow-xl shadow-slate-300/30 backdrop-blur-sm">
                <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-7 sm:py-5">
                    <div>
                        <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                            {mode === 'update' ? 'Update Purchase Order' : 'Create Purchase Order'}
                        </h1>
                    </div>
                    <button
                        type="button"
                        onClick={() => navigate('/po')}
                        className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                    >
                        Cancel
                    </button>
                </header>

                <form className="flex h-full min-h-0 flex-col gap-3 px-5 py-3 sm:px-7 sm:py-4" onSubmit={submitPo}>
                    <div className="flex min-h-0 flex-1 flex-col gap-4">
                        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
                            {/* PO ID Section (Update mode only) */}
                            {mode === 'update' && (
                                <div className="space-y-3 border-b border-slate-200 pb-4">
                                    <div className="space-y-2">
                                        <label htmlFor="id" className="text-xs font-semibold uppercase tracking-wide text-slate-600">PO ID</label>
                                        <input
                                            id="id"
                                            type="text"
                                            name="id"
                                            value={formData.id}
                                            readOnly
                                            className="w-full bg-slate-100 border border-slate-300 rounded-lg px-4 py-2 text-sm text-slate-600 cursor-not-allowed"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Order Information */}
                            <div className="space-y-3 border-b border-slate-200 pb-4">
                                <h2 className="text-sm font-semibold text-slate-900">Order Information</h2>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label htmlFor="supplierId" className="text-xs font-semibold uppercase tracking-wide text-slate-600">Supplier *</label>
                                        <select
                                            id="supplierId"
                                            name="supplierId"
                                            value={formData.supplierId}
                                            onChange={handleChange}
                                            disabled={isFormDisabled}
                                            className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                                        >
                                            <option value="">Select a supplier...</option>
                                            {suppliers.map((supplier) => (
                                                <option key={supplier.id} value={supplier.id}>{supplier.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label htmlFor="orderDate" className="text-xs font-semibold uppercase tracking-wide text-slate-600">Order Date *</label>
                                        <input
                                            id="orderDate"
                                            className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                                            type="date"
                                            name="orderDate"
                                            value={formData.orderDate}
                                            onChange={handleChange}
                                            disabled={isFormDisabled}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Status</label>
                                        {mode === 'update' ? (
                                            <select
                                                id="poStatusId"
                                                name="poStatusId"
                                                value={formData.poStatusId}
                                                onChange={handleChange}
                                                disabled
                                                className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                                            >
                                                <option value="">Select status...</option>
                                                {poStatuses.map((status) => (
                                                    <option key={status.id} value={status.id}>{status.label}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <div className="w-full bg-slate-100 border border-slate-300 rounded-lg px-4 py-2 text-sm text-slate-700">
                                                {mode === 'add' ? 'Sent' : selectedStatusLabel}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Line Items */}
                            <div className="space-y-3 border-b border-slate-200 pb-4">
                                <h2 className="text-sm font-semibold text-slate-900">Line Items</h2>

                                <div className="relative mb-3">
                                    <span className="material-symbols-outlined absolute left-2 top-8 -translate-y-1/2 text-slate-400 text-lg" data-icon="search">search</span>
                                    <input
                                        className="w-full bg-white border border-slate-200 rounded-lg py-2 pl-10 pr-4 text-sm placeholder-slate-400 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                        placeholder="Search by SKU or Name..."
                                        type="text"
                                        name="searchTerm"
                                        value={formData.searchTerm}
                                        onChange={handleChange}
                                        disabled={isFormDisabled}
                                    />
                                </div>

                                <div className="overflow-x-auto rounded-lg border border-slate-200">
                                    <table className="w-full min-w-262.5 text-left text-sm">
                                        <thead>
                                            <tr className="bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wide border-b border-slate-200">
                                                <th className="py-3 px-4 min-w-90">Item</th>
                                                <th className="py-3 px-4">SKU</th>
                                                <th className="py-3 px-4">Unit Price</th>
                                                <th className="py-3 px-4">Quantity</th>
                                                <th className="py-3 px-4 text-right">Subtotal</th>
                                                <th className="py-3 px-4 text-center w-10"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-sm">
                                            {!filteredItems.length && (
                                                <tr>
                                                    <td colSpan={6} className="py-4 px-4 text-center text-slate-500">No matching line items</td>
                                                </tr>
                                            )}

                                            {filteredItems.map((item) => {
                                                const subtotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)
                                                const hasSelectedOption = supplierItemOptions.some((option) => String(option.id) === String(item.itemId))
                                                return (
                                                    <tr key={item.key} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                                                        <td className="py-4 px-4 min-w-90">
                                                            <div className="space-y-1">
                                                                <select
                                                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                                                                    value={item.itemId}
                                                                    onChange={(event) => handleLineItemChange(item.key, 'itemId', event.target.value)}
                                                                    disabled={isFormDisabled || !formData.supplierId}
                                                                >
                                                                    <option value="">{formData.supplierId ? 'Select an item...' : 'Select supplier first...'}</option>
                                                                    {item.itemId && !hasSelectedOption && (
                                                                        <option value={item.itemId}>
                                                                            {item.description || `Item #${item.itemId}`} ({item.sku || 'No SKU'})
                                                                        </option>
                                                                    )}
                                                                    {supplierItemOptions.map((option) => (
                                                                        <option
                                                                            key={option.id}
                                                                            value={option.id}
                                                                            disabled={selectedItemIds.includes(String(option.id)) && String(item.itemId) !== String(option.id)}
                                                                        >
                                                                            {option.label} ({option.sku || 'No SKU'}) - {formatCurrency(option.price)}
                                                                        </option>
                                                                    ))}
                                                                </select>

                                                            </div>
                                                        </td>
                                                        <td className="py-4 px-4 font-mono text-xs text-slate-500">
                                                            <input
                                                                className="w-full bg-transparent border-none rounded-lg py-1 px-0 focus:ring-0"
                                                                type="text"
                                                                value={getResolvedSku(item)}
                                                                onChange={(event) => handleLineItemChange(item.key, 'sku', event.target.value)}
                                                                placeholder="SKU"
                                                                disabled={isFormDisabled}
                                                            />
                                                        </td>
                                                        <td className="py-4 px-4">
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-slate-500">Rs</span>
                                                                <input
                                                                    className="w-24 bg-white border border-slate-200 rounded-lg py-1 px-2 text-center focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                                                    type="number"
                                                                    min="0"
                                                                    step="0.01"
                                                                    value={item.unitPrice}
                                                                    onChange={(event) => handleLineItemChange(item.key, 'unitPrice', event.target.value)}
                                                                    disabled={isFormDisabled}
                                                                />
                                                            </div>
                                                        </td>
                                                        <td className="py-4 px-4">
                                                            <input
                                                                className="w-20 bg-white border border-slate-200 rounded-lg py-1 px-2 text-center focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                                                type="number"
                                                                min="0"
                                                                value={item.quantity}
                                                                onChange={(event) => handleLineItemChange(item.key, 'quantity', event.target.value)}
                                                                disabled={isFormDisabled}
                                                            />
                                                        </td>
                                                        <td className="py-4 px-4 text-right font-semibold text-slate-900">{formatCurrency(subtotal)}</td>
                                                        <td className="py-4 px-4 text-center">
                                                            <button
                                                                className="text-red-600/60 hover:text-red-600 transition-colors disabled:opacity-40"
                                                                type="button"
                                                                onClick={() => handleRemoveItem(item.key)}
                                                                disabled={isFormDisabled || lineItems.length === 1}
                                                            >
                                                                <span className="material-symbols-outlined text-lg" data-icon="delete">delete</span>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                <p className="text-xs text-slate-500">
                                    A new empty line is added automatically after you select an item.
                                </p>
                            </div>

                        </div>
                        {/* Totals */}
                        <aside className="sticky bottom-0 z-10 w-full rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-10px_25px_-18px_rgba(15,23,42,0.7)] backdrop-blur">
                            <div className="flex flex-wrap items-center gap-3 text-sm">
                                <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5">
                                    <span className="text-slate-500">Subtotal</span>
                                    <span className="font-semibold text-slate-900">{formatCurrency(totals.subtotal)}</span>
                                </div>
                                <div className="ml-auto flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-1.5">
                                    <span className="font-semibold text-slate-900">Total</span>
                                    <span className="text-lg font-bold leading-none text-blue-600">{formatCurrency(totals.total)}</span>
                                </div>
                                <div className="text-xs text-slate-500">Items: {totals.units}</div>
                            </div>
                        </aside>
                    </div>

                    {/* Form Actions */}
                    <div className="flex justify-end border-t border-slate-200 pt-4 gap-3">
                        {mode === 'update' && (
                            <button
                                type="button"
                                onClick={handleDelete}
                                disabled={isBusy}
                                className="rounded-lg border border-red-200 bg-red-50 text-red-600 px-6 py-2 text-sm font-semibold transition hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isDeleting ? 'Deleting...' : 'Delete PO'}
                            </button>
                        )}

                        {!isReadOnly && (
                            <>
                                {mode === 'add' && (
                                    <button
                                        className="rounded-lg border border-slate-300 bg-white text-slate-700 px-6 py-2 text-sm font-semibold transition hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                        type="button"
                                        onClick={() => submitPo(undefined, { saveAsDraft: true })}
                                        disabled={isBusy}
                                    >
                                        {isSavingDraft ? 'Saving Draft...' : 'Save as Draft'}
                                    </button>
                                )}

                                {mode === 'update' && isDraftStatusSelected && (
                                    <button
                                        className="rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 px-6 py-2 text-sm font-semibold transition hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                        type="button"
                                        onClick={() => submitPo(undefined, { forceStatusId: defaultSentStatusId })}
                                        disabled={isBusy || !defaultSentStatusId}
                                    >
                                        {isSending ? 'Sending...' : 'Send PO'}
                                    </button>
                                )}

                                <button
                                    className="rounded-lg bg-blue-600 text-white px-6 py-2 text-sm font-semibold transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    type="submit"
                                    disabled={isBusy}
                                >
                                    {isSaving ? 'Saving...' : mode === 'add' ? 'Create PO' : 'Save Changes'}
                                </button>
                            </>
                        )}
                    </div>
                </form>
            </section>
        </main>
    )
}