import { useCallback, useContext, useEffect, useState } from "react";
import axios from "axios";
import { AppContext } from "../context/AppContext";

const ENDPOINTS = {
  list: "/api/po/all-po",
  create: "/api/po/create",
  update: "/api/po/update",
  remove: "/api/po/delete",
};

export function usePo() {
  const { backendUrl, token } = useContext(AppContext);
  const [pos, setPos] = useState([]);
  const [isLoadingPos, setIsLoadingPos] = useState(false);

  const headers = useCallback(() => ({ headers: { token } }), [token]);
  const endpoint = useCallback((path) => `${backendUrl}${path}`, [backendUrl]);

  const parsePos = (data) => {
    if (Array.isArray(data)) return data;

    const direct = data?.posData ?? data?.poData ?? data?.purchaseOrders ?? data?.poList ?? data?.data;
    if (Array.isArray(direct)) return direct;

    if (data && typeof data === "object") {
      const firstArray = Object.values(data).find((value) => Array.isArray(value));
      if (Array.isArray(firstArray)) return firstArray;
    }

    return [];
  };

  // ── load ──────────────────────────────────────────────────────────────────

  const loadPos = useCallback(async () => {
    if (!token) { setPos([]); return; }
    setIsLoadingPos(true);
    try {
      const { data } = await axios.get(endpoint(ENDPOINTS.list), headers());
      setPos(parsePos(data));
    } catch {
      setPos([]);
    } finally {
      setIsLoadingPos(false);
    }
  }, [token, endpoint, headers]);

  // ── create ────────────────────────────────────────────────────────────────

  const addPo = async (payload) => {
    try {
      const { data } = await axios.post(endpoint(ENDPOINTS.create), payload, headers());
      if (data?.success) { await loadPos(); return { success: true, message: data.message }; }
      return { success: false, message: data?.message ?? "Failed to add purchase order" };
    } catch (err) {
      return { success: false, message: err?.response?.data?.message ?? err.message };
    }
  };

  // ── update ────────────────────────────────────────────────────────────────

  const updatePo = async (po) => {
    const id = Number(po?.id ?? po?.po_id ?? po?._id);
    if (!id) return { success: false, message: "Missing purchase order id" };

    const payload = Object.fromEntries(
      Object.entries({
        id,
        po_no: po.po_no,
        supplier_id: po.supplier_id,
        po_status_id: po.po_status_id,
        order_date: po.order_date,
        shipping_terms: po.shipping_terms,
        internal_notes: po.internal_notes,
        shipping_cost: po.shipping_cost,
        total_amount: po.total_amount,
        items: po.items,
        createdAt: po.createdAt,
      }).filter(([, v]) => v !== undefined && v !== null && v !== "")
    );

    // try PUT first, fall back to POST
    for (const method of ["put", "post"]) {
      try {
        const fn = method === "put" ? axios.put : axios.post;
        const { data } = await fn(endpoint(`${ENDPOINTS.update}/${id}`), payload, headers());
        if (data?.success) { await loadPos(); return { success: true, message: data.message }; }
      } catch { /* try next */ }
    }
    return { success: false, message: "Failed to update purchase order" };
  };

  // ── delete ────────────────────────────────────────────────────────────────

  const deletePo = async (po) => {
    const id = Number(po?.id ?? po?.po_id ?? po?._id);
    if (!id) return { success: false, message: "Missing purchase order id" };

    try {
      const { data } = await axios.delete(endpoint(`${ENDPOINTS.remove}/${id}`), headers());
      if (data?.success) { await loadPos(); return { success: true, message: data.message }; }
      return { success: false, message: data?.message ?? "Failed to delete purchase order" };
    } catch (err) {
      return { success: false, message: err?.response?.data?.message ?? err.message };
    }
  };

  useEffect(() => { loadPos(); }, [loadPos]);

  return { pos, isLoadingPos, reloadPos: loadPos, addPo, updatePo, deletePo };
}

export const usePos = usePo;