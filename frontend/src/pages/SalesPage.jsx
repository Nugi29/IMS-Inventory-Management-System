import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import { useItem } from '../services/useItem'
import { useLookup } from '../services/useLookup'
import { useCustomer } from '../services/useCustomer'
import { useSale } from '../services/useSale'

const normalizeCategory = (item) =>
  item?.category?.name ||
  item?.category?.categoryName ||
  item?.category_name ||
  item?.categoryName ||
  'Uncategorized'

const toCurrency = (value) => `Rs ${Number(value || 0).toFixed(2)}`

const getItemStock = (item) => Number(item?.current_stock ?? item?.quantity ?? 0)

const getItemStockStatus = (item) => {
  const stock = getItemStock(item)
  if (stock === 0) return 'Out of Stock'

  const reorderLevel = Number(item?.reorder_level ?? 5)
  return stock <= reorderLevel ? 'Low Stock' : 'In Stock'
}

const getStockBadgeColor = (status) => {
  if (status === 'Out of Stock') return 'bg-red-50 text-red-600'
  if (status === 'Low Stock') return 'bg-yellow-50 text-yellow-600'
  return 'bg-emerald-50 text-emerald-600'
}

export const SalesPage = () => {
  const { items, isLoadingItems, reloadItems } = useItem()
  const { categories: lookupCategories } = useLookup()
  const { customers, isLoadingCustomers, addCustomer, updateCustomer, deleteCustomer } = useCustomer()
  const { createSale } = useSale()
  const PRODUCTS_PER_PAGE = 12

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All Products')
  const [cart, setCart] = useState([])
  const [paidAmount, setPaidAmount] = useState('0')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [showCustomerPanel, setShowCustomerPanel] = useState(false)
  const [customerPhoneSearch, setCustomerPhoneSearch] = useState('')
  const [customerNameInput, setCustomerNameInput] = useState('')
  const [editingCustomerId, setEditingCustomerId] = useState(null)
  const [isSavingCustomer, setIsSavingCustomer] = useState(false)
  const [isDeletingCustomer, setIsDeletingCustomer] = useState(false)
  const [activeCustomerAction, setActiveCustomerAction] = useState('')
  const [isSubmittingSale, setIsSubmittingSale] = useState(false)

  const resetCustomerDraftState = () => {
    setEditingCustomerId(null)
    setActiveCustomerAction('')
    setCustomerPhoneSearch('')
    setCustomerNameInput('')
  }

  const categories = useMemo(() => {
    const namesFromItems = items
      .map((item) => normalizeCategory(item))
      .filter(Boolean)

    const namesFromLookup = lookupCategories
      .map((category) => category?.label || category?.name || category?.categoryName)
      .filter(Boolean)

    return ['All Products', ...new Set([...namesFromItems, ...namesFromLookup])]
  }, [items, lookupCategories])

  const filteredProducts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return items.filter((item) => {
      const matchesSearch =
        !normalizedSearch ||
        item?.item_name?.toLowerCase().includes(normalizedSearch) ||
        item?.sku?.toLowerCase().includes(normalizedSearch)

      const category = normalizeCategory(item)
      const matchesCategory =
        selectedCategory === 'All Products' || selectedCategory === category

      return matchesSearch && matchesCategory
    })
  }, [items, searchTerm, selectedCategory])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, selectedCategory])

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE))

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * PRODUCTS_PER_PAGE
    return filteredProducts.slice(start, start + PRODUCTS_PER_PAGE)
  }, [filteredProducts, currentPage])

  const searchedCustomer = useMemo(() => {
    const query = customerPhoneSearch.trim()
    if (!query) {
      return null
    }

    return (
      customers.find((customer) => String(customer?.phone || '').trim() === query)
      || customers.find((customer) => String(customer?.phone || '').includes(query))
      || null
    )
  }, [customers, customerPhoneSearch])

  const addToCart = (product) => {
    const stockAvailable = getItemStock(product)
    
    setCart((prevCart) => {
      const existingItem = prevCart.find((entry) => Number(entry.id) === Number(product.id))

      if (existingItem) {
        if (existingItem.quantity >= stockAvailable) {
          toast.error(`Cannot add more than available stock (${stockAvailable}).`)
          return prevCart
        }
        
        return prevCart.map((entry) =>
          Number(entry.id) === Number(product.id)
            ? { ...entry, quantity: entry.quantity + 1 }
            : entry
        )
      }

      if (stockAvailable <= 0) {
        toast.error('Product is out of stock.')
        return prevCart
      }

      return [
        ...prevCart,
        {
          id: product.id,
          name: product.item_name,
          price: Number(product.selling_price || 0),
          quantity: 1,
          stock: stockAvailable,
        },
      ]
    })
  }

  const updateQuantity = (id, amount) => {
    setCart((prevCart) => {
      let limitExceeded = false

      const updatedCart = prevCart.map((entry) => {
        if (Number(entry.id) === Number(id)) {
          const newQuantity = entry.quantity + amount
          if (newQuantity > entry.stock) {
            limitExceeded = true
            return { ...entry, quantity: entry.stock }
          }
          return { ...entry, quantity: Math.max(0, newQuantity) }
        }
        return entry
      })

      if (limitExceeded) {
        toast.error('Cannot add more than available stock.')
      }

      return updatedCart.filter((entry) => entry.quantity > 0)
    })
  }

  const removeCartItem = (id) => {
    setCart((prevCart) => prevCart.filter((entry) => Number(entry.id) !== Number(id)))
  }

  const selectCustomer = (customer) => {
    setSelectedCustomer(customer)
    setShowCustomerPanel(false)
    resetCustomerDraftState()
  }

  const chooseGuestCheckout = () => {
    setSelectedCustomer(null)
    setShowCustomerPanel(false)
    resetCustomerDraftState()
  }

  const handlePhoneSearchChange = (event) => {
    const value = event.target.value
    setActiveCustomerAction('')
    setCustomerPhoneSearch(value)
  }

  const startUpdateCustomer = (customer) => {
    setActiveCustomerAction('update')
    setEditingCustomerId(customer?.id || null)
    setCustomerPhoneSearch(String(customer?.phone || ''))
    setCustomerNameInput(customer?.name || '')
  }

  const registerCustomer = async (event) => {
    event.preventDefault()

    const phoneToRegister = customerPhoneSearch.trim()
    const nameToRegister = customerNameInput.trim()

    if (!nameToRegister) {
      toast.error('Customer name is required')
      return
    }

    if (!phoneToRegister) {
      toast.error('Phone number is required')
      return
    }

    setIsSavingCustomer(true)
    const response = await addCustomer({ name: nameToRegister, phone: phoneToRegister })
    setIsSavingCustomer(false)

    if (!response.success) {
      toast.error(response.message)
      return
    }

    toast.success(response.message)
    if (response.customer?.id) {
      selectCustomer(response.customer)
      return
    }

    setCustomerNameInput('')
  }

  const saveCustomerUpdate = async () => {
    const targetCustomer = searchedCustomer || selectedCustomer

    if (!targetCustomer?.id) {
      toast.error('Select a customer to update')
      return
    }

    const updatedName = customerNameInput.trim() || targetCustomer?.name
    const updatedPhone = customerPhoneSearch.trim() || targetCustomer?.phone

    if (!updatedName || !updatedPhone) {
      toast.error('Name and phone number are required')
      return
    }

    setIsSavingCustomer(true)
    const response = await updateCustomer({
      id: targetCustomer.id,
      name: updatedName,
      phone: updatedPhone,
    })
    setIsSavingCustomer(false)

    if (!response.success) {
      toast.error(response.message)
      return
    }

    toast.success(response.message)

    const updatedCustomer = response.customer?.id
      ? response.customer
      : { ...targetCustomer, name: updatedName, phone: updatedPhone }

    selectCustomer(updatedCustomer)
  }

  const removeCustomerFromDatabase = async () => {
    setActiveCustomerAction('delete')
    const targetCustomer = searchedCustomer || selectedCustomer

    if (!targetCustomer?.id) {
      toast.error('Select a customer to delete')
      return
    }

    if (!window.confirm('Delete this customer from database?')) {
      return
    }

    setIsDeletingCustomer(true)
    const response = await deleteCustomer({ id: targetCustomer.id })
    setIsDeletingCustomer(false)

    if (!response.success) {
      toast.error(response.message)
      return
    }

    toast.success(response.message)

    if (selectedCustomer?.id === targetCustomer.id) {
      setSelectedCustomer(null)
    }

    setEditingCustomerId(null)
    setCustomerNameInput('')
    setCustomerPhoneSearch('')
    setShowCustomerPanel(false)
  }

  const clearCart = () => setCart([])

  const confirmSale = async () => {
    // Validate cart is not empty
    if (cart.length === 0) {
      toast.error('Cart is empty. Please add items to proceed.')
      return
    }

    // Validate paid amount
    const paid = Number(paidAmount || 0)
    if (paid === 0) {
      toast.error('Please enter a paid amount.')
      return
    }

    // Validate paid amount is sufficient
    if (paid < subtotal) {
      toast.error('Paid amount cannot be less than the total.')
      return
    }

    // Prepare payload
    const customerId = selectedCustomer?.id ? Number(selectedCustomer.id) : 1

    const payload = {
      customer_id: customerId,
      items: cart.map((item) => ({
        item_id: item.id,
        quantity: item.quantity,
        selling_price: item.price,
      })),
      paid_amount: paid,
    }

    setIsSubmittingSale(true)

    try {
      const response = await createSale(payload)

      if (response.success) {
        toast.success(response.message || 'Sale recorded successfully')
        
        // Reload items data to update the product cards with new stock levels
        if (reloadItems) {
            await reloadItems()
        }

        clearCart()
        setPaidAmount('0')
        setSelectedCustomer(null)
        setShowCustomerPanel(false)
      } else {
        toast.error(response.message || 'Failed to record sale')
      }
    } catch (error) {
      toast.error('Error creating sale. Please try again.')
      console.error('Sale confirmation error:', error)
    } finally {
      setIsSubmittingSale(false)
    }
  }

  const subtotal = useMemo(
    () => cart.reduce((sum, entry) => sum + entry.price * entry.quantity, 0),
    [cart]
  )

  const totalCartUnits = useMemo(
    () => cart.reduce((sum, entry) => sum + entry.quantity, 0),
    [cart]
  )

  const grandTotal = subtotal

  const paid = Number(paidAmount || 0)
  const changeDue = paid > grandTotal ? paid - grandTotal : 0

  return (
    <main className="ml-0 mt-0 p-4 sm:p-6 lg:p-8 min-h-screen">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <section className="xl:col-span-8 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
            <div className="lg:col-span-8 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 flex items-center">
                <span className="material-symbols-outlined absolute left-4 text-slate-400" data-icon="search">
                  search
                </span>
                <input
                  className="w-full bg-white border border-slate-200 rounded-xl pl-12 pr-4 py-3.5 text-sm shadow-sm focus:ring-2 focus:ring-primary/20 outline-none"
                  type="text"
                  placeholder="Search by name or SKU..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>
              <select
                className="appearance-none bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-sm shadow-sm focus:ring-2 focus:ring-primary/20 outline-none min-w-[220px]"
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value)}
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <div className="lg:col-span-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Products</p>
                <p className="text-xl font-extrabold text-on-surface">{filteredProducts.length}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-blue-50/60 px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-primary">In Cart</p>
                  <p className="text-xl font-extrabold text-primary">{totalCartUnits}</p>
                </div>
                <span className="material-symbols-outlined text-primary text-[28px] opacity-80" data-icon="shopping_cart">
                  shopping_cart
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm p-4 sm:p-5">
            {isLoadingItems ? (
              <p className="px-2 py-4 text-sm text-slate-500">Loading products...</p>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
                  {paginatedProducts.map((product) => (
                    <article
                      key={product.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 flex flex-col gap-3 hover:border-primary/30 hover:bg-white transition-colors"
                    >
                      <div className="min-h-[52px]">
                        <h3 className="text-lg font-bold text-on-surface leading-tight break-words">{product.item_name}</h3>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex text-[11px] uppercase tracking-tight font-bold px-2.5 py-1 rounded-full bg-slate-200 text-slate-600">
                          {normalizeCategory(product)}
                        </span>
                        <span className="text-sm font-semibold text-slate-700">{getItemStock(product)} units</span>
                      </div>
                      <div>
                        {(() => {
                          const statusText = getItemStockStatus(product)
                          return (
                            <span
                              className={`inline-flex text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-tight ${getStockBadgeColor(statusText)}`}
                            >
                              {statusText}
                            </span>
                          )
                        })()}
                      </div>
                      <div className="mt-auto flex items-center justify-between gap-3">
                        <p className="text-xl font-extrabold text-primary">{toCurrency(product.selling_price)}</p>
                        <button
                          type="button"
                          className="flex items-center justify-center h-10 w-10 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition shadow-sm"
                          onClick={() => addToCart(product)}
                          aria-label={`Add ${product.item_name} to cart`}
                        >
                          <span className="material-symbols-outlined text-[24px]">add</span>
                        </button>
                      </div>
                    </article>
                  ))}
                </div>

                {!filteredProducts.length && (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center mt-4">
                    <p className="text-sm font-semibold text-on-surface">No products match your filters</p>
                    <p className="text-xs text-slate-500 mt-1">Try changing category or search keyword.</p>
                  </div>
                )}

                {filteredProducts.length > 0 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-5 px-1">
                    <p className="text-xs text-slate-500 font-medium">
                      Showing {filteredProducts.length ? `${(currentPage - 1) * PRODUCTS_PER_PAGE + 1} - ${Math.min(currentPage * PRODUCTS_PER_PAGE, filteredProducts.length)}` : 0} of {filteredProducts.length} products
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className={`p-2 rounded-lg border border-slate-200 transition-all ${currentPage === 1 ? 'bg-slate-50 text-slate-400 cursor-not-allowed opacity-50' : 'bg-slate-50 text-slate-600 hover:bg-primary hover:text-white'}`}
                        aria-label="Previous page"
                      >
                        <span className="material-symbols-outlined text-[18px]" data-icon="chevron_left">chevron_left</span>
                      </button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                          <button
                            key={page}
                            type="button"
                            onClick={() => setCurrentPage(page)}
                            className={`w-8 h-8 rounded-lg text-xs font-bold ${page === currentPage ? 'bg-primary text-white' : 'bg-slate-50 text-slate-600 hover:bg-primary hover:text-white border border-slate-200'}`}
                          >
                            {page}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className={`p-2 rounded-lg border border-slate-200 transition-all ${currentPage === totalPages ? 'bg-slate-50 text-slate-400 cursor-not-allowed opacity-50' : 'bg-slate-50 text-slate-600 hover:bg-primary hover:text-white'}`}
                        aria-label="Next page"
                      >
                        <span className="material-symbols-outlined text-[18px]" data-icon="chevron_right">chevron_right</span>
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        <section className="xl:col-span-4">
          <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm p-5 sm:p-6 xl:sticky xl:top-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-on-surface">Current Sale</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Customer: <span className="font-semibold text-on-surface">{selectedCustomer?.name || 'Guest Checkout'}</span>
                </p>
                {selectedCustomer && (
                  <p className="text-xs text-slate-500 mt-0.5">Phone: {selectedCustomer.phone || 'N/A'}</p>
                )}
              </div>
              <button
                type="button"
                className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                onClick={clearCart}
              >
                Clear All
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <p className="text-xs text-slate-500">Manage customer</p>
              <button
                type="button"
                className="text-xs font-semibold text-primary hover:brightness-95"
                onClick={() => {
                  setShowCustomerPanel((prev) => !prev)
                  setEditingCustomerId(null)
                  setCustomerNameInput('')
                }}
              >
                {showCustomerPanel ? 'Close' : '+ Add New'}
              </button>
            </div>

            {showCustomerPanel && (
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <label className="block text-xs font-semibold text-slate-500 mb-1">Phone Number</label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Type phone number"
                  value={customerPhoneSearch}
                  onChange={handlePhoneSearchChange}
                />

                {isLoadingCustomers ? (
                  <p className="text-xs text-slate-500 mt-2">Searching customers...</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {customerPhoneSearch.trim() && searchedCustomer && (
                      <div className="rounded-lg border border-slate-200 bg-white p-3">
                        <p className="text-xs text-slate-600 mb-2">
                          <span className="font-semibold text-on-surface">{searchedCustomer.name}</span> · {searchedCustomer.phone || 'N/A'}
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            className={`text-xs py-1.5 rounded-md border transition ${activeCustomerAction === 'select' ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`}
                            onClick={() => {
                              setActiveCustomerAction('select')
                              selectCustomer(searchedCustomer)
                            }}
                          >
                            Select
                          </button>
                          <button
                            type="button"
                            className={`text-xs py-1.5 rounded-md border transition ${activeCustomerAction === 'update' ? 'bg-primary border-primary text-white' : 'border-primary/30 text-primary hover:bg-primary/5'}`}
                            onClick={() => startUpdateCustomer(searchedCustomer)}
                          >
                            Update
                          </button>
                          <button
                            type="button"
                            className={`text-xs py-1.5 rounded-md border transition ${activeCustomerAction === 'delete' ? 'bg-rose-600 border-rose-600 text-white' : 'border-rose-200 text-rose-700 hover:bg-rose-50'}`}
                            onClick={removeCustomerFromDatabase}
                            disabled={isDeletingCustomer}
                          >
                            {isDeletingCustomer ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </div>
                    )}

                    {customerPhoneSearch.trim() && !searchedCustomer && (
                      <div className="rounded-lg border border-slate-200 bg-white p-3">
                        <p className="text-xs text-slate-500 mb-2">No registered customer for this number.</p>
                        <form onSubmit={registerCustomer}>
                          <input
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm mb-2 outline-none focus:ring-2 focus:ring-primary/20"
                            name="name"
                            placeholder="Customer name"
                            value={customerNameInput}
                            onChange={(event) => setCustomerNameInput(event.target.value)}
                          />
                          <button
                            type="submit"
                            className="w-full rounded-lg bg-primary text-white text-xs font-bold py-2 hover:brightness-95 transition"
                            disabled={isSavingCustomer}
                          >
                            {isSavingCustomer ? 'Saving...' : 'Add Customer'}
                          </button>
                        </form>
                      </div>
                    )}

                    {!customerPhoneSearch.trim() && (
                      <p className="text-xs text-slate-500">Enter phone number to search or add customer.</p>
                    )}
                  </div>
                )}

                {editingCustomerId && (
                  <div className="rounded-lg border border-slate-200 bg-white p-3 mt-2">
                    <p className="text-xs font-semibold text-slate-600 mb-2">Update Customer</p>
                    <input
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm mb-2 outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="Customer name"
                      value={customerNameInput}
                      onChange={(event) => setCustomerNameInput(event.target.value)}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        className="rounded-lg border border-primary/30 text-primary text-xs font-semibold py-2 hover:bg-primary/5 transition"
                        onClick={saveCustomerUpdate}
                        disabled={isSavingCustomer}
                      >
                        {isSavingCustomer ? 'Saving...' : 'Save Update'}
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-slate-300 text-slate-600 text-xs font-semibold py-2 hover:bg-slate-50 transition"
                        onClick={() => {
                          setEditingCustomerId(null)
                          setCustomerNameInput('')
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  className="w-full mt-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold py-2 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-colors"
                  onClick={chooseGuestCheckout}
                >
                  Guest Checkout
                </button>
              </div>
            )}

            <div className="mt-4 max-h-[42vh] overflow-auto pr-1 no-scrollbar">
              {cart.length === 0 && <p className="text-sm text-slate-500">No items selected yet.</p>}

              <div className="space-y-2.5">
                {cart.map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-on-surface truncate">{entry.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{toCurrency(entry.price)} / unit</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="w-7 h-7 rounded-md border border-slate-300 text-slate-600 hover:bg-white"
                          onClick={() => updateQuantity(entry.id, -1)}
                        >
                          -
                        </button>
                        <span className="w-6 text-center text-sm font-bold text-on-surface">{entry.quantity}</span>
                        <button
                          type="button"
                          className="w-7 h-7 rounded-md border border-slate-300 text-slate-600 hover:bg-white"
                          onClick={() => updateQuantity(entry.id, 1)}
                        >
                          +
                        </button>
                        <button
                          type="button"
                          className="w-7 h-7 rounded-md border border-rose-200 text-rose-600 hover:bg-rose-50 flex items-center justify-center"
                          onClick={() => removeCartItem(entry.id)}
                          aria-label={`Delete ${entry.name} from cart`}
                        >
                          <span className="material-symbols-outlined text-[16px]" data-icon="delete">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-200 mt-4 pt-4">
              <div className="space-y-1.5 mb-4">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Subtotal</span>
                  <span className="font-semibold text-on-surface">{toCurrency(subtotal)}</span>
                </div>
                <div className="flex items-end justify-between">
                  <span className="text-xs uppercase tracking-wide font-semibold text-slate-500">Grand Total</span>
                  <span className="text-2xl font-extrabold text-primary">{toCurrency(grandTotal)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Paid Amount</label>
                  <input
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                    type="number"
                    min="0"
                    step="0.01"
                    value={paidAmount}
                    onChange={(event) => setPaidAmount(event.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Change Due</label>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-on-surface min-h-[42px] flex items-center">
                    {toCurrency(changeDue)}
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="w-full rounded-xl bg-emerald-600 text-white font-bold py-3 hover:bg-emerald-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={confirmSale}
                disabled={isSubmittingSale || cart.length === 0}
              >
                {isSubmittingSale ? 'Processing...' : 'Confirm and Print Receipt'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

export default SalesPage
