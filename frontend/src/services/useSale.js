import { useCallback, useContext } from 'react'
import axios, { SESSION_EXPIRED_MESSAGE, isSessionExpiredError } from './httpClient'
import { AppContext } from '../context/AppContext'

const CREATE_ENDPOINTS = [
  '/api/sale/create',
  '/api/sales/create',
  '/api/transaction/create',
  '/api/checkout',
  '/api/order/create',
]

export function useSale() {
  const { backendUrl, token } = useContext(AppContext)

  const headers = useCallback(() => ({ headers: { token } }), [token])
  const endpoint = useCallback((path) => `${backendUrl}${path}`, [backendUrl])

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

    for (const path of CREATE_ENDPOINTS) {
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
        console.warn(`Endpoint ${path} failed with status ${status}:`, error.message)

        if (status === 404 || status === 500) {
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

        if (path === CREATE_ENDPOINTS[CREATE_ENDPOINTS.length - 1]) {
          return {
            success: false,
            message:
              error?.response?.data?.message ||
              `Failed to create sale: ${error.message}. Please ensure the backend endpoint exists.`,
          }
        }
      }
    }

    return {
      success: false,
      message: 'All sale endpoints failed. Please contact support.',
    }
  }

  return { createSale }
}
