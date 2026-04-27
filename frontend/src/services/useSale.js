import { useCallback, useContext, useEffect, useState } from 'react'
import axios, { SESSION_EXPIRED_MESSAGE, isSessionExpiredError } from './httpClient'
import { AppContext } from '../context/AppContext'

const LIST_ENDPOINTS = [
  '/api/sales/all',
  '/api/sale/all',
]

const CREATE_ENDPOINTS = [
  '/api/sales/create',
  '/api/sale/create',
]

const parseSales = (data) =>
  data?.salesData ?? data?.saleData ?? data?.sales ?? data?.data ?? (Array.isArray(data) ? data : [])

export function useSale() {
  const { backendUrl, token } = useContext(AppContext)
  const [sales, setSales] = useState([])
  const [isLoadingSales, setIsLoadingSales] = useState(false)

  const headers = useCallback(() => ({ headers: { token } }), [token])
  const endpoint = useCallback((path) => `${backendUrl}${path}`, [backendUrl])

  const isEndpointProbeError = (status) => status === 404 || status === 500

  const loadSales = useCallback(async () => {
    if (!token) {
      setSales([])
      return { success: false, message: 'Unauthorized' }
    }

    setIsLoadingSales(true)
    try {
      for (const path of LIST_ENDPOINTS) {
        try {
          const { data } = await axios.get(endpoint(path), headers())
          const parsed = parseSales(data)
          if (Array.isArray(parsed)) {
            setSales(parsed)
            return { success: true }
          }
        } catch (error) {
          const status = error?.response?.status

          if (isEndpointProbeError(status)) {
            continue
          }

          if (status === 401 || isSessionExpiredError(error)) {
            return { success: false, message: SESSION_EXPIRED_MESSAGE }
          }

          return {
            success: false,
            message: error?.response?.data?.message || error?.message || 'Failed to load sales list',
          }
        }
      }

      setSales([])
      return { success: false, message: 'Failed to load sales list' }
    } finally {
      setIsLoadingSales(false)
    }
  }, [token, endpoint, headers])

  const createSale = async (payload) => {
    if (!payload?.items || !Array.isArray(payload.items) || payload.items.length === 0) {
      return { success: false, message: 'Cart is empty. Please add items.' }
    }

    if (!payload?.paid_amount || Number(payload.paid_amount) <= 0) {
      return { success: false, message: 'Paid amount must be greater than 0.' }
    }

    const total = payload.items.reduce(
      (sum, item) => sum + (item.selling_price * item.quantity || 0),
      0
    )

    if (Number(payload.paid_amount) < total) {
      return {
        success: false,
        message: `Paid amount (${payload.paid_amount}) cannot be less than total (${total.toFixed(2)}).`,
      }
    }

    for (const [index, path] of CREATE_ENDPOINTS.entries()) {
      try {
        const { data } = await axios.post(endpoint(path), payload, headers())

        if (data?.success) {
          const saleData = {
            ...payload,
            sale_id: data?.sale_id || data?.saleId || data?.id,
            total: total,
            change_due: Number(payload.paid_amount) - total,
            timestamp: new Date().toISOString(),
          }
          sessionStorage.setItem('lastSaleData', JSON.stringify(saleData))

          return {
            success: true,
            message: data?.message || 'Sale recorded successfully',
            saleData,
          }
        }
      } catch (error) {
        const status = error?.response?.status

        if (isEndpointProbeError(status)) {
          continue
        }

        if (status === 401) {
          return { success: false, message: SESSION_EXPIRED_MESSAGE }
        }

        if (isSessionExpiredError(error)) {
          return { success: false, message: SESSION_EXPIRED_MESSAGE }
        }

        if (status === 400) {
          return {
            success: false,
            message: error?.response?.data?.message || 'Validation error. Please check your input.',
          }
        }

        if (index === CREATE_ENDPOINTS.length - 1) {
          return {
            success: false,
            message:
              error?.response?.data?.message ||
              `Failed to create sale: ${error.message}. Please ensure the backend endpoint exists.`,
          }
        }

        return {
          success: false,
          message: error?.response?.data?.message || `Failed to create sale: ${error.message}`,
        }
      }
    }

    return {
      success: false,
      message: 'All sale endpoints failed. Please contact support.',
    }
  }

  useEffect(() => {
    loadSales()
  }, [loadSales])

  return { createSale, sales, isLoadingSales, reloadSales: loadSales }
}
