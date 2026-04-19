import { useCallback, useContext, useEffect, useState } from "react";
import axios, { SESSION_EXPIRED_MESSAGE, isSessionExpiredError } from "./httpClient";
import { AppContext } from "../context/AppContext";

const BASE_ENDPOINT = "/api/grns";

const parseArrayPayload = (data) => {
  if (Array.isArray(data)) return data;

  const direct = data?.grnsData ?? data?.grnData ?? data?.grns ?? data?.grnList ?? data?.data;
  if (Array.isArray(direct)) return direct;

  if (data && typeof data === "object") {
    const firstArray = Object.values(data).find((value) => Array.isArray(value));
    if (Array.isArray(firstArray)) return firstArray;
  }

  return [];
};

const parseObjectPayload = (data) => {
  if (!data || typeof data !== "object") return null;

  const direct = data?.grnData ?? data?.grn ?? data?.data;
  if (direct && typeof direct === "object" && !Array.isArray(direct)) {
    return direct;
  }

  const firstObject = Object.values(data).find((value) => value && typeof value === "object" && !Array.isArray(value));
  return firstObject || null;
};

const parseItemsPayload = (data) => {
  if (Array.isArray(data)) return data;

  const direct = data?.itemsData ?? data?.grnItems ?? data?.grn_items ?? data?.items ?? data?.data;
  if (Array.isArray(direct)) return direct;

  const extractArrays = (value, depth = 0) => {
    if (depth > 5 || value == null) return [];
    if (Array.isArray(value)) return [value];
    if (typeof value !== "object") return [];

    const prioritizedKeys = [
      "grn_items",
      "grnItems",
      "items",
      "itemsData",
      "line_items",
      "rows",
      "data",
    ];

    const found = [];

    prioritizedKeys.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        found.push(...extractArrays(value[key], depth + 1));
      }
    });

    Object.values(value).forEach((entry) => {
      found.push(...extractArrays(entry, depth + 1));
    });

    return found;
  };

  const nestedArrays = extractArrays(data);
  if (nestedArrays.length) {
    return nestedArrays.reduce((best, current) =>
      current.length > best.length ? current : best,
    nestedArrays[0]);
  }

  if (data && typeof data === "object") {
    const firstArray = Object.values(data).find((value) => Array.isArray(value));
    if (Array.isArray(firstArray)) return firstArray;
  }

  return [];
};

const parseItemsFromGrnObject = (grn) => {
  if (!grn || typeof grn !== "object") return [];

  const candidates = [
    grn?.grn_items,
    grn?.grnItems,
    grn?.items,
    grn?.item_details,
    grn?.line_items,
  ];

  for (const entry of candidates) {
    if (Array.isArray(entry)) return entry;
  }

  return [];
};

const GRN_STATUS_TO_PO_STATUS_ID = {
  1: 1,
  2: 3,
  3: 4,
  4: 5,
};

const normalizeStatusId = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const normalizeGrnWritePayload = (payload = {}) => {
  const nextPayload = { ...payload };
  const grnStatusId = normalizeStatusId(
    nextPayload.grn_status_id ?? nextPayload.grnStatusId,
  );
  const poStatusId = normalizeStatusId(
    nextPayload.po_status_id ?? nextPayload.poStatusId,
  );

  if (grnStatusId && !poStatusId) {
    nextPayload.po_status_id = GRN_STATUS_TO_PO_STATUS_ID[grnStatusId] ?? nextPayload.po_status_id;
  }

  if (!grnStatusId && poStatusId) {
    const inferredGrnStatusId = Object.entries(GRN_STATUS_TO_PO_STATUS_ID)
      .find(([, mappedPoStatusId]) => Number(mappedPoStatusId) === poStatusId)?.[0];

    if (inferredGrnStatusId) {
      nextPayload.grn_status_id = Number(inferredGrnStatusId);
    }
  }

  return nextPayload;
};

