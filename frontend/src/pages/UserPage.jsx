import { useEffect, useMemo, useState } from 'react'
import { useUser } from '../services/useUser';
import { useLookup } from '../services/useLookup';

export const UserPage = () => {
    const { users, isLoadingUsers } = useUser();
    const { roles: roleLookup, statuses: statusLookup, loadLookupData } = useLookup();

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

    const ITEMS_PER_PAGE = 2

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

    const activeCount = users.filter((user) => user?.user_status?.name === 'Active').length
    const inactiveCount = users.length - activeCount
    const adminCount = users.filter((user) => user?.role?.name === 'Admin').length

    const clearFilters = () => {
        setSearchTerm('')
        setSelectedRole('All Roles')
        setSelectedStatus('All Status')
        setCurrentPage(1)
    }

    return (
        <main className="ml-0 mt-0 p-4 sm:p-6 lg:p-8 min-h-screen">

            {/* <!-- Filter Bar: Asymmetric Layout --> */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8 items-center">
                <div className="lg:col-span-8 flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <span className="material-symbols-outlined absolute left-4 top-10 -translate-y-1/2 text-slate-400" data-icon="filter_list">filter_list</span>
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
                            className="appearance-none bg-white border border-slate-200 dark:border-slate-800 rounded-xl px-6 pr-12 py-4 text-sm shadow-sm focus:ring-2 focus:ring-primary/20 outline-none min-w-[200px]"
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
                        {/* <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" data-icon="keyboard_arrow_down">keyboard_arrow_down</span> */}
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
                        {/* <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none " data-icon="keyboard_arrow_down">keyboard_arrow_down</span> */}
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
                    <button className="bg-[var(--color-primary)] text-[var(--color-on-primary)] px-5 py-3 rounded-xl font-bold flex items-center gap-2 shadow-sm hover:brightness-95 transition-all active:scale-95 duration-150 whitespace-nowrap" type="button">
                        <span className="material-symbols-outlined" data-icon="add">add</span>
                        Add New User
                    </button>
                </div>
            </div>
            {/* User Data Table Section */}
            <div className="bg-white border border-slate-200 dark:border-slate-800 rounded-[2rem] shadow-sm overflow-hidden p-2">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-separate border-spacing-y-1">
                        <thead>
                            <tr className="text-on-surface-variant">
                                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-wider font-label">User Name</th>
                                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-wider font-label">Name</th>
                                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-wider font-label">Role</th>
                                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-wider font-label text-center">Status</th>
                                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-wider font-label">Created Date</th>
                                <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-wider font-label text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="space-y-2">
                            {isLoadingUsers && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-10 text-center text-slate-500">
                                        Loading users...
                                    </td>
                                </tr>
                            )}
                            {paginatedUsers.map((user) => (
                                <tr key={user.id} className="bg-slate-50/50 hover:bg-slate-100/50 transition-colors group">
                                    <td className="px-6 py-4 rounded-l-xl text-sm font-bold text-on-surface">
                                        {user.username}
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium text-slate-500">
                                        {user.name}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-[10px] font-bold uppercase tracking-tight px-3 py-1 bg-slate-200 dark:bg-slate-800 rounded-full text-slate-600 dark:text-slate-400 font-label">
                                            {user.role.name}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 ${user.user_status.name === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-600'} font-bold text-[10px] rounded-full uppercase tracking-tight font-label`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${user.user_status.name === 'Active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`}></span>
                                            {user.user_status.name}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-500">
                                        {new Date(user.createdAt).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 text-right rounded-r-xl">
                                        <div className="flex items-center justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                            <button className="p-2 hover:bg-white rounded-lg transition-colors text-slate-400 hover:text-primary" aria-label={`View ${user.username}`} type="button"><span className="material-symbols-outlined text-[20px]" data-icon="visibility">visibility</span></button>
                                            <button className="p-2 hover:bg-white rounded-lg transition-colors text-slate-400 hover:text-primary" aria-label={`Edit ${user.username}`} type="button"><span className="material-symbols-outlined text-[20px]" data-icon="edit">edit</span></button>
                                            <button className="p-2 hover:bg-white rounded-lg transition-colors text-slate-400 hover:text-error" aria-label={`Delete ${user.username}`} type="button"><span className="material-symbols-outlined text-[20px]" data-icon="delete">delete</span></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {!filteredUsers.length && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-14 text-center text-slate-500">
                                        <p className="text-sm font-semibold text-on-surface">No users found</p>
                                        <p className="text-xs mt-1">Try changing your filters or reset them to view all users.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {/* <!-- Custom Pagination Footer --> */}
                <div className="flex flex-col sm:flex-row items-center justify-between p-6 gap-4 mt-2">
                    <p className="text-xs text-slate-500 font-medium font-label">Showing <span className="font-bold text-on-surface">{filteredUsers.length ? `${startIndex + 1} - ${Math.min(endIndex, filteredUsers.length)}` : 0}</span> of <span className="font-bold text-on-surface">{filteredUsers.length}</span> items</p>
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
            {/* <!-- Metric Summary Bar (Architectural Feature) --> */}
            <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="p-6 bg-white border border-slate-200 dark:border-slate-800 rounded-2xl">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-2 font-label">Total Active Users</p>
                    <p className="text-3xl font-headline font-extrabold text-on-surface">{activeCount}</p>
                </div>
                <div className="p-6 bg-white border border-slate-200 dark:border-slate-800 rounded-2xl">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-2 font-label">Total Inactive Users</p>
                    <p className="text-3xl font-headline font-extrabold text-on-surface">{inactiveCount}</p>
                </div>
                <div className="p-6 bg-white border border-slate-200 dark:border-slate-800 rounded-2xl">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-2 font-label">Total Admins</p>
                    <p className="text-3xl font-headline font-extrabold text-on-surface">{adminCount}</p>
                </div>
                <div className="p-6 bg-white border border-slate-200 dark:border-slate-800 rounded-2xl">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-2 font-label">Filtered Result</p>
                    <p className="text-3xl font-headline font-extrabold text-on-surface">{filteredUsers.length}</p>
                </div>
            </div>
        </main>
    )
}
