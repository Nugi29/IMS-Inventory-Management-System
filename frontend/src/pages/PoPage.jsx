import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLookup } from '../services/useLookup'
import { usePo } from '../services/usePo'

const ALL_SUPPLIERS = 'All Suppliers'
const ALL_STATUS = 'All Status'
const ITEMS_PER_PAGE = 2

const normalizeText = (value) => String(value || '').toLowerCase().replace(/\s+/g, ' ').trim()

const getLookupLabel = (item) => {
    if (typeof item === 'string') return item
    if (!item || typeof item !== 'object') return ''
    return item?.name || item?.status_name || item?.status || item?.label || item?.title || ''
}

const getLookupId = (item) => {
    if (!item || typeof item !== 'object') return null
    return item?.id ?? item?.supplier_id ?? item?.po_status_id ?? item?.status_id ?? null
}

const getPoDateValue = (po) => po?.order_date || po?.orderDate || po?.createdAt || po?.date || po?.created_at || null
const getPoTotalAmount = (po) => Number(po?.total_amount || po?.totalAmount || 0)

const buildLabelByIdMap = (lookupItems) => {
    const map = new Map()
    lookupItems.forEach((entry) => {
        const id = getLookupId(entry)
        const label = getLookupLabel(entry)
        if (id !== null && label) map.set(String(id), label)
    })
    return map
}

