import { useCallback } from 'react'
import axios, { SESSION_EXPIRED_MESSAGE, isSessionExpiredError } from './httpClient'

const ENDPOINTS = {
    profile: '/api/user/get-profile',
    update: '/api/user/update-profile',
}

const backendUrl = import.meta.env.VITE_BACKEND_URL

const endpoint = (path) => `${backendUrl}${path}`

const normalizeResponse = (data) => {
    if (!data) {
        return null
    }

    if (data?.success && data?.userData) {
        return data.userData
    }

    if (data?.userData) {
        return data.userData
    }

    if (data?.data) {
        return data.data
    }

    return data
}

export function useUserProfile() {
    const loadUserProfile = useCallback(async () => {
        try {
            const { data } = await axios.get(endpoint(ENDPOINTS.profile))
            const profile = normalizeResponse(data)

            return {
                success: Boolean(profile),
                profile,
                message: data?.message,
            }
        } catch (error) {
            if (isSessionExpiredError(error)) {
                return { success: false, message: SESSION_EXPIRED_MESSAGE }
            }

            return { success: false, message: error?.response?.data?.message ?? error.message }
        }
    }, [])

    const updateUserProfile = useCallback(async (payload) => {
        const id = Number(payload?.id)
        if (!id) {
            return { success: false, message: 'Missing user profile id' }
        }

        const cleanedPayload = Object.fromEntries(
            Object.entries({
                id,
                name: payload?.name?.trim(),
                username: payload?.username?.trim(),
                password: payload?.password,
            }).filter(([, value]) => value !== undefined && value !== null && value !== '')
        )

        for (const method of ['put', 'post']) {
            try {
                const url = endpoint(ENDPOINTS.update)
                const fn = method === 'put' ? axios.put : axios.post
                const { data } = await fn(url, cleanedPayload)

                if (data?.success) {
                    return {
                        success: true,
                        message: data.message || 'Profile updated successfully',
                        profile: normalizeResponse(data),
                    }
                }
            } catch (error) {
                if (isSessionExpiredError(error)) {
                    return { success: false, message: SESSION_EXPIRED_MESSAGE }
                }
            }
        }

        return { success: false, message: 'Unable to update profile' }
    }, [])

    return {
        loadUserProfile,
        updateUserProfile,
    }
}
