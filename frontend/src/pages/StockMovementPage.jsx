import { useCallback, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useStockMovement } from '../services/useStockMovement'
import { useUser } from '../services/useUser'

const ROWS_PER_PAGE = 5
const ALL_MOVEMENT_TYPES = 'All Movement Types'
const ALL_PERIODS = 'all'
const ALL_USERS = 'All Users'

// â"€â"€â"€ Helper Functions â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

const normalizeText = (value) => String(value || '').toLowerCase().trim()

const getMovementType = (movement) => {
  const typeName = movement?.movement_type?.name
    || movement?.movement_type_name
    || movement?.movementType
    || movement?.type
    || ''

  if (typeName) return String(typeName)

  const typeId = Number(movement?.movement_type_id ?? movement?.movementTypeId)
  if (typeId === 1) return 'GRN'
  if (typeId === 2) return 'Sale'
  if (typeId === 3) return 'Adjustment'
  return 'Unknown'
}

const getMovementQuantity = (movement) => {
  const raw = Number(
    movement?.quantity_change
      ?? movement?.adjustment_qty
      ?? movement?.quantity
      ?? movement?.qty
      ?? 0,
  )

  if (!raw) return 0

  const type = normalizeText(getMovementType(movement))
  if (type === 'sale' && raw > 0) return -raw

  return raw
}

const getMovementItemName = (movement) => (
  movement?.item?.item_name
  || movement?.item_name
  || movement?.product_name
  || movement?.name
  || 'Unknown Item'
)

const getMovementSku = (movement) => (
  movement?.item?.sku
  || movement?.item?.code
  || movement?.sku
  || movement?.code
  || movement?.item_code
  || '-'
)

const getMovementUser = (movement) => (
  movement?.user?.name
  || movement?.performed_by?.name
  || movement?.performed_by_name
  || movement?.created_by_name
  || movement?.created_by
  || 'System'
)

const getMovementUserId = (movement) => {
  const id = movement?.user?.id
    || movement?.user_id
    || movement?.performed_by?.id
    || movement?.created_by_id
    || null;
  return id ? String(id) : null;
}

const getMovementTime = (movement) => (
  movement?.movement_time
  || movement?.created_at
  || movement?.createdAt
  || movement?.updated_at
  || movement?.updatedAt
  || ''
)

const formatDateTime = (value) => {
  if (!value) return { primary: '-', secondary: '-' }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return { primary: '-', secondary: '-' }
  }

  return {
    primary: date.toLocaleDateString(),
    secondary: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  }
}

const getTypeChipClass = (type) => {
  const normalized = normalizeText(type)
  if (normalized === 'sale') return 'bg-rose-100 text-rose-700'
  if (normalized === 'grn') return 'bg-emerald-100 text-emerald-700'
  if (normalized === 'adjustment') return 'bg-amber-100 text-amber-800'
  return 'bg-slate-100 text-slate-600'
}

const isWithinPeriod = (movementTime, periodDays) => {
  if (periodDays === 'all') return true

  // Some DB rows do not expose a timestamp field through current API payload.
  // Keep them visible instead of filtering everything out.
  if (!movementTime) return true

  const date = new Date(movementTime)
  if (Number.isNaN(date.getTime())) return true

  const now = new Date()
  const threshold = new Date(now)
  threshold.setDate(now.getDate() - Number(periodDays))

  return date >= threshold
}

