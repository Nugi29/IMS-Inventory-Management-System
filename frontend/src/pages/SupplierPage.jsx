import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
    const { suppliers, isLoadingSuppliers, reloadSuppliers } = useSupplier()
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedStatus, setSelectedStatus] = useState('all')
    const [currentPage, setCurrentPage] = useState(1)

    const ITEMS_PER_PAGE = 6

    const handleRefresh = async () => {
        setSearchTerm('')
        setSelectedStatus('all')
        setCurrentPage(1)
        await reloadSuppliers()
    }

    const normalizedSuppliers = useMemo(() => {
        return suppliers.map((supplier) => {
            const normalizedStatus = normalizeSupplierStatus(
                supplier?.supplier_status?.name
                ?? supplier?.supplier_status?.status_name
                ?? supplier?.supplier_status?.label
                ?? supplier?.supplier_status?.title
                ?? supplier?.supplier_status?.status
                ?? supplier?.supplier_status?.value
                ?? supplier?.supplier_status
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

    const totalSuppliers = normalizedSuppliers.length
    const activeSuppliers = normalizedSuppliers.filter((supplier) => supplier.supplier_status === 'active').length
    const inactiveSuppliers = normalizedSuppliers.filter((supplier) => supplier.supplier_status === 'inactive').length

    const clearFilters = () => {
        setSearchTerm('')
        setSelectedStatus('all')
        setCurrentPage(1)
    }

    const getStatusClasses = (status) => {
        const normalizedStatus = status.toLowerCase()

        if (normalizedStatus === 'active') return 'bg-emerald-50 text-emerald-600'
        if (normalizedStatus === 'inactive') return 'bg-rose-50 text-rose-600'
        if (normalizedStatus === 'pending') return 'bg-amber-50 text-amber-700'

        return 'bg-slate-100 text-slate-600'
    }

    return (
        <main className="ml-0 mt-0 min-h-screen p-4 sm:p-6 lg:p-8">
            <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
                <button
                    type="button"
                    onClick={() => {
                        setSelectedStatus('all')
                        setCurrentPage(1)
                    }}
                    className={`p-6 bg-white border border-slate-200 dark:border-slate-800 rounded-2xl text-left shadow-sm transition ${selectedStatus === 'all' ? 'ring-2 ring-primary/20 border-primary/40' : 'hover:border-primary/30'}`}
                >
                    <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-2">Total Suppliers</p>
                    <p className="text-3xl font-headline font-extrabold text-on-surface">{totalSuppliers}</p>
                </button>
                <button
                    type="button"
                    onClick={() => {
                        setSelectedStatus('active')
                        setCurrentPage(1)
                    }}
                    className={`p-6 bg-white border border-slate-200 dark:border-slate-800 rounded-2xl text-left shadow-sm transition ${selectedStatus === 'active' ? 'ring-2 ring-primary/20 border-primary/40' : 'hover:border-primary/30'}`}
                >
                    <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-2">Active Suppliers</p>
                    <p className="text-3xl font-headline font-extrabold text-on-surface">{activeSuppliers}</p>
                </button>
                <button
                    type="button"
                    onClick={() => {
                        setSelectedStatus('inactive')
                        setCurrentPage(1)
                    }}
                    className={`p-6 bg-white border border-slate-200 dark:border-slate-800 rounded-2xl text-left shadow-sm transition ${selectedStatus === 'inactive' ? 'ring-2 ring-primary/20 border-primary/40' : 'hover:border-primary/30'}`}
                >
                    <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-2">Inactive Suppliers</p>
                    <p className="text-3xl font-headline font-extrabold text-on-surface">{inactiveSuppliers}</p>
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8 items-center">
                <div className="lg:col-span-8 flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <span className="material-symbols-outlined absolute left-4 top-10 -translate-y-1/2 text-slate-400" data-icon="filter_list">filter_list</span>
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
                    <button
                        className="px-4 py-3 rounded-xl font-semibold text-sm border border-slate-200 bg-white text-slate-600 hover:text-primary hover:border-primary/40 transition-colors"
                        type="button"
                        onClick={clearFilters}
                    >
                        Reset Filters
                    </button>
                </div>
                <button
                    className="bg-primary text-(--color-on-primary) px-5 py-3 rounded-xl font-bold flex items-center gap-2 shadow-sm hover:brightness-95 transition-all active:scale-95 duration-150 whitespace-nowrap"
                    type="button"
                    onClick={() => navigate('/supplierform', { state: { mode: 'add' } })}
                >
                    <span className="material-symbols-outlined">add</span>
                    Add New Supplier
                </button>
            </div>

            <div className="bg-white border border-slate-200 dark:border-slate-800 rounded-4xl shadow-sm overflow-hidden p-2">
                <div className="overflow-x-auto">
                    <table className="w-full border-separate border-spacing-y-1 text-left">
                        <thead>
                            <tr className="text-on-surface-variant">
                                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-wider font-label">Supplier</th>
                                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-wider font-label">Phone</th>
                                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-wider font-label">Email</th>
                                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-wider font-label">Address</th>
                                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-wider font-label text-center">Status</th>
                                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-wider font-label text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoadingSuppliers && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-10 text-center text-slate-500">
                                        Loading suppliers...
                                    </td>
                                </tr>
                            )}

                            {!isLoadingSuppliers && paginatedSuppliers.map((supplier) => (
                                <tr key={supplier.id || supplier.name} className="bg-slate-50/50 hover:bg-slate-100/50 transition-colors group">
                                    <td className="px-6 py-4 rounded-l-xl text-sm font-bold text-on-surface">
                                        <div className="flex items-center gap-4">
                                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-sm font-bold text-white">
                                                {supplier.name
                                                    .split(' ')
                                                    .filter(Boolean)
                                                    .map((part) => part[0])
                                                    .slice(0, 2)
                                                    .join('')
                                                    .toUpperCase() || 'S'}
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-on-surface">{supplier.name || '-'}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-500">{supplier.phone || '-'}</td>
                                    <td className="px-6 py-4 text-sm text-slate-500">{supplier.email || '-'}</td>
                                    <td className="px-6 py-4 text-sm text-slate-500">{supplier.address || '-'}</td>
                                    <td className="px-6 py-4 text-center">
                                         <span className={`inline-flex items-center gap-1.5 px-3 py-1 ${supplier.supplier_status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-600'} font-bold text-[10px] rounded-full uppercase tracking-tight font-label`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${supplier.supplier_status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`}></span>
                                            {formatSupplierStatus(supplier.supplier_status)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right rounded-r-xl">
                                        <div className="flex items-center justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                            <button
                                                className="p-2 hover:bg-white rounded-lg transition-colors text-slate-400 hover:text-primary"
                                                aria-label={`Edit ${supplier.name || 'supplier'}`}
                                                type="button"
                                                onClick={() => navigate('/supplierform', { state: { mode: 'update', supplier } })}
                                            >
                                                <span className="material-symbols-outlined text-[20px]">edit</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}

                            {!isLoadingSuppliers && !filteredSuppliers.length && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-14 text-center text-slate-500">
                                        <p className="text-sm font-semibold text-on-surface">No suppliers found</p>
                                        <p className="mt-1 text-xs">The backend returned no matching supplier records.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between p-6 gap-4 mt-2">
                    <p className="text-xs text-slate-500 font-medium font-label">
                        Showing <span className="font-bold text-on-surface">{filteredSuppliers.length ? `${startIndex + 1} - ${Math.min(endIndex, filteredSuppliers.length)}` : 0}</span> of <span className="font-bold text-on-surface">{filteredSuppliers.length}</span> suppliers
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className={`p-2 rounded-lg border border-slate-200 transition-all ${currentPage === 1 ? 'bg-slate-50 text-slate-400 cursor-not-allowed opacity-50' : 'bg-slate-50 text-slate-600 hover:bg-primary hover:text-white'}`}
                        >
                            <span className="material-symbols-outlined">chevron_left</span>
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
                            <span className="material-symbols-outlined">chevron_right</span>
                        </button>
                    </div>
                </div>
            </div>
        </main>
    )
}

export default SupplierPage