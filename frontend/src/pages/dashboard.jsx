import { useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AppContext } from '../context/AppContext'
import { resolveRoleConfig } from '../constants/accessControl'
import { useDashboard } from '../services/useDashboard'
import { useItem } from '../services/useItem'
import { useSale } from '../services/useSale'

const fmtMoney = (value) =>
  `Rs ${Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

const fmtCompactMoney = (value) => {
  const n = Number(value || 0)
  if (n >= 1_000_000) return `Rs ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `Rs ${(n / 1_000).toFixed(0)}K`
  return fmtMoney(n)
}

const safeToNumber = (value) => {
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, '').trim())
    return Number.isFinite(parsed) ? parsed : 0
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const safeToPercent = (value) => {
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/%/g, '').replace(/,/g, '').trim())
    return Number.isFinite(parsed) ? parsed : 0
  }

  return safeToNumber(value)
}

const clampPercent = (value) => Math.min(100, Math.max(0, safeToPercent(value)))

const parseDateValue = (value) => {
  if (!value) return null

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  if (typeof value === 'object') {
    if (typeof value?.toDate === 'function') {
      const fromToDate = value.toDate()
      if (fromToDate instanceof Date && !Number.isNaN(fromToDate.getTime())) {
        return fromToDate
      }
    }

    const secondsLike = value?.seconds ?? value?._seconds ?? value?.epochSecond ?? value?.unix
    if (Number.isFinite(Number(secondsLike))) {
      const parsed = new Date(Number(secondsLike) * 1000)
      if (!Number.isNaN(parsed.getTime())) return parsed
    }

    const millisLike = value?.milliseconds ?? value?.millis ?? value?.epochMillis ?? value?.timestampMs
    if (Number.isFinite(Number(millisLike))) {
      const parsed = new Date(Number(millisLike))
      if (!Number.isNaN(parsed.getTime())) return parsed
    }

    if (value?.$date) {
      return parseDateValue(value.$date)
    }
  }

  if (typeof value === 'number') {
    const normalized = value < 1_000_000_000_000 ? value * 1000 : value
    const parsed = new Date(normalized)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null

    if (/^\d{14,17}$/.test(trimmed)) {
      const asNumber = Number(trimmed)
      const normalized = trimmed.length >= 16 ? Math.floor(asNumber / 1000) : asNumber
      const parsed = new Date(normalized)
      return Number.isNaN(parsed.getTime()) ? null : parsed
    }

    if (/^\d{10,13}$/.test(trimmed)) {
      const asNumber = Number(trimmed)
      const normalized = trimmed.length === 10 ? asNumber * 1000 : asNumber
      const parsed = new Date(normalized)
      return Number.isNaN(parsed.getTime()) ? null : parsed
    }

    const normalized =
      trimmed.includes(' ') && !trimmed.includes('T') ? trimmed.replace(' ', 'T') : trimmed
    const parsed = new Date(normalized)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  return null
}

const parseObjectIdDate = (value) => {
  const raw = String(value || '').trim()
  if (!/^[0-9a-fA-F]{24}$/.test(raw)) return null

  const seconds = Number.parseInt(raw.slice(0, 8), 16)
  if (!Number.isFinite(seconds)) return null

  const parsed = new Date(seconds * 1000)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const relTime = (dateValue) => {
  if (!dateValue) return 'Just now'

  if (typeof dateValue === 'string') {
    const raw = dateValue.trim()
    const lowered = raw.toLowerCase()
    if (
      lowered === 'just now' ||
      lowered.includes('ago') ||
      lowered.startsWith('in ') ||
      lowered.includes('minute') ||
      lowered.includes('hour') ||
      lowered.includes('day')
    ) {
      return raw
    }
  }

  const d = parseDateValue(dateValue)
  if (!d) return 'Just now'

  const diffMinutes = Math.floor((Date.now() - d.getTime()) / 60_000)
  const minutes = Math.abs(diffMinutes)
  if (minutes < 1) return 'Just now'
  if (diffMinutes < 0 && minutes < 60) return `in ${minutes}m`
  if (diffMinutes < 0) {
    const hoursAhead = Math.floor(minutes / 60)
    if (hoursAhead < 24) return `in ${hoursAhead}h`
    return `in ${Math.floor(hoursAhead / 24)}d`
  }
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

const formatLiveFeedDateTime = (dateValue) => {
  const parsed = parseDateValue(dateValue)
  if (!parsed) return null

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(parsed)
  } catch {
    return parsed.toLocaleString()
  }
}

const resolveStockMovementCreatedAt = (entry = {}) => {
  // Check standard variations of stock_movement field
  const stockMovement = entry?.stock_movement ?? entry?.stockMovement ?? entry?.movement ?? null
  
  if (stockMovement) {
    const value = 
      stockMovement?.created_at ??
      stockMovement?.createdAt ??
      stockMovement?.created ??
      stockMovement?.timestamp ??
      stockMovement?.date ??
      null
    if (value) return value
  }

  // Check root-level stock_movement_* fields
  return (
    entry?.stock_movement_created_at ??
    entry?.stockMovementCreatedAt ??
    entry?.stock_movement_timestamp ??
    entry?.stockMovementTimestamp ??
    entry?.movement_created_at ??
    entry?.movementCreatedAt ??
    null
  )
}

const resolveLiveFeedResolvedDate = (entry = {}) => {
  // Priority 1: Extract stock_movement.created_at (primary source for timestamp)
  const stockMovementCreatedAt = resolveStockMovementCreatedAt(entry)
  if (stockMovementCreatedAt) {
    const parsed = parseDateValue(stockMovementCreatedAt)
    if (parsed) return parsed
  }

  // Priority 2: Try comprehensive timestamp search across entry fields
  const timestamp = resolveLiveFeedTimestamp(entry)
  if (timestamp) {
    const parsed = parseDateValue(timestamp)
    if (parsed) return parsed
  }

  // Priority 3: Try relative time labels (already formatted by backend)
  const timeLabel = resolveLiveFeedTimeLabel(entry)
  if (timeLabel) {
    const parsed = parseDateValue(timeLabel)
    if (parsed) return parsed
  }

  // No timestamp found - return null to trigger fallback in buildLiveFeedTiming
  return null
}

const buildLiveFeedTiming = ({ resolvedDate, fallbackBase, fallbackIndex }) => {
  // Only use fallback if no real timestamp was resolved
  const fallbackTimestamp = new Date(fallbackBase.getTime() - (fallbackIndex + 1) * 5 * 60_000)
  const effectiveDate = resolvedDate || fallbackTimestamp
  const displayTimeExact = formatLiveFeedDateTime(effectiveDate) || 'Unknown time'

  return {
    createdAt: effectiveDate,
    displayTime: relTime(effectiveDate),
    displayTimeExact,
    timeTitle: displayTimeExact,
  }
}

const resolveLiveFeedTimestamp = (entry = {}) => {
  const isLikelyTimestampKey = (key = '') => {
    const normalized = String(key).trim()
    if (!normalized) return false

    return /(^|_|-)(created|updated|event|occurred|time|date|timestamp)(_|-|$)|(?:created|updated|occurred|event)At$/i.test(normalized)
  }

  const stockMovementCreatedAt = resolveStockMovementCreatedAt(entry)
  if (stockMovementCreatedAt) return stockMovementCreatedAt

  const directTimestamp =
    entry?.createdAt ??
    entry?.created_at ??
    entry?.created ??
    entry?.createdOn ??
    entry?.timestamp ??
    entry?.time ??
    entry?.date ??
    entry?.eventDate ??
    entry?.event_time ??
    entry?.eventTime ??
    entry?.occurred_at ??
    entry?.occurredAt ??
    entry?.loggedAt ??
    entry?.sale_date ??
    entry?.order_date ??
    entry?.grn_date ??
    entry?.transaction_date ??
    entry?.datetime ??
    entry?.date_time ??
    entry?.updatedAt ??
    entry?.updated_at ??
    entry?.lastUpdated ??
    entry?.last_updated ??
    null

  if (directTimestamp) return directTimestamp

  // Some APIs place event time in nested payload blocks (e.g. sale, grn, item).
  // Walk a small object tree and pick the first parseable timestamp candidate.
  const findNestedTimestamp = (value, depth = 0) => {
    if (depth > 3 || value == null) return null

    if (Array.isArray(value)) {
      for (const row of value) {
        const nested = findNestedTimestamp(row, depth + 1)
        if (nested) return nested
      }
      return null
    }

    if (typeof value !== 'object') return null

    for (const [key, raw] of Object.entries(value)) {
      const looksLikeTimeKey = isLikelyTimestampKey(key)

      if (looksLikeTimeKey && parseDateValue(raw)) {
        return raw
      }

      const nested = findNestedTimestamp(raw, depth + 1)
      if (nested) return nested
    }

    return null
  }

  const nestedTimestamp = findNestedTimestamp(entry)
  if (nestedTimestamp) return nestedTimestamp

  const idLikeCandidates = [
    entry?.id,
    entry?._id,
    entry?.event_id,
    entry?.eventId,
    entry?.sale_id,
    entry?.saleId,
    entry?.grn_id,
    entry?.grnId,
    entry?.po_id,
    entry?.poId,
    entry?.item_id,
    entry?.itemId,
  ]

  for (const candidate of idLikeCandidates) {
    const parsedFromObjectId = parseObjectIdDate(candidate)
    if (parsedFromObjectId) return parsedFromObjectId
  }

  const keyMatch = Object.keys(entry).find((key) => isLikelyTimestampKey(key))

  return keyMatch ? entry[keyMatch] : null
}

const resolveLiveFeedTimeLabel = (entry = {}) =>
  entry?.relativeTime ||
  entry?.relative_time ||
  entry?.timeAgo ||
  entry?.time_ago ||
  entry?.when ||
  null

const EMPTY_SUMMARY = {
  total_sales_today: 0,
  total_sales_count_today: 0,
  total_items: 0,
  low_stock_count: 0,
  total_suppliers: 0,
  total_grn_today: 0,
  pending_grn_today: 0,
  total_stock_value: 0,
}

const EMPTY_SALES_TREND = [
  { label: 'Mon', amount: 0 },
  { label: 'Tue', amount: 0 },
  { label: 'Wed', amount: 0 },
  { label: 'Thu', amount: 0 },
  { label: 'Fri', amount: 0 },
  { label: 'Sat', amount: 0 },
  { label: 'Sun', amount: 0 },
]

const EMPTY_LIST = []

const FALLBACK_LIVE_FEED = [
  {
    title: 'Stock Adjusted: INV-902',
    actor: 'Admin Alex',
    createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    description: '+100 units due to inventory recount.',
    icon: 'add',
    tone: 'blue',
  },
  {
    title: 'GRN Created: #2024-001',
    actor: 'Warehouse Dock 4',
    createdAt: new Date(Date.now() - 22 * 60_000).toISOString(),
    description: 'Inbound delivery received and matched.',
    icon: 'local_shipping',
    tone: 'teal',
  },
  {
    title: 'Stock Damaged Report',
    actor: 'Item: Crystal Vase',
    createdAt: new Date(Date.now() - 60 * 60_000).toISOString(),
    description: '05 units written off as breakage.',
    icon: 'close',
    tone: 'rose',
  },
  {
    title: 'Bulk Sale: INV-8919',
    actor: 'Register 01',
    createdAt: new Date(Date.now() - 3 * 60 * 60_000).toISOString(),
    description: 'High-volume sale completed successfully.',
    icon: 'sell',
    tone: 'amber',
  },
]

const resolveLiveFeedVisual = (entry = {}) => {
  const eventText = [
    entry?.type,
    entry?.category,
    entry?.title,
    entry?.label,
    entry?.description,
    entry?.details,
    entry?.message,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (
    eventText.includes('adjust') ||
    eventText.includes('adjustment') ||
    eventText.includes('stock adjusted')
  ) {
    return { icon: 'build', tone: 'yellow' }
  }

  if (
    eventText.includes('purchase order') ||
    eventText.includes('po ') ||
    eventText.startsWith('po:') ||
    eventText.includes('p.o') ||
    eventText.includes('po#') ||
    eventText.includes('po-') ||
    eventText.includes('order sent') ||
    eventText.includes('sent to supplier') ||
    eventText.includes('po created') ||
    eventText.includes('purchase order created')
  ) {
    return { icon: 'arrow_forward', tone: 'blue' }
  }

  if (
    eventText.includes('grn') ||
    eventText.includes('delivery') ||
    eventText.includes('received') ||
    eventText.includes('inbound')
  ) {
    return { icon: 'local_shipping', tone: 'green' }
  }

  if (
    eventText.includes('sale') ||
    eventText.includes('invoice') ||
    eventText.includes('checkout')
  ) {
    return { icon: 'shopping_cart', tone: 'red' }
  }

  return { icon: 'notifications', tone: 'slate' }
}

const CARD_COLORS = ['#2563eb', '#004ac6', '#0f766e', '#943700', '#7c3aed', '#f59e0b']
const TOP_LIST_LIMIT = 5

const stockDistributionCircumference = 2 * Math.PI * 70

const categoryToneClass = (index) => {
  const palette = [
    'from-blue-500 to-blue-400',
    'from-indigo-500 to-violet-500',
    'from-teal-500 to-cyan-500',
    'from-amber-500 to-orange-500',
  ]

  return palette[index % palette.length]
}

const getCategoryName = (item) =>
  item?.category?.name ||
  item?.category?.categoryName ||
  item?.category?.label ||
  item?.category_name ||
  item?.categoryName ||
  'Uncategorized'

const getSupplierName = (item) =>
  item?.supplier?.name ||
  item?.supplier?.supplierName ||
  item?.supplier_name ||
  item?.supplierName ||
  'Unknown supplier'

const getItemQuantity = (item) =>
  safeToNumber(
    item?.current_stock ??
    item?.quantity ??
    item?.available_quantity ??
    item?.available_stock ??
    item?.stock ??
    item?.stock_qty ??
    item?.qty_on_hand ??
    item?.qty ??
    0,
  )

const getItemUnitValue = (item) =>
  safeToNumber(item?.selling_price ?? item?.price ?? item?.unit_price ?? item?.cost_price ?? 0)

const getItemReorderLevel = (item) =>
  safeToNumber(item?.reorder_level ?? item?.reorderLevel ?? item?.minimum_stock ?? item?.min_stock ?? 0)

const getItemValue = (item) => {
  const quantity = getItemQuantity(item)
  const unitValue = getItemUnitValue(item)
  return quantity > 0 && unitValue > 0 ? quantity * unitValue : quantity || unitValue || 0
}

const getSaleDateValue = (sale) => {
  const dateValue = sale?.sale_date || sale?.saleDate || sale?.createdAt || sale?.created_at || sale?.date || null
  const timestamp = dateValue ? new Date(dateValue).getTime() : 0
  return Number.isFinite(timestamp) ? timestamp : 0
}

const aggregateItems = (items, getKey) => {
  const grouped = new Map()

  items.forEach((item, index) => {
    const key = getKey(item, index)
    if (!key) return

    const current = grouped.get(key) || { name: key, amount: 0 }
    current.amount += getItemValue(item)
    grouped.set(key, current)
  })

  const rows = Array.from(grouped.values()).sort((left, right) => right.amount - left.amount)
  const totalAmount = rows.reduce((sum, row) => sum + row.amount, 0)

  return rows.map((row, index) => ({
    ...row,
    share: totalAmount ? Math.round((row.amount / totalAmount) * 100) : 0,
    color: CARD_COLORS[index % CARD_COLORS.length],
  }))
}

const getTopStockDistribution = (rows) => {
  const topRows = rows
    .map((row) => ({
      ...row,
      share: Math.max(0, safeToNumber(row?.share || 0)),
    }))
    .sort((left, right) => right.share - left.share)
    .slice(0, TOP_LIST_LIMIT)

  const totalShare = topRows.reduce((sum, row) => sum + row.share, 0)
  let runningShare = 0

  return topRows.map((row, index) => {
    const normalizedShare = totalShare ? Math.round((row.share / totalShare) * 100) : 0
    const dashOffset = (runningShare / 100) * stockDistributionCircumference
    const dashArray = (normalizedShare / 100) * stockDistributionCircumference
    runningShare += normalizedShare

    return {
      ...row,
      share: normalizedShare,
      color: row.color || CARD_COLORS[index % CARD_COLORS.length],
      dashOffset,
      dashArray,
    }
  })
}

const getTopSellingCategories = (rows) => {
  const topRows = rows
    .map((row) => ({
      ...row,
      amount: safeToNumber(row?.amount || 0),
    }))
    .filter((row) => row.amount > 0)
    .sort((left, right) => right.amount - left.amount)
    .slice(0, TOP_LIST_LIMIT)

  const totalAmount = topRows.reduce((sum, row) => sum + row.amount, 0)

  return topRows.map((row, index) => ({
    ...row,
    share: totalAmount ? Math.round((row.amount / totalAmount) * 100) : 0,
    color: row.color || CARD_COLORS[index % CARD_COLORS.length],
  }))
}

const permissionBlock = (title) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
    <span className="material-symbols-outlined text-2xl text-slate-400">lock</span>
    <p className="mt-2 text-sm font-semibold text-slate-700">No access to {title}</p>
    <p className="text-xs text-slate-500">Your role does not allow this section.</p>
  </div>
)

const SectionCard = ({ title, subtitle, children, right, className = '', contentClassName = '' }) => (
  <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      {right}
    </div>
    <div className={contentClassName}>{children}</div>
  </section>
)

const MetricTile = ({ label, value, hint, icon, tone = 'blue' }) => {
  const tones = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    teal: 'bg-teal-50 text-teal-700 border-teal-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    rose: 'bg-rose-50 text-rose-700 border-rose-100',
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">{label}</p>
        <span className={`rounded-lg border p-1.5 ${tones[tone] || tones.blue}`}>
          <span className="material-symbols-outlined text-base">{icon}</span>
        </span>
      </div>
      <p className="text-2xl font-bold tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  )
}

const SalesChart = ({ trend }) => {
  const chartData = useMemo(
    () =>
      trend.map((entry) => ({
        label: entry?.label || '-',
        displayLabel: entry?.displayLabel || entry?.label || '-',
        amount: Number(entry?.amount || 0),
      })),
    [trend],
  )

  const peak = useMemo(
    () => Math.max(...chartData.map((entry) => entry.amount), 0),
    [chartData],
  )

  return (
    <div className="rounded-2xl border border-slate-200 bg-linear-to-b from-slate-50 to-white p-3">
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="displayLabel"
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
              tickFormatter={(value) => fmtCompactMoney(value)}
              width={70}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '14px',
                boxShadow: '0 12px 30px rgba(15, 23, 42, 0.08)',
              }}
              labelStyle={{ color: '#334155', fontWeight: 700 }}
              formatter={(value) => [fmtMoney(value), 'Sales']}
            />
            <Area
              type="monotone"
              dataKey="amount"
              stroke="#2563eb"
              strokeWidth={3}
              fill="url(#salesGradient)"
              activeDot={{ r: 6, stroke: '#2563eb', strokeWidth: 2, fill: '#ffffff' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-slate-500">
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1">Peak: {fmtCompactMoney(peak)}</span>
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1">7 day trend</span>
      </div>
    </div>
  )
}

const DecisionBadge = ({ label, value, tone = 'slate', icon }) => {
  const tones = {
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  }

  return (
    <div className={`rounded-xl border px-3 py-2 ${tones[tone] || tones.slate}`}>
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em]">
        {icon && <span className="material-symbols-outlined text-sm">{icon}</span>}
        {label}
      </div>
      <p className="text-sm font-bold">{value}</p>
    </div>
  )
}

const StockDistributionCard = ({ items }) => {
  const capacity = 84

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-bold text-slate-900">Stock Distribution</h2>
        <p className="text-xs text-slate-500">Share by primary supplier</p>
      </div>

      <div className="flex flex-col items-center justify-center">
        <div className="relative flex h-56 w-56 items-center justify-center">
          <svg className="h-48 w-48 -rotate-90" viewBox="0 0 192 192" aria-hidden="true">
            <circle cx="96" cy="96" r="70" fill="transparent" stroke="#f1f5f9" strokeWidth="24" />
            {items.map((item, index) => (
              <circle
                key={item.name}
                cx="96"
                cy="96"
                r="70"
                fill="transparent"
                stroke={item.color}
                strokeWidth="24"
                strokeDasharray={`${item.dashArray} ${stockDistributionCircumference - item.dashArray}`}
                strokeDashoffset={-item.dashOffset}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 500ms ease, stroke-dasharray 500ms ease' }}
                opacity={1 - index * 0.02}
              />
            ))}
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="text-3xl font-extrabold tracking-tight text-slate-900">{capacity}%</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Capacity</span>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {items.length > 0 ? items.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-3 text-xs">
            <div className="flex min-w-0 items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="truncate text-slate-500">{item.name}</span>
            </div>
            <span className="font-bold text-slate-900">{item.share}%</span>
          </div>
        )) : <p className="text-center text-xs text-slate-500">No stock data available.</p>}
      </div>
    </section>
  )
}