export const PoPage = () => {
    const { pos, isLoadingPos, reloadPos } = usePo()
    const navigate = useNavigate()
    const {
        suppliers: suppLookup = [],
        poStatuses: poStatusLookup = [],
        loadLookupData,
    } = useLookup()

    const [searchTerm, setSearchTerm] = useState('')
    const [selectedSupplier, setSelectedSupplier] = useState(ALL_SUPPLIERS)
    const [selectedPoStatus, setSelectedPoStatus] = useState(ALL_STATUS)
    const [currentPage, setCurrentPage] = useState(1)

    const suppliers = useMemo(() => {
        return [...new Set(suppLookup.map((supplier) => getLookupLabel(supplier)).filter(Boolean))]
    }, [suppLookup])

    const poStatuses = useMemo(() => {
        return [...new Set(poStatusLookup.map((status) => getLookupLabel(status)).filter(Boolean))]
    }, [poStatusLookup])

    const supplierLabelById = useMemo(() => buildLabelByIdMap(suppLookup), [suppLookup])

    const statusLabelById = useMemo(() => buildLabelByIdMap(poStatusLookup), [poStatusLookup])

    const getSupplierName = useCallback((po) => {
        const supplierId = po?.supplier_id ?? po?.supplierId ?? po?.supplier?.id
        const fromLookup = supplierId !== undefined && supplierId !== null ? supplierLabelById.get(String(supplierId)) : null
        return fromLookup || po?.supplier?.name || po?.supplier_name || '-'
    }, [supplierLabelById])

    const getStatusLabel = useCallback((po) => {
        const statusId = po?.po_status_id ?? po?.poStatusId ?? po?.po_status?.id
        const fromLookup = statusId !== undefined && statusId !== null ? statusLabelById.get(String(statusId)) : null
        return fromLookup || po?.po_status?.name || po?.status || 'Unknown'
    }, [statusLabelById])

    useEffect(() => {
        loadLookupData()
        reloadPos()
    }, [loadLookupData, reloadPos])

    const filteredPos = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase()

        return pos.filter((po) => {
            const poId = String(po?.id ?? po?.po_id ?? po?._id ?? '').toLowerCase()
            const poNumber = String(po?.po_no || po?.po_number || po?.name || '').toLowerCase()
            const supplierName = String(getSupplierName(po)).toLowerCase()

            const matchesSearch = !normalizedSearch
                || poId.includes(normalizedSearch)
                || poNumber.includes(normalizedSearch)
                || supplierName.includes(normalizedSearch)

            const poSupplier = getSupplierName(po)
            const poStatus = getStatusLabel(po)

            const matchesSupplier = selectedSupplier === ALL_SUPPLIERS || poSupplier === selectedSupplier
            const matchesStatus = selectedPoStatus === ALL_STATUS || poStatus === selectedPoStatus

            return matchesSearch && matchesSupplier && matchesStatus
        })
    }, [pos, searchTerm, selectedSupplier, selectedPoStatus, getSupplierName, getStatusLabel])

    const totalPages = Math.max(1, Math.ceil(filteredPos.length / ITEMS_PER_PAGE))
    const safeCurrentPage = Math.min(currentPage, totalPages)
    const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE
    const endIndex = startIndex + ITEMS_PER_PAGE
    const paginatedPos = filteredPos.slice(startIndex, endIndex)

    const poDecisionMetrics = useMemo(() => {
        const today = new Date()
        const currentMonth = today.getMonth()
        const currentYear = today.getFullYear()
        const spendBySupplier = new Map()

        let totalSpend = 0
        let thisMonthPurchases = 0
        let cancelledOrders = 0

        pos.forEach((po) => {
            const status = String(getStatusLabel(po)).toLowerCase()
            const total = Number(po?.total_amount || po?.totalAmount || 0)
            const supplierName = getSupplierName(po)
            const orderDateValue = getPoDateValue(po)
            const orderDate = orderDateValue ? new Date(orderDateValue) : null

            totalSpend += total

            if (
                orderDate
                && !Number.isNaN(orderDate.getTime())
                && orderDate.getMonth() === currentMonth
                && orderDate.getFullYear() === currentYear
            ) {
                thisMonthPurchases += 1
            }

            if (supplierName && supplierName !== '-') {
                const existing = spendBySupplier.get(supplierName) || 0
                spendBySupplier.set(supplierName, existing + total)
            }

            if (status === 'cancelled' || status === 'canceled') {
                cancelledOrders += 1
            }
        })

        const avgOrderValue = pos.length ? totalSpend / pos.length : 0

        let topSupplier = '-'
        let topSupplierSpend = 0
        spendBySupplier.forEach((value, supplier) => {
            if (value > topSupplierSpend) {
                topSupplierSpend = value
                topSupplier = supplier
            }
        })

        return {
            thisMonthPurchases,
            cancelledOrders,
            avgOrderValue,
            topSupplier,
        }
    }, [pos, getSupplierName, getStatusLabel])

    const clearFilters = () => {
        setSearchTerm('')
        setSelectedSupplier(ALL_SUPPLIERS)
        setSelectedPoStatus(ALL_STATUS)
        setCurrentPage(1)
    }

    const getPoNumber = (po) => po?.po_no || po?.po_number || po?.name || `${po?.id || 'N/A'}`

    const getDateLabel = (po) => {
        const rawDate = getPoDateValue(po)
        if (!rawDate) return '-'
        const date = new Date(rawDate)
        return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString()
    }

    const getSupplierTag = (po) => {
        const name = getSupplierName(po)
        if (!name || name === '-') return 'NA'
        const words = name.split(' ').filter(Boolean)
        if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
        return `${words[0][0] || ''}${words[1][0] || ''}`.toUpperCase()
    }

    const getTotalLabel = (po) => {
        const total = getPoTotalAmount(po)
        return `Rs ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }

    const getStatusChipClass = (status) => {
        const normalized = normalizeText(status)

        if (normalized.includes('fully received') || normalized.includes('fully recieved')) {
            return 'bg-emerald-100 text-emerald-700'
        }
        if (normalized.includes('partially received') || normalized.includes('partially recieved')) {
            return 'bg-teal-100 text-teal-700'
        }
        if (normalized === 'sent' || normalized.includes('sent')) {
            return 'bg-blue-100 text-blue-700'
        }
        if (normalized === 'draft') {
            return 'bg-amber-100 text-amber-700'
        }
        if (normalized === 'cancelled' || normalized === 'canceled') {
            return 'bg-rose-100 text-rose-700'
        }
        return 'bg-slate-100 text-slate-400'
    }

    const isDraftStatus = (status) => normalizeText(status) === 'draft'
    const canCreateGrn = (status) => {
        const normalized = normalizeText(status)
        return normalized.includes('fully received') || normalized.includes('partially received')
    }

    return (
        <main className="ml-0 mt-0 p-4 sm:p-6 lg:p-8">
            {/* Filter Bar: Asymmetric Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8 items-center">
                <div className="lg:col-span-8 flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <span className="material-symbols-outlined absolute left-4 top-10 -translate-y-1/2 text-slate-400" data-icon="filter_list">filter_list</span>
                        <input
                            className="w-full bg-white border border-slate-200 dark:border-slate-800 rounded-xl pl-12 pr-4 py-4 text-sm shadow-sm focus:ring-2 focus:ring-primary/20 outline-none"
                            placeholder="Filter by PO Number or ID..."
                            type="text"
                            value={searchTerm}
                            onChange={(event) => {
                                setSearchTerm(event.target.value)
                                setCurrentPage(1)
                            }}
                            aria-label="Filter PO Number or ID"
                        />
                    </div>
                    <div className="relative">
                        <select
                            className="appearance-none bg-white border border-slate-200 dark:border-slate-800 rounded-xl px-6 pr-12 py-4 text-sm shadow-sm focus:ring-2 focus:ring-primary/20 outline-none min-w-50"
                            value={selectedPoStatus}
                            onChange={(event) => {
                                setSelectedPoStatus(event.target.value)
                                setCurrentPage(1)
                            }}
                            aria-label="Filter by Status"
                        >
                            <option value={ALL_STATUS}>All Statuses</option>
                            {poStatuses.map((category) => (
                                <option key={category} value={category}>{category}</option>
                            ))}
                        </select>
                    </div>
                    <div className="relative">
                        <select
                            className="appearance-none bg-white border border-slate-200 dark:border-slate-800 rounded-xl px-6 pr-12 py-4 text-sm shadow-sm focus:ring-2 focus:ring-primary/20 outline-none min-w-50"
                            value={selectedSupplier}
                            onChange={(event) => {
                                setSelectedSupplier(event.target.value)
                                setCurrentPage(1)
                            }}
                            aria-label="Filter by Supplier"
                        >
                            <option value={ALL_SUPPLIERS}>All Suppliers</option>
                            {suppliers.map((supplier) => (
                                <option key={supplier} value={supplier}>{supplier}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="lg:col-span-4 flex items-center justify-between gap-3">
                    <button
                        className="px-4 py-3 rounded-xl font-semibold text-sm border border-slate-200 bg-white text-slate-600 hover:text-primary hover:border-primary/40 transition-colors"
                        onClick={clearFilters}
                        type="button"
                    >
                        Reset Filters
                    </button>
                    <button
                        className="bg-blue-600 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 shadow-sm hover:bg-blue-700 transition-all active:scale-95 duration-150 whitespace-nowrap"
                        onClick={() => navigate('/poform', { state: { mode: 'add' } })}
                    >
                        <span className="material-symbols-outlined" data-icon="add">add</span>
                        New Purchase order
                    </button>
                </div>
            </div>

            {/* Data Table Section */}
            <div className="bg-white border border-slate-200 dark:border-slate-800 rounded-4xl shadow-sm overflow-hidden p-2">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-separate border-spacing-y-1">
                        <thead>
                            <tr className="text-on-surface-variant">
                                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-wider font-label">ID</th>
                                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-wider font-label">Date</th>
                                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-wider font-label">Supplier</th>
                                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-wider font-label">Total Amount</th>
                                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-wider font-label text-center">Status</th>
                                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-wider font-label text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="space-y-2">
                            {isLoadingPos && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-10 text-center text-slate-500">Loading purchase orders...</td>
                                </tr>
                            )}

                            {!isLoadingPos && paginatedPos.map((po, index) => {
                                const status = getStatusLabel(po)
                                const rowBg = index % 2 === 1 ? 'bg-surface-container-low/30' : ''
                                const isDraft = isDraftStatus(status)
                                const showGrnAction = canCreateGrn(status)

                                return (
                                    <tr key={po?.id || po?.po_id || po?.po_no || `${index}`} className={`bg-slate-50/50 ${rowBg} hover:bg-slate-100/50 transition-colors group`}>
                                        <td className="px-6 py-4 rounded-l-xl text-sm font-bold text-slate-600">{po?.id ?? po?.po_id ?? '-'}</td>
                                        <td className="px-6 py-4 text-sm text-slate-600">{getDateLabel(po)}</td>
                                        <td className="px-6 py-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">{getSupplierTag(po)}</div>
                                                <span className="text-sm font-semibold text-on-surface">{getSupplierName(po)}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-headline font-extrabold">{getTotalLabel(po)}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest ${getStatusChipClass(status)}`}>{status}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right rounded-r-xl">
                                            <div className="flex items-center justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                {showGrnAction && (
                                                    <button
                                                        className="p-2 hover:bg-white rounded-lg transition-colors text-emerald-600 hover:text-emerald-700"
                                                        type="button"
                                                        aria-label={`Create GRN for ${getPoNumber(po)}`}
                                                        title="Create GRN"
                                                        onClick={() => navigate('/grn', { state: { source: 'po', po } })}
                                                    >
                                                        <span className="material-symbols-outlined text-xl" data-icon="fact_check">fact_check</span>
                                                    </button>
                                                )}
                                                <button
                                                    className="p-2 hover:bg-white rounded-lg transition-colors text-slate-400 hover:text-primary"
                                                    type="button"
                                                    aria-label={`View ${getPoNumber(po)}`}
                                                    onClick={() => navigate('/poform', { state: { mode: 'view', po, poId: po?.id || po?.po_id || po?._id } })}
                                                >
                                                    <span className="material-symbols-outlined text-xl" data-icon="visibility">visibility</span>
                                                </button>
                                                <button
                                                    className="p-2 hover:bg-white rounded-lg transition-colors text-slate-400 hover:text-primary"
                                                    type="button"
                                                    aria-label={`Edit ${getPoNumber(po)}`}
                                                    title={isDraft ? 'Edit draft purchase order' : 'Edit purchase order'}
                                                    onClick={() => navigate('/poform', { state: { mode: 'update', po, poId: po?.id || po?.po_id || po?._id } })}
                                                >
                                                    <span className="material-symbols-outlined text-xl" data-icon="edit">edit</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}

                            {!isLoadingPos && !filteredPos.length && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-14 text-center text-slate-500">
                                        <p className="text-sm font-semibold text-on-surface">No purchase orders found</p>
                                        <p className="text-xs mt-1">Try changing your filters or reset them to view all purchase orders.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between p-6 gap-4 mt-2">
                    <p className="text-xs text-slate-500 font-medium font-label">
                        Showing <span className="font-bold text-on-surface">{filteredPos.length ? `${startIndex + 1} - ${Math.min(endIndex, filteredPos.length)}` : 0}</span> of <span className="font-bold text-on-surface">{filteredPos.length}</span> items
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

            <section >
                {/* Summary Metrics */}
                <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-8">
                    <div className="p-4 bg-white border border-slate-200 dark:border-slate-800 rounded-2xl">
                        <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-2 font-label">This Month Purchases</p>
                        <p className="text-3xl font-headline font-extrabold text-on-surface">{poDecisionMetrics.thisMonthPurchases}</p>
                    </div>
                    <div className="p-4 bg-white border border-slate-200 dark:border-slate-800 rounded-2xl">
                        <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-2 font-label">Avg PO Value</p>
                        <p className="text-3xl font-headline font-extrabold text-on-surface">
                            Rs {poDecisionMetrics.avgOrderValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </p>
                    </div>
                    <div className="p-4 bg-emerald-50/60 border border-emerald-200 dark:border-emerald-800 rounded-2xl">
                        <p className="text-[10px] uppercase font-bold tracking-widest text-emerald-700 mb-2 font-label">Top Supplier</p>
                        <div className="flex items-center gap-3">
                            <p className="text-2xl font-headline font-extrabold text-emerald-700">{poDecisionMetrics.topSupplier}</p>
                        </div>
                    </div>
                    <div className="p-4 bg-red-50/60 border border-red-200 dark:border-red-800 rounded-2xl">
                        <p className="text-[10px] uppercase font-bold tracking-widest text-red-600 mb-2 font-label">Cancelled Orders</p>
                        <p className="text-3xl font-headline font-extrabold text-red-600">{poDecisionMetrics.cancelledOrders}</p>
                    </div>
                </div>
            </section>

        </main>
    )
}
