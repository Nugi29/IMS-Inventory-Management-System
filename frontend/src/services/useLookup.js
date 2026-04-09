import { useCallback, useContext, useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { AppContext } from "../context/AppContext";

export function useLookup() {
    const { backendUrl } = useContext(AppContext);
    const [roles, setRoles] = useState([]);
    const [statuses, setStatuses] = useState([]);
    const [categories, setCategories] = useState([]);
    const [isLoadingLookup, setIsLoadingLookup] = useState(false);

    const normalizeLookupItem = (item) => ({
        id: item?.id ?? item?.categoryId ?? item?.category_id ?? item?.roleId ?? item?.statusId,
        label: item?.name ?? item?.categoryName ?? item?.category_name ?? item?.title ?? item?.roleName ?? item?.statusName,
    });

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

    const getCategories = useCallback(async () => {
        try {
            const { data } = await axios.get(`${backendUrl}/api/list/get-all-categories`);
            if (data?.success || Array.isArray(data)) {
                const categoryList = pickFirstArray(data, ['categories', 'categoryData', 'data'])
                    .map(normalizeLookupItem)
                    .filter((category) => category.id !== undefined && category.id !== null && category.label);

                setCategories(categoryList);
                return true;
            }

            setCategories([]);
            toast.error(data?.message || "Failed to load categories");
            return false;
        } catch (error) {
            setCategories([]);
            toast.error(error?.response?.data?.message || error?.message || "Failed to load lookup data");
            return false;
        }
    }, [backendUrl]);

    // Auto-load categories on mount
    useEffect(() => {
        getCategories();
    }, [getCategories]);

    const loadLookupData = useCallback(async () => {
        setIsLoadingLookup(true);
        try {
            const [rolesLoaded, statusesLoaded, categoriesLoaded] = await Promise.all([getUserRoles(), getUserStatuses(), getCategories()]);
            return rolesLoaded && statusesLoaded && categoriesLoaded;
        } finally {
            setIsLoadingLookup(false);
        }
    }, [getUserRoles, getUserStatuses, getCategories]);

    return {
        roles,
        statuses,
        categories,
        getCategories,
        refreshCategories: getCategories,
        isLoadingLookup,
        getUserRoles,
        getUserStatuses,
        loadLookupData,
    };
}