export function useGrn() {
  const { backendUrl, token } = useContext(AppContext);

  const [grns, setGrns] = useState([]);
  const [isLoadingGrns, setIsLoadingGrns] = useState(false);

  const headers = useCallback(() => ({ headers: { token } }), [token]);
  const endpoint = useCallback((path) => `${backendUrl}${BASE_ENDPOINT}${path}`, [backendUrl]);

  const buildErrorMessage = (error, fallbackMessage) => (
    error?.response?.data?.message || error?.message || fallbackMessage
  );

  const loadGrns = useCallback(async () => {
    if (!token) {
      setGrns([]);
      return;
    }

    setIsLoadingGrns(true);
    try {
      const { data } = await axios.get(endpoint("/"), headers());
      setGrns(parseArrayPayload(data));
    } catch (error) {
      if (isSessionExpiredError(error)) {
        return;
      }

      setGrns([]);
    } finally {
      setIsLoadingGrns(false);
    }
  }, [token, endpoint, headers]);

  const getGrnById = useCallback(async (id) => {
    if (!token || !id) return null;

    try {
      const { data } = await axios.get(endpoint(`/${id}`), headers());
      return parseObjectPayload(data);
    } catch (error) {
      if (isSessionExpiredError(error)) {
        return null;
      }

      return null;
    }
  }, [token, endpoint, headers]);

  const getGrnsByStatus = useCallback(async (status) => {
    if (!token || !status) return [];

    try {
      const { data } = await axios.get(endpoint(`/status/${status}`), headers());
      return parseArrayPayload(data);
    } catch (error) {
      if (isSessionExpiredError(error)) {
        return [];
      }

      return [];
    }
  }, [token, endpoint, headers]);

  const getGrnsBySupplier = useCallback(async (supplierId) => {
    if (!token || !supplierId) return [];

    try {
      const { data } = await axios.get(endpoint(`/supplier/${supplierId}`), headers());
      return parseArrayPayload(data);
    } catch (error) {
      if (isSessionExpiredError(error)) {
        return [];
      }

      return [];
    }
  }, [token, endpoint, headers]);

  const getGrnByPurchaseOrder = useCallback(async (poId) => {
    if (!token || !poId) return null;

    try {
      const { data } = await axios.get(endpoint(`/purchase-order/${poId}`), headers());
      return parseObjectPayload(data);
    } catch (error) {
      if (isSessionExpiredError(error)) {
        return null;
      }

      return null;
    }
  }, [token, endpoint, headers]);

  const getGrnItems = useCallback(async (id) => {
    if (!token || !id) return [];

    try {
      const { data } = await axios.get(endpoint(`/${id}/items`), headers());
      const directItems = parseItemsPayload(data);
      if (directItems.length) return directItems;

      const embeddedGrn = parseObjectPayload(data);
      const embeddedItems = parseItemsFromGrnObject(embeddedGrn);
      if (embeddedItems.length) return embeddedItems;

      // Fallback for APIs that expose items only on get-by-id payload.
      const { data: byIdData } = await axios.get(endpoint(`/${id}`), headers());
      const grn = parseObjectPayload(byIdData);
      return parseItemsFromGrnObject(grn);
    } catch (error) {
      if (isSessionExpiredError(error)) {
        return [];
      }

      try {
        // If /:id/items route fails, still try get-by-id as a recovery path.
        const { data } = await axios.get(endpoint(`/${id}`), headers());
        const grn = parseObjectPayload(data);
        return parseItemsFromGrnObject(grn);
      } catch {
        return [];
      }
    }
  }, [token, endpoint, headers]);

  const createGrn = async (payload) => {
    try {
      const { data } = await axios.post(endpoint("/"), normalizeGrnWritePayload(payload), headers());
      if (data?.success) {
        await loadGrns();
        return { success: true, message: data.message, data };
      }
      return { success: false, message: data?.message || "Failed to create GRN", data };
    } catch (error) {
      if (isSessionExpiredError(error)) {
        return { success: false, message: SESSION_EXPIRED_MESSAGE };
      }

      return { success: false, message: buildErrorMessage(error, "Failed to create GRN") };
    }
  };

  const createGrnFromPurchaseOrder = async (poId, payload = {}) => {
    if (!poId) return { success: false, message: "Missing purchase order id" };

    try {
      const { data } = await axios.post(endpoint(`/from-po/${poId}`), normalizeGrnWritePayload(payload), headers());
      if (data?.success) {
        await loadGrns();
        return { success: true, message: data.message, data };
      }
      return { success: false, message: data?.message || "Failed to create GRN from purchase order", data };
    } catch (error) {
      if (isSessionExpiredError(error)) {
        return { success: false, message: SESSION_EXPIRED_MESSAGE };
      }

      return { success: false, message: buildErrorMessage(error, "Failed to create GRN from purchase order") };
    }
  };

  const addGrnItem = async (id, payload) => {
    if (!id) return { success: false, message: "Missing GRN id" };

    try {
      const { data } = await axios.post(endpoint(`/${id}/items`), payload, headers());
      if (data?.success) {
        await loadGrns();
        return { success: true, message: data.message, data };
      }
      return { success: false, message: data?.message || "Failed to add GRN item", data };
    } catch (error) {
      if (isSessionExpiredError(error)) {
        return { success: false, message: SESSION_EXPIRED_MESSAGE };
      }

      return { success: false, message: buildErrorMessage(error, "Failed to add GRN item") };
    }
  };

  const updateGrn = async (grn) => {
    const id = Number(grn?.id ?? grn?.grn_id ?? grn?._id);
    if (!id) return { success: false, message: "Missing GRN id" };

    const payload = normalizeGrnWritePayload(Object.fromEntries(
      Object.entries(grn || {}).filter(([, value]) => value !== undefined && value !== null && value !== "")
    ));

    try {
      const { data } = await axios.put(endpoint(`/${id}`), payload, headers());
      if (data?.success) {
        await loadGrns();
        return { success: true, message: data.message, data };
      }
      return { success: false, message: data?.message || "Failed to update GRN", data };
    } catch (error) {
      if (isSessionExpiredError(error)) {
        return { success: false, message: SESSION_EXPIRED_MESSAGE };
      }

      return { success: false, message: buildErrorMessage(error, "Failed to update GRN") };
    }
  };

  const deleteGrn = async (grn) => {
    const id = Number(grn?.id ?? grn?.grn_id ?? grn?._id ?? grn);
    if (!id) return { success: false, message: "Missing GRN id" };

    try {
      const { data } = await axios.delete(endpoint(`/${id}`), headers());
      if (data?.success) {
        await loadGrns();
        return { success: true, message: data.message, data };
      }
      return { success: false, message: data?.message || "Failed to delete GRN", data };
    } catch (error) {
      if (isSessionExpiredError(error)) {
        return { success: false, message: SESSION_EXPIRED_MESSAGE };
      }

      return { success: false, message: buildErrorMessage(error, "Failed to delete GRN") };
    }
  };

  useEffect(() => {
    loadGrns();
  }, [loadGrns]);

  return {
    grns,
    isLoadingGrns,
    reloadGrns: loadGrns,
    getGrnById,
    getGrnsByStatus,
    getGrnsBySupplier,
    getGrnByPurchaseOrder,
    getGrnItems,
    addGrnItem,
    createGrn,
    createGrnFromPurchaseOrder,
    updateGrn,
    deleteGrn,
  };
}

export const useGrns = useGrn;
