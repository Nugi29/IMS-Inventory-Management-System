import { useContext } from "react"
import { Navigate, Outlet, Route, Routes } from "react-router-dom"
import Login from "./pages/Login"
import Home from "./pages/Home"
import { ToastContainer } from "react-toastify"
import "react-toastify/dist/ReactToastify.css"
import { AppContext } from "./context/AppContext"
import { UserPage } from "./pages/UserPage"
import { ItemPage } from "./pages/ItemPage"
import HomeContent from "./components/HomeContent"
import { Userform } from "./components/Userform"
import { ItemForm } from "./components/ItemForm"

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
            <Route path="/suppliers" element={<HomeContent />} />
            <Route path="/grn" element={<HomeContent />} />
            <Route path="/sales" element={<HomeContent />} />
            <Route path="/stock-movement" element={<HomeContent />} />
            <Route path="/users" element={<UserPage />} />
            <Route path="/reports" element={<HomeContent />} />
            <Route path="/settings" element={<HomeContent />} />
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
