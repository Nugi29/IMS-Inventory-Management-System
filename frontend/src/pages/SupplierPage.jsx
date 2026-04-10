import { useMemo, useState } from 'react'
import { useSupplier } from '../services/useSupplier'

const SupplierPage = () => {
    const { suppliers, isLoadingSuppliers, reloadSuppliers } = useSupplier()
    const [searchTerm, setSearchTerm] = useState('')

    const handleRefresh = async () => {
        setSearchTerm('')
        await reloadSuppliers()
    }

    const normalizedSuppliers = useMemo(() => {
        return suppliers.map((supplier) => ({
            id: supplier?.id ?? supplier?.supplier_id ?? supplier?._id ?? '',
            name: supplier?.name ?? '',
            phone: supplier?.phone ?? '',
            email: supplier?.email ?? '',
            address: supplier?.address ?? '',
        }))
    }, [suppliers])

    const filteredSuppliers = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase()

        if (!normalizedSearch) {
            return normalizedSuppliers
        }

        return normalizedSuppliers.filter((supplier) => {
            return (
                supplier.name.toLowerCase().includes(normalizedSearch) ||
                supplier.phone.toLowerCase().includes(normalizedSearch) ||
                supplier.email.toLowerCase().includes(normalizedSearch) ||
                supplier.address.toLowerCase().includes(normalizedSearch)
            )
        })
    }, [normalizedSuppliers, searchTerm])

    const totalSuppliers = normalizedSuppliers.length
    const suppliersWithContact = normalizedSuppliers.filter((supplier) => supplier.phone || supplier.email).length
    const suppliersWithAddress = normalizedSuppliers.filter((supplier) => supplier.address).length

    return (
        <section className="min-h-screen p-4 sm:p-6 lg:p-8">
            <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Supplier Management</p>
                    <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                        Suppliers Directory
                    </h1>
                    <p className="mt-3 text-sm leading-6 text-slate-500 sm:text-base">
                        Live supplier data from the backend controller is shown here.
                    </p>
                </div>

                <button
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 active:scale-95"
                    type="button"
                    onClick={handleRefresh}
                >
                    <span className="material-symbols-outlined text-[20px]">refresh</span>
                    Refresh
                </button>
            </div>

            <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Suppliers</p>
                    <p className="mt-2 text-3xl font-bold text-slate-900">{totalSuppliers}</p>
                </div>
                {/* <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">With Contact</p>
                    <p className="mt-2 text-3xl font-bold text-emerald-600">{suppliersWithContact}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">With Address</p>
                    <p className="mt-2 text-3xl font-bold text-slate-500">{suppliersWithAddress}</p>
                </div> */}
            </div>

            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative max-w-xl flex-1">
                    <span className="material-symbols-outlined absolute left-4 top-9 -translate-y-1/2 text-slate-400">search</span>
                    <input
                        className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-12 pr-4 text-sm shadow-sm outline-none transition focus:ring-2 focus:ring-slate-200"
                        placeholder="Search supplier name, phone, email, or address..."
                        type="text"
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                    />
                </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full border-separate border-spacing-y-1 text-left">
                        <thead>
                            <tr className="text-slate-400">
                                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-wider">Supplier</th>
                                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-wider">Phone</th>
                                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-wider">Email</th>
                                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-wider">Address</th>
                                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-wider text-right">ID</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoadingSuppliers && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-16 text-center text-slate-500">
                                        Loading suppliers...
                                    </td>
                                </tr>
                            )}

                            {!isLoadingSuppliers && filteredSuppliers.map((supplier) => (
                                <tr key={supplier.id || supplier.name} className="group bg-slate-50/40 transition hover:bg-slate-50">
                                    <td className="px-6 py-4 rounded-l-2xl">
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
                                                <p className="text-sm font-semibold text-slate-900">{supplier.name || '-'}</p>
                                                {/* <p className="text-xs text-slate-400">Backend supplier record</p> */}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-700">{supplier.phone || '-'}</td>
                                    <td className="px-6 py-4 text-sm text-slate-700">{supplier.email || '-'}</td>
                                    <td className="px-6 py-4 text-sm text-slate-700">{supplier.address || '-'}</td>
                                    <td className="px-6 py-4 rounded-r-2xl text-right text-xs font-semibold uppercase tracking-wider text-slate-400">
                                        {supplier.id || '-'}
                                    </td>
                                </tr>
                            ))}

                            {!isLoadingSuppliers && !filteredSuppliers.length && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-16 text-center text-slate-500">
                                        <p className="text-sm font-semibold text-slate-900">No suppliers found</p>
                                        <p className="mt-1 text-xs">The backend returned no matching supplier records.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    )
}

export default SupplierPage