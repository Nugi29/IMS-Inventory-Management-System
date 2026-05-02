
import {
  Document, Page, Text, View, StyleSheet, pdf, Font
} from "@react-pdf/renderer";

// ─── Shared Styles ────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  page: { backgroundColor: "#ffffff", padding: 36, fontFamily: "Helvetica", fontSize: 9, color: "#1e293b" },
  header: { marginBottom: 20, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: "#10b981", flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  headerLeft: {},
  headerTitle: { fontSize: 22, fontFamily: "Helvetica-Bold", color: "#0f172a", marginBottom: 2 },
  headerSub: { fontSize: 9, color: "#64748b" },
  headerRight: { alignItems: "flex-end" },
  headerBadge: { backgroundColor: "#10b981", color: "#fff", fontSize: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, fontFamily: "Helvetica-Bold" },
  headerDate: { fontSize: 8, color: "#94a3b8", marginTop: 4 },

  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#0f172a", marginBottom: 2 },
  sectionSub: { fontSize: 8, color: "#64748b", marginBottom: 8 },

  kpiRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  kpiCard: { flex: 1, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 6, padding: 10 },
  kpiLabel: { fontSize: 7, color: "#94a3b8", fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  kpiValue: { fontSize: 15, fontFamily: "Helvetica-Bold", color: "#0f172a" },
  kpiSub: { fontSize: 7, color: "#94a3b8", marginTop: 2 },

  table: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 6, overflow: "hidden", marginBottom: 10 },
  tableHead: { flexDirection: "row", backgroundColor: "#f1f5f9", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  tableHeadCell: { flex: 1, padding: "6 8", fontFamily: "Helvetica-Bold", fontSize: 7.5, color: "#64748b", textTransform: "uppercase" },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  tableRowAlt: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#f1f5f9", backgroundColor: "#fafafa" },
  tableCell: { flex: 1, padding: "5 8", fontSize: 8, color: "#334155" },

  badgeGreen: { backgroundColor: "#d1fae5", color: "#065f46", fontSize: 7, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3, fontFamily: "Helvetica-Bold" },
  badgeAmber: { backgroundColor: "#fef3c7", color: "#92400e", fontSize: 7, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3, fontFamily: "Helvetica-Bold" },
  badgeRed: { backgroundColor: "#fee2e2", color: "#991b1b", fontSize: 7, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3, fontFamily: "Helvetica-Bold" },
  badgeBlue: { backgroundColor: "#dbeafe", color: "#1e40af", fontSize: 7, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3, fontFamily: "Helvetica-Bold" },

  footer: { position: "absolute", bottom: 24, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "#e2e8f0", paddingTop: 6 },
  footerText: { fontSize: 7.5, color: "#94a3b8" },

  divider: { height: 1, backgroundColor: "#f1f5f9", marginVertical: 10 },
  emerald: { color: "#10b981" },
  rose: { color: "#f43f5e" },
  sky: { color: "#0ea5e9" },
  amber: { color: "#f59e0b" },
  bold: { fontFamily: "Helvetica-Bold" },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) => n >= 1_000_000 ? `Rs. ${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `Rs. ${(n / 1_000).toFixed(1)}K` : `Rs. ${Number(n ?? 0).toLocaleString()}`;
const fmtNum = (n) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n ?? 0);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
const now = () => new Date().toLocaleDateString("en-US", { dateStyle: "long" });

// ─── Shared Components ────────────────────────────────────────────────────────
const PDFHeader = ({ title, subtitle, badge }) => (
  <View style={S.header}>
    <View style={S.headerLeft}>
      <Text style={S.headerTitle}>{title}</Text>
      <Text style={S.headerSub}>{subtitle}</Text>
    </View>
    <View style={S.headerRight}>
      <Text style={S.headerBadge}>{badge || "IMS REPORT"}</Text>
      <Text style={S.headerDate}>Generated: {now()}</Text>
    </View>
  </View>
);

const PDFFooter = ({ title }) => (
  <View style={S.footer} fixed>
    <Text style={S.footerText}>IMS — {title}</Text>
    <Text style={S.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
  </View>
);

const KpiRow = ({ items }) => (
  <View style={S.kpiRow}>
    {items.map((k, i) => (
      <View key={i} style={S.kpiCard}>
        <Text style={S.kpiLabel}>{k.label}</Text>
        <Text style={[S.kpiValue, k.color === "green" ? S.emerald : k.color === "red" ? S.rose : k.color === "sky" ? S.sky : {}]}>{k.value}</Text>
        {k.sub && <Text style={S.kpiSub}>{k.sub}</Text>}
      </View>
    ))}
  </View>
);

const PDFTable = ({ headers, rows, title, sub }) => (
  <View style={S.section}>
    {title && <Text style={S.sectionTitle}>{title}</Text>}
    {sub && <Text style={S.sectionSub}>{sub}</Text>}
    <View style={S.table}>
      <View style={S.tableHead}>
        {headers.map((h, i) => <Text key={i} style={S.tableHeadCell}>{h}</Text>)}
      </View>
      {rows.map((row, i) => (
        <View key={i} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
          {row.map((cell, j) => <Text key={j} style={S.tableCell}>{cell}</Text>)}
        </View>
      ))}
    </View>
  </View>
);

// ══════════════════════════════════════════════════════════════════════════════
// 1. OVERVIEW PDF
// ══════════════════════════════════════════════════════════════════════════════
export function OverviewPDF({ summary, dashboard }) {
  const { salesTrend = [], recentSales = [], lowStockItems = [], purchaseActivity = [] } = dashboard || {};
  const s = summary || {};
  return (
    <Document>
      <Page size="A4" style={S.page}>
        <PDFHeader title="Business Overview" subtitle="Complete snapshot of key business metrics" badge="OVERVIEW" />
        <KpiRow items={[
          { label: "Total Sales", value: fmt(s.totalSales), color: "green" },
          { label: "Total Purchases", value: fmt(s.totalPurchases), color: "sky" },
          { label: "Profit / Loss", value: fmt(s.totalProfit), color: s.totalProfit >= 0 ? "green" : "red" },
          { label: "Stock Value", value: fmt(s.totalStockValue) },
        ]} />
        <KpiRow items={[
          { label: "Total Orders", value: fmtNum(s.totalOrders) },
          { label: "Suppliers", value: String(s.totalSuppliers ?? 0) },
          { label: "Low Stock Items", value: String(s.lowStock ?? 0), color: "red", sub: "Need reorder" },
          { label: "Today Sales", value: fmt(dashboard?.summary?.total_sales_today), sub: `${dashboard?.summary?.total_sales_count_today ?? 0} transactions` },
        ]} />
        <PDFTable
          title="Recent Sales"
          sub="Latest invoices"
          headers={["Invoice", "Date", "Items", "Amount"]}
          rows={recentSales.slice(0, 10).map(r => [r.invoice_no, fmtDate(r.sale_date), String(r.item_count), fmt(r.total_amount)])}
        />
        <PDFTable
          title="Low Stock Alerts"
          sub="Items below reorder threshold"
          headers={["Item Name", "Qty", "Reorder Level", "Status"]}
          rows={lowStockItems.slice(0, 10).map(i => [i.item_name, String(i.quantity), String(i.reorder_level), i.is_out_of_stock ? "OUT OF STOCK" : "LOW"])}
        />
        <PDFTable
          title="Recent Purchase Activity"
          sub="Recent goods received"
          headers={["GRN No", "Supplier", "Items", "Amount", "Status", "Date"]}
          rows={purchaseActivity.slice(0, 8).map(p => [p.grn_no, p.supplier_name, String(p.items_received), fmt(p.total_amount), p.status_name, fmtDate(p.grn_date)])}
        />
        <PDFFooter title="Overview Report" />
      </Page>
    </Document>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. SALES PDF
// ══════════════════════════════════════════════════════════════════════════════
export function SalesPDF({ data }) {
  const { sales = [], daily = [], monthly = [], byItem = [], byCashier = [], topItems = [] } = data || {};
  return (
    <Document>
      <Page size="A4" style={S.page}>
        <PDFHeader title="Sales Report" subtitle="Revenue analysis, top items & cashier breakdown" badge="SALES" />
        <KpiRow items={[
          { label: "Top Item Revenue", value: fmt(byItem[0]?.revenue), color: "green", sub: byItem[0]?.item_name?.split(" ").slice(0, 2).join(" ") },
          { label: "Unique SKUs Sold", value: fmtNum(byItem.length) },
          { label: "Top Cashier", value: byCashier[0]?.cashier ?? "—", sub: fmt(byCashier[0]?.total_amount) },
          { label: "Latest Month", value: fmt(monthly[0]?.total_amount), sub: `${monthly[0]?.count ?? 0} txns` },
        ]} />
        <PDFTable
          title="Daily Sales"
          sub="Revenue by day"
          headers={["Date", "Transactions", "Amount"]}
          rows={daily.slice(0, 15).map(d => [fmtDate(d.date), String(d.count ?? "—"), fmt(d.total_amount)])}
        />
        <PDFTable
          title="Top Selling Items"
          sub="Best performing products by revenue"
          headers={["#", "Item Name", "Qty Sold", "Revenue"]}
          rows={topItems.slice(0, 15).map((item, i) => [String(i + 1), item.item_name, fmtNum(item.quantity), fmt(item.revenue)])}
        />
        <PDFTable
          title="Sales by Item"
          sub="Revenue breakdown per product"
          headers={["Item Name", "Qty Sold", "Revenue"]}
          rows={byItem.slice(0, 15).map(r => [r.item_name, String(r.quantity), fmt(r.revenue)])}
        />
        <PDFTable
          title="Sales by Cashier"
          sub="Revenue split by cashier"
          headers={["Cashier", "Transactions", "Total Amount"]}
          rows={byCashier.slice(0, 10).map(r => [r.cashier, String(r.count ?? "—"), fmt(r.total_amount)])}
        />
        <PDFFooter title="Sales Report" />
      </Page>
    </Document>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. INVENTORY PDF
// ══════════════════════════════════════════════════════════════════════════════
export function InventoryPDF({ data }) {
  const { inventory = [], inventoryValue = 0, itemValues = [], low = [], oos = [] } = data || {};
  const totalUnits = inventory.reduce((s, i) => s + i.quantity, 0);
  return (
    <Document>
      <Page size="A4" style={S.page}>
        <PDFHeader title="Inventory Report" subtitle="Full stock overview, values & health status" badge="INVENTORY" />
        <KpiRow items={[
          { label: "Total SKUs", value: String(inventory.length), color: "sky" },
          { label: "Total Units", value: fmtNum(totalUnits) },
          { label: "Stock Value", value: fmt(inventoryValue), color: "green" },
          { label: "Low Stock Items", value: String(low.length), color: "red", sub: "Below reorder" },
        ]} />
        <PDFTable
          title="Full Inventory"
          sub={`${inventory.length} items`}
          headers={["Code", "Item Name", "Qty", "Reorder", "Supplier", "Status"]}
          rows={inventory.slice(0, 30).map(i => {
            const ok = i.quantity >= i.reorder_level;
            const out = i.quantity === 0;
            return [i.code, i.name, String(i.quantity), String(i.reorder_level), i.supplier, out ? "OUT" : !ok ? "LOW" : "OK"];
          })}
        />
        {low.length > 0 && (
          <PDFTable
            title="Low Stock Items"
            sub="Critically low stock requiring reorder"
            headers={["Item Name", "Current Qty", "Reorder Level", "Status"]}
            rows={low.slice(0, 15).map(i => [i.item_name ?? i.name, String(i.quantity), String(i.reorder_level), i.quantity === 0 ? "OUT OF STOCK" : "LOW"])}
          />
        )}
        {itemValues.length > 0 && (
          <PDFTable
            title="Item Values"
            sub="Inventory value by item"
            headers={["Item", "Qty", "Unit Price", "Total Value"]}
            rows={itemValues.slice(0, 15).map(iv => [iv.item_name, String(iv.quantity), fmt(iv.unit_price), fmt(iv.value)])}
          />
        )}
        <PDFFooter title="Inventory Report" />
      </Page>
    </Document>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. PURCHASES PDF
// ══════════════════════════════════════════════════════════════════════════════
export function PurchasesPDF({ data }) {
  const { grn = [], grnSupplier = [], daily = [], monthly = [], byStatus = [], po = [], poPending = [], poCompleted = [] } = data || {};
  const totalGrn = grn.reduce((s, g) => s + (g.total_amount || 0), 0);
  const fullyReceived = grn.filter(g => g.status === "Fully Received").length;
  const totalPO = po.reduce((s, p) => s + (p.total_amount || 0), 0);
  return (
    <Document>
      <Page size="A4" style={S.page}>
        <PDFHeader title="Purchases Report" subtitle="GRN history, purchase orders & supplier spend" badge="PURCHASES" />
        <KpiRow items={[
          { label: "Total Purchases", value: fmt(totalGrn), color: "sky" },
          { label: "Total GRNs", value: String(grn.length) },
          { label: "Fully Received", value: String(fullyReceived), color: "green" },
          { label: "Total POs", value: fmt(totalPO), sub: `${po.length} orders` },
        ]} />
        <PDFTable
          title="GRN History"
          sub="Recent goods received notes"
          headers={["Supplier", "Amount", "Status", "Date"]}
          rows={grn.slice(0, 15).map(g => [g.supplier, fmt(g.total_amount), g.status, fmtDate(g.grn_date)])}
        />
        <PDFTable
          title="Supplier Performance"
          sub="GRN breakdown by supplier"
          headers={["Supplier", "Orders", "Total Amount"]}
          rows={grnSupplier.slice(0, 10).map(s => [s.supplier, String(s.grn_count), fmt(s.total_amount)])}
        />
        <PDFTable
          title="Purchase Orders"
          sub="All purchase orders"
          headers={["PO ID", "Supplier", "Amount", "Status"]}
          rows={po.slice(0, 10).map(p => [String(p.po_id), p.supplier, fmt(p.total_amount), p.status])}
        />
        <PDFTable
          title="Pending Orders"
          sub="Awaiting fulfilment"
          headers={["PO ID", "Supplier", "Amount", "Status"]}
          rows={poPending.slice(0, 10).map(p => [String(p.po_id), p.supplier, fmt(p.total_amount), p.status])}
        />
        <PDFFooter title="Purchases Report" />
      </Page>
    </Document>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. STOCK MOVEMENT PDF
// ══════════════════════════════════════════════════════════════════════════════
export function StockMovementPDF({ data }) {
  const { history = [], byItem = [], byType = [], summary = {} } = data || {};
  const grnTotal = byType.find(t => t.type === "GRN")?.quantity || 0;
  const saleTotal = byType.find(t => t.type === "SALE")?.quantity || 0;
  return (
    <Document>
      <Page size="A4" style={S.page}>
        <PDFHeader title="Stock Movement Report" subtitle="All inventory movement events — in, out, adjustments" badge="STOCK MOV." />
        <KpiRow items={[
          { label: "Total Movements", value: fmtNum(summary.totalMovements), color: "sky" },
          { label: "Total Quantity", value: fmtNum(summary.totalQuantity) },
          { label: "GRN Quantity In", value: fmtNum(grnTotal), color: "green" },
          { label: "Sales Quantity Out", value: fmtNum(saleTotal), color: "red" },
        ]} />
        <PDFTable
          title="Movement by Type"
          sub="Summary of each movement type"
          headers={["Type", "Movements", "Total Quantity"]}
          rows={byType.map(t => [t.type, String(t.movements), fmtNum(t.quantity)])}
        />
        <PDFTable
          title="By Item Volume"
          sub="Top items by movement volume"
          headers={["#", "Item", "Movements", "Total Quantity"]}
          rows={byItem.slice(0, 15).map((item, i) => [String(i + 1), item.item, String(item.movements), fmtNum(item.quantity)])}
        />
        <PDFTable
          title="Movement History"
          sub="Recent stock movements"
          headers={["Item", "Qty", "Type", "User", "Date"]}
          rows={history.slice(0, 20).map(m => [m.item, (m.quantity > 0 ? "+" : "") + m.quantity, m.type, m.user, fmtDate(m.createdAt)])}
        />
        <PDFFooter title="Stock Movement Report" />
      </Page>
    </Document>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 6. ADJUSTMENTS PDF
// ══════════════════════════════════════════════════════════════════════════════
export function AdjustmentsPDF({ data }) {
  const { adjustments = [], byItem = [], byReason = [] } = data || {};
  const totalAdj = adjustments.length;
  const positiveAdj = adjustments.filter(a => a.quantity > 0).length;
  const negativeAdj = adjustments.filter(a => a.quantity < 0).length;
  const totalQuantity = adjustments.reduce((s, a) => s + a.quantity, 0);
  return (
    <Document>
      <Page size="A4" style={S.page}>
        <PDFHeader title="Stock Adjustments Report" subtitle="Manual inventory corrections — increases & decreases" badge="ADJUSTMENTS" />
        <KpiRow items={[
          { label: "Total Adjustments", value: String(totalAdj), color: "sky" },
          { label: "Net Quantity", value: (totalQuantity >= 0 ? "+" : "") + fmtNum(totalQuantity), color: totalQuantity >= 0 ? "green" : "red" },
          { label: "Increases", value: String(positiveAdj), color: "green" },
          { label: "Decreases", value: String(negativeAdj), color: "red" },
        ]} />
        <PDFTable
          title="Adjustment by Item"
          sub="Net adjustment impact per item"
          headers={["Item", "Net Qty", "Adjustments"]}
          rows={byItem.slice(0, 15).map(i => [i.item, (i.quantity > 0 ? "+" : "") + String(i.quantity), String(i.adjustments)])}
        />
        <PDFTable
          title="Adjustment by Reason"
          sub="Top adjustment reasons"
          headers={["Reason", "Item", "Qty"]}
          rows={byReason.slice(0, 12).map(r => [r.reason, r.item_name, (r.quantity > 0 ? "+" : "") + String(r.quantity)])}
        />
        <PDFTable
          title="Full Adjustment History"
          sub="All recorded stock adjustments"
          headers={["Item", "Qty", "Reason", "User"]}
          rows={adjustments.slice(0, 25).map(a => [a.item, (a.quantity > 0 ? "+" : "") + String(a.quantity), a.reason ?? "—", a.user ?? "—"])}
        />
        <PDFFooter title="Stock Adjustments Report" />
      </Page>
    </Document>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 7. SUPPLIERS PDF
// ══════════════════════════════════════════════════════════════════════════════
export function SuppliersPDF({ data }) {
  const { summary = {}, topSuppliers = [] } = data || {};
  const supplierList = Array.isArray(topSuppliers) ? topSuppliers : [];
  const totalSpend = supplierList.reduce((s, sup) => s + (sup.total_amount ?? sup.totalAmount ?? 0), 0);
  return (
    <Document>
      <Page size="A4" style={S.page}>
        <PDFHeader title="Suppliers Report" subtitle="Supplier spend, activity & performance overview" badge="SUPPLIERS" />
        <KpiRow items={[
          { label: "Total Suppliers", value: String(summary.totalSuppliers ?? supplierList.length), color: "amber" },
          { label: "Active Suppliers", value: String(summary.byStatus?.Active ?? supplierList.length), color: "green" },
          { label: "Total Spend", value: fmt(totalSpend), color: "sky" },
        ]} />
        <PDFTable
          title="Supplier Overview"
          sub="All suppliers with purchase activity"
          headers={["Supplier", "Orders", "Total Spend"]}
          rows={supplierList.slice(0, 20).map(s => [
            s.supplier ?? s.supplier_name ?? s.name ?? "—",
            String(s.grn_count ?? s.order_count ?? "—"),
            fmt(s.total_amount ?? s.totalAmount ?? 0),
          ])}
        />
        <PDFFooter title="Suppliers Report" />
      </Page>
    </Document>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 8. PROFIT PDF
// ══════════════════════════════════════════════════════════════════════════════
export function ProfitPDF({ data }) {
  const { total = 0, byItem = [], byDate = [] } = data || {};
  const sortedByProfit = [...byItem].sort((a, b) => b.profit - a.profit);
  const bestItem = sortedByProfit[0];
  const positiveCount = byItem.filter(i => i.profit > 0).length;
  const avgProfit = byItem.reduce((s, i) => s + i.profit, 0) / (byItem.length || 1);
  return (
    <Document>
      <Page size="A4" style={S.page}>
        <PDFHeader title="Profit & Loss Report" subtitle="Net profit, margin analysis & item-level breakdown" badge="PROFIT" />
        <KpiRow items={[
          { label: "Total Profit / Loss", value: fmt(total), color: total >= 0 ? "green" : "red", sub: total < 0 ? "Net deficit" : "Net positive" },
          { label: "Best Item", value: bestItem?.item_name?.split(" ")[0] ?? "—", color: "green", sub: fmt(bestItem?.profit) },
          { label: "Profitable Items", value: String(positiveCount), sub: `of ${byItem.length} SKUs` },
          { label: "Avg Item Profit", value: fmt(avgProfit) },
        ]} />
        <PDFTable
          title="Profit Trend"
          sub="Daily sales vs purchases vs net profit"
          headers={["Date", "Sales", "Purchases", "Net Profit"]}
          rows={[...byDate].sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 15).map(d => [
            fmtDate(d.date), fmt(d.total_sales), fmt(d.total_purchases), fmt(d.profit),
          ])}
        />
        <PDFTable
          title="Profit by Item"
          sub="Revenue vs cost vs margin per product"
          headers={["Item Name", "Revenue", "Est. Cost", "Profit"]}
          rows={sortedByProfit.slice(0, 20).map(i => [i.item_name, fmt(i.revenue), fmt(i.estimated_cost), fmt(i.profit)])}
        />
        <PDFFooter title="Profit & Loss Report" />
      </Page>
    </Document>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Export trigger helper
// ══════════════════════════════════════════════════════════════════════════════
export async function downloadPDF(DocComponent, props, filename) {
  const blob = await pdf(<DocComponent {...props} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
