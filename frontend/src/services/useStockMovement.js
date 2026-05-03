import { useCallback, useContext, useEffect, useState } from 'react'
import axios, { SESSION_EXPIRED_MESSAGE, isSessionExpiredError } from './httpClient'
import { AppContext } from '../context/AppContext'

const LIST_ENDPOINTS = [
  '/api/stock-movements',
  '/api/stock-movement/all',
  '/api/stock-movements/all',
  '/api/stock-movement/list',
  '/api/stock-movements/list',
  '/api/stock/movements',
  '/api/stock-movement',
]

const CREATE_ADJUSTMENT_ENDPOINTS = [
  '/api/stock-adjustment/create',
  '/api/stock-adjustments/create',
  '/api/stock-adjustments',
  '/api/stock-movement/adjustment',
  '/api/stock-movements/adjustment',
  '/api/stock/adjustment',
]

const parseArrayPayload = (data) => {
  if (Array.isArray(data)) return data

  const direct = data?.stockMovements
    || data?.stockMovementData
    || data?.movements
    || data?.movementData
    || data?.rows
    || data?.data

  if (Array.isArray(direct)) return direct

  if (data && typeof data === 'object') {
    const firstArray = Object.values(data).find((value) => Array.isArray(value))
    if (Array.isArray(firstArray)) return firstArray
  }

  return []
}

const normalizeAdjustmentPayload = (payload = {}, userId = null) => {
  const quantity = Number(payload?.quantity ?? payload?.adjustment_qty ?? payload?.qty ?? 0)

  return {
    item_id: Number(payload?.item_id ?? payload?.itemId),
    quantity,
    adjustment_qty: quantity,
    movement_type: 'Adjustment',
    movement_type_id: 3,
    reason: payload?.reason || payload?.remarks || '',
    remarks: payload?.reason || payload?.remarks || '',
    note: payload?.reason || payload?.remarks || '',
    user_id: userId || undefined,
    created_at: new Date().toISOString(),
  }
}

export function useStockMovement() {
  const { backendUrl, token, userData } = useContext(AppContext)

  const [movements, setMovements] = useState([])
  const [isLoadingMovements, setIsLoadingMovements] = useState(false)

  const headers = useCallback(() => ({ headers: { token } }), [token])
  const endpoint = useCallback((path) => `${backendUrl}${path}`, [backendUrl])

  const loadMovements = useCallback(async () => {
    if (!token) {
      setMovements([])
      return
    }

    setIsLoadingMovements(true)

    for (const path of LIST_ENDPOINTS) {
      try {
        const { data } = await axios.get(endpoint(path), headers())
        const list = parseArrayPayload(data)
        setMovements(list)
        setIsLoadingMovements(false)
        return
      } catch (error) {
        const status = error?.response?.status

        if (isSessionExpiredError(error)) {
          setIsLoadingMovements(false)
          return
        }

        if (status === 404 || status === 405) {
          continue
        }

        setMovements([])
        setIsLoadingMovements(false)
        return
      }
    }

    setMovements([])
    setIsLoadingMovements(false)
  }, [token, endpoint, headers])

  const createAdjustment = useCallback(async (payload) => {
    if (!token) {
      return { success: false, message: SESSION_EXPIRED_MESSAGE }
    }

    const normalizedPayload = normalizeAdjustmentPayload(payload, Number(userData?.id || userData?.user_id || 0) || null)

    if (!normalizedPayload.item_id) {
      return { success: false, message: 'Please select an item.' }
    }

    if (!normalizedPayload.quantity) {
      return { success: false, message: 'Adjustment quantity is required.' }
    }

    for (const path of CREATE_ADJUSTMENT_ENDPOINTS) {
      try {
        const { data } = await axios.post(endpoint(path), normalizedPayload, headers())

        if (data?.success || data?.id || data?.adjustment_id || data?.movement_id) {
          await loadMovements()
          return {
            success: true,
            message: data?.message || 'Stock adjustment recorded successfully.',
            data,
          }
        }
      } catch (error) {
        const status = error?.response?.status

        if (isSessionExpiredError(error)) {
          return { success: false, message: SESSION_EXPIRED_MESSAGE }
        }

        if (status === 404 || status === 405) {
          continue
        }

        return {
          success: false,
          message: error?.response?.data?.message || error?.message || 'Failed to record stock adjustment.',
        }
      }
    }

    return {
      success: false,
      message: 'Stock adjustment endpoint not found. Please verify backend routes.',
    }
  }, [token, endpoint, headers, loadMovements, userData])

  useEffect(() => {
    loadMovements()
  }, [loadMovements])

  return {
    movements,
    isLoadingMovements,
    reloadMovements: loadMovements,
    createAdjustment,
  }
}
