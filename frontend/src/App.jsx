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
import HomeContent from "./components/HomeContent"
import { Userform } from "./components/Userform"
import { ItemForm } from "./components/ItemForm"
import { PoPage } from "./pages/PoPage"
import { PoForm } from "./components/PoForm"
import { GrnPage } from "./pages/GrnPage"
import { SupplierForm } from "./components/SupplierForm"

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
            <Route path="/" element={<HomeContent />} />
            <Route path="/profile" element={<HomeContent />} />
            <Route path="/userform" element={<Userform />} />
            <Route path="/items" element={<ItemPage />} />
            <Route path="/itemform" element={<ItemForm />} />
            <Route path="/categories" element={<HomeContent />} />
            <Route path="/po" element={<PoPage />} />
            <Route path="/poform" element={<PoForm />} />
            <Route path="/sales" element={<SalesPage />} />
            <Route path="/grns" element={<GrnPage />} />
            <Route path="/grn" element={<HomeContent />} />
            <Route path="/sales" element={<HomeContent />} />
            <Route path="/stock-movement" element={<HomeContent />} />
            <Route path="/users" element={<UserPage />} />
            <Route path="/reports" element={<HomeContent />} />
            <Route path="/settings" element={<HomeContent />} />
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
