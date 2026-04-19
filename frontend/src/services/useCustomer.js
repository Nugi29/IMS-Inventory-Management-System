import { useCallback, useContext, useEffect, useState } from 'react'
import axios, { SESSION_EXPIRED_MESSAGE, isSessionExpiredError } from './httpClient'
import { AppContext } from '../context/AppContext'

const LIST_ENDPOINTS = [
  '/api/customer/all-customers',
  '/api/customer/all-profiles',
  '/api/customer/get-all',
  '/api/user/all-profiles',
]

const CREATE_ENDPOINTS = [
  '/api/customer/register',
  '/api/customer/create-customer',
  '/api/customer/create',
  '/api/user/user-register',
]

const UPDATE_ENDPOINTS = [
  '/api/customer/update',
  '/api/customer/update-customer',
  '/api/customer/edit',
]

const DELETE_ENDPOINTS = [
  '/api/customer/delete',
  '/api/customer/remove',
]

const pickFirstArray = (payload, keys) => {
  if (Array.isArray(payload)) {
    return payload
  }

  for (const key of keys) {
    if (Array.isArray(payload?.[key])) {
      return payload[key]
    }
  }

  if (payload && typeof payload === 'object') {
    const firstArray = Object.values(payload).find((value) => Array.isArray(value))
    if (Array.isArray(firstArray)) {
      return firstArray
    }
  }

  return []
}

const normalizeCustomer = (item) => ({
  id: item?.id ?? item?.customer_id ?? item?.user_id ?? item?._id ?? item?.uuid,
  name: item?.name ?? item?.customer_name ?? item?.full_name ?? item?.username ?? '',
  phone: item?.phone ?? item?.mobile ?? item?.contact_no ?? item?.telephone ?? '',
  email: item?.email ?? item?.mail ?? '',
  address: item?.address ?? item?.customer_address ?? '',
  taxId: item?.tax_id ?? item?.tin ?? item?.taxId ?? '',
  businessName: item?.business_name ?? item?.company_name ?? item?.organization_name ?? '',
  roleName: item?.role?.name ?? item?.role_name ?? item?.role ?? '',
})

const isCustomerLike = (customer) => {
  if (!customer?.name) {
    return false
  }

  if (!customer?.roleName) {
    return true
  }

  return String(customer.roleName).toLowerCase().includes('customer')
}

export function useCustomer() {
  const { backendUrl, token } = useContext(AppContext)
  const [customers, setCustomers] = useState([])
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false)

  const headers = useCallback(() => ({ headers: { token } }), [token])
  const endpoint = useCallback((path) => `${backendUrl}${path}`, [backendUrl])

  const loadCustomers = useCallback(async () => {
    if (!token) {
      setCustomers([])
      return
    }

    setIsLoadingCustomers(true)

    try {
      for (const path of LIST_ENDPOINTS) {
        try {
          const { data } = await axios.get(endpoint(path), headers())
          const list = pickFirstArray(data, ['customersData', 'customers', 'customerData', 'usersData', 'userData', 'data'])
            .map(normalizeCustomer)
            .filter((customer) => customer?.id && isCustomerLike(customer))

          if (list.length || data?.success) {
            setCustomers(list)
            return
          }
        } catch (error) {
          if (isSessionExpiredError(error)) {
            return
          }

          // Try next endpoint.
        }
      }

      setCustomers([])
    } finally {
      setIsLoadingCustomers(false)
    }
  }, [token, endpoint, headers])

  const addCustomer = async (payload) => {
    const cleanedPayload = Object.fromEntries(
      Object.entries({
        id: payload?.id,
        customer_id: payload?.id,
        name: payload?.name?.trim(),
        phone: payload?.phone?.trim(),
        email: payload?.email?.trim(),
        address: payload?.address?.trim(),
        tax_id: payload?.tax_id?.trim(),
        business_name: payload?.business_name?.trim(),
      }).filter(([, value]) => value !== undefined && value !== null && value !== '')
    )

    for (const path of CREATE_ENDPOINTS) {
      try {
        const { data } = await axios.post(endpoint(path), cleanedPayload, headers())

        if (data?.success) {
          await loadCustomers()

          const createdRaw =
            data?.customerData ||
            data?.customer ||
            data?.userData ||
            data?.user ||
            data?.data ||
            cleanedPayload

          return {
            success: true,
            message: data?.message || 'Customer registered successfully',
            customer: normalizeCustomer(createdRaw),
          }
        }
      } catch (error) {
        if (isSessionExpiredError(error)) {
          return {
            success: false,
            message: SESSION_EXPIRED_MESSAGE,
          }
        }

        // Try next endpoint.
      }
    }

    return {
      success: false,
      message: 'Failed to register customer',
    }
  }

  const updateCustomer = async (payload) => {
    const id = Number(payload?.id ?? payload?.customer_id ?? payload?._id)

    if (!id) {
      return { success: false, message: 'Missing customer id' }
    }

    const cleanedPayload = Object.fromEntries(
      Object.entries({
        id,
        customer_id: id,
        name: payload?.name?.trim(),
        phone: payload?.phone?.trim(),
      }).filter(([, value]) => value !== undefined && value !== null && value !== '')
    )

    for (const basePath of UPDATE_ENDPOINTS) {
      for (const method of ['put', 'post']) {
        try {
          const url = endpoint(`${basePath}/${id}`)
          const fn = method === 'put' ? axios.put : axios.post
          const { data } = await fn(url, cleanedPayload, headers())

          if (data?.success) {
            await loadCustomers()

            const updatedRaw =
              data?.customerData ||
              data?.customer ||
              data?.data ||
              cleanedPayload

            return {
              success: true,
              message: data?.message || 'Customer updated successfully',
              customer: normalizeCustomer(updatedRaw),
            }
          }
        } catch (error) {
          if (isSessionExpiredError(error)) {
            return {
              success: false,
              message: SESSION_EXPIRED_MESSAGE,
            }
          }

          // Try next method/endpoint.
        }
      }
    }

    return {
      success: false,
      message: 'Failed to update customer',
    }
  }

  const deleteCustomer = async (payload) => {
    const id = Number(payload?.id ?? payload?.customer_id ?? payload?._id)

    if (!id) {
      return { success: false, message: 'Missing customer id' }
    }

    for (const basePath of DELETE_ENDPOINTS) {
      try {
        const { data } = await axios.delete(endpoint(`${basePath}/${id}`), headers())

        if (data?.success) {
          await loadCustomers()
          return {
            success: true,
            message: data?.message || 'Customer deleted successfully',
          }
        }
      } catch (error) {
        if (isSessionExpiredError(error)) {
          return {
            success: false,
            message: SESSION_EXPIRED_MESSAGE,
          }
        }

        // Try alternate endpoints.
      }

      try {
        const { data } = await axios.post(endpoint(`${basePath}/${id}`), { id, customer_id: id }, headers())

        if (data?.success) {
          await loadCustomers()
          return {
            success: true,
            message: data?.message || 'Customer deleted successfully',
          }
        }
      } catch (error) {
        if (isSessionExpiredError(error)) {
          return {
            success: false,
            message: SESSION_EXPIRED_MESSAGE,
          }
        }

        // Try alternate endpoints.
      }
    }

    return {
      success: false,
      message: 'Failed to delete customer',
    }
  }

  useEffect(() => {
    loadCustomers()
  }, [loadCustomers])

  return {
    customers,
    isLoadingCustomers,
    reloadCustomers: loadCustomers,
    addCustomer,
    updateCustomer,
    deleteCustomer,
  }
}

export const useCustomers = useCustomer
