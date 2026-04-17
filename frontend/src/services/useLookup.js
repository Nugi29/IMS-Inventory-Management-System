import { useCallback, useContext, useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { AppContext } from "../context/AppContext";

export function useLookup() {
    const { backendUrl } = useContext(AppContext);
    const [roles, setRoles] = useState([]);
    const [statuses, setStatuses] = useState([]);
    const [categories, setCategories] = useState([]);
    const [itemStatuses, setItemStatuses] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [users, setUsers] = useState([]);
    const [poStatuses, setPoStatuses] = useState([]);

    const [isLoadingLookup, setIsLoadingLookup] = useState(false);

    const normalizeLookupItem = (item) => ({
        id: item?.id ?? item?.categoryId ?? item?.category_id ?? item?.roleId ?? item?.statusId ?? item?.userId ?? item?.supplierId ?? item?.poStatusId,
        label: item?.name ?? item?.categoryName ?? item?.category_name ?? item?.title ?? item?.roleName ?? item?.statusName ?? item?.userName ?? item?.supplierName ?? item?.poStatusName ?? item?.name,
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

    const getItemStatuses = useCallback(async () => {
        try {
            const { data } = await axios.get(`${backendUrl}/api/list/get-all-item-statuses`);
            if (data?.success || Array.isArray(data)) {
                const statusList = pickFirstArray(data, ['itemStatuses', 'statuses', 'statusData', 'data'])
                    .map(normalizeLookupItem)
                    .filter((status) => status.id !== undefined && status.id !== null && status.label);

                setItemStatuses(statusList);
                return true;
            }

            setItemStatuses([]);
            toast.error(data?.message || "Failed to load item statuses");
            return false;
        } catch (error) {
            setItemStatuses([]);
            toast.error(error?.response?.data?.message || error?.message || "Failed to load lookup data");
            return false;
        }
    }, [backendUrl]);

    const getAllUsers = useCallback(async () => {
        try {
            const { data } = await axios.get(`${backendUrl}/api/list/get-all-users`);
            if (data?.success || Array.isArray(data)) {
                setUsers(pickFirstArray(data, ['users', 'userData', 'data']));
                return true;
            }

            setUsers([]);
            toast.error(data?.message || "Failed to load lookup data");
            return false;
        } catch (error) {
            setUsers([]);
            toast.error(error?.response?.data?.message || error?.message || "Failed to load lookup data");
            return false;
        }
    }, [backendUrl]);

    const getAllSuppliers = useCallback(async () => {
        try {
            const { data } = await axios.get(`${backendUrl}/api/list/get-all-suppliers`);
            if (data?.success || Array.isArray(data)) {
                setSuppliers(pickFirstArray(data, ['suppliers', 'supplierData', 'data']));
                return true;
            }

            setSuppliers([]);
            toast.error(data?.message || "Failed to load lookup data");
            return false;
        } catch (error) {
            setSuppliers([]);
            toast.error(error?.response?.data?.message || error?.message || "Failed to load lookup data");
            return false;
        }
    }, [backendUrl]);

    const getAllPoStatuses = useCallback(async () => {
        try {
            const { data } = await axios.get(`${backendUrl}/api/list/get-all-po-statuses`);
            if (data?.success || Array.isArray(data)) {
                setPoStatuses(pickFirstArray(data, ['poStatuses', 'poStatuses', 'poStatusData', 'data']));
                return true;
            }

            setPoStatuses([]);
            toast.error(data?.message || "Failed to load lookup data");
            return false;
        } catch (error) {
            setPoStatuses([]);
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
            const [rolesLoaded, statusesLoaded, categoriesLoaded, itemStatusesLoaded, usersLoaded, suppliersLoaded, poStatusesLoaded] = await Promise.all([
                getUserRoles(),
                getUserStatuses(),
                getCategories(),
                getItemStatuses(),
                getAllUsers(),
                getAllSuppliers(),
                getAllPoStatuses()
            ]);
            return rolesLoaded && statusesLoaded && categoriesLoaded && itemStatusesLoaded && usersLoaded && suppliersLoaded && poStatusesLoaded;
        } finally {
            setIsLoadingLookup(false);
        }
    }, [getUserRoles, getUserStatuses, getCategories, getItemStatuses, getAllUsers, getAllSuppliers, getAllPoStatuses]);

    return {
        roles,
        statuses,
        categories,
        itemStatuses,
        suppliers,
        poStatuses,
        getCategories,
        getItemStatuses,
        getAllSuppliers,
        getAllPoStatuses,
        refreshCategories: getCategories,
        isLoadingLookup,
        getUserRoles,
        getUserStatuses,
        loadLookupData,
    };
}