export const StockMovementPage = () => {
  const location = useLocation()
  const navigate = useNavigate()

  const isAdjustmentModule = location.pathname.includes('/stock-adjustments')

  const {
    movements = [],
    isLoadingMovements,
  } = useStockMovement()

  const { users: systemUsers = [] } = useUser()

  const [selectedType, setSelectedType] = useState(ALL_MOVEMENT_TYPES)
  const [selectedPeriod, setSelectedPeriod] = useState(ALL_PERIODS)
  const [selectedUser, setSelectedUser] = useState(ALL_USERS)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  // â"€â"€â"€ Derived Data: Filter Options â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

  const movementTypes = useMemo(() => {
    const types = movements.map((movement) => getMovementType(movement)).filter(Boolean)
    return [...new Set(types)].sort()
  }, [movements])

  const usersList = useMemo(() => {
    const userMap = new Map()

    movements.forEach((movement) => {
      const id = getMovementUserId(movement)
      const name = getMovementUser(movement)
      
      if (id && !userMap.has(id)) {
        userMap.set(id, { id, name })
      } else if (!id && name !== 'System' && name) {
        if (!userMap.has(name)) {
          userMap.set(name, { id: name, name })
        }
      }
    })

    systemUsers.forEach((u) => {
      const id = String(u.id)
      if (id && !userMap.has(id)) {
        userMap.set(id, { id, name: u.name || u.username })
      }
    })
    
    return Array.from(userMap.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [movements, systemUsers])

  // â"€â"€â"€ Filtering Logic â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

  const filteredMovements = useMemo(() => {
    return movements.filter((movement) => {
      const type = getMovementType(movement)
      const itemName = getMovementItemName(movement)
      const sku = getMovementSku(movement)
      const movementTime = getMovementTime(movement)
      
      const userId = getMovementUserId(movement)
      const userName = getMovementUser(movement)
      
      const effectiveUserId = userId || userName

      const matchesModule = !isAdjustmentModule || normalizeText(type) === 'adjustment'
      const matchesType = selectedType === ALL_MOVEMENT_TYPES || selectedType === type
      const matchesUser = selectedUser === ALL_USERS || effectiveUserId === selectedUser
      const matchesSearch = !searchTerm.trim()
        || normalizeText(itemName).includes(normalizeText(searchTerm))
        || normalizeText(sku).includes(normalizeText(searchTerm))
      const matchesPeriod = isWithinPeriod(movementTime, selectedPeriod)

      return matchesModule && matchesType && matchesUser && matchesSearch && matchesPeriod
    })
  }, [movements, isAdjustmentModule, selectedType, selectedUser, searchTerm, selectedPeriod])

  // â"€â"€â"€ Pagination â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

  const totalPages = Math.max(1, Math.ceil(filteredMovements.length / ROWS_PER_PAGE))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const startIndex = (safeCurrentPage - 1) * ROWS_PER_PAGE
  const endIndex = startIndex + ROWS_PER_PAGE
  const paginatedMovements = filteredMovements.slice(startIndex, endIndex)
  const visiblePageNumbers = useMemo(() => {
    const maxVisiblePages = 7

    if (totalPages <= maxVisiblePages) {
      return Array.from({ length: totalPages }, (_, index) => index + 1)
    }

    const halfWindow = Math.floor(maxVisiblePages / 2)
    let startPage = Math.max(1, safeCurrentPage - halfWindow)
    let endPage = startPage + maxVisiblePages - 1

    if (endPage > totalPages) {
      endPage = totalPages
      startPage = Math.max(1, endPage - maxVisiblePages + 1)
    }

    return Array.from({ length: endPage - startPage + 1 }, (_, index) => startPage + index)
  }, [safeCurrentPage, totalPages])

  // â"€â"€â"€ Statistics â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

  const movementStats = useMemo(() => {
    const totalMovements = movements.length
    let grnCount = 0
    let saleCount = 0
    let adjustmentCount = 0

    filteredMovements.forEach((movement) => {
      const typeId = Number(
        movement?.movement_type?.id
        ?? movement?.movement_type_id
        ?? movement?.movementTypeId,
      )

      const isGrn = typeId === 1 || movement?.grn_id || movement?.grn?.id
      const isSale = typeId === 2 || movement?.sale_id || movement?.sale?.id
      const isAdjustment = typeId === 3
        || movement?.stock_adjustment_id
        || movement?.stock_adjustment?.id
        || normalizeText(getMovementType(movement)).includes('adjust')

      if (isGrn) grnCount += 1
      else if (isSale) saleCount += 1
      else if (isAdjustment) adjustmentCount += 1
    })

    return {
      totalMovements,
      grnCount,
      saleCount,
      adjustmentCount,
    }
  }, [filteredMovements, movements.length])

  // â"€â"€â"€ Actions â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

  const clearFilters = useCallback(() => {
    setSelectedType(ALL_MOVEMENT_TYPES)
    setSelectedPeriod(ALL_PERIODS)
    setSelectedUser(ALL_USERS)
    setSearchTerm('')
    setCurrentPage(1)
  }, [])

  const exportCsv = useCallback(() => {
    if (!filteredMovements.length) {
      toast.error('No stock movement data to export.')
      return
    }

    const rows = filteredMovements.map((movement) => ({
      item_name: getMovementItemName(movement),
      sku: getMovementSku(movement),
      type: getMovementType(movement),
      quantity: getMovementQuantity(movement),
      performed_by: getMovementUser(movement),
      timestamp: getMovementTime(movement),
    }))

    const headers = Object.keys(rows[0])
    const csvContent = [
      headers.join(','),
      ...rows.map((row) => headers.map((key) => `"${String(row[key] ?? '').replaceAll('"', '""')}"`).join(',')),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `stock-movements-${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [filteredMovements])

  // â"€â"€â"€ Render â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

  return (
    <main className="ml-0 mt-0 p-4 sm:p-6 lg:p-8">
      {/* Statistics Section */}
      {!isAdjustmentModule && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500 font-semibold uppercase">Total Movements</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{movementStats.totalMovements}</p>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl p-4">
            <p className="text-xs text-emerald-600 font-semibold uppercase">GRN</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{movementStats.grnCount}</p>
          </div>

          <div className="bg-gradient-to-br from-rose-50 to-rose-100 border border-rose-200 rounded-xl p-4">
            <p className="text-xs text-rose-600 font-semibold uppercase">Sale</p>
            <p className="text-2xl font-bold text-rose-700 mt-1">{movementStats.saleCount}</p>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 rounded-xl p-4">
            <p className="text-xs text-amber-600 font-semibold uppercase">Adjustment</p>
            <p className="text-2xl font-bold text-amber-700 mt-1">{movementStats.adjustmentCount}</p>
          </div>
        </div>
      )}

      {/* Filter Bar: Flexible Layout */}
      <div className="flex flex-col lg:flex-row flex-wrap gap-4 mb-8 items-center justify-between">
        <div className="flex flex-col md:flex-row gap-4 flex-1 w-full lg:w-auto">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-4 inset-y-0 flex items-center text-slate-400" data-icon="search">search</span>
            <input
              className="w-full bg-white border border-slate-200 dark:border-slate-800 rounded-xl pl-12 pr-4 py-4 text-sm shadow-sm focus:ring-2 focus:ring-primary/20 outline-none"
              placeholder="Search by item name or SKU..."
              type="text"
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value)
                setCurrentPage(1)
              }}
              aria-label="Search stock movements"
            />
          </div>

          <div className="relative">
            <select
              className="appearance-none bg-white border border-slate-200 dark:border-slate-800 rounded-xl px-6 pr-12 py-4 text-sm shadow-sm focus:ring-2 focus:ring-primary/20 outline-none min-w-50"
              value={selectedType}
              onChange={(event) => {
                setSelectedType(event.target.value)
                setCurrentPage(1)
              }}
              aria-label="Filter by movement type"
            >
              <option value={ALL_MOVEMENT_TYPES}>All Types</option>
              {movementTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div className="relative">
            <select
              className="appearance-none bg-white border border-slate-200 dark:border-slate-800 rounded-xl px-6 pr-12 py-4 text-sm shadow-sm focus:ring-2 focus:ring-primary/20 outline-none min-w-50"
              value={selectedPeriod}
              onChange={(event) => {
                setSelectedPeriod(event.target.value)
                setCurrentPage(1)
              }}
              aria-label="Filter by period"
            >
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="90">Last 90 Days</option>
              <option value={ALL_PERIODS}>All Time</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap w-full lg:w-auto">
          <div className="relative flex-1">
            <select
              className="appearance-none bg-white border border-slate-200 dark:border-slate-800 rounded-xl px-6 pr-12 py-4 text-sm shadow-sm focus:ring-2 focus:ring-primary/20 outline-none w-full min-w-[200px]"
              value={selectedUser}
              onChange={(event) => {
                setSelectedUser(event.target.value)
                setCurrentPage(1)
              }}
              aria-label="Filter by user"
            >
              <option value={ALL_USERS}>All Users</option>
              {usersList.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          <button
            className="px-4 py-4 rounded-xl font-semibold text-sm border border-slate-200 bg-white text-slate-600 hover:text-primary hover:border-primary/40 transition-colors whitespace-nowrap"
            onClick={clearFilters}
            type="button"
            aria-label="Reset all filters"
          >
            Reset Filters
          </button>

          <button
            className="bg-blue-600 text-white px-5 py-4 rounded-xl font-bold flex items-center gap-2 shadow-sm hover:bg-blue-700 transition-all active:scale-95 duration-150 whitespace-nowrap"
            onClick={() => navigate('/stock-adjustment-form', { state: { from: location.pathname } })}
            aria-label="Record new stock adjustment"
          >
            <span className="material-symbols-outlined" data-icon="add">add</span>
            New Adjustment
          </button>
        </div>
      </div>

      {/* Data Table Section */}
      <div className="bg-white border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-separate border-spacing-y-1 p-4">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Item</th>
                <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Type</th>
                <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Quantity</th>
                <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Created At</th>
                <th className="px-6 py-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">User</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoadingMovements && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    <span className="material-symbols-outlined animate-spin inline mr-2">sync</span>
                    Loading stock movements...
                  </td>
                </tr>
              )}

              {!isLoadingMovements && !paginatedMovements.length && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    No stock movements found for the selected filters.
                  </td>
                </tr>
              )}

              {!isLoadingMovements && paginatedMovements.map((movement, index) => {
                const type = getMovementType(movement)
                const quantity = getMovementQuantity(movement)
                const dateTime = formatDateTime(getMovementTime(movement))
                const typeId = Number(
                  movement?.movement_type?.id
                  ?? movement?.movement_type_id
                  ?? movement?.movementTypeId,
                )

                const isAdjustment = typeId === 3
                  || movement?.stock_adjustment_id
                  || movement?.stock_adjustment?.id
                  || normalizeText(type).includes('adjust')

                const displayQuantity = isAdjustment ? -Math.abs(quantity) : quantity

                return (
                  <tr key={movement?.id || movement?.movement_id || index} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <p className="font-semibold text-slate-800 text-sm">{getMovementItemName(movement)}</p>
                        <p className="text-xs text-slate-500">SKU: {getMovementSku(movement)}</p>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`inline-flex px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-tight ${getTypeChipClass(type)}`}>
                        {type}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <p className="font-semibold text-slate-800 text-sm">{displayQuantity}</p>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <p className="font-bold text-slate-800 text-base">{dateTime.primary}</p>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">{dateTime.secondary}</p>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <p className="font-medium text-slate-700 text-sm">{getMovementUser(movement)}</p>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-6 py-4 bg-slate-50 flex flex-col sm:flex-row items-center gap-3 border-t border-slate-200">
          <p className="text-xs text-slate-500 font-medium">
            Showing <span className="font-semibold text-slate-800">{filteredMovements.length ? startIndex + 1 : 0} - {Math.min(startIndex + ROWS_PER_PAGE, filteredMovements.length)}</span>
            {' '}of <span className="font-semibold text-slate-800">{filteredMovements.length}</span> movements
          </p>

          <div className="flex items-center gap-2 sm:ml-auto">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={safeCurrentPage === 1}
              className={`p-2 rounded-lg border border-slate-200 transition-all ${safeCurrentPage === 1 ? 'bg-slate-50 text-slate-400 cursor-not-allowed opacity-50' : 'bg-slate-50 text-slate-600 hover:bg-primary hover:text-white'}`}
              aria-label="Previous page"
              type="button"
            >
              <span className="material-symbols-outlined" data-icon="chevron_left">chevron_left</span>
            </button>
            <div className="flex items-center gap-1">
              {visiblePageNumbers.map((pageNumber) => {
                const isActive = pageNumber === safeCurrentPage

                return (
                  <button
                    key={pageNumber}
                    onClick={() => setCurrentPage(pageNumber)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold ${isActive ? 'bg-primary text-white' : 'bg-slate-50 text-slate-600 hover:bg-primary hover:text-white border border-slate-200'}`}
                    type="button"
                  >
                    {pageNumber}
                  </button>
                )
              })}
            </div>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={safeCurrentPage === totalPages}
              className={`p-2 rounded-lg border border-slate-200 transition-all ${safeCurrentPage === totalPages ? 'bg-slate-50 text-slate-400 cursor-not-allowed opacity-50' : 'bg-slate-50 text-slate-600 hover:bg-primary hover:text-white'}`}
              aria-label="Next page"
              type="button"
            >
              <span className="material-symbols-outlined" data-icon="chevron_right">chevron_right</span>
            </button>
          </div>

          <button
            type="button"
            className="px-4 py-2 rounded-lg font-semibold text-sm border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
            onClick={exportCsv}
            aria-label="Export movements to CSV"
          >
            <span className="material-symbols-outlined text-sm mr-1 align-middle" data-icon="download">download</span>
            Export
          </button>
        </div>
      </div>
    </main>
  )
}

export default StockMovementPage
