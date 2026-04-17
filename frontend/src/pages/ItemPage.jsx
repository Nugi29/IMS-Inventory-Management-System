import { useEffect, useMemo, useState } from 'react'
import { useItem } from '../services/useItem';
import { useLookup } from '../services/useLookup';
import { useNavigate } from 'react-router-dom';

const ITEM_STATUS_FALLBACK = {
    1: 'Active',
    2: 'Inactive',
    3: 'Discontinued',
    4: 'Out of Stock',
}

export const ItemPage = () => {
    const { items, isLoadingItems } = useItem();
    const { categories: lookupCategories, itemStatuses } = useLookup();
    const navigate = useNavigate();

    const getCategoryName = (item) => item?.category?.name || item?.category?.categoryName || item?.category_name || item?.categoryName || 'N/A'

    const getItemStatusName = (item) => {
        const itemStatusId = Number(item?.item_status_id ?? item?.item_status?.id)
        const lookupStatus = itemStatuses.find((status) => Number(status?.id) === itemStatusId)

        return lookupStatus?.label || item?.item_status?.name || item?.item_status_name || ITEM_STATUS_FALLBACK[itemStatusId] || 'Unknown'
    }


    const [searchTerm, setSearchTerm] = useState('')
    const [selectedCategory, setSelectedCategory] = useState('All Categories')
    const [currentPage, setCurrentPage] = useState(1)

    const ITEMS_PER_PAGE = 3

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

            return matchesSearch && matchesCategory
        })
    }, [items, searchTerm, selectedCategory])

    const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE))
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    const endIndex = startIndex + ITEMS_PER_PAGE
    const paginatedItems = filteredItems.slice(startIndex, endIndex)

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages)
        }
    }, [currentPage, totalPages])

    const totalCategories = categories.length
    const totalSkus = items.length
    const lowStockCount = items.filter((item) => item?.stock_status === 'Low').length
    const totalInventoryValue = items.reduce((sum, item) => sum + (item?.selling_price * item?.current_stock || 0), 0)

    const clearFilters = () => {
        setSearchTerm('')
        setSelectedCategory('All Categories')
        setCurrentPage(1)
    }

    return (
        <main className="ml-0 mt-0 p-4 sm:p-6 lg:p-8 min-h-screen">

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
                            className="appearance-none bg-white border border-slate-200 dark:border-slate-800 rounded-xl px-6 pr-12 py-4 text-sm shadow-sm focus:ring-2 focus:ring-primary/20 outline-none min-w-[200px]"
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
            <div className="bg-white border border-slate-200 dark:border-slate-800 rounded-[2rem] shadow-sm overflow-hidden p-2">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-separate border-spacing-y-1">
                        <thead>
                            <tr className="text-on-surface-variant">
                                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-wider font-label">Item Name</th>
                                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-wider font-label">Code</th>
                                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-wider font-label">Category</th>
                                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-wider font-label">Supplier</th>
                                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-wider font-label text-right">Selling Price</th>
                                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-wider font-label text-center">Stock Status</th>
                                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-wider font-label text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="space-y-2">
                            {isLoadingItems && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-10 text-center text-slate-500">
                                        Loading items...
                                    </td>
                                </tr>
                            )}
                            {paginatedItems.map((item, index) => (
                                <tr key={item.id || index} className="bg-slate-50/50 hover:bg-slate-100/50 transition-colors group">
                                    <td className="px-6 py-4 rounded-l-xl">
                                        <p className="font-bold text-sm text-on-surface">{item.item_name}</p>
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium text-slate-500">
                                        <p>{item.sku}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-[10px] font-bold uppercase tracking-tight px-3 py-1 bg-slate-200 dark:bg-slate-800 rounded-full text-slate-600 dark:text-slate-400 font-label">
                                            {getCategoryName(item)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600">
                                        {item.supplier?.name || 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold text-on-surface">
                                        Rs {parseFloat(item.selling_price || 0).toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 text-slate-600 font-bold text-[10px] rounded-full uppercase tracking-tight font-label">
                                            {getItemStatusName(item)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right rounded-r-xl">
                                        <div className="flex items-center justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                            <button 
                                                className="p-2 hover:bg-white rounded-lg transition-colors text-slate-400 hover:text-primary"
                                                onClick={() => navigate('/itemform', { state: { mode: 'view', item } })}
                                                aria-label={`View ${item.item_name}`}
                                                type="button"
                                            >
                                                <span className="material-symbols-outlined text-[20px]" data-icon="visibility">visibility</span>
                                            </button>
                                            <button 
                                                className="p-2 hover:bg-white rounded-lg transition-colors text-slate-400 hover:text-primary"
                                                onClick={() => navigate('/itemform', { state: { mode: 'update', item } })}
                                                aria-label={`Edit ${item.item_name}`}
                                                type="button"
                                            >
                                                <span className="material-symbols-outlined text-[20px]" data-icon="edit">edit</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {!filteredItems.length && !isLoadingItems && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-14 text-center text-slate-500">
                                        <p className="text-sm font-semibold text-on-surface">No items found</p>
                                        <p className="text-xs mt-1">Try changing your filters or reset them to view all items.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="flex flex-col sm:flex-row items-center justify-between p-6 gap-4 mt-2">
                    <p className="text-xs text-slate-500 font-medium font-label">Showing <span className="font-bold text-on-surface">{filteredItems.length ? `${startIndex + 1} - ${Math.min(endIndex, filteredItems.length)}` : 0}</span> of <span className="font-bold text-on-surface">{filteredItems.length}</span> items</p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className={`p-2 rounded-lg border border-slate-200 transition-all ${currentPage === 1 ? 'bg-slate-50 text-slate-400 cursor-not-allowed opacity-50' : 'bg-slate-50 text-slate-600 hover:bg-primary hover:text-white'}`}
                        >
                            <span className="material-symbols-outlined" data-icon="chevron_left">chevron_left</span>
                        </button>
                        <div className="flex items-center gap-1">
                            {Array.from({ length: totalPages }, (_, index) => {
                                const pageNumber = index + 1
                                const isActive = pageNumber === currentPage

                                return (
                                    <button
                                        key={pageNumber}
                                        onClick={() => setCurrentPage(pageNumber)}
                                        className={`w-8 h-8 rounded-lg text-xs font-bold ${isActive ? 'bg-primary text-white' : 'bg-slate-50 text-slate-600 hover:bg-primary hover:text-white border border-slate-200'}`}
                                    >
                                        {pageNumber}
                                    </button>
                                )
                            })}
                        </div>
                        <button
                            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            className={`p-2 rounded-lg border border-slate-200 transition-all ${currentPage === totalPages ? 'bg-slate-50 text-slate-400 cursor-not-allowed opacity-50' : 'bg-slate-50 text-slate-600 hover:bg-primary hover:text-white'}`}
                        >
                            <span className="material-symbols-outlined" data-icon="chevron_right">chevron_right</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Summary Metrics */}
            <div className="mt-12 grid grid-cols-1 md:grid-cols-4 gap-8">
                <div className="p-6 bg-white border border-slate-200 dark:border-slate-800 rounded-2xl">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-2 font-label">Total Categories</p>
                    <p className="text-3xl font-headline font-extrabold text-on-surface">{totalCategories}</p>
                </div>
                <div className="p-6 bg-white border border-slate-200 dark:border-slate-800 rounded-2xl">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-2 font-label">Total Items</p>
                    <p className="text-3xl font-headline font-extrabold text-on-surface">{totalSkus}</p>
                </div>
                <div className="p-6 bg-white border border-slate-200 dark:border-slate-800 rounded-2xl">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-tertiary mb-2 font-label">Low Stock Alerts</p>
                    <div className="flex items-center gap-3">
                        <p className="text-3xl font-headline font-extrabold text-tertiary">{lowStockCount}</p>
                        <span className="text-[10px] font-bold text-tertiary/60 bg-tertiary/10 px-2 py-0.5 rounded-md font-label">ACTION REQ.</span>
                    </div>
                </div>
                <div className="p-6 bg-blue-50/50 border border-blue-200 dark:border-blue-800 rounded-2xl">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-primary mb-2 font-label">Inventory Value</p>
                    <p className="text-3xl font-headline font-extrabold text-primary">Rs {totalInventoryValue.toFixed(2)}</p>
                </div>
            </div>
        </main>
    )
}

export default ItemPage;
