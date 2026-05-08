import { createContext, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import axios, { SESSION_EXPIRED_EVENT, SESSION_EXPIRED_MESSAGE, isSessionExpiredError } from '../services/httpClient';

export const AppContext = createContext();

const AppContextProvider = (props) => {

    const backendUrl = import.meta.env.VITE_BACKEND_URL;

    const [token, setToken] = useState(localStorage.getItem('token') ? localStorage.getItem('token') : false);
    const [userData, setUserData] = useState(false);
    

    const loadUserProfileData = async () => {
        try {
            const { data } = await axios.get(`${backendUrl}/api/user/get-profile`, { headers: { token } });
            if (data.success) {
                setUserData(data.userData);
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            if (isSessionExpiredError(error)) {
                return;
            }

            console.log(error);
            toast.error(error.message);
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        setToken(false);
        setUserData(false);
    };

    const value = {
        token,
        setToken,
        backendUrl,
        userData,
        setUserData,
        loadUserProfileData,
        logout,
    };

    useEffect(() => {
        if (token) {
            loadUserProfileData();
        } else {
            setUserData(false);
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