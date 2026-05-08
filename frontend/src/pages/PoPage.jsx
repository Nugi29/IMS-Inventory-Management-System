import { useCallback, useEffect, useMemo, useState, useContext } from 'react'
import { AppContext } from '../context/AppContext'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useLookup } from '../services/useLookup'
import { usePo } from '../services/usePo'

const ALL_SUPPLIERS = 'All Suppliers'
const ALL_STATUS = 'All Status'
const ITEMS_PER_PAGE = 4

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
    const { userData } = useContext(AppContext)
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
        return (
            normalized === 'sent'
            || normalized.includes('partially received')
            || normalized.includes('partially recieved')
            || normalized.includes('fully received')
            || normalized.includes('fully recieved')
        )
    }

    const exportCsv = () => {
        if (!filteredPos.length) {
            toast.error('No purchase order data to export.')
            return
        }

        const rows = filteredPos.map((po) => ({
            id: po?.id ?? po?.po_id ?? '-',
            date: getDateLabel(po),
            supplier: getSupplierName(po),
            total_amount: getPoTotalAmount(po),
            status: getStatusLabel(po),
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
        link.setAttribute('download', `purchase-orders-${Date.now()}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
    }

    return (
        <main className="ml-0 mt-0 p-4 sm:p-6 lg:p-8">
            {/* Filter Bar: Asymmetric Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8 items-center">
                <div className="lg:col-span-8 flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <span className="material-symbols-outlined absolute left-4 top-10 -translate-y-1/2 text-slate-400" data-icon="search">search</span>
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

            {/* Items Data Table */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

                {/* Table Header Info Bar */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/60">
                    <p className="text-xs font-semibold text-slate-500 tracking-wide uppercase">
                        {filteredPos.length} purchase order{filteredPos.length !== 1 ? 's' : ''} found
                    </p>
                    <p className="text-xs text-slate-400">
                        Page <span className="font-bold text-slate-600">{safeCurrentPage}</span> of <span className="font-bold text-slate-600">{totalPages}</span>
                    </p>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[800px] md:min-w-0">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">ID</th>
                            <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Date</th>
                            <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Supplier</th>
                            <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">Total Amount</th>
                            <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-center">Status</th>
                            <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {isLoadingPos && (
                            <tr>
                                <td colSpan={6} className="px-6 py-16 text-center">
                                    <span className="material-symbols-outlined animate-spin text-primary text-2xl block mx-auto mb-2">sync</span>
                                    <p className="text-sm text-slate-500 font-medium">Loading purchase orders...</p>
                                </td>
                            </tr>
                        )}

                        {!isLoadingPos && paginatedPos.map((po, index) => {
                            const status = getStatusLabel(po)
                            const isDraft = isDraftStatus(status)
                            const showGrnAction = canCreateGrn(status)

                            return (
                                <tr
                                    key={po?.id || po?.po_id || po?.po_no || `${index}`}
                                    className="hover:bg-slate-50/80 transition-colors group"
                                >
                                    <td className="px-6 py-4">
                                        <p className="font-semibold text-sm text-slate-800 leading-snug">{po?.id ?? po?.po_id ?? '-'}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-sm text-slate-600">{getDateLabel(po)}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs shrink-0">
                                                {getSupplierTag(po)}
                                            </div>
                                            <span className="text-sm font-semibold text-slate-800">{getSupplierName(po)}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className="font-bold text-slate-800 text-sm">{getTotalLabel(po)}</span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`inline-flex items-center text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-tight ${getStatusChipClass(status)}`}>
                                            {status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                            {showGrnAction && (
                                                <button
                                                    className="p-1.5 rounded-lg hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-colors"
                                                    type="button"
                                                    aria-label={`Create GRN for ${getPoNumber(po)}`}
                                                    title="Open GRN"
                                                    onClick={() => navigate('/grns', { state: { source: 'po', po } })}
                                                >
                                                    <span className="material-symbols-outlined text-[18px]" data-icon="fact_check">fact_check</span>
                                                </button>
                                            )}
                                            <button
                                                className="p-1.5 rounded-lg hover:bg-primary/10 text-slate-400 hover:text-primary transition-colors"
                                                type="button"
                                                aria-label={`View ${getPoNumber(po)}`}
                                                title="View details"
                                                onClick={() => navigate('/poform', { state: { mode: 'view', po, poId: po?.id || po?.po_id || po?._id } })}
                                            >
                                                <span className="material-symbols-outlined text-[18px]" data-icon="visibility">visibility</span>
                                            </button>
                                            <button
                                                className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors"
                                                type="button"
                                                aria-label={`Edit ${getPoNumber(po)}`}
                                                title={isDraft ? 'Edit draft purchase order' : 'Edit purchase order'}
                                                onClick={() => navigate('/poform', { state: { mode: 'update', po, poId: po?.id || po?.po_id || po?._id } })}
                                            >
                                                <span className="material-symbols-outlined text-[18px]" data-icon="edit">edit</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}

                        {!isLoadingPos && !filteredPos.length && (
                            <tr>
                                <td colSpan={6} className="px-6 py-20 text-center">
                                    <span className="material-symbols-outlined text-4xl text-slate-300 block mb-3">shopping_cart</span>
                                    <p className="text-sm font-semibold text-slate-600">No purchase orders found</p>
                                    <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or search term.</p>
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
                            {filteredPos.length ? `${startIndex + 1}–${Math.min(endIndex, filteredPos.length)}` : 0}
                        </span>
                        {' '}of{' '}
                        <span className="font-bold text-slate-700">{filteredPos.length}</span>
                        {' '}purchase orders
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
                            aria-label="Export purchase orders to CSV"
                        >
                            <span className="material-symbols-outlined text-[16px]">download</span>
                            Export CSV
                        </button>
                    )}
                </div>
            </div>
        </main>
    )
}
