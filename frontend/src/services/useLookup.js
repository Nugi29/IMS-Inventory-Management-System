import { useCallback, useContext, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { AppContext } from "../context/AppContext";

export function useLookup() {
    const { backendUrl } = useContext(AppContext);
    const [roles, setRoles] = useState([]);
    const [statuses, setStatuses] = useState([]);
    const [isLoadingLookup, setIsLoadingLookup] = useState(false);

    const pickFirstArray = (payload, keys) => {
        if (Array.isArray(payload)) {
            return payload;
        }

        for (const key of keys) {
            if (Array.isArray(payload?.[key])) {
                return payload[key];
            }
        }

        if (payload && typeof payload === 'object') {
            const firstArray = Object.values(payload).find((value) => Array.isArray(value));
            if (Array.isArray(firstArray)) {
                return firstArray;
            }
        }

        return [];
    };

    const getUserRoles = useCallback(async () => {
        try {
            const { data } = await axios.get(`${backendUrl}/api/list/get-all-user-roles`);
            if (data?.success || Array.isArray(data)) {
                setRoles(pickFirstArray(data, ['roles', 'userRoles', 'roleData', 'data']));
                return true;
            }

            setRoles([]);
            toast.error(data?.message || "Failed to load lookup data");
            return false;
        } catch (error) {
            setRoles([]);
            toast.error(error?.response?.data?.message || error?.message || "Failed to load lookup data");
            return false;
        }
    }, [backendUrl]);

    const getUserStatuses = useCallback(async () => {
        try {
            const { data } = await axios.get(`${backendUrl}/api/list/get-all-user-statuses`);
            if (data?.success || Array.isArray(data)) {
                setStatuses(pickFirstArray(data, ['statuses', 'userStatuses', 'statusData', 'data']));
                return true;
            }

            setStatuses([]);
            toast.error(data?.message || "Failed to load lookup data");
            return false;
        } catch (error) {
            setStatuses([]);
            toast.error(error?.response?.data?.message || error?.message || "Failed to load lookup data");
            return false;
        }
    }, [backendUrl]);

    const loadLookupData = useCallback(async () => {
        setIsLoadingLookup(true);
        try {
            const [rolesLoaded, statusesLoaded] = await Promise.all([getUserRoles(), getUserStatuses()]);
            return rolesLoaded && statusesLoaded;
        } finally {
            setIsLoadingLookup(false);
        }
    }, [getUserRoles, getUserStatuses]);

    return {
        roles,
        statuses,
        isLoadingLookup,
        getUserRoles,
        getUserStatuses,
        loadLookupData,
    };
}

