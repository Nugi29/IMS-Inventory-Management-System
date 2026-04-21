import axios from 'axios'

export const SESSION_EXPIRED_EVENT = 'ims:session-expired'
export const SESSION_EXPIRED_MESSAGE = 'Session expired. Please log in again.'

let sessionExpiryHandled = false
let interceptorsInstalled = false

export const isSessionExpiredError = (error) => error?.isSessionExpired || error?.response?.status === 401

export const resetSessionExpiredState = () => {
  sessionExpiryHandled = false
}

const clearStoredToken = () => {
  if (typeof window === 'undefined') {
    return
  }

  localStorage.removeItem('token')
}

const dispatchSessionExpiredEvent = () => {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
}

const handleSessionExpired = () => {
  if (sessionExpiryHandled) {
    return
  }

  sessionExpiryHandled = true
  clearStoredToken()
  dispatchSessionExpiredEvent()

  if (typeof window !== 'undefined') {
    window.setTimeout(() => {
      sessionExpiryHandled = false
    }, 1000)
  }
}

if (!interceptorsInstalled) {
  interceptorsInstalled = true

  axios.interceptors.request.use((config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token')

      if (token) {
        config.headers = config.headers || {}
        config.headers.Authorization = `Bearer ${token}`
        config.headers.token = token
      }
    }

    return config
  })

  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error?.response?.status === 401) {
        error.isSessionExpired = true
        handleSessionExpired()
      }

      return Promise.reject(error)
    }
  )
}

export default axios