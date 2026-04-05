import { useCallback, useContext, useEffect, useState } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import { AppContext } from '../context/AppContext'

const ENDPOINTS = {
    list: '/api/supplier/get-all-suppliers',
    listFallbacks: [
        '/api/suppliers/get-all-suppliers',
        '/api/supplier/all-suppliers',
        '/api/suppliers/all-suppliers',
        '/api/supplier',
        '/api/suppliers',
    ],
}

export const useSupplier = () => {
    const { backendUrl, token } = useContext(AppContext)
    const [suppliers, setSuppliers] = useState([])
    const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(false)

    const endpoint = useCallback((path) => `${backendUrl}${path}`, [backendUrl])
    const headers = useCallback(() => (token ? { headers: { token } } : undefined), [token])

    const parseSuppliers = (data) => {
        if (Array.isArray(data)) {
            return data
        }

        return data?.suppliers ?? data?.supplierData ?? data?.data ?? []
    }

    const loadSuppliers = useCallback(async () => {
        if (!backendUrl) {
            setSuppliers([])
            return
        }

        setIsLoadingSuppliers(true)

        try {
            const candidatePaths = [ENDPOINTS.list, ...ENDPOINTS.listFallbacks]
            let loadedSuppliers = []

            for (const path of candidatePaths) {
                try {
                    const { data } = await axios.get(endpoint(path), headers())
                    loadedSuppliers = parseSuppliers(data)
                    if (loadedSuppliers.length || data?.success) {
                        break
                    }
                } catch (requestError) {
                    if (requestError?.response?.status !== 404) {
                        throw requestError
                    }
                }
            }

            setSuppliers(loadedSuppliers)
        } catch (error) {
            setSuppliers([])
            toast.error(error?.response?.data?.message || error?.message || 'Failed to load suppliers')
        } finally {
            setIsLoadingSuppliers(false)
        }
    }, [backendUrl, endpoint, headers])

    useEffect(() => {
        loadSuppliers()
    }, [loadSuppliers])

    return {
        suppliers,
        isLoadingSuppliers,
        reloadSuppliers: loadSuppliers,
    }
}