const TopSellingCategoriesCard = ({ items }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-5">
      <h2 className="text-base font-bold text-slate-900">Top Selling Categories</h2>
      <p className="text-xs text-slate-500">Live stock value concentration by category</p>
    </div>

    <div className="space-y-4">
      {items.length > 0 ? items.map((item, index) => (
        <div key={item.name} className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-slate-700">{item.name}</span>
            <span className="font-bold text-slate-900">{fmtCompactMoney(item.amount)}</span>
          </div>
          <div className="h-8 overflow-hidden rounded-xl bg-slate-100">
            <div
              className={`h-full rounded-xl bg-linear-to-r ${categoryToneClass(index)} transition-all duration-500`}
              style={{
                width: `${clampPercent(item.share)}%`,
                minWidth: clampPercent(item.share) > 0 ? '8px' : undefined,
                backgroundColor: item.color || '#2563eb',
              }}
            />
          </div>
        </div>
      )) : <p className="text-center text-sm text-slate-500">No category data available.</p>}
    </div>
  </section>
)

const LiveFeedCard = ({ entries = [], right }) => {
  const tones = {
    blue: 'bg-blue-600',
    red: 'bg-red-600',
    green: 'bg-emerald-600',
    yellow: 'bg-amber-500',
    slate: 'bg-slate-600',
  }

  const safeEntries = Array.isArray(entries) ? entries : []

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-blue-700">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            Live Feed
          </div>
          <h2 className="mt-3 text-base font-bold text-slate-900">Latest stock and sales events</h2>
          <p className="text-xs text-slate-500">Most recent activity appears at the top.</p>
        </div>
        <div className="flex flex-col items-end gap-2">{right}</div>
      </div>

      <div className="relative space-y-3 before:absolute before:bottom-2 before:left-4 before:top-2 before:w-px before:bg-slate-200">
        {safeEntries.map((entry, index) => (
          <div
            key={entry.id || `${entry.title}-${index}`}
            className="relative flex gap-4 rounded-xl border border-slate-100 bg-slate-50/70 p-3 transition-colors hover:border-slate-200 hover:bg-white"
          >
            <div className={`z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white shadow-sm ${tones[entry.tone] || tones.slate}`}>
              <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                {entry.icon}
              </span>
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900">{entry.title}</p>
                  <p className="truncate text-[10px] text-slate-500">{entry.actor || 'System'}</p>
                </div>
                <span
                  className="shrink-0 rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700"
                  title={entry.timeTitle || entry.createdAt || entry.timeLabel || ''}
                >
                  {entry.displayTimeExact || entry.displayTime || entry.timeLabel || 'Unknown time'}
                </span>
              </div>
              <p className="text-[10px] font-medium text-slate-500">{entry.displayTime || 'Unknown time'}</p>
              {entry.description && (
                <div className="rounded-lg border border-slate-200 bg-white p-2">
                  <p className="text-[10px] font-medium leading-5 text-slate-600">{entry.description}</p>
                </div>
              )}
            </div>
          </div>
        ))}
        {!safeEntries.length && (
          <div className="relative rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 pl-12 text-xs text-slate-500">
            <span className="absolute left-4 top-4 text-slate-400">
              <span className="material-symbols-outlined text-[18px]">notifications</span>
            </span>
            No live feed activity yet.
          </div>
        )}
      </div>
    </section>
  )
}

