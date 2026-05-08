import React from 'react'
import SideNavbar from '../components/SideNavbar'
import Header from '../components/Header'
import { Outlet, useLocation } from 'react-router-dom'

const Home = () => {
  const location = useLocation()
  // Determine the header title based on current string route path
  let currentModule = "Dashboard"
  if (location.pathname.includes('/users')) currentModule = "User Management"
  if (location.pathname.includes('/userform')) currentModule = "User Profile Management"
  else if (location.pathname.includes('/itemform')) currentModule = "Item Profile Management"
  else if (location.pathname.includes('/items')) currentModule = "Item Management"
  else if (location.pathname.includes('/suppliers')) currentModule = "Supplier Management"
  else if (location.pathname.includes('/po')) currentModule = "Purchase Orders Management"
  else if (location.pathname.includes('/poform')) currentModule = "Purchase Order Profile Management"
  else if (location.pathname.includes('/supplierform')) currentModule = "Supplier Profile Management"
  else if (location.pathname.includes('/sales')) currentModule = "Sales Management"
  else if (location.pathname.includes('/grns')) currentModule = "Good Recieved Note Management"
  else if (location.pathname.includes('/stock-adjustment-form')) currentModule = "Stock Adjustment"
  else if (location.pathname.includes('/stock-adjustments')) currentModule = "Stock Management"
  else if (location.pathname.includes('/stock-movement')) currentModule = "Stock Management"
  else if (location.pathname.includes('/reports')) currentModule = "Reports"
  else if (location.pathname.includes('/settings')) currentModule = "Settings"
  else if (location.pathname.includes('/profile')) currentModule = "User Profile"

  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false)

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <SideNavbar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />
      <Header loadedModule={currentModule} toggleSidebar={toggleSidebar} />
      <main className="transition-all duration-300 pt-16 md:ml-64">
        <div className="p-4 md:p-8">
          <Outlet />
        </div>
      </main>
      
      {/* Overlay for mobile when sidebar is open */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
          onClick={toggleSidebar}
        />
      )}
    </div>
  )
}

export default Home