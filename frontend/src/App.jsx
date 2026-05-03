import { useContext } from "react"
import { Navigate, Outlet, Route, Routes } from "react-router-dom"
import Login from "./pages/Login"
import Home from "./pages/Home"
import SupplierPage from "./pages/SupplierPage"
import { ToastContainer } from "react-toastify"
import "react-toastify/dist/ReactToastify.css"
import { AppContext } from "./context/AppContext"
import { UserPage } from "./pages/UserPage"
import { ItemPage } from "./pages/ItemPage"
import { SalesPage } from "./pages/SalesPage"
import { Userform } from "./components/Userform"
import { ItemForm } from "./components/ItemForm"
import { PoPage } from "./pages/PoPage"
import { PoForm } from "./components/PoForm"
import { GrnPage } from "./pages/GrnPage"
import { SupplierForm } from "./components/SupplierForm"
import { Dashboard } from "./pages/dashboard"
import { UserProfile } from "./pages/UserProfile"
import { Reports } from "./pages/Reports"
import { StockMovementPage } from "./pages/StockMovementPage"
import { StockAdjustmentForm } from "./components/StockAdjustmentForm"
import { InvoiceDetail } from "./components/InvoiceDetail"

const ProtectedRoute = () => {
  const { token } = useContext(AppContext)

  return token ? <Outlet /> : <Navigate to="/login" replace />
}

const AuthRoute = () => {
  const { token } = useContext(AppContext)

  return token ? <Navigate to="/" replace /> : <Outlet />
}

function App() {
  return (
    <>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route element={<Home />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/profile" element={<UserProfile />} />
            <Route path="/userform" element={<Userform />} />
            <Route path="/items" element={<ItemPage />} />
            <Route path="/itemform" element={<ItemForm />} />
            <Route path="/po" element={<PoPage />} />
            <Route path="/poform" element={<PoForm />} />
            <Route path="/sales" element={<SalesPage />} />
            <Route path="/invoice/:id" element={<InvoiceDetail />} />
            <Route path="/grns" element={<GrnPage />} />
            <Route path="/stock-movement" element={<StockMovementPage />} />
            <Route path="/stock-adjustments" element={<StockMovementPage />} />
            <Route path="/stock-adjustment-form" element={<StockAdjustmentForm />} />
            <Route path="/users" element={<UserPage />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/suppliers" element={<SupplierPage />} />
            <Route path="/supplierform" element={<SupplierForm />} />
          </Route>
        </Route>
        <Route element={<AuthRoute />}>
          <Route path="/login" element={<Login />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      <ToastContainer />
    </>
  )
}
export default App
