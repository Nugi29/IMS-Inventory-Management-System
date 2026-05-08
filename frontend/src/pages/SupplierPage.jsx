import { useEffect, useMemo, useState, useContext } from 'react'
import { AppContext } from '../context/AppContext'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useSupplier } from '../services/useSupplier'

const normalizeSupplierStatus = (status) => {
    if (status === null || status === undefined) {
        return 'unknown'
    }

    if (typeof status === 'boolean') {
        return status ? 'active' : 'inactive'
    }

    const value = String(status).trim().toLowerCase()

    if (!value) {
        return 'unknown'
    }

    if (['active', 'enabled', '1', 'true', 'yes'].includes(value)) {
        return 'active'
    }

    if (['inactive', 'disabled', '0', 'false', 'no'].includes(value)) {
        return 'inactive'
    }

    return value
}

const formatSupplierStatus = (status) => {
    if (!status || status === 'unknown') {
        return 'Unknown'
    }

    return status
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
}

const SupplierPage = () => {
    const navigate = useNavigate()
    const { userData } = useContext(AppContext)
    const { suppliers, isLoadingSuppliers } = useSupplier()
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedStatus, setSelectedStatus] = useState('all')
    const [currentPage, setCurrentPage] = useState(1)

    const ITEMS_PER_PAGE = 4

    const normalizedSuppliers = useMemo(() => {
        return suppliers.map((supplier) => {
            const normalizedStatus = normalizeSupplierStatus(
                supplier?.supplier_status?.name
            )

            const supplierStatusId = Number(
                supplier?.supplier_status?.id
                ?? supplier?.supplier_status_id
                ?? (normalizedStatus === 'inactive' ? 2 : normalizedStatus === 'active' ? 1 : 0)
            )

            return {
                id: supplier?.id ?? supplier?.supplier_id ?? supplier?._id ?? '',
                name: supplier?.name ?? '',
                phone: supplier?.phone ?? '',
                email: supplier?.email ?? '',
                address: supplier?.address ?? '',
                supplier_status: normalizedStatus,
                supplier_status_id: supplierStatusId,
            }
        })
    }, [suppliers])

    const statuses = useMemo(() => {
        const statusMap = new Map([
            ['active', 'Active'],
            ['inactive', 'Inactive'],
        ])

        normalizedSuppliers.forEach((supplier) => {
            const normalized = supplier.supplier_status

            if (!normalized) {
                return
            }

            statusMap.set(normalized, formatSupplierStatus(normalized))
        })

        return [...statusMap.values()]
    }, [normalizedSuppliers])

    const filteredSuppliers = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase()

        return normalizedSuppliers.filter((supplier) => {
            const supplierStatus = supplier.supplier_status
            const matchesSearch = !normalizedSearch || (
                supplier.name.toLowerCase().includes(normalizedSearch) ||
                supplier.phone.toLowerCase().includes(normalizedSearch) ||
                supplier.email.toLowerCase().includes(normalizedSearch) ||
                supplier.address.toLowerCase().includes(normalizedSearch) ||
                supplier.id.toString().toLowerCase().includes(normalizedSearch) ||
                supplierStatus.includes(normalizedSearch)
            )
            const matchesStatus = selectedStatus === 'all' || supplierStatus === selectedStatus

            return (
                matchesSearch && matchesStatus
            )
        })
    }, [normalizedSuppliers, searchTerm, selectedStatus])

    const totalPages = Math.max(1, Math.ceil(filteredSuppliers.length / ITEMS_PER_PAGE))
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    const endIndex = startIndex + ITEMS_PER_PAGE
    const paginatedSuppliers = filteredSuppliers.slice(startIndex, endIndex)

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages)
        }
    }, [currentPage, totalPages])

    const clearFilters = () => {
        setSearchTerm('')
        setSelectedStatus('all')
        setCurrentPage(1)
    }

    const exportCsv = () => {
        if (!filteredSuppliers.length) {
            toast.error('No supplier data to export.')
            return
        }

        const rows = filteredSuppliers.map((supplier) => ({
            name: supplier.name || '',
            phone: supplier.phone || '',
            email: supplier.email || '',
            address: supplier.address || '',
            status: formatSupplierStatus(supplier.supplier_status),
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
        link.setAttribute('download', `suppliers-${Date.now()}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
    }

    return (
        <main className="p-4 sm:p-6 lg:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8 items-center">
                <div className="lg:col-span-8 flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <span className="material-symbols-outlined absolute left-4 top-10 -translate-y-1/2 text-slate-400" data-icon="search">search</span>
                        <input
                            className="w-full bg-white border border-slate-200 dark:border-slate-800 rounded-xl pl-12 pr-4 py-4 text-sm shadow-sm focus:ring-2 focus:ring-primary/20 outline-none"
                            placeholder="Search supplier name, phone, email, or address..."
                            type="text"
                            value={searchTerm}
                            onChange={(event) => {
                                setSearchTerm(event.target.value)
                                setCurrentPage(1)
                            }}
                        />
                    </div>
                    <div className="relative">
                        <select
                            className="appearance-none bg-white border border-slate-200 dark:border-slate-800 rounded-xl px-6 pr-12 py-4 text-sm shadow-sm focus:ring-2 focus:ring-primary/20 outline-none min-w-50"
                            value={selectedStatus}
                            onChange={(event) => {
                                setSelectedStatus(event.target.value)
                                setCurrentPage(1)
                            }}
                            aria-label="Filter by supplier status"
                        >
                            <option value="all">All Status</option>
                            {statuses.map((status) => (
                                <option key={status} value={status.toLowerCase()}>{status}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="lg:col-span-4 flex items-center justify-between gap-3">
                    <button
                        className="px-4 py-3 rounded-xl font-semibold text-sm border border-slate-200 bg-white text-slate-600 hover:text-primary hover:border-primary/40 transition-colors"
                        type="button"
                        onClick={clearFilters}
                    >
                        Reset Filters
                    </button>
                    <button
                        className="bg-blue-600 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 shadow-sm hover:bg-blue-700 transition-all active:scale-95 duration-150 whitespace-nowrap"
                        type="button"
                        onClick={() => navigate('/supplierform', { state: { mode: 'add' } })}
                    >
                        <span className="material-symbols-outlined" data-icon="add">add</span>
                        New Supplier
                    </button>
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                {/* Table Header Info Bar */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/60">
                    <p className="text-xs font-semibold text-slate-500 tracking-wide uppercase">
                        {filteredSuppliers.length} supplier{filteredSuppliers.length !== 1 ? 's' : ''} found
                    </p>
                    <p className="text-xs text-slate-400">
                        Page <span className="font-bold text-slate-600">{currentPage}</span> of <span className="font-bold text-slate-600">{totalPages}</span>
                    </p>
                </div>

                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Supplier</th>
                            <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Phone</th>
                            <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Email</th>
                            <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Address</th>
                            <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-center">Status</th>
                            <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {isLoadingSuppliers && (
                            <tr>
                                <td colSpan={6} className="px-6 py-16 text-center">
                                    <span className="material-symbols-outlined animate-spin text-primary text-2xl block mx-auto mb-2">sync</span>
                                    <p className="text-sm text-slate-500 font-medium">Loading suppliers...</p>
                                </td>
                            </tr>
                        )}

                        {!isLoadingSuppliers && paginatedSuppliers.map((supplier) => (
                            <tr
                                key={supplier.id || supplier.name}
                                className="hover:bg-slate-50/80 transition-colors group"
                            >
                                <td className="px-6 py-4">
                                    <p className="font-semibold text-sm text-slate-800 leading-snug">{supplier.name || '—'}</p>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-600 font-medium">
                                    {supplier.phone || <span className="text-slate-300">—</span>}
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-600 font-medium">
                                    {supplier.email || <span className="text-slate-300">—</span>}
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-600 font-medium">
                                    {supplier.address || <span className="text-slate-300">—</span>}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <span className={`inline-flex items-center text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-tight ${supplier.supplier_status === 'active' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                                        {formatSupplierStatus(supplier.supplier_status)}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                        <button
                                            className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors"
                                            onClick={() => navigate('/supplierform', { state: { mode: 'update', supplier } })}
                                            aria-label={`Edit ${supplier.name}`}
                                            title="Edit supplier"
                                            type="button"
                                        >
                                            <span className="material-symbols-outlined text-[18px]">edit</span>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}

                        {!isLoadingSuppliers && !filteredSuppliers.length && (
                            <tr>
                                <td colSpan={6} className="px-6 py-20 text-center">
                                    <span className="material-symbols-outlined text-4xl text-slate-300 block mb-3">local_shipping</span>
                                    <p className="text-sm font-semibold text-slate-600">No suppliers found</p>
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
                            {filteredSuppliers.length ? `${startIndex + 1}–${Math.min(endIndex, filteredSuppliers.length)}` : 0}
                        </span>
                        {' '}of{' '}
                        <span className="font-bold text-slate-700">{filteredSuppliers.length}</span>
                        {' '}suppliers
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
                            aria-label="Export suppliers to CSV"
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


export default SupplierPage