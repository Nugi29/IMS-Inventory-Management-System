import { useMemo, useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useItem } from '../services/useItem'
import { useLookup } from '../services/useLookup'

export const ItemForm = () => {
    const navigate = useNavigate()
    const location = useLocation()
    const { items, addItem, updateItem, deleteItem, getNextSku } = useItem()
    const { 
        categories: fetchedCategories, 
        itemStatuses, 
        suppliers: fetchedSuppliers,
        refreshCategories, 
        getItemStatuses,
        getAllSuppliers
    } = useLookup()

    const mode = location.state?.mode === 'update' ? 'update' : location.state?.mode === 'view' ? 'view' : 'add'
    const selectedItem = location.state?.item

    const [formData, setFormData] = useState({
        id: selectedItem?.id || '',
        item_name: selectedItem?.item_name || '',
        sku: selectedItem?.sku || '',
        category_id: selectedItem?.category?.id || selectedItem?.category?.categoryId || selectedItem?.category_id || '',
        supplier_id: selectedItem?.supplier?.id || selectedItem?.supplier?.supplierId || selectedItem?.supplier_id || '',
        item_status_id: selectedItem?.item_status?.id || selectedItem?.item_status_id || 1,
        selling_price: selectedItem?.selling_price || '',
        quantity: selectedItem?.current_stock || selectedItem?.quantity || 0,
        reorder_level: selectedItem?.reorder_level || '',
        createdAt: selectedItem?.createdAt ? new Date(selectedItem.createdAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    })
    const [pendingAction, setPendingAction] = useState(null)

    useEffect(() => {
        refreshCategories?.()
        getItemStatuses?.()
        getAllSuppliers?.()
    }, [refreshCategories, getItemStatuses, getAllSuppliers])

    // Auto-generate SKU when category changes (only for new items)
    useEffect(() => {
        const fetchNextSku = async () => {
            if (mode === 'add' && formData.category_id) {
                const nextSku = await getNextSku(formData.category_id)
                if (nextSku) {
                    setFormData(prev => ({ ...prev, sku: nextSku }))
                }
            }
        }
        fetchNextSku()
    }, [formData.category_id, mode])

    const categories = useMemo(() => {
        if (fetchedCategories && fetchedCategories.length > 0) {
            return fetchedCategories
                .map((cat) => ({
                    id: cat?.id || cat?.categoryId || cat?.category_id,
                    label: cat?.label || cat?.name || cat?.categoryName || cat?.category_name,
                }))
                .filter((cat) => cat.id && cat.label)
        }
        // Fallback to deriving from items if API call fails
        return items
            .map((item) => ({
                id: item?.category?.id || item?.category?.categoryId || item?.category_id,
                label: item?.category?.label || item?.category?.name || item?.category?.categoryName || item?.category_name,
            }))
            .filter((cat) => cat.id && cat.label)
            .reduce((unique, cat) => {
                if (!unique.find(c => c.id === cat.id)) {
                    unique.push(cat)
                }
                return unique
            }, [])
    }, [fetchedCategories, items])

    const suppliers = useMemo(() => {
        if (fetchedSuppliers && fetchedSuppliers.length > 0) {
            return fetchedSuppliers
                .map((supplier) => ({
                    id: supplier?.id || supplier?.supplierId || supplier?.supplier_id,
                    label: supplier?.label || supplier?.name || supplier?.supplierName || supplier?.supplier_name,
                }))
                .filter((supplier) => supplier.id && supplier.label)
        }
        // Fallback to deriving from items if API call fails
        return items
            .map((item) => ({
                id: item?.supplier?.id || item?.supplier?.supplierId || item?.supplier_id,
                label: item?.supplier?.label || item?.supplier?.name || item?.supplier?.supplierName || item?.supplier_name,
            }))
            .filter((supplier) => supplier.id && supplier.label)
            .reduce((unique, supplier) => {
                if (!unique.find(s => s.id === supplier.id)) {
                    unique.push(supplier)
                }
                return unique
            }, [])
    }, [fetchedSuppliers, items])

    const handleChange = (event) => {
        const { name, value } = event.target
        setFormData((prev) => ({ ...prev, [name]: value }))
    }

    const handleSubmit = async (event) => {
        event.preventDefault()

        if (!formData.item_name.trim()) {
            toast.error('Item name is required')
            return
        }

        if (!formData.sku.trim()) {
            toast.error('Code is required')
            return
        }

        if (!formData.category_id || !formData.supplier_id) {
            toast.error('Please select category and supplier')
            return
        }

        if (!formData.item_status_id) {
            toast.error('Please select item status')
            return
        }

        if (!formData.selling_price) {
            toast.error('Selling price is required')
            return
        }

        const createdAtValue = formData.createdAt
            ? new Date(`${formData.createdAt}T00:00:00`).toISOString()
            : new Date().toISOString()

        const payload = {
            item_name: formData.item_name.trim(),
            sku: formData.sku.trim(),
            category_id: Number(formData.category_id),
            supplier_id: Number(formData.supplier_id),
            item_status_id: Number(formData.item_status_id),
            selling_price: parseFloat(formData.selling_price),
            quantity: parseInt(formData.quantity) || 0,
            reorder_level: parseInt(formData.reorder_level) || 0,
            createdAt: createdAtValue,
        }

        if (mode === 'update') {
            payload.id = Number(formData.id || selectedItem?.id)
            if (!payload.id) {
                toast.error('Missing item id for update')
                return
            }
        }

        setPendingAction('save')
        const response = mode === 'update' ? await updateItem(payload) : await addItem(payload)
        setPendingAction(null)

        if (!response.success) {
            toast.error(response.message)
            return
        }

        toast.success(response.message)
        navigate('/items')
    }

    const handleDelete = async () => {
        const itemId = Number(formData.id || selectedItem?.id)

        if (!itemId) {
            toast.error('Missing item id for deletion')
            return
        }

        if (!window.confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
            return
        }

        setPendingAction('delete')
        const response = await deleteItem({ id: itemId })
        setPendingAction(null)

        if (!response.success) {
            toast.error(response.message)
            return
        }

        toast.success(response.message)
        navigate('/items')
    }

    const isSaving = pendingAction === 'save'
    const isDeleting = pendingAction === 'delete'
    const isBusy = isSaving || isDeleting
    const isReadOnly = mode === 'view'

    return (
        <main className="h-full overflow-hidden bg-linear-to-br from-slate-100 via-white to-blue-50 p-3 sm:p-4">
            <section className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200/70 bg-white/95 shadow-xl shadow-slate-300/30 backdrop-blur-sm">
                <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-7 sm:py-5">
                    <div>
                        <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                            {mode === 'update' ? 'Update Item' : mode === 'view' ? 'View Item' : 'Create Item'}
                        </h1>
                    </div>
                    <button
                        type="button"
                        onClick={() => navigate('/items')}
                        className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                    >
                        Cancel
                    </button>
                </header>

                <form className="flex h-full min-h-0 flex-col gap-3 px-5 py-3 sm:px-7 sm:py-4" onSubmit={handleSubmit}>
                    <div className="flex-1 space-y-4 overflow-y-auto">
                        {/* Item ID Section (Update mode only) */}
                        {mode === 'update' && (
                            <div className="space-y-3 border-b border-slate-200 pb-4">
                                <div className="space-y-2">
                                    <label htmlFor="id" className="text-xs font-semibold uppercase tracking-wide text-slate-600">Item ID</label>
                                    <input
                                        id="id"
                                        type="text"
                                        name="id"
                                        value={formData.id}
                                        readOnly
                                        className="w-full bg-slate-100 border border-slate-300 rounded-lg px-4 py-2 text-sm text-slate-600 cursor-not-allowed"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Item Details */}
                        <div className="space-y-3 border-b border-slate-200 pb-4">
                            <h2 className="text-sm font-semibold text-slate-900">Item Details</h2>

                            <div className="space-y-2">
                                <label htmlFor="item_name" className="text-xs font-semibold uppercase tracking-wide text-slate-600">Item Name *</label>
                                <input
                                    id="item_name"
                                    type="text"
                                    name="item_name"
                                    value={formData.item_name}
                                    onChange={handleChange}
                                    readOnly={isReadOnly}
                                    placeholder="Enter item name"
                                    className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm placeholder-slate-400 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                                    disabled={isReadOnly}
                                />
                            </div>

                            <div className="space-y-2 mt-4">
                                <label htmlFor="sku" className="text-xs font-semibold uppercase tracking-wide text-slate-600">Code *</label>
                                <input
                                    id="sku"
                                    type="text"
                                    name="sku"
                                    value={formData.sku}
                                    onChange={handleChange}
                                    readOnly={isReadOnly}
                                    placeholder="e.g., CODE-0042"
                                    className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm placeholder-slate-400 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                                    disabled={isReadOnly}
                                />
                            </div>
                        </div>

                        {/* Category & Supplier */}
                        <div className="space-y-3 border-b border-slate-200 pb-4">
                            <h2 className="text-sm font-semibold text-slate-900">Item Condition</h2>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <label htmlFor="category_id" className="text-xs font-semibold uppercase tracking-wide text-slate-600">Category *</label>
                                    <select
                                        id="category_id"
                                        name="category_id"
                                        value={formData.category_id}
                                        onChange={handleChange}
                                        disabled={isReadOnly}
                                        className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                                    >
                                        <option value="">Select a category</option>
                                        {categories.map((cat) => (
                                            <option key={cat.id} value={cat.id}>{cat.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="item_status_id" className="text-xs font-semibold uppercase tracking-wide text-slate-600">Item Status *</label>
                                    <select
                                        id="item_status_id"
                                        name="item_status_id"
                                        value={formData.item_status_id}
                                        onChange={handleChange}
                                        disabled={isReadOnly}
                                        className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                                    >
                                        <option value="">Select item status</option>
                                        {itemStatuses.map((status) => (
                                            <option key={status.id} value={status.id}>{status.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="supplier_id" className="text-xs font-semibold uppercase tracking-wide text-slate-600">Supplier *</label>
                                    <select
                                        id="supplier_id"
                                        name="supplier_id"
                                        value={formData.supplier_id}
                                        onChange={handleChange}
                                        disabled={isReadOnly}
                                        className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                                    >
                                        <option value="">Select a supplier</option>
                                        {suppliers.map((supplier) => (
                                            <option key={supplier.id} value={supplier.id}>{supplier.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Pricing & Stock */}
                        <div className="space-y-3">
                            <h2 className="text-sm font-semibold text-slate-900">Pricing & Stock</h2>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <label htmlFor="selling_price" className="text-xs font-semibold uppercase tracking-wide text-slate-600">Selling Price *</label>
                                    <input
                                        id="selling_price"
                                        type="number"
                                        name="selling_price"
                                        value={formData.selling_price}
                                        onChange={handleChange}
                                        readOnly={isReadOnly}
                                        placeholder="0.00"
                                        step="0.01"
                                        min="0"
                                        className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm placeholder-slate-400 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                                        disabled={isReadOnly}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="quantity" className="text-xs font-semibold uppercase tracking-wide text-slate-600">Quantity</label>
                                    <input
                                        id="quantity"
                                        type="number"
                                        name="quantity"
                                        value={formData.quantity}
                                        onChange={handleChange}
                                        readOnly={isReadOnly}
                                        placeholder="0"
                                        min="0"
                                        className="w-full bg-slate-100 border border-slate-200 rounded-lg px-4 py-2 text-sm placeholder-slate-400 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                                        disabled
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="reorder_level" className="text-xs font-semibold uppercase tracking-wide text-slate-600">Reorder Level</label>
                                    <input
                                        id="reorder_level"
                                        type="number"
                                        name="reorder_level"
                                        value={formData.reorder_level}
                                        onChange={handleChange}
                                        readOnly={isReadOnly}
                                        placeholder="0"
                                        min="0"
                                        className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm placeholder-slate-400 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                                        disabled={isReadOnly}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Created At Section */}
                        <div className="space-y-3">
                            <div className="space-y-2">
                                <label htmlFor="createdAt" className="text-xs font-semibold uppercase tracking-wide text-slate-600">Created at</label>
                                <input
                                    id="createdAt"
                                    className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                                    type="date"
                                    name="createdAt"
                                    value={formData.createdAt}
                                    onChange={handleChange}
                                    disabled
                                />
                            </div>
                        </div>

                    </div>

                    {/* Form Actions */}
                    <div className="flex justify-end border-t border-slate-200 pt-4 gap-3">
                        {mode === 'update' && !isReadOnly && (
                            <button
                                type="button"
                                onClick={handleDelete}
                                disabled={isBusy}
                                className="rounded-lg border border-red-200 bg-red-50 text-red-600 px-6 py-2 text-sm font-semibold transition hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isDeleting ? 'Deleting...' : 'Delete Item'}
                            </button>
                        )}

                        {!isReadOnly && (
                            <button
                                type="submit"
                                disabled={isBusy}
                                className="rounded-lg bg-blue-600 text-white px-6 py-2 text-sm font-semibold transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSaving ? 'Saving...' : mode === 'update' ? 'Save Changes' : 'Create Item'}
                            </button>
                        )}
                    </div>
                </form>
            </section>
        </main>
    )
}

export default ItemForm;
