import { createContext, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import axios, { SESSION_EXPIRED_EVENT, SESSION_EXPIRED_MESSAGE, isSessionExpiredError } from '../services/httpClient';

export const AppContext = createContext();

const AppContextProvider = (props) => {

    const backendUrl = import.meta.env.VITE_BACKEND_URL;

    const [token, setToken] = useState(localStorage.getItem('token') ? localStorage.getItem('token') : false);
    const [userData, setUserData] = useState(false);
    const [isInitializing, setIsInitializing] = useState(true);
    const [initError, setInitError] = useState(null);
    

    const loadUserProfileData = async () => {
        setIsInitializing(true);
        setInitError(null);
        try {
            const { data } = await axios.get(`${backendUrl}/api/user/get-profile`, { headers: { token } });
            if (data.success) {
                setUserData(data.userData);
                setIsInitializing(false);
                setInitError(null);
            } else {
                setInitError(data.message || 'Failed to load user profile');
                // Auto retry after 5 seconds if failed but still on loading screen
                setTimeout(loadUserProfileData, 5000);
            }
        } catch (error) {
            if (isSessionExpiredError(error)) {
                setIsInitializing(false);
                return;
            }

            console.log(error);
            setInitError(error.message || 'A connection error occurred');
            // Auto retry after 5 seconds
            setTimeout(loadUserProfileData, 5000);
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        setToken(false);
        setUserData(false);
        setInitError(null);
    };

    const value = {
        token,
        setToken,
        backendUrl,
        userData,
        setUserData,
        loadUserProfileData,
        logout,
        isInitializing,
        setIsInitializing,
        initError,
        setInitError,
    };

    useEffect(() => {
        if (token) {
            loadUserProfileData();
        } else {
            setUserData(false);
            setIsInitializing(false);
        }
    }, [token]);

    useEffect(() => {
        const handleSessionExpired = () => {
            logout();
            toast.error(SESSION_EXPIRED_MESSAGE);
        };

        window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);

        return () => {
            window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
        };
    }, []);

    return (
        <AppContext.Provider value={value}>
            {props.children}
        </AppContext.Provider>
    );
};

export default AppContextProvider;