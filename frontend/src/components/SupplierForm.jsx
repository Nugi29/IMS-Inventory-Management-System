import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useSupplier } from '../services/useSupplier'

const normalizeSupplierStatusValue = (status) => {
    if (status === null || status === undefined) {
        return '1'
    }

    if (typeof status === 'boolean') {
        return status ? '1' : '2'
    }

    if (typeof status === 'number') {
        return status === 2 ? '2' : '1'
    }

    const value = String(status).trim().toLowerCase()

    if (['2', 'inactive', 'disabled', 'false', 'no'].includes(value)) {
        return '2'
    }
    if (['1', 'active', 'enabled', 'true', 'yes'].includes(value)) {
        return '1'
    }

    return '1'
}

const normalizePhoneNumber = (phone) => String(phone || '').trim().replace(/[\s()-]/g, '')

const isValidPhoneNumber = (phone) => {
    const value = normalizePhoneNumber(phone)

    if (!value) {
        return true
    }

    return /^\+?\d{7,15}$/.test(value)
}

const isValidEmailAddress = (email) => {
    const value = String(email || '').trim()

    if (!value) {
        return true
    }

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export const SupplierForm = () => {
    const navigate = useNavigate()
    const location = useLocation()
    const { addSupplier, updateSupplier, deleteSupplier } = useSupplier()

    const mode = location.state?.mode === 'update' ? 'update' : 'add'
    const selectedSupplier = location.state?.supplier

    const initialFormData = useMemo(() => ({
        id: selectedSupplier?.id || selectedSupplier?.supplier_id || selectedSupplier?._id || '',
        name: selectedSupplier?.name || '',
        phone: selectedSupplier?.phone || '',
        email: selectedSupplier?.email || '',
        address: selectedSupplier?.address || '',
        supplier_status: normalizeSupplierStatusValue(
            selectedSupplier?.supplier_status?.id
            || selectedSupplier?.supplier_status_id
            || selectedSupplier?.supplier_status?.value
            || selectedSupplier?.supplier_status?.status
            || selectedSupplier?.supplier_status?.name
            || selectedSupplier?.supplier_status
        ),
    }), [selectedSupplier])

    const [formData, setFormData] = useState(initialFormData)
    const [isSaving, setIsSaving] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    useEffect(() => {
        setFormData(initialFormData)
    }, [initialFormData])

    const handleChange = (event) => {
        const { name, value } = event.target
        setFormData((prev) => ({ ...prev, [name]: value }))
    }

    const handleSubmit = async (event) => {
        event.preventDefault()

        if (!formData.name.trim()) {
            toast.error('Supplier name is required')
            return
        }

        if (!isValidPhoneNumber(formData.phone)) {
            toast.error('Enter a valid phone number')
            return
        }

        if (!isValidEmailAddress(formData.email)) {
            toast.error('Enter a valid email address')
            return
        }

        const statusValue = Number(normalizeSupplierStatusValue(formData.supplier_status))
        const normalizedPhone = normalizePhoneNumber(formData.phone)
        const normalizedEmail = String(formData.email || '').trim().toLowerCase()

        const payload = {
            id: Number(formData.id || selectedSupplier?.id),
            name: formData.name.trim(),
            phone: normalizedPhone,
            email: normalizedEmail,
            address: formData.address.trim(),
            supplier_status_id: statusValue,
        }

        if (mode === 'update' && !payload.id) {
            toast.error('Missing supplier id for update')
            return
        }

        setIsSaving(true)
        try {
            let response

            if (mode === 'update') {
                response = await updateSupplier(payload)
            } else {
                response = await addSupplier(payload)

                // Backend create currently forces Active (id:1); if user chose Inactive (id:2), patch it right after create.
                if (response?.success && statusValue !== 1) {
                    const createdId = Number(response?.supplier?.id)

                    if (!createdId) {
                        toast.error('Supplier created, but failed to apply inactive status. Please edit and save again.')
                        navigate('/suppliers')
                        return
                    }

                    response = await updateSupplier({
                        id: createdId,
                        supplier_status_id: statusValue,
                    })
                }
            }

            if (!response.success) {
                toast.error(response.message)
                return
            }

            toast.success(response.message)
            navigate('/suppliers')
        } catch (error) {
            toast.error(error?.response?.data?.message || error?.message || 'Failed to save supplier')
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async () => {
        const supplierId = Number(formData.id || selectedSupplier?.id)

        if (!supplierId) {
            toast.error('Missing supplier id for deletion')
            return
        }

        if (!window.confirm('Are you sure you want to delete this supplier? This action cannot be undone.')) {
            return
        }

        setIsDeleting(true)
        const response = await deleteSupplier({ id: supplierId })
        setIsDeleting(false)

        if (!response.success) {
            toast.error(response.message)
            return
        }

        toast.success(response.message)
        navigate('/suppliers')
    }

    const isBusy = isSaving || isDeleting

    return (
        <main className="h-full overflow-hidden bg-linear-to-br from-slate-100 via-white to-blue-50 p-3 sm:p-4">
            <section className="mx-auto flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-200/70 bg-white/95 shadow-xl shadow-slate-300/30 backdrop-blur-sm">
                <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-7 sm:py-5">
                    <div>
                        <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                            {mode === 'update' ? 'Update Supplier' : 'Create Supplier'}
                        </h1>
                    </div>
                    <button
                        type="button"
                        onClick={() => navigate('/suppliers')}
                        className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                    >
                        Cancel
                    </button>
                </header>

                <form className="flex h-full min-h-0 flex-col gap-3 px-5 py-3 sm:px-7 sm:py-4" onSubmit={handleSubmit}>
                    <div className="flex-1 space-y-4 overflow-y-auto">
                        <div className="space-y-3 border-b border-slate-200 pb-4">
                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="space-y-2">
                                    <label htmlFor="name" className="text-sm font-medium text-slate-700">Supplier name</label>
                                    <input
                                        id="name"
                                        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                        placeholder="e.g. ABC Traders"
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label htmlFor="phone" className="text-sm font-medium text-slate-700">Phone</label>
                                    <input
                                        id="phone"
                                        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                        placeholder="e.g. 0771234567"
                                        type="tel"
                                        name="phone"
                                        inputMode="tel"
                                        autoComplete="tel"
                                        value={formData.phone}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="space-y-2">
                                    <label htmlFor="email" className="text-sm font-medium text-slate-700">Email</label>
                                    <input
                                        id="email"
                                        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                        placeholder="e.g. supplier@mail.com"
                                        type="email"
                                        name="email"
                                        autoComplete="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label htmlFor="supplier_status" className="text-sm font-medium text-slate-700">Status</label>
                                    <select
                                        id="supplier_status"
                                        className="w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                        name="supplier_status"
                                        value={formData.supplier_status}
                                        onChange={handleChange}
                                    >
                                        <option value="1">Active</option>
                                        <option value="2">Inactive</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="address" className="text-sm font-medium text-slate-700">Address</label>
                                <textarea
                                    id="address"
                                    className="min-h-28 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                    placeholder="Enter supplier address"
                                    name="address"
                                    value={formData.address}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-end">
                        <button
                            type="button"
                            onClick={() => navigate('/suppliers')}
                            className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                            disabled={isBusy}
                        >
                            Back
                        </button>
                        {mode === 'update' && (
                            <button
                                type="button"
                                onClick={handleDelete}
                                disabled={isBusy}
                                className="rounded-lg border-2 border-red-200 bg-red-50 px-5 py-2.5 text-sm font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isDeleting ? 'Deleting...' : 'Delete supplier'}
                            </button>
                        )}
                        <button
                            type="submit"
                            disabled={isBusy}
                            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                            {isSaving ? 'Saving...' : mode === 'update' ? 'Save changes' : 'Create supplier'}
                        </button>
                    </div>
                </form>
            </section>
        </main>
    )
}
