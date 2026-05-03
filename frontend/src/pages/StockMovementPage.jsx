import { useCallback, useMemo, useState, useContext } from 'react'
import { AppContext } from '../context/AppContext'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useStockMovement } from '../services/useStockMovement'
import { useUser } from '../services/useUser'

const ROWS_PER_PAGE = 4
const ALL_MOVEMENT_TYPES = 'All Movement Types'
const ALL_PERIODS = 'all'
const ALL_USERS = 'All Users'

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
  const { userData } = useContext(AppContext)

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


  const filteredMovements = useMemo(() => {
    return movements
      .filter((movement) => {
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
      .sort((a, b) => {
        const timeA = new Date(getMovementTime(a)).getTime()
        const timeB = new Date(getMovementTime(b)).getTime()

        if (Number.isFinite(timeA) && Number.isFinite(timeB) && timeA !== timeB) {
          return timeB - timeA
        }

        const idA = Number(a?.id ?? a?.movement_id ?? 0)
        const idB = Number(b?.id ?? b?.movement_id ?? 0)
        return idB - idA
      })
  }, [movements, isAdjustmentModule, selectedType, selectedUser, searchTerm, selectedPeriod])


  const totalPages = Math.max(1, Math.ceil(filteredMovements.length / ROWS_PER_PAGE))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const startIndex = (safeCurrentPage - 1) * ROWS_PER_PAGE
  const endIndex = startIndex + ROWS_PER_PAGE
  const paginatedMovements = filteredMovements.slice(startIndex, endIndex)



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

  const openAdjustmentDetails = useCallback((movement) => {
    navigate('/stock-adjustment-form', {
      state: {
        from: location.pathname,
        mode: 'view',
        adjustment: movement,
      },
    })
  }, [navigate, location.pathname])


  return (
    <main className="ml-0 mt-0 p-4 sm:p-6 lg:p-8">

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
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

        {/* Table Header Info Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/60">
            <p className="text-xs font-semibold text-slate-500 tracking-wide uppercase">
                {filteredMovements.length} movement{filteredMovements.length !== 1 ? 's' : ''} found
            </p>
            <p className="text-xs text-slate-400">
                Page <span className="font-bold text-slate-600">{safeCurrentPage}</span> of <span className="font-bold text-slate-600">{totalPages}</span>
            </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Item</th>
                <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Type</th>
                <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Quantity</th>
                <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Created At</th>
                <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">User</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoadingMovements && (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <span className="material-symbols-outlined animate-spin text-primary text-2xl block mx-auto mb-2">sync</span>
                    <p className="text-sm text-slate-500 font-medium">Loading stock movements...</p>
                  </td>
                </tr>
              )}

              {!isLoadingMovements && !paginatedMovements.length && (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <span className="material-symbols-outlined text-4xl text-slate-300 block mb-3">manage_history</span>
                    <p className="text-sm font-semibold text-slate-600">No stock movements found</p>
                    <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or search term.</p>
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
                const isRowClickable = isAdjustment

                return (
                  <tr
                    key={movement?.id || movement?.movement_id || index}
                    className={`hover:bg-slate-50/80 transition-colors group ${isRowClickable ? 'cursor-pointer' : ''}`}
                    onClick={isRowClickable ? () => openAdjustmentDetails(movement) : undefined}
                    title={isRowClickable ? 'Click to view adjustment details' : undefined}
                  >
                    <td className="px-6 py-4">
                      <p className="font-semibold text-sm text-slate-800 leading-snug">{getMovementItemName(movement)}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5 font-mono">{getMovementSku(movement)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight ${getTypeChipClass(type)}`}>
                        {type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-800 text-sm">{displayQuantity}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-800 text-sm">{dateTime.primary}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5 font-mono">{dateTime.secondary}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-600 text-sm">{getMovementUser(movement)}</p>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 bg-slate-50/60 border-t border-slate-100 gap-4">

          {/* Count */}
          <p className="text-xs text-slate-500 font-medium shrink-0">
            Showing{' '}
            <span className="font-bold text-slate-700">
              {filteredMovements.length ? `${startIndex + 1}–${Math.min(endIndex, filteredMovements.length)}` : 0}
            </span>
            {' '}of{' '}
            <span className="font-bold text-slate-700">{filteredMovements.length}</span>
            {' '}movements
          </p>

          {/* Page Numbers */}
          <div className="flex items-center gap-1">
            {/* Prev */}
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={safeCurrentPage === 1}
              type="button"
              className={`p-1.5 rounded-lg border transition-all ${safeCurrentPage === 1 ? 'border-slate-200 bg-white text-slate-300 cursor-not-allowed' : 'border-slate-200 bg-white text-slate-600 hover:bg-primary hover:text-white hover:border-primary'}`}
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
                let start = Math.max(2, safeCurrentPage - half)
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
                      className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-bold transition-all border ${page === safeCurrentPage ? 'bg-primary text-white border-primary shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-primary hover:text-white hover:border-primary'}`}
                    >
                      {page}
                    </button>
                  )
              )
            })()}

            {/* Next */}
            <button
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={safeCurrentPage === totalPages}
              type="button"
              className={`p-1.5 rounded-lg border transition-all ${safeCurrentPage === totalPages ? 'border-slate-200 bg-white text-slate-300 cursor-not-allowed' : 'border-slate-200 bg-white text-slate-600 hover:bg-primary hover:text-white hover:border-primary'}`}
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
              aria-label="Export movements to CSV"
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

export default StockMovementPage
