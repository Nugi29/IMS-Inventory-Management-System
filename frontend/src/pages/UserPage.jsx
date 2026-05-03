import { useEffect, useMemo, useState, useContext } from 'react'
import { useUser } from '../services/useUser';
import { useLookup } from '../services/useLookup';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { AppContext } from '../context/AppContext';

export const UserPage = () => {
    const { users, isLoadingUsers } = useUser();
    const { userData } = useContext(AppContext);
    const { roles: roleLookup, statuses: statusLookup, loadLookupData } = useLookup();
    const navigate = useNavigate();

    const getLookupLabel = (item) => {
        if (typeof item === 'string') {
            return item
        }

        if (!item || typeof item !== 'object') {
            return ''
        }

        return item?.name || item?.role_name || item?.status_name || item?.role || item?.status || item?.label || item?.title || ''
    }


    const [searchTerm, setSearchTerm] = useState('')
    const [selectedRole, setSelectedRole] = useState('All Roles')
    const [selectedStatus, setSelectedStatus] = useState('All Status')
    const [currentPage, setCurrentPage] = useState(1)

    const ITEMS_PER_PAGE = 4

    const roles = useMemo(() => {
        const lookupRoles = roleLookup
            .map((role) => getLookupLabel(role))
            .filter(Boolean)

        if (lookupRoles.length) {
            return [...new Set(lookupRoles)]
        }

        return [...new Set(users.map((user) => user?.role?.name).filter(Boolean))]
    }, [roleLookup, users])

    const statuses = useMemo(() => {
        const lookupStatuses = statusLookup
            .map((status) => getLookupLabel(status))
            .filter(Boolean)

        if (lookupStatuses.length) {
            return [...new Set(lookupStatuses)]
        }

        return [...new Set(users.map((user) => user?.user_status?.name).filter(Boolean))]
    }, [statusLookup, users])

    useEffect(() => {
        loadLookupData()
    }, [loadLookupData])

    const filteredUsers = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase()

        return users.filter((user) => {
            const matchesSearch = !normalizedSearch
                || user?.username?.toLowerCase().includes(normalizedSearch)
                || user?.name?.toLowerCase().includes(normalizedSearch)

            const matchesRole = selectedRole === 'All Roles' || user?.role?.name === selectedRole
            const matchesStatus = selectedStatus === 'All Status' || user?.user_status?.name === selectedStatus

            return matchesSearch && matchesRole && matchesStatus
        })
    }, [users, searchTerm, selectedRole, selectedStatus])

    const totalPages = Math.max(1, Math.ceil(filteredUsers.length / ITEMS_PER_PAGE))
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    const endIndex = startIndex + ITEMS_PER_PAGE
    const paginatedUsers = filteredUsers.slice(startIndex, endIndex)

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages)
        }
    }, [currentPage, totalPages])


    const clearFilters = () => {
        setSearchTerm('')
        setSelectedRole('All Roles')
        setSelectedStatus('All Status')
        setCurrentPage(1)
    }

    const exportCsv = () => {
        if (!filteredUsers.length) {
            toast.error('No user data to export.')
            return
        }

        const rows = filteredUsers.map((user) => ({
            username: user.username || '',
            name: user.name || '',
            role: user.role?.name || '',
            status: user.user_status?.name || '',
            created_date: new Date(user.createdAt).toLocaleDateString(),
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
        link.setAttribute('download', `users-${Date.now()}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
    }

    return (
        <main className="p-4 sm:p-6 lg:p-8">

            {/* <!-- Filter Bar: Asymmetric Layout --> */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8 items-center">
                <div className="lg:col-span-8 flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <span className="material-symbols-outlined absolute left-4 top-10 -translate-y-1/2 text-slate-400" data-icon="search">search</span>
                        <input
                            className="w-full bg-white border border-slate-200 dark:border-slate-800 rounded-xl pl-12 pr-4 py-4 text-sm shadow-sm focus:ring-2 focus:ring-primary/20 outline-none"
                            placeholder="Filter by name or username"
                            type="text"
                            value={searchTerm}
                            onChange={(event) => {
                                setSearchTerm(event.target.value)
                                setCurrentPage(1)
                            }}
                            aria-label="Filter users by name or username"
                        />
                    </div>
                    <div className="relative">
                        <select
                            className="appearance-none bg-white border border-slate-200 dark:border-slate-800 rounded-xl px-6 pr-12 py-4 text-sm shadow-sm focus:ring-2 focus:ring-primary/20 outline-none min-w-50"
                            value={selectedRole}
                            onChange={(event) => {
                                setSelectedRole(event.target.value)
                                setCurrentPage(1)
                            }}
                            aria-label="Filter by role"
                        >
                            <option>All Roles</option>
                            {roles.map((role) => (
                                <option key={role} value={role}>{role}</option>
                            ))}
                        </select>
                    </div>
                    <div className="relative">
                        <select
                            className="appearance-none bg-white border border-slate-200 dark:border-slate-800 rounded-xl px-6 pr-12 py-4 text-sm shadow-sm focus:ring-2 focus:ring-primary/20"
                            value={selectedStatus}
                            onChange={(event) => {
                                setSelectedStatus(event.target.value)
                                setCurrentPage(1)
                            }}
                            aria-label="Filter by status"
                        >
                            <option>All Status</option>
                            {statuses.map((status) => (
                                <option key={status} value={status}>{status}</option>
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
                        onClick={() => navigate('/userform', { state: { mode: 'add' } })}
                        type="button"
                    >
                        <span className="material-symbols-outlined" data-icon="add">add</span>
                        Add New User
                    </button>
                </div>
            </div>
            {/* User Data Table Section */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

                {/* Table Header Info Bar */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/60">
                    <p className="text-xs font-semibold text-slate-500 tracking-wide uppercase">
                        {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''} found
                    </p>
                    <p className="text-xs text-slate-400">
                        Page <span className="font-bold text-slate-600">{currentPage}</span> of <span className="font-bold text-slate-600">{totalPages}</span>
                    </p>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">User Name</th>
                                <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Name</th>
                                <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Role</th>
                                <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-center">Status</th>
                                <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Created Date</th>
                                <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoadingUsers && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-16 text-center">
                                        <span className="material-symbols-outlined animate-spin text-primary text-2xl block mx-auto mb-2">sync</span>
                                        <p className="text-sm text-slate-500 font-medium">Loading users...</p>
                                    </td>
                                </tr>
                            )}
                            {!isLoadingUsers && paginatedUsers.map((user) => {
                                const statusName = user.user_status?.name || 'Unknown'
                                
                                const statusBadge = (() => {
                                    if (statusName === 'Active') return 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                    if (statusName === 'Inactive') return 'bg-slate-100 text-slate-500 border border-slate-200'
                                    return 'bg-slate-50 text-slate-600 border border-slate-200'
                                })()

                                return (
                                    <tr key={user.id} className="hover:bg-slate-50/80 transition-colors group">
                                        <td className="px-6 py-4">
                                            <p className="font-semibold text-sm text-slate-800 leading-snug">{user.username}</p>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600 font-medium">
                                            {user.name}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-tight px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md">
                                                {user.role?.name || '—'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`inline-flex items-center text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-tight ${statusBadge}`}>
                                                {statusName}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-500">
                                            {new Date(user.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                                <button className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors" aria-label={`Edit ${user.username}`} type="button" onClick={() => navigate('/userform', { state: { mode: 'update', user } })}>
                                                    <span className="material-symbols-outlined text-[18px]" data-icon="edit">edit</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                            {!isLoadingUsers && !filteredUsers.length && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-20 text-center">
                                        <span className="material-symbols-outlined text-4xl text-slate-300 block mb-3">person_off</span>
                                        <p className="text-sm font-semibold text-slate-600">No users found</p>
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
                            {filteredUsers.length ? `${startIndex + 1}–${Math.min(endIndex, filteredUsers.length)}` : 0}
                        </span>
                        {' '}of{' '}
                        <span className="font-bold text-slate-700">{filteredUsers.length}</span>
                        {' '}users
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
                            aria-label="Export users to CSV"
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
