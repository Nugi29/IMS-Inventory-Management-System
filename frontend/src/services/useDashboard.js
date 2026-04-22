import { useCallback, useContext, useEffect, useState } from 'react'
import axios, { SESSION_EXPIRED_MESSAGE, isSessionExpiredError } from './httpClient'
import { AppContext } from '../context/AppContext'

const ENDPOINTS = {
	overview: '/api/dashboard/overview',
}

const EMPTY_DASHBOARD = {
	summary: {
		total_sales_today: 0,
		total_sales_count_today: 0,
		total_items: 0,
		total_suppliers: 0,
		low_stock_count: 0,
		total_grn_today: 0,
		pending_grn_today: 0,
		total_stock_value: 0,
	},
	salesTrend: [],
	recentSales: [],
	lowStockItems: [],
	purchaseActivity: [],
	liveFeed: [],
}

const toNumber = (value) => {
	const parsed = Number(value)
	return Number.isFinite(parsed) ? parsed : 0
}

const normalizeOverview = (payload) => {
	const source = payload?.dashboardData || payload?.data || payload || {}

	return {
		summary: {
			total_sales_today: toNumber(source?.summary?.total_sales_today),
			total_sales_count_today: toNumber(source?.summary?.total_sales_count_today),
			total_items: toNumber(source?.summary?.total_items),
			total_suppliers: toNumber(source?.summary?.total_suppliers),
			low_stock_count: toNumber(source?.summary?.low_stock_count),
			total_grn_today: toNumber(source?.summary?.total_grn_today),
			pending_grn_today: toNumber(source?.summary?.pending_grn_today),
			total_stock_value: toNumber(source?.summary?.total_stock_value),
		},
		salesTrend: Array.isArray(source?.salesTrend) ? source.salesTrend : [],
		recentSales: Array.isArray(source?.recentSales) ? source.recentSales : [],
		lowStockItems: Array.isArray(source?.lowStockItems) ? source.lowStockItems : [],
		purchaseActivity: Array.isArray(source?.purchaseActivity) ? source.purchaseActivity : [],
		liveFeed: Array.isArray(source?.liveFeed) ? source.liveFeed : [],
	}
}

export function useDashboard() {
	const { backendUrl, token } = useContext(AppContext)

	const [dashboard, setDashboard] = useState(EMPTY_DASHBOARD)
	const [isLoadingDashboard, setIsLoadingDashboard] = useState(false)

	const headers = useCallback(() => ({ headers: { token } }), [token])
	const endpoint = useCallback((path) => `${backendUrl}${path}`, [backendUrl])

	const loadDashboard = useCallback(async () => {
		if (!token) {
			setDashboard(EMPTY_DASHBOARD)
			return { success: false, message: 'Unauthorized' }
		}

		setIsLoadingDashboard(true)
		try {
			const { data } = await axios.get(endpoint(ENDPOINTS.overview), headers())
			setDashboard(normalizeOverview(data))
			return { success: true }
		} catch (error) {
			if (isSessionExpiredError(error)) {
				return { success: false, message: SESSION_EXPIRED_MESSAGE }
			}

			setDashboard(EMPTY_DASHBOARD)
			return {
				success: false,
				message: error?.response?.data?.message || error?.message || 'Failed to load dashboard',
			}
		} finally {
			setIsLoadingDashboard(false)
		}
	}, [token, endpoint, headers])

	useEffect(() => {
		loadDashboard()
	}, [loadDashboard])

	return {
		dashboard,
		isLoadingDashboard,
		reloadDashboard: loadDashboard,
	}
}

export const useDashboards = useDashboard