const Dashboard = () => {
  const navigate = useNavigate()
  const { userData } = useContext(AppContext)
  const roleConfig = resolveRoleConfig(userData?.role)
  const permissions = roleConfig.permissions

  const { dashboard, isLoadingDashboard, reloadDashboard } = useDashboard()
  const { items, isLoadingItems, reloadItems } = useItem()
  const { sales, isLoadingSales, reloadSales } = useSale()
  const hasItemData = Array.isArray(items) && items.length > 0
  const summary = useMemo(() => dashboard?.summary || EMPTY_SUMMARY, [dashboard])

  const salesTrend = useMemo(
    () => (dashboard?.salesTrend?.length ? dashboard.salesTrend : EMPTY_SALES_TREND),
    [dashboard],
  )

  const recentSales = useMemo(() => {
    const salesSource = Array.isArray(sales) && sales.length
      ? sales
      : (Array.isArray(dashboard?.recentSales) ? dashboard.recentSales : EMPTY_LIST)

    return [...salesSource].sort((left, right) => getSaleDateValue(right) - getSaleDateValue(left))
  }, [sales, dashboard])
  const lowStockItems = useMemo(
    () => (Array.isArray(dashboard?.lowStockItems) ? dashboard.lowStockItems : EMPTY_LIST),
    [dashboard],
  )
  const inventoryAlerts = useMemo(() => {
    if (hasItemData) {
      return items
        .map((item, index) => {
          const quantity = getItemQuantity(item)
          const reorderLevel = getItemReorderLevel(item)
          const isOut = quantity <= 0
          const isLow = !isOut && reorderLevel > 0 && quantity <= reorderLevel

          if (!isOut && !isLow) return null

          const levelPercent = reorderLevel > 0 ? Math.min(100, Math.round((quantity / reorderLevel) * 100)) : 0

          return {
            id: item?.id || `item-${index}`,
            item_name: item?.item_name || item?.name || 'Unnamed item',
            sku: item?.sku || item?.item_code || '',
            supplier_id: item?.supplier?.id || item?.supplier?.supplier_id || item?.supplier_id || item?.supplierId || '',
            quantity,
            is_out_of_stock: isOut,
            level_percent: levelPercent,
          }
        })
        .filter(Boolean)
        .sort((left, right) => {
          if (left.is_out_of_stock !== right.is_out_of_stock) {
            return left.is_out_of_stock ? -1 : 1
          }
          return left.quantity - right.quantity
        })
    }

    return lowStockItems.map((item, index) => ({
      id: item?.id || `item-${index}`,
      item_name: item?.item_name || item?.name || 'Unnamed item',
      sku: item?.sku || item?.item_code || '',
      supplier_id: item?.supplier?.id || item?.supplier?.supplier_id || item?.supplier_id || item?.supplierId || '',
      quantity: Number(item?.quantity || 0),
      is_out_of_stock: Boolean(item?.is_out_of_stock),
      level_percent: Number(item?.level_percent || 0),
    }))
  }, [items, hasItemData, lowStockItems])
  const purchaseActivity = useMemo(
    () => (Array.isArray(dashboard?.purchaseActivity) ? dashboard.purchaseActivity : EMPTY_LIST),
    [dashboard],
  )
  const liveFeed = useMemo(
    () => (Array.isArray(dashboard?.liveFeed) ? dashboard.liveFeed : EMPTY_LIST),
    [dashboard],
  )
  const [stockValueRefreshAt, setStockValueRefreshAt] = useState(new Date().toISOString())

  useEffect(() => {
    const refreshDashboardData = () => {
      reloadItems()
      reloadDashboard()
      reloadSales()
      setStockValueRefreshAt(new Date().toISOString())
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshDashboardData()
      }
    }

    window.addEventListener('focus', refreshDashboardData)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    const realtimeRefresh = window.setInterval(refreshDashboardData, 30_000)

    return () => {
      window.removeEventListener('focus', refreshDashboardData)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.clearInterval(realtimeRefresh)
    }
  }, [reloadItems, reloadDashboard, reloadSales])

  const stockDistribution = useMemo(() => {
    if (Array.isArray(dashboard?.stockDistribution) && dashboard.stockDistribution.length) {
      return getTopStockDistribution(
        dashboard.stockDistribution
        .map((entry, index) => ({
          name: entry?.name || entry?.supplier_name || `Supplier ${index + 1}`,
          share: safeToNumber(entry?.share ?? entry?.percentage ?? entry?.percent ?? entry?.value ?? entry?.amount ?? 0),
          color: entry?.color || CARD_COLORS[index % CARD_COLORS.length],
        }))
        .filter((entry) => entry.name && entry.share > 0),
      )
    }

    if (!hasItemData) return []

    return getTopStockDistribution(aggregateItems(items, (item) => getSupplierName(item)))
  }, [dashboard, items, hasItemData])

  const topSellingCategories = useMemo(() => {
    if (hasItemData) {
      const liveCategories = getTopSellingCategories(aggregateItems(items, (item) => getCategoryName(item)))
      if (liveCategories.length) return liveCategories
    }

    if (Array.isArray(dashboard?.topSellingCategories) && dashboard.topSellingCategories.length) {
      return getTopSellingCategories(
        dashboard.topSellingCategories
        .map((entry, index) => ({
          name:
            entry?.name ||
            entry?.category ||
            entry?.category_name ||
            entry?.categoryName ||
            entry?.label ||
            `Category ${index + 1}`,
          amount: safeToNumber(
            entry?.amount ??
            entry?.total ??
            entry?.total_amount ??
            entry?.sales_amount ??
            entry?.salesTotal ??
            entry?.value ??
            0,
          ),
          share: safeToNumber(entry?.share ?? entry?.percentage ?? entry?.percent ?? 0),
        }))
        .filter((entry) => entry.name && entry.amount >= 0),
      )
    }

    return []
  }, [dashboard, items, hasItemData])

  const liveFeedEntries = useMemo(() => {
    const source = liveFeed.length ? liveFeed : FALLBACK_LIVE_FEED
    const fallbackBase = parseDateValue(stockValueRefreshAt) || new Date(stockValueRefreshAt)

    const normalized = source.map((entry, index) => {
      const resolvedDate = resolveLiveFeedResolvedDate(entry)
      const resolvedTime = resolvedDate?.getTime() ?? Number.NEGATIVE_INFINITY

      // Debug: Log timestamp extraction
      if (process.env.NODE_ENV === 'development' && !resolvedDate) {
        console.warn(`[LiveFeed] Entry ${index} ("${entry?.title}") has no timestamp extracted`, {
          entry,
          stockMovement: entry?.stock_movement,
          timestamp: entry?.createdAt || entry?.created_at,
        })
      }

      return {
        entry,
        index,
        resolvedDate,
        resolvedTime,
      }
    })

    normalized.sort((left, right) => {
      if (left.resolvedTime === right.resolvedTime) return left.index - right.index
      return right.resolvedTime - left.resolvedTime
    })

    return normalized
      .map((row, sortedIndex) => {
        const entry = row.entry
        const visual = resolveLiveFeedVisual(entry)
        const eventTimeLabel = resolveLiveFeedTimeLabel(entry)
        const timing = buildLiveFeedTiming({
          resolvedDate: row.resolvedDate,
          fallbackBase,
          fallbackIndex: sortedIndex,
        })

        return {
          id: entry?.id || row.index,
          title: entry?.title || entry?.label || 'System event',
          actor: entry?.actor || entry?.source || 'System',
          createdAt: timing.createdAt,
          timeLabel: eventTimeLabel,
          displayTime: timing.displayTime,
          displayTimeExact: timing.displayTimeExact,
          timeTitle: timing.timeTitle,
          description: entry?.description || entry?.details || entry?.message || '',
          icon: visual.icon,
          tone: visual.tone,
        }
      })
  }, [liveFeed, stockValueRefreshAt])

  const recentSalesTotal = useMemo(
    () => recentSales.reduce((sum, sale) => sum + Number(sale?.total_amount || 0), 0),
    [recentSales],
  )

  const decisionModel = useMemo(() => {
    const lowStockCount = Number(summary.low_stock_count || 0)
    const pendingGrn = Number(summary.pending_grn_today || 0)
    const totalSalesToday = Number(summary.total_sales_today || 0)
    const totalSalesCount = Number(summary.total_sales_count_today || 0)
    const trendValues = salesTrend.map((point) => Number(point?.amount || 0))
    const todayTrend = trendValues[trendValues.length - 1] || 0
    const yesterdayTrend = trendValues[trendValues.length - 2] || 0
    const trendChange = yesterdayTrend > 0 ? ((todayTrend - yesterdayTrend) / yesterdayTrend) * 100 : 0

    const health =
      lowStockCount >= 20 || pendingGrn >= 5
        ? { label: 'Critical', tone: 'rose' }
        : lowStockCount >= 8 || pendingGrn >= 2
          ? { label: 'Watch', tone: 'amber' }
          : { label: 'Stable', tone: 'emerald' }

    const priorities = [
      {
        id: 'low-stock',
        show: permissions.inventory && lowStockCount > 0,
        text: `Review ${lowStockCount} low-stock items and raise purchase orders`,
        tone: lowStockCount >= 10 ? 'rose' : 'amber',
        icon: 'inventory_2',
      },
      {
        id: 'pending-grn',
        show: permissions.grn && pendingGrn > 0,
        text: `Clear ${pendingGrn} pending GRN records to unblock inventory accuracy`,
        tone: pendingGrn >= 3 ? 'rose' : 'amber',
        icon: 'receipt_long',
      },
      {
        id: 'sales-push',
        show: permissions.sales && totalSalesCount < 15,
        text: 'Sales volume is low today, trigger cashier upsell push',
        tone: 'blue',
        icon: 'point_of_sale',
      },
      {
        id: 'healthy-run',
        show: true,
        text: 'No major blockers, keep normal operations and monitor feed',
        tone: 'emerald',
        icon: 'verified',
      },
    ]
      .filter((item) => item.show)
      .slice(0, 3)

    return {
      health,
      trendChange,
      totalSalesToday,
      totalSalesCount,
      priorities,
    }
  }, [summary, salesTrend, permissions])

  const quickLinks = useMemo(
    () => [
      { id: 'sales', label: 'Open Sales', icon: 'point_of_sale', path: '/sales', show: permissions.sales, priority: true },
      { id: 'items', label: 'Manage Items', icon: 'inventory_2', path: '/items', show: permissions.inventory, priority: false },
      { id: 'grn', label: 'Go To GRN', icon: 'receipt_long', path: '/grns', show: permissions.grn, priority: false },
      { id: 'po', label: 'Purchase Orders', icon: 'local_shipping', path: '/po', show: permissions.purchaseOrders, priority: false },
      { id: 'reports', label: 'View Reports', icon: 'assessment', path: '/reports', show: permissions.reports, priority: false },
    ].filter((link) => link.show),
    [permissions],
  )

  const salesPulseKpi = useMemo(() => {
    const totalSalesToday = safeToNumber(summary.total_sales_today)
    const totalSalesCount = Math.max(0, safeToNumber(summary.total_sales_count_today))
    const normalizedTrend = salesTrend.map((point) => ({
      label: point?.label || '-',
      amount: safeToNumber(point?.amount || 0),
    }))

    const weekTotal = normalizedTrend.reduce((sum, point) => sum + point.amount, 0)
    const weekAvg = normalizedTrend.length ? weekTotal / normalizedTrend.length : 0
    const avgTicket = totalSalesCount > 0 ? totalSalesToday / totalSalesCount : 0
    const bestDay = normalizedTrend.reduce(
      (best, point) => (point.amount > best.amount ? point : best),
      { label: '-', amount: 0 },
    )

    const todayVsAvgPct = weekAvg > 0 ? ((totalSalesToday - weekAvg) / weekAvg) * 100 : 0
    const todayIndexPct = weekAvg > 0 ? Math.min(200, Math.round((totalSalesToday / weekAvg) * 100)) : 0

    return {
      totalSalesToday,
      totalSalesCount,
      weekTotal,
      weekAvg,
      avgTicket,
      bestDay,
      todayVsAvgPct,
      todayIndexPct,
    }
  }, [summary, salesTrend])

  const salesTrendPeak = useMemo(
    () => Math.max(...salesTrend.map((point) => safeToNumber(point?.amount || 0)), 0),
    [salesTrend],
  )

  const stockValueCard = useMemo(() => {
    const totalStockValue = safeToNumber(summary.total_stock_value)
    const totalItems = Math.max(0, safeToNumber(summary.total_items))
    const lowStockCount = Math.max(0, safeToNumber(summary.low_stock_count))
    const healthyRatio = totalItems > 0 ? Math.round(((totalItems - lowStockCount) / totalItems) * 100) : 0
    const averagePerItem = totalItems > 0 ? totalStockValue / totalItems : 0
    const todaySales = safeToNumber(decisionModel.totalSalesToday)
    const avgDailySales = safeToNumber(salesPulseKpi.weekAvg)
    const stockToSales = todaySales > 0 ? totalStockValue / todaySales : 0
    const lowStockShare = totalItems > 0 ? (lowStockCount / totalItems) * 100 : 0
    const lowStockValueEstimate = lowStockCount * averagePerItem
    const coverageDays = avgDailySales > 0 ? totalStockValue / avgDailySales : 0

    const coverageLabel =
      coverageDays <= 0
        ? 'No sales baseline'
        : coverageDays < 14
          ? 'Tight coverage'
          : coverageDays < 45
            ? 'Balanced coverage'
            : 'High coverage'

    return {
      totalStockValue,
      totalItems,
      lowStockCount,
      healthyRatio: Math.min(100, Math.max(0, healthyRatio)),
      averagePerItem,
      stockToSales,
      avgDailySales,
      coverageDays,
      coverageLabel,
      lowStockShare: Math.min(100, Math.max(0, lowStockShare)),
      lowStockValueEstimate,
    }
  }, [summary, decisionModel.totalSalesToday, salesPulseKpi.weekAvg])

  const inventoryHealth = useMemo(() => {
    if (hasItemData) {
      const counts = items.reduce(
        (acc, item) => {
          const qty = getItemQuantity(item)
          const reorder = getItemReorderLevel(item)

          if (qty <= 0) {
            acc.outOfStock += 1
          } else if (reorder > 0 && qty <= reorder) {
            acc.lowStock += 1
          } else {
            acc.healthy += 1
          }

          return acc
        },
        { healthy: 0, lowStock: 0, outOfStock: 0 },
      )

      const total = counts.healthy + counts.lowStock + counts.outOfStock
      return {
        ...counts,
        total,
        riskPercent: total ? Math.round(((counts.lowStock + counts.outOfStock) / total) * 100) : 0,
      }
    }

    const total = Number(summary.total_items || 0)
    const lowStock = Number(summary.low_stock_count || 0)
    return {
      healthy: Math.max(total - lowStock, 0),
      lowStock,
      outOfStock: 0,
      total,
      riskPercent: total ? Math.round((lowStock / total) * 100) : 0,
    }
  }, [items, hasItemData, summary])

  const inboundSnapshot = useMemo(() => {
    const statusBuckets = purchaseActivity.reduce(
      (acc, row) => {
        const normalizedStatus = String(
          row?.status_name || row?.status || row?.grn_status || row?.grnStatus || '',
        )
          .trim()
          .toLowerCase()

        if (normalizedStatus.includes('fully received') || normalizedStatus.includes('fully_received')) {
          acc.fullyReceivedCount += 1
        } else if (
          normalizedStatus.includes('partially received') ||
          normalizedStatus.includes('partially_received') ||
          normalizedStatus.includes('partial')
        ) {
          acc.partiallyReceivedCount += 1
        } else if (normalizedStatus) {
          acc.otherCount += 1
        }

        return acc
      },
      { fullyReceivedCount: 0, partiallyReceivedCount: 0, otherCount: 0 },
    )

    const rowTotal =
      statusBuckets.fullyReceivedCount + statusBuckets.partiallyReceivedCount + statusBuckets.otherCount
    const total = rowTotal || Number(summary.total_grn_today || 0)
    const fullyReceivedRate = total ? Math.round((statusBuckets.fullyReceivedCount / total) * 100) : 0

    const todayInboundValue = purchaseActivity.reduce(
      (sum, row) => sum + safeToNumber(row?.total_amount),
      0,
    )

    const activeSuppliers = new Set(
      purchaseActivity
        .map((row) => row?.supplier_name)
        .filter(Boolean),
    ).size

    return {
      total,
      fullyReceivedCount: statusBuckets.fullyReceivedCount,
      partiallyReceivedCount: statusBuckets.partiallyReceivedCount,
      otherCount: statusBuckets.otherCount,
      fullyReceivedRate,
      todayInboundValue,
      activeSuppliers,
    }
  }, [summary, purchaseActivity])

  const trendToneClass =
    decisionModel.trendChange < -10
      ? 'text-rose-600 bg-rose-50 border-rose-200'
      : decisionModel.trendChange < 0
        ? 'text-amber-700 bg-amber-50 border-amber-200'
        : 'text-emerald-700 bg-emerald-50 border-emerald-200'

  const handleInventoryAlertClick = (item) => {
    if (!permissions.purchaseOrders) return

    navigate('/poform', {
      state: {
        mode: 'add',
        preselectedItem: {
          id: item?.id,
          item_name: item?.item_name || '',
          sku: item?.sku || '',
          supplier_id: item?.supplier_id || '',
          suggestedQuantity: 1,
        },
      },
    })
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 sm:p-6 lg:p-8">
      <section className="relative mb-6 overflow-hidden rounded-3xl border border-blue-100 bg-linear-to-br from-blue-50 via-white to-slate-50 p-5 shadow-sm sm:p-6 lg:p-7">
        <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-blue-200/50 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-indigo-200/40 blur-3xl" />

        <div className="relative mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-blue-100 bg-white p-3 shadow-sm">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">Sales Pulse</p>
            <p className="text-lg font-bold text-slate-900">{fmtCompactMoney(salesPulseKpi.totalSalesToday)}</p>
            <div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-slate-600">
              <span>{salesPulseKpi.totalSalesCount} txns</span>
              <span>Avg bill {fmtCompactMoney(salesPulseKpi.avgTicket)}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${clampPercent(salesPulseKpi.todayIndexPct / 2)}%`,
                  background: 'linear-gradient(90deg, #3b82f6 0%, #06b6d4 100%)',
                }}
              />
            </div>
            <p className="mt-2 text-[11px] font-semibold text-slate-500">
              {salesPulseKpi.todayVsAvgPct >= 0 ? '+' : ''}{salesPulseKpi.todayVsAvgPct.toFixed(1)}% vs 7-day avg
            </p>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-white p-3 shadow-sm">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">Sales Flow</p>
            <div className={`inline-flex rounded-lg border px-2 py-1 text-[11px] font-semibold ${trendToneClass}`}>
              {decisionModel.trendChange >= 0 ? '+' : ''}{decisionModel.trendChange.toFixed(1)}%
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                <p className="font-semibold text-slate-500">7-day total</p>
                <p className="font-bold text-slate-800">{fmtCompactMoney(salesPulseKpi.weekTotal)}</p>
              </div>
              <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                <p className="font-semibold text-slate-500">Daily avg</p>
                <p className="font-bold text-slate-800">{fmtCompactMoney(salesPulseKpi.weekAvg)}</p>
              </div>
            </div>
            <p className="mt-2 text-[11px] font-semibold text-slate-500">
              Best day {salesPulseKpi.bestDay.label}: {fmtCompactMoney(salesPulseKpi.bestDay.amount)}
            </p>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-white p-3 shadow-sm">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">Inventory Health</p>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xl font-bold text-slate-900">{inventoryHealth.riskPercent}%</p>
                <p className="text-[11px] font-semibold text-slate-500">Needs action</p>
              </div>
              <p className="text-[11px] font-semibold text-slate-500">
                {inventoryHealth.total} items tracked
              </p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${clampPercent(inventoryHealth.riskPercent)}%`,
                  background: 'linear-gradient(90deg, #f59e0b 0%, #f43f5e 100%)',
                }}
              />
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
              <div className="rounded-lg bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">Healthy {inventoryHealth.healthy}</div>
              <div className="rounded-lg bg-amber-50 px-2 py-1 font-semibold text-amber-700">Low {inventoryHealth.lowStock}</div>
              <div className="rounded-lg bg-rose-50 px-2 py-1 font-semibold text-rose-700">Out {inventoryHealth.outOfStock}</div>
            </div>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-white p-3 shadow-sm">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">Inbound Ops</p>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xl font-bold text-slate-900">{inboundSnapshot.fullyReceivedRate}%</p>
                <p className="text-[11px] font-semibold text-slate-500">Fully received rate</p>
              </div>
              <p className="text-[11px] font-semibold text-slate-500">
                {inboundSnapshot.partiallyReceivedCount} partially received
              </p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${clampPercent(inboundSnapshot.fullyReceivedRate)}%`,
                  background: 'linear-gradient(90deg, #3b82f6 0%, #4f46e5 100%)',
                }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-slate-600">
              <span>
                Fully {inboundSnapshot.fullyReceivedCount} / Total {inboundSnapshot.total}
              </span>
              <span>Value {fmtCompactMoney(inboundSnapshot.todayInboundValue)}</span>
            </div>
            <p className="mt-1 text-[11px] font-semibold text-slate-500">{inboundSnapshot.activeSuppliers} suppliers active</p>
          </div>
        </div>

        {quickLinks.length > 0 && (
          <div className="relative rounded-2xl border border-blue-100 bg-white p-3 shadow-sm">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
              {quickLinks.map((link) => (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => navigate(link.path)}
                  className={`inline-flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-150 active:scale-95 ${
                    link.priority
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-200 hover:bg-blue-700'
                      : 'border border-blue-100 bg-blue-50 text-blue-700 hover:border-blue-200 hover:bg-blue-100'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[18px]">{link.icon}</span>
                    {link.label}
                  </span>
                  <span className="material-symbols-outlined text-[16px] opacity-80">arrow_forward</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <StockDistributionCard items={stockDistribution} />
        </div>
        <div className="lg:col-span-8">
          <TopSellingCategoriesCard items={topSellingCategories} />
        </div>
      </section>

      <section className="mb-4 grid grid-cols-1 items-stretch gap-5 lg:grid-cols-12 ">
        <div className="lg:col-span-8">
          {permissions.sales ? (
            <SectionCard
              title="Sales Trend"
              subtitle="Revenue for the last 7 days"
              className="flex h-full flex-col"
              contentClassName="flex flex-1 flex-col"
              right={
                <span className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                  <span className="material-symbols-outlined text-sm">insights</span>
                  Peak {fmtCompactMoney(salesTrendPeak)}
                </span>
              }
            >
              <SalesChart trend={salesTrend} />
            </SectionCard>
          ) : (
            permissionBlock('Sales Trend')
          )}
        </div>
        <div className="lg:col-span-4">
          <SectionCard
            title="Stock Value"
            subtitle="Full valuation with live refresh"
            className="flex h-full flex-col"
            contentClassName="flex flex-1 flex-col"
            right={
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                Live
              </span>
            }
          >
            <p className="text-[32px] leading-none font-bold tracking-tight text-slate-900">{fmtMoney(stockValueCard.totalStockValue)}</p>

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="font-semibold text-slate-500">Avg per item</p>
                <p className="mt-1 text-sm font-bold text-slate-900">{fmtMoney(stockValueCard.averagePerItem)}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="font-semibold text-slate-500">Stock / sales</p>
                <p className="mt-1 text-sm font-bold text-slate-900">{stockValueCard.stockToSales.toFixed(1)}x</p>
              </div>
            </div>

            <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
              <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-blue-700">
                <span>Coverage runway</span>
                <span>{stockValueCard.coverageDays > 0 ? `${stockValueCard.coverageDays.toFixed(1)} days` : '-'}</span>
              </div>
              <p className="mt-1 text-[11px] font-medium text-blue-700">{stockValueCard.coverageLabel}</p>
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${clampPercent(stockValueCard.healthyRatio)}%`,
                  background: 'linear-gradient(90deg, #10b981 0%, #3b82f6 100%)',
                }}
              />
            </div>

            <div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-slate-500">
              <span>{stockValueCard.totalItems} items tracked</span>
              <span>{stockValueCard.lowStockCount} low stock</span>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="font-semibold text-amber-700">Low stock share</p>
                <p className="mt-1 text-sm font-bold text-amber-700">{stockValueCard.lowStockShare.toFixed(1)}%</p>
              </div>
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                <p className="font-semibold text-rose-700">At risk value</p>
                <p className="mt-1 text-sm font-bold text-rose-700">{fmtCompactMoney(stockValueCard.lowStockValueEstimate)}</p>
              </div>
            </div>

            <p className="mt-auto pt-3 text-[11px] font-medium text-slate-500">
              Updated {relTime(stockValueRefreshAt)}. Refreshes every 30s and on window focus.
            </p>
          </SectionCard>
        </div>
      </section>

      <section className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        {permissions.sales ? (
          <SectionCard
            title="Recent Sales"
            subtitle={`All ${recentSales.length} transactions`}
            contentClassName="h-96 overflow-y-auto pr-1"
          >
            <div className="space-y-2">
              {recentSales.map((sale, index) => (
                <div
                  key={sale?.id || index}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{sale?.invoice_no || `INV-${sale?.id || index}`}</p>
                    <p className="text-xs text-slate-500">{relTime(sale?.sale_date)} • {sale?.payment_method || 'Sale'}</p>
                  </div>
                  <p className="text-sm font-bold text-slate-900">{fmtMoney(sale?.total_amount)}</p>
                </div>
              ))}
              {!recentSales.length && <p className="py-4 text-center text-sm text-slate-500">No recent sales.</p>}
            </div>
          </SectionCard>
        ) : (
          permissionBlock('Recent Sales')
        )}

        {permissions.inventory ? (
          <SectionCard
            title="Inventory Alerts"
            subtitle="Low stock and out-of-stock items"
            contentClassName="h-96 overflow-y-auto pr-1"
          >
            <div className="space-y-2">
              {inventoryAlerts.map((item, index) => {
                const level = clampPercent(item?.level_percent)
                const isOut = Boolean(item?.is_out_of_stock)
                const isClickable = permissions.purchaseOrders
                return (
                  <button
                    key={item?.id || index}
                    type="button"
                    onClick={() => handleInventoryAlertClick(item)}
                    disabled={!isClickable}
                    className={`w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-left transition ${isClickable ? 'cursor-pointer hover:border-blue-300 hover:bg-blue-50/40' : 'cursor-default'}`}
                    title={isClickable ? 'Create purchase order for this item' : 'No purchase order permission'}
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-semibold text-slate-800">{item?.item_name || 'Unnamed item'}</p>
                      <span className={`text-xs font-bold ${isOut ? 'text-rose-600' : 'text-amber-600'}`}>
                        {isOut ? 'OUT' : `${item?.quantity || 0} left`}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                      <div className={`h-full rounded-full ${isOut ? 'bg-rose-500' : 'bg-amber-500'}`} style={{ width: `${isOut ? 0 : clampPercent(level)}%` }} />
                    </div>
                  </button>
                )
              })}
              {!inventoryAlerts.length && <p className="py-4 text-center text-sm text-slate-500">No low stock alerts.</p>}
            </div>
          </SectionCard>
        ) : (
          permissionBlock('Inventory Alerts')
        )}
      </section>

      <section className="grid grid-cols-1 gap-4">
        <div>
          {permissions.stockMovement ? (
            <LiveFeedCard
              entries={liveFeedEntries}
              right={<span className="text-xs font-semibold text-slate-600">Total: {fmtMoney(recentSalesTotal)}</span>}
            />
          ) : (
            permissionBlock('Live Feed')
          )}
        </div>
      </section>

          {(isLoadingDashboard || isLoadingItems || isLoadingSales) && (
            <div className="fixed bottom-6 right-6 inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-lg">
              <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
              Loading dashboard data
            </div>
          )}

      {permissions.users && (
        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-slate-900">User Management Snapshot</h2>
          <p className="text-xs text-slate-500">Visible for admin role only.</p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Total Users', value: '24' },
              { label: 'Active Now', value: '7' },
              { label: 'Pending Invite', value: '3' },
              { label: 'Roles Defined', value: '4' },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{item.label}</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{item.value}</p>
              </div>
            ))}
          </div>
        </section>
      )}

    </main>
  )
}

export { Dashboard }
export default Dashboard
