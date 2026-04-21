import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useLookup } from '../services/useLookup'
import { useUser } from '../services/useUser'

export const Userform = () => {
    const navigate = useNavigate()
    const location = useLocation()
    const { users, addUser, updateUser, deleteUser } = useUser()
    const { roles: roleLookup, statuses: statusLookup, loadLookupData, isLoadingLookup } = useLookup()

    const mode = location.state?.mode === 'update' ? 'update' : 'add'
    const selectedUser = location.state?.user

    const getLookupLabel = (item) => {
        if (typeof item === 'string') {
            return item
        }

        if (!item || typeof item !== 'object') {
            return ''
        }

        return item?.name || item?.role_name || item?.status_name || item?.role || item?.status || item?.label || item?.title || ''
    }

    const [formData, setFormData] = useState({
        id: selectedUser?.id || '',
        username: selectedUser?.username || '',
        name: selectedUser?.name || '',
        roleId: selectedUser?.role?.id || selectedUser?.role_id || '',
        statusId: selectedUser?.user_status?.id || selectedUser?.user_status_id || '',
        password: '',
        confirmPassword: '',
        createdAt: selectedUser?.createdAt ? new Date(selectedUser.createdAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    })
    const [pendingAction, setPendingAction] = useState(null)

    const roles = useMemo(() => {
        const lookupRoles = roleLookup
            .map((role) => ({
                id: role?.id || role?.role_id || role?.value || role?.key || '',
                label: getLookupLabel(role),
            }))
            .filter((role) => role.id && role.label)

        if (lookupRoles.length) {
            return [...new Map(lookupRoles.map((role) => [String(role.id), role])).values()]
        }

        return users
            .map((user) => ({ id: user?.role?.id, label: user?.role?.name }))
            .filter((role) => role.id && role.label)
    }, [roleLookup, users])

    const statuses = useMemo(() => {
        const lookupStatuses = statusLookup
            .map((status) => ({
                id: status?.id || status?.user_status_id || status?.status_id || status?.value || status?.key || '',
                label: getLookupLabel(status),
            }))
            .filter((status) => status.id && status.label)

        if (lookupStatuses.length) {
            return [...new Map(lookupStatuses.map((status) => [String(status.id), status])).values()]
        }

        return users
            .map((user) => ({ id: user?.user_status?.id, label: user?.user_status?.name }))
            .filter((status) => status.id && status.label)
    }, [statusLookup, users])

    useEffect(() => {
        loadLookupData()
    }, [loadLookupData])

    const handleChange = (event) => {
        const { name, value } = event.target
        setFormData((prev) => ({ ...prev, [name]: value }))
    }

    const handleSubmit = async (event) => {
        event.preventDefault()

        if (!formData.name.trim() || !formData.username.trim()) {
            toast.error('Name and username are required')
            return
        }

        if (!formData.roleId || !formData.statusId) {
            toast.error('Please select role and status')
            return
        }

        if (mode === 'add' && !formData.password) {
            toast.error('Password is required for new users')
            return
        }

        if ((mode === 'add' || formData.password) && formData.password !== formData.confirmPassword) {
            toast.error('Password confirmation does not match')
            return
        }

        const createdAtValue = formData.createdAt
            ? new Date(`${formData.createdAt}T00:00:00`).toISOString()
            : new Date().toISOString()

        const payload = {
            name: formData.name.trim(),
            username: formData.username.trim(),
            role_id: Number(formData.roleId),
            user_status_id: Number(formData.statusId),
            createdAt: createdAtValue,
        }

        if (formData.password) {
            payload.password = formData.password
        }

        if (mode === 'update') {
            payload.id = Number(formData.id || selectedUser?.id)
            if (!payload.id) {
                toast.error('Missing user id for update')
                return
            }

            payload.user_id = payload.id
        }

        setPendingAction('save')
        const response = mode === 'update' ? await updateUser(payload) : await addUser(payload)
        setPendingAction(null)

        if (!response.success) {
            toast.error(response.message)
            return
        }

        toast.success(response.message)
        navigate('/users')
    }

    const handleDelete = async () => {
        const userId = Number(formData.id || selectedUser?.id)

        if (!userId) {
            toast.error('Missing user id for deletion')
            return
        }

        if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
            return
        }

        setPendingAction('delete')
        const response = await deleteUser({ id: userId })
        setPendingAction(null)

        if (!response.success) {
            toast.error(response.message)
            return
        }

        toast.success(response.message)
        navigate('/users')
    }

    const isSaving = pendingAction === 'save'
    const isDeleting = pendingAction === 'delete'
    const isBusy = isLoadingLookup || isSaving || isDeleting

    return (
        <main className="h-full overflow-hidden bg-linear-to-br from-slate-100 via-white to-blue-50 p-3 sm:p-4">
            <section className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200/70 bg-white/95 shadow-xl shadow-slate-300/30 backdrop-blur-sm">
                <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-7 sm:py-5">
                    <div>
                        <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                            {mode === 'update' ? 'Update user' : 'Create user'}
                        </h1>
                    </div>
                    <button
                        type="button"
                        onClick={() => navigate('/users')}
                        className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                    >
                        Cancel
                    </button>
                </header>

                <form className="flex h-full min-h-0 flex-col gap-3 px-5 py-3 sm:px-7 sm:py-4" onSubmit={handleSubmit}>
                    <div className="flex-1 space-y-4 overflow-hidden">
                        {/* User ID Section (Update mode only) */}
                        {mode === 'update' && (
                            <div className="space-y-3 border-b border-slate-200 pb-4">
                                <div className="space-y-2">
                                    <label htmlFor="id" className="text-xs font-semibold uppercase tracking-wide text-slate-600">User ID</label>
                                    <input
                                        id="id"
                                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-600 font-medium"
                                        type="text"
                                        name="id"
                                        value={formData.id}
                                        readOnly
                                    />
                                </div>
                            </div>
                        )}

                        {/* User Information Section */}
                        <div className="space-y-3 border-b border-slate-200 pb-4">
                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="space-y-2">
                                    <label htmlFor="username" className="text-sm font-medium text-slate-700">Username</label>
                                    <input
                                        id="username"
                                        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                        placeholder="e.g. john_ims"
                                        type="text"
                                        name="username"
                                        value={formData.username}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label htmlFor="name" className="text-sm font-medium text-slate-700">Full name</label>
                                    <input
                                        id="name"
                                        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                        placeholder="e.g. John Doe"
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Role & Status Section */}
                        <div className="space-y-3 border-b border-slate-200 pb-4">
                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="space-y-2">
                                    <label htmlFor="roleId" className="text-sm font-medium text-slate-700">Role</label>
                                    <select
                                        id="roleId"
                                        className="w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                        name="roleId"
                                        value={formData.roleId}
                                        onChange={handleChange}
                                        required
                                    >
                                        <option value="">Select role</option>
                                        {roles.map((role) => (
                                            <option key={role.id} value={role.id}>{role.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label htmlFor="statusId" className="text-sm font-medium text-slate-700">Status</label>
                                    <select
                                        id="statusId"
                                        className="w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                        name="statusId"
                                        value={formData.statusId}
                                        onChange={handleChange}
                                        required
                                    >
                                        <option value="">Select status</option>
                                        {statuses.map((status) => (
                                            <option key={status.id} value={status.id}>{status.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Password Section */}
                        <div className="space-y-3 border-b border-slate-200 pb-4">
                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="space-y-2">
                                    <label htmlFor="password" className="text-sm font-medium text-slate-700">
                                        {mode === 'update' ? 'New password (optional)' : 'Password'}
                                    </label>
                                    <input
                                        id="password"
                                        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                        placeholder={mode === 'update' ? 'Leave blank to keep current' : 'Enter password'}
                                        type="password"
                                        name="password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        minLength={8}
                                        required={mode === 'add'}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label htmlFor="confirmPassword" className="text-sm font-medium text-slate-700">
                                        {mode === 'update' ? 'Confirm new password' : 'Confirm password'}
                                    </label>
                                    <input
                                        id="confirmPassword"
                                        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                        placeholder="Confirm password"
                                        type="password"
                                        name="confirmPassword"
                                        value={formData.confirmPassword}
                                        onChange={handleChange}
                                        minLength={8}
                                        required={mode === 'add'}
                                    />
                                </div>
                            </div>
                            {mode === 'update' && (
                                <p className="text-xs text-slate-500">Leave password fields blank if you don't want to change the password</p>
                            )}
                        </div>

                        {/* Created At Section */}
                        <div className="space-y-3">
                            <div className="space-y-2">
                                <label htmlFor="createdAt" className="text-sm font-medium text-slate-700">Created at</label>
                                <input
                                    id="createdAt"
                                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                    type="date"
                                    name="createdAt"
                                    value={formData.createdAt}
                                    onChange={handleChange}
                                    disabled
                                />
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-end">
                        {mode === 'update' && (
                            <button
                                type="button"
                                onClick={handleDelete}
                                disabled={isBusy}
                                className="rounded-lg border-2 border-red-200 bg-red-50 px-5 py-2.5 text-sm font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                            >
                                {isDeleting ? 'Deleting...' : 'Delete user'}
                            </button>
                        )}

                        <button
                            type="submit"
                            disabled={isBusy}
                            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
                        >
                            {isSaving ? 'Saving...' : mode === 'update' ? 'Save changes' : 'Create user'}
                        </button>
                    </div>
                </form>
            </section>
        </main>
    )
}