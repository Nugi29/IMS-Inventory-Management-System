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
    create: '/api/supplier/create-supplier',
    createFallbacks: [
        '/api/suppliers/create-supplier',
        '/api/supplier/add-supplier',
        '/api/suppliers/add-supplier',
        '/api/supplier/create',
        '/api/suppliers/create',
        '/api/supplier',
        '/api/suppliers',
    ],
    update: '/api/supplier/update-supplier',
    updateFallbacks: [
        '/api/suppliers/update-supplier',
        '/api/supplier/edit-supplier',
        '/api/suppliers/edit-supplier',
        '/api/supplier/update',
        '/api/suppliers/update',
    ],
    remove: '/api/supplier/delete-supplier',
    removeFallbacks: [
        '/api/suppliers/delete-supplier',
        '/api/supplier/remove-supplier',
        '/api/suppliers/remove-supplier',
        '/api/supplier/delete',
        '/api/suppliers/delete',
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

    const addSupplier = useCallback(async (payload) => {
        if (!backendUrl) {
            return { success: false, message: 'Backend URL is not configured' }
        }

        const candidatePaths = [ENDPOINTS.create, ...ENDPOINTS.createFallbacks]
        let lastErrorMessage = 'Failed to add supplier'

        for (const path of candidatePaths) {
            try {
                const { data } = await axios.post(endpoint(path), payload, headers())

                if (data?.success === false) {
                    lastErrorMessage = data?.message || lastErrorMessage
                    continue
                }

                await loadSuppliers()
                return {
                    success: true,
                    message: data?.message || 'Supplier created successfully',
                    supplier: data?.supplier,
                }
            } catch (error) {
                if (error?.response?.status === 404) {
                    continue
                }

                lastErrorMessage = error?.response?.data?.message || error?.message || lastErrorMessage
            }
        }

        return { success: false, message: lastErrorMessage }
    }, [backendUrl, endpoint, headers, loadSuppliers])

    const updateSupplier = useCallback(async (supplier) => {
        if (!backendUrl) {
            return { success: false, message: 'Backend URL is not configured' }
        }

        const id = Number(supplier?.id ?? supplier?.supplier_id ?? supplier?._id)
        if (!id) {
            return { success: false, message: 'Missing supplier id' }
        }

        const payload = Object.fromEntries(
            Object.entries({
                id,
                name: supplier?.name?.trim(),
                phone: supplier?.phone?.trim(),
                email: supplier?.email?.trim(),
                address: supplier?.address?.trim(),
                supplier_status_id: supplier?.supplier_status_id,
                supplier_status: supplier?.supplier_status,
                status: supplier?.status ?? supplier?.supplier_status,
                is_active: supplier?.is_active,
            }).filter(([, value]) => value !== undefined && value !== null && value !== '')
        )

        const candidatePaths = [ENDPOINTS.update, ...ENDPOINTS.updateFallbacks]
        const updateAttempts = candidatePaths.flatMap((path) => ([
            // Expected by controller-style route: /update-supplier/:id
            { method: 'put', url: `${path}/${id}` },
            // Common alternative where id is read from body
            { method: 'put', url: path },
        ]))
        let lastErrorMessage = 'Failed to update supplier'
        let notFoundCount = 0

        for (const attempt of updateAttempts) {
            try {
                const request = {
                    method: attempt.method,
                    url: endpoint(attempt.url),
                    data: payload,
                    ...headers(),
                }
                const { data } = await axios(request)

                if (data?.success === false) {
                    lastErrorMessage = data?.message || lastErrorMessage
                    continue
                }

                await loadSuppliers()
                return {
                    success: true,
                    message: data?.message || 'Supplier updated successfully',
                }
            } catch (error) {
                if (error?.response?.status === 404) {
                    notFoundCount += 1
                    continue
                }

                lastErrorMessage = error?.response?.data?.message || error?.message || lastErrorMessage
            }
        }

        if (notFoundCount === updateAttempts.length) {
            return {
                success: false,
                message: 'Supplier update endpoint not found. Expected PUT /api/supplier/update-supplier/:id',
            }
        }

        return { success: false, message: lastErrorMessage }
    }, [backendUrl, endpoint, headers, loadSuppliers])

    const deleteSupplier = useCallback(async (supplier) => {
        if (!backendUrl) {
            return { success: false, message: 'Backend URL is not configured' }
        }

        const id = Number(supplier?.id ?? supplier?.supplier_id ?? supplier?._id)
        if (!id) {
            return { success: false, message: 'Missing supplier id' }
        }

        const candidatePaths = [ENDPOINTS.remove, ...ENDPOINTS.removeFallbacks]
        let lastErrorMessage = 'Failed to delete supplier'

        for (const path of candidatePaths) {
            try {
                const { data } = await axios.delete(endpoint(`${path}/${id}`), headers())

                if (data?.success === false) {
                    lastErrorMessage = data?.message || lastErrorMessage
                    continue
                }

                await loadSuppliers()
                return {
                    success: true,
                    message: data?.message || 'Supplier deleted successfully',
                }
            } catch (error) {
                if (error?.response?.status === 404) {
                    continue
                }

                lastErrorMessage = error?.response?.data?.message || error?.message || lastErrorMessage
            }
        }

        return { success: false, message: lastErrorMessage }
    }, [backendUrl, endpoint, headers, loadSuppliers])

    useEffect(() => {
        loadSuppliers()
    }, [loadSuppliers])

    return {
        suppliers,
        isLoadingSuppliers,
        reloadSuppliers: loadSuppliers,
        addSupplier,
        updateSupplier,
        deleteSupplier,
    }
}
