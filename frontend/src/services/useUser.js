import { useCallback, useContext, useEffect, useState } from "react";
import axios from "axios";
import { AppContext } from "../context/AppContext";

export function useUser() {
    const { backendUrl, token } = useContext(AppContext);
    const [users, setUsers] = useState([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);

    const loadUsers = useCallback(async () => {
        if (!token) {
            setUsers([]);
            return;
        }

        setIsLoadingUsers(true);
        try {
            const { data } = await axios.get(`${backendUrl}/api/user/all-profiles`, {
                headers: { token },
            });

            if (data?.success && Array.isArray(data?.usersData)) {
                setUsers(data.usersData);
                return;
            }

            if (data?.success && Array.isArray(data?.userData)) {
                setUsers(data.userData);
                return;
            }

            if (Array.isArray(data)) {
                setUsers(data);
                return;
            }

            setUsers([]);
        } catch {
            setUsers([]);
        } finally {
            setIsLoadingUsers(false);
        }
    }, [backendUrl, token]);

    const addUser = async (userInfo) => {
        try {
            const { data } = await axios.post(`${backendUrl}/api/user/add`, userInfo, {
                headers: { token },
            });
            if (data?.success) {
                await loadUsers();
                return { success: true, message: data?.message || "User added successfully" };
            }
            return { success: false, message: data?.message || "Failed to add user" };
        } catch (error) {
            return { success: false, message: error?.response?.data?.message || error.message || "Failed to add user" };
        }
    };

    useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    return { users, isLoadingUsers, reloadUsers: loadUsers, addUser };
}



export const useUsers = useUser;