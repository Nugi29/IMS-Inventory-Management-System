import { useCallback, useContext, useEffect, useState } from "react";
import axios, { SESSION_EXPIRED_MESSAGE, isSessionExpiredError } from "./httpClient";
import { AppContext } from "../context/AppContext";

const ENDPOINTS = {
  list:   "/api/item/all-items",
  create: "/api/item/create-item",
  update: "/api/item/update-item",
  remove: "/api/item/delete-item",
};

export function useItem() {
  const { backendUrl, token } = useContext(AppContext);
  const [items, setItems]         = useState([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  const headers  = useCallback(() => ({ headers: { token } }), [token]);
  const endpoint = useCallback((path) => `${backendUrl}${path}`, [backendUrl]);

  const parseItems = (data) =>
    data?.itemsData ?? data?.items ?? (Array.isArray(data) ? data : []);

  // ── load ──────────────────────────────────────────────────────────────────

  const loadItems = useCallback(async () => {
    if (!token) { setItems([]); return; }
    setIsLoadingItems(true);
    try {
      const { data } = await axios.get(endpoint(ENDPOINTS.list), headers());
      setItems(parseItems(data));
    } catch (error) {
      if (isSessionExpiredError(error)) {
        return;
      }

      setItems([]);
    } finally {
      setIsLoadingItems(false);
    }
  }, [token, endpoint, headers]);

  // ── create ────────────────────────────────────────────────────────────────

  const addItem = async (payload) => {
    try {
      const { data } = await axios.post(endpoint(ENDPOINTS.create), payload, headers());
      if (data?.success) { await loadItems(); return { success: true, message: data.message }; }
      return { success: false, message: data?.message ?? "Failed to add item" };
    } catch (err) {
      if (isSessionExpiredError(err)) {
        return { success: false, message: SESSION_EXPIRED_MESSAGE };
      }

      return { success: false, message: err?.response?.data?.message ?? err.message };
    }
  };

  // ── update ────────────────────────────────────────────────────────────────

  const updateItem = async (item) => {
    const id = Number(item?.id ?? item?.item_id ?? item?._id);
    if (!id) return { success: false, message: "Missing item id" };

    const payload = Object.fromEntries(
      Object.entries({
        id,
        item_name:      item.item_name,
        sku:            item.sku?.trim(),
        category_id:    item.category_id,
        supplier_id:    item.supplier_id,
        item_status_id: item.item_status_id,
        selling_price:  item.selling_price,
        quantity:       item.quantity,
        reorder_level:  item.reorder_level,
      }).filter(([, v]) => v !== undefined && v !== null && v !== "")
    );

    // try PUT first, fall back to POST
    for (const method of ["put", "post"]) {
      try {
        const fn = method === "put" ? axios.put : axios.post;
        const { data } = await fn(endpoint(`${ENDPOINTS.update}/${id}`), payload, headers());
        if (data?.success) { await loadItems(); return { success: true, message: data.message }; }
      } catch (err) {
        if (isSessionExpiredError(err)) {
          return { success: false, message: SESSION_EXPIRED_MESSAGE };
        }
      }
    }
    return { success: false, message: "Failed to update item" };
  };

  // ── delete ────────────────────────────────────────────────────────────────

  const deleteItem = async (item) => {
    const id = Number(item?.id ?? item?.item_id ?? item?._id);
    if (!id) return { success: false, message: "Missing item id" };

    try {
      const { data } = await axios.delete(endpoint(`${ENDPOINTS.remove}/${id}`), headers());
      if (data?.success) { await loadItems(); return { success: true, message: data.message }; }
      return { success: false, message: data?.message ?? "Failed to delete item" };
    } catch (err) {
      if (isSessionExpiredError(err)) {
        return { success: false, message: SESSION_EXPIRED_MESSAGE };
      }

      return { success: false, message: err?.response?.data?.message ?? err.message };
    }
  };

  useEffect(() => { loadItems(); }, [loadItems]);

  return { items, isLoadingItems, reloadItems: loadItems, addItem, updateItem, deleteItem };
}

export const useItems = useItem;
