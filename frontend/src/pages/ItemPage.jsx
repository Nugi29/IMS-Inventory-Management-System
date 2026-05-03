import { useEffect, useMemo, useState, useContext } from 'react'
import { useItem } from '../services/useItem';
import { useLookup } from '../services/useLookup';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { AppContext } from '../context/AppContext';

const ITEM_STATUS_FALLBACK = {
    1: 'Active',
    2: 'Inactive',
    3: 'Discontinued',
    4: 'Out of Stock',
}

export const ItemPage = () => {
    const { items, isLoadingItems } = useItem();
    const { userData } = useContext(AppContext);
    const { categories: lookupCategories, itemStatuses, getItemStatuses } = useLookup();
    const navigate = useNavigate();

    useEffect(() => {
        getItemStatuses()
    }, [getItemStatuses])

    const getCategoryName = (item) => item?.category?.name || item?.category?.categoryName || item?.category_name || item?.categoryName || 'N/A'

    const getItemStatusName = (item) => {
        const itemStatusId = Number(item?.item_status_id ?? item?.item_status?.id)
        const lookupStatus = itemStatuses.find((status) => Number(status?.id) === itemStatusId)

        return lookupStatus?.label || item?.item_status?.name || item?.item_status_name || ITEM_STATUS_FALLBACK[itemStatusId] || 'Unknown'
    }


    const [searchTerm, setSearchTerm] = useState('')
    const [selectedCategory, setSelectedCategory] = useState('All Categories')
    const [selectedStatus, setSelectedStatus] = useState('All Statuses')
    const [currentPage, setCurrentPage] = useState(1)

    const ITEMS_PER_PAGE = 4

    const categories = useMemo(() => {
        const lookupNames = lookupCategories
            .map((category) => category?.label || category?.name || category?.categoryName || category?.category_name)
            .filter(Boolean)

        const itemNames = items
            .map((item) => getCategoryName(item))
            .filter((category) => category && category !== 'N/A')

        return [...new Set([...lookupNames, ...itemNames])].sort((a, b) => a.localeCompare(b))
    }, [lookupCategories, items])

    const filteredItems = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase()

        return items.filter((item) => {
            const matchesSearch = !normalizedSearch
                || item?.item_name?.toLowerCase().includes(normalizedSearch)
                || item?.sku?.toLowerCase().includes(normalizedSearch)

            const matchesCategory = selectedCategory === 'All Categories' || item?.category?.name === selectedCategory
                || item?.category?.categoryName === selectedCategory
                || item?.category_name === selectedCategory

            const itemStatusId = Number(item?.item_status_id ?? 0)
            const matchesStatus = selectedStatus === 'All Statuses'
                || itemStatuses.find((s) => Number(s.id) === itemStatusId)?.label === selectedStatus

            return matchesSearch && matchesCategory && matchesStatus
        })
    }, [items, searchTerm, selectedCategory, selectedStatus, itemStatuses])

    const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE))
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    const endIndex = startIndex + ITEMS_PER_PAGE
    const paginatedItems = filteredItems.slice(startIndex, endIndex)

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages)
        }
    }, [currentPage, totalPages])

    const clearFilters = () => {
        setSearchTerm('')
        setSelectedCategory('All Categories')
        setSelectedStatus('All Statuses')
        setCurrentPage(1)
    }

    const exportCsv = () => {
        if (!filteredItems.length) {
            toast.error('No item data to export.')
            return
        }

        const rows = filteredItems.map((item) => ({
            item_name: item.item_name || '',
            sku: item.sku || '',
            category: getCategoryName(item),
            supplier: item.supplier?.name || 'N/A',
            selling_price: parseFloat(item.selling_price || 0).toFixed(2),
            current_stock: item.current_stock ?? item.quantity ?? 0,
            status: getItemStatusName(item),
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
        link.setAttribute('download', `items-${Date.now()}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
    }

    return (
        <main className="p-4 sm:p-6 lg:p-8">
            {/* Filter Bar: Asymmetric Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8 items-center">
                <div className="lg:col-span-8 flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1 flex items-center">
                        <span className="material-symbols-outlined absolute left-4 text-slate-400" data-icon="search">search</span>
                        <input
                            className="w-full bg-white border border-slate-200 dark:border-slate-800 rounded-xl pl-12 pr-4 py-4 text-sm shadow-sm focus:ring-2 focus:ring-primary/20 outline-none"
                            placeholder="Filter by item name or code..."
                            type="text"
                            value={searchTerm}
                            onChange={(event) => {
                                setSearchTerm(event.target.value)
                                setCurrentPage(1)
                            }}
                            aria-label="Filter items by name or code"
                        />
                    </div>
                    <div className="relative">
                        <select
                            className="appearance-none bg-white border border-slate-200 dark:border-slate-800 rounded-xl px-6 pr-12 py-4 text-sm shadow-sm focus:ring-2 focus:ring-primary/20 outline-none min-w-50"
                            value={selectedCategory}
                            onChange={(event) => {
                                setSelectedCategory(event.target.value)
                                setCurrentPage(1)
                            }}
                            aria-label="Filter by category"
                        >
                            <option>All Categories</option>
                            {categories.map((category) => (
                                <option key={category} value={category}>{category}</option>
                            ))}
                        </select>
                    </div>
                    <div className="relative">
                        <select
                            className="appearance-none bg-white border border-slate-200 dark:border-slate-800 rounded-xl px-6 pr-12 py-4 text-sm shadow-sm focus:ring-2 focus:ring-primary/20 outline-none min-w-44"
                            value={selectedStatus}
                            onChange={(event) => {
                                setSelectedStatus(event.target.value)
                                setCurrentPage(1)
                            }}
                            aria-label="Filter by item status"
                        >
                            <option value="All Statuses">All Statuses</option>
                            {itemStatuses.map((status) => (
                                <option key={status.id} value={status.label}>{status.label}</option>
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
                        onClick={() => navigate('/itemform', { state: { mode: 'add' } })}
                    >
                        <span className="material-symbols-outlined" data-icon="add">add</span>
                        Add New Item
                    </button>
                </div>
            </div>

            {/* Items Data Table */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

                {/* Table Header Info Bar */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/60">
                    <p className="text-xs font-semibold text-slate-500 tracking-wide uppercase">
                        {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''} found
                    </p>
                    <p className="text-xs text-slate-400">
                        Page <span className="font-bold text-slate-600">{currentPage}</span> of <span className="font-bold text-slate-600">{totalPages}</span>
                    </p>
                </div>

                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Item</th>
                            <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Category</th>
                            <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Supplier</th>
                            <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">Price</th>
                            <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-center">Stock</th>
                            <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-center">Status</th>
                            <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {isLoadingItems && (
                            <tr>
                                <td colSpan={7} className="px-6 py-16 text-center">
                                    <span className="material-symbols-outlined animate-spin text-primary text-2xl block mx-auto mb-2">sync</span>
                                    <p className="text-sm text-slate-500 font-medium">Loading items...</p>
                                </td>
                            </tr>
                        )}

                        {!isLoadingItems && paginatedItems.map((item, index) => {
                            const statusName = getItemStatusName(item)
                            const statusId = Number(item?.item_status_id ?? 0)
                            const stock = item.current_stock ?? item.quantity ?? 0

                            const statusBadge = (() => {
                                if (statusId === 4 || statusName === 'Out of Stock') return 'bg-red-50 text-red-600 border border-red-200'
                                if (statusId === 2 || statusName === 'Inactive')     return 'bg-slate-100 text-slate-500 border border-slate-200'
                                if (statusId === 3 || statusName === 'Discontinued') return 'bg-orange-50 text-orange-600 border border-orange-200'
                                if (stock > 0 && stock <= (item.reorder_level ?? 10)) return 'bg-amber-50 text-amber-600 border border-amber-200'
                                return 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                            })()

                            return (
                                <tr
                                    key={item.id || index}
                                    className="hover:bg-slate-50/80 transition-colors group"
                                >
                                    {/* Item Name + SKU */}
                                    <td className="px-6 py-4">
                                        <p className="font-semibold text-sm text-slate-800 leading-snug">{item.item_name}</p>
                                        <p className="text-[11px] text-slate-400 mt-0.5 font-mono">{item.sku || '—'}</p>
                                    </td>

                                    {/* Category */}
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-tight px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md">
                                            {getCategoryName(item)}
                                        </span>
                                    </td>

                                    {/* Supplier */}
                                    <td className="px-6 py-4 text-sm text-slate-600 font-medium">
                                        {item.supplier?.name || <span className="text-slate-300">—</span>}
                                    </td>

                                    {/* Price */}
                                    <td className="px-6 py-4 text-right">
                                        <span className="font-bold text-slate-800 text-sm">Rs {parseFloat(item.selling_price || 0).toFixed(2)}</span>
                                    </td>

                                    {/* Stock Qty */}
                                    <td className="px-6 py-4 text-center">
                                        <span className={`font-bold text-sm ${stock === 0 ? 'text-red-500' : stock <= (item.reorder_level ?? 10) ? 'text-amber-500' : 'text-slate-700'}`}>
                                            {stock}
                                        </span>
                                        <span className="text-[10px] text-slate-400 ml-1">units</span>
                                    </td>

                                    {/* Status Badge */}
                                    <td className="px-6 py-4 text-center">
                                        <span className={`inline-flex items-center text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-tight ${statusBadge}`}>
                                            {statusName}
                                        </span>
                                    </td>

                                    {/* Actions */}
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                            <button
                                                className="p-1.5 rounded-lg hover:bg-primary/10 text-slate-400 hover:text-primary transition-colors"
                                                onClick={() => navigate('/itemform', { state: { mode: 'view', item } })}
                                                aria-label={`View ${item.item_name}`}
                                                title="View details"
                                                type="button"
                                            >
                                                <span className="material-symbols-outlined text-[18px]">visibility</span>
                                            </button>
                                            <button
                                                className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors"
                                                onClick={() => navigate('/itemform', { state: { mode: 'update', item } })}
                                                aria-label={`Edit ${item.item_name}`}
                                                title="Edit item"
                                                type="button"
                                            >
                                                <span className="material-symbols-outlined text-[18px]">edit</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}

                        {!isLoadingItems && !filteredItems.length && (
                            <tr>
                                <td colSpan={7} className="px-6 py-20 text-center">
                                    <span className="material-symbols-outlined text-4xl text-slate-300 block mb-3">inventory_2</span>
                                    <p className="text-sm font-semibold text-slate-600">No items found</p>
                                    <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or search term.</p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>

                {/* Pagination Footer */}
                <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 bg-slate-50/60 border-t border-slate-100 gap-4">

                    {/* Count */}
                    <p className="text-xs text-slate-500 font-medium shrink-0">
                        Showing{' '}
                        <span className="font-bold text-slate-700">
                            {filteredItems.length ? `${startIndex + 1}–${Math.min(endIndex, filteredItems.length)}` : 0}
                        </span>
                        {' '}of{' '}
                        <span className="font-bold text-slate-700">{filteredItems.length}</span>
                        {' '}items
                    </p>

                    {/* Page Numbers */}
                    <div className="flex items-center gap-1">
                        {/* Prev */}
                        <button
                            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            type="button"
                            className={`p-1.5 rounded-lg border transition-all ${currentPage === 1 ? 'border-slate-200 bg-white text-slate-300 cursor-not-allowed' : 'border-slate-200 bg-white text-slate-600 hover:bg-primary hover:text-white hover:border-primary'}`}
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
                                let start = Math.max(2, currentPage - half)
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
                                            className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-bold transition-all border ${page === currentPage ? 'bg-primary text-white border-primary shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-primary hover:text-white hover:border-primary'}`}
                                        >
                                            {page}
                                        </button>
                                    )
                            )
                        })()}

                        {/* Next */}
                        <button
                            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            type="button"
                            className={`p-1.5 rounded-lg border transition-all ${currentPage === totalPages ? 'border-slate-200 bg-white text-slate-300 cursor-not-allowed' : 'border-slate-200 bg-white text-slate-600 hover:bg-primary hover:text-white hover:border-primary'}`}
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
                            aria-label="Export items to CSV"
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

export default ItemPage;
