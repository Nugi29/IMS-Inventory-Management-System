import { useContext } from "react"
import { Navigate, Outlet, Route, Routes } from "react-router-dom"
import Login from "./pages/Login"
import Home from "./pages/Home"
import { ToastContainer } from "react-toastify"
import "react-toastify/dist/ReactToastify.css"
import { AppContext } from "./context/AppContext"

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
          <Route path="/" element={<Home />} />
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
