import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSale } from '../services/useSale'
import { toast } from 'react-toastify'
import { InvoicePDF, downloadPDF } from './ReportPDFs'

const fmtMoney = (value) =>
  `Rs ${Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

const InvoiceDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { getSale } = useSale()
  const [sale, setSale] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchSaleDetails = async () => {
      setIsLoading(true)
      const response = await getSale(id)
      if (response.success) {
        setSale(response.sale)
      } else {
        toast.error(response.message || 'Failed to load invoice details')
        navigate('/')
      }
      setIsLoading(false)
    }

    if (id) {
      fetchSaleDetails()
    }
  }, [id, getSale, navigate])

  const subtotal = useMemo(() => {
    if (!sale?.sale_items) return 0
    return sale.sale_items.reduce((sum, item) => sum + Number(item.selling_price) * Number(item.quantity), 0)
  }, [sale])

  const handlePrint = async () => {
    if (!sale) return

    const invoiceNumber = sale.invoice_no || `INV-${sale.id}`
    const receiptData = {
      invoiceNumber,
      cashierName: sale.user?.name || ' ',
      paymentMethod: sale.payment_method || 'Cash',
      items: sale.sale_items.map(si => ({
        name: si.item?.name || 'Unknown Item',
        price: Number(si.selling_price),
        quantity: Number(si.quantity)
      })),
      subtotal: subtotal,
      tax: 0,
      discount: 0,
      grandTotal: sale.total_amount,
      paid: sale.total_amount, 
      changeDue: 0,
      customer: sale.customer || { name: 'Walk-in Customer' },
      date: new Date(sale.sale_date).toLocaleString()
    }

    await downloadPDF(InvoicePDF, receiptData, `Invoice-${invoiceNumber}.pdf`)
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <span className="material-symbols-outlined animate-spin text-blue-600 text-3xl">sync</span>
          <p className="text-sm font-semibold text-slate-600">Loading invoice details...</p>
        </div>
      </div>
    )
  }

  if (!sale) return null

  return (
    <main className="p-4 sm:p-6 lg:p-8 bg-slate-50 min-h-screen">
      <div className="mx-auto max-w-5xl">
        {/* Top Navigation & Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <button
              onClick={() => navigate(-1)}
              className="group flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-blue-600 transition-colors mb-2"
            >
              <span className="material-symbols-outlined text-[20px] transition-transform group-hover:-translate-x-1">arrow_back</span>
              Back to Dashboard
            </button>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Invoice Details</h1>
          </div>
          <div className="flex items-center gap-3">
             <button
              onClick={handlePrint}
              className="bg-blue-600 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 shadow-sm hover:bg-blue-700 transition-all active:scale-95 duration-150"
            >
              <span className="material-symbols-outlined">download</span>
              Download PDF
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between px-8 py-6 border-b border-slate-100 bg-slate-50/60 gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-[10px] font-bold uppercase tracking-wider mb-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Completed
              </div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">
                {sale.invoice_no || `INV-${String(sale.id).padStart(4, '0')}`}
              </h2>
            </div>
            <div className="text-center sm:text-right">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Invoice Date</p>
              <p className="text-sm font-bold text-slate-700">
                {new Date(sale.sale_date).toLocaleDateString(undefined, { dateStyle: 'long' })}
              </p>
            </div>
          </div>

          <div className="p-8 lg:p-10">
            {/* Info Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
              <div className="p-5 rounded-2xl bg-slate-50/50 border border-slate-100">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">Customer Details</h3>
                <p className="text-base font-bold text-slate-900 leading-tight">{sale.customer?.name || 'Walk-in Customer'}</p>
                {sale.customer?.phone ? (
                  <p className="mt-2 flex items-center gap-2 text-sm text-slate-500 font-medium">
                    <span className="material-symbols-outlined text-[16px]">call</span>
                    {sale.customer.phone}
                  </p>
                ) : (
                  <p className="mt-2 text-sm italic text-slate-300">No contact info</p>
                )}
              </div>

              <div className="p-5 rounded-2xl bg-slate-50/50 border border-slate-100">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">Transaction Info</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">Processed By</span>
                    <span className="text-xs font-bold text-slate-800">{sale.user?.name || 'System'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">Payment</span>
                    <span className="inline-flex px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded uppercase">
                      {sale.payment_method || 'Cash'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-blue-50/30 border border-blue-100/50">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-blue-600/60 mb-4">Financial Summary</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Total Items</span>
                    <span className="text-slate-900 font-bold">{sale.sale_items?.length || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Grand Total</span>
                    <span className="text-blue-700 font-black text-lg">{fmtMoney(sale.total_amount)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="mb-10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Order Items</h3>
                <span className="text-[10px] font-bold text-slate-400 uppercase">
                  {sale.sale_items?.length || 0} Entries
                </span>
              </div>
              <div className="overflow-hidden rounded-xl border border-slate-100">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-100">
                      <th className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Description</th>
                      <th className="px-6 py-3.5 text-center text-[10px] font-bold uppercase tracking-widest text-slate-400">Unit Price</th>
                      <th className="px-6 py-3.5 text-center text-[10px] font-bold uppercase tracking-widest text-slate-400">Qty</th>
                      <th className="px-6 py-3.5 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {sale.sale_items?.map((item, index) => (
                      <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-800 text-sm">{item.item?.name || 'Unnamed Item'}</p>
                          <p className="text-[10px] font-mono text-slate-400 uppercase mt-0.5 tracking-tighter">SKU: {item.item?.sku || item.item?.code || 'N/A'}</p>
                        </td>
                        <td className="px-6 py-4 text-center text-sm font-medium text-slate-600">{fmtMoney(item.selling_price)}</td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex h-7 min-w-[28px] items-center justify-center rounded-lg bg-slate-100 text-[11px] font-bold text-slate-700">
                            {item.quantity}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-sm font-bold text-slate-900">{fmtMoney(Number(item.selling_price) * Number(item.quantity))}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Total Calculation */}
            <div className="flex justify-end pt-6 border-t border-slate-100">
              <div className="w-full max-w-[280px] space-y-3">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="text-slate-800 font-bold">{fmtMoney(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                  <span className="text-sm font-black text-slate-900 uppercase">Total Amount</span>
                  <span className="text-2xl font-black text-blue-600 tracking-tighter">{fmtMoney(sale.total_amount)}</span>
                </div>
              </div>
            </div>

            {/* Computer Generated Disclaimer */}
            <div className="mt-20 py-6 border-t border-dashed border-slate-200 text-center">
              <p className="text-[11px] font-medium text-slate-400 italic">
                This is a computer-generated document and does not require a signature.
                <br />
                Thank you for your purchase from IMS.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

export { InvoiceDetail }
export default InvoiceDetail
