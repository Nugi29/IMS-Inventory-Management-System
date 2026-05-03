import { useState, useEffect } from "react";

/** Generic hook: runs an async `fetcher` and returns { data, loading } */
export function useTabData(fetcher) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetcher().then((result) => {
      if (!cancelled) {
        setData(result);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { data, loading };
}

export function useOverviewData(api) {
  return useTabData(async () => {
    const [s, d] = await Promise.all([api.getSummary(), api.getDashboard()]);
    return { summary: s?.summary, dashboard: d?.dashboardData };
  });
}

export function useSalesData(api) {
  return useTabData(async () => {
    const [sales, daily, monthly, byItem, byCashier, topItems] = await Promise.all([
      api.getSales(), api.getSalesDaily(), api.getSalesMonthly(),
      api.getSalesByItem(), api.getSalesByCashier(), api.getTopSellingItems(),
    ]);
    return {
      sales:     sales?.sales      || [],
      daily:     daily?.daily      || [],
      monthly:   monthly?.monthly  || [],
      byItem:    byItem?.byItem    || [],
      byCashier: byCashier?.byCashier || [],
      topItems:  topItems?.topItems || [],
    };
  });
}

export function useInventoryData(api) {
  return useTabData(async () => {
    const [inv, invValue, low, oos] = await Promise.all([
      api.getInventory(), api.getInventoryValue(),
      api.getLowStock(), api.getOutOfStock(),
    ]);
    return {
      inventory:      inv?.inventory    || [],
      inventoryValue: invValue?.total_value || 0,
      itemValues:     invValue?.itemValues  || [],
      low:            low?.lowStock     || [],
      oos:            oos?.outOfStock   || [],
    };
  });
}

export function usePurchasesData(api) {
  return useTabData(async () => {
    const [grn, grnSupplier, daily, monthly, byStatus, po, poPending, poCompleted] = await Promise.all([
      api.getGrnHistory(), api.getGrnBySupplier(), api.getGrnDaily(), api.getGrnMonthly(),
      api.getPurchaseOrdersByStatus(), api.getPurchaseOrders(),
      api.getPurchaseOrdersPending(), api.getPurchaseOrdersCompleted(),
    ]);
    return {
      grn:         grn?.grnHistory       || [],
      grnSupplier: grnSupplier?.bySupplier || [],
      daily:       daily?.daily          || [],
      monthly:     monthly?.monthly      || [],
      byStatus:    byStatus?.byStatus    || [],
      po:          po?.purchaseOrders    || [],
      poPending:   poPending?.pending    || [],
      poCompleted: poCompleted?.completed || [],
    };
  });
}

export function useStockMovementData(api) {
  return useTabData(async () => {
    const [history, byItem, byType, summary] = await Promise.all([
      api.getStockMovementHistory(), api.getStockMovementByItem(),
      api.getStockMovementByType(), api.getStockMovementSummary(),
    ]);
    return {
      history: history?.movements || [],
      byItem:  byItem?.byItem     || [],
      byType:  byType?.byType     || [],
      summary: summary?.summary   || {},
    };
  });
}

export function useAdjustmentsData(api) {
  return useTabData(async () => {
    const [adj, byItem, byReason] = await Promise.all([
      api.getStockAdjustments(), api.getStockAdjustmentsByItem(),
      api.getStockAdjustmentsReasons(),
    ]);
    return {
      adjustments: adj?.adjustments  || [],
      byItem:      byItem?.byItem    || [],
      byReason:    byReason?.byReason || [],
    };
  });
}

export function useSuppliersData(api) {
  return useTabData(async () => {
    const [summary, top] = await Promise.all([
      api.getSupplierSummary(), api.getTopSuppliers(),
    ]);
    return {
      summary:      summary?.summary    || {},
      topSuppliers: top?.topSuppliers   || [],
    };
  });
}

export function useProfitData(api) {
  return useTabData(async () => {
    const [total, byItem, byDate] = await Promise.all([
      api.getProfitTotal(), api.getProfitByItem(), api.getProfitByDate(),
    ]);
    return {
      total:  total?.total ?? total?.profit ?? 0,
      byItem: byItem?.byItem  || [],
      byDate: byDate?.byDate  || [],
    };
  });
}
