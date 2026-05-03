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
  else if (location.pathname.includes('/suppliers')) currentModule = "Suppliers"
  else if (location.pathname.includes('/po')) currentModule = "Purchase Orders Management"
  else if (location.pathname.includes('/poform')) currentModule = "Purchase Order Profile Management"
  else if (location.pathname.includes('/supplierform')) currentModule = "Supplier Profile Management"
  else if (location.pathname.includes('/grn')) currentModule = "GRN"
  else if (location.pathname.includes('/sales')) currentModule = "Sales Management" 
  else if (location.pathname.includes('/grns')) currentModule = "GRN Management"
  else if (location.pathname.includes('/stock-adjustment-form')) currentModule = "Stock Adjustment"
  else if (location.pathname.includes('/stock-adjustments')) currentModule = "Stock Management"
  else if (location.pathname.includes('/stock-movement')) currentModule = "Stock Management"
  else if (location.pathname.includes('/reports')) currentModule = "Reports"
  else if (location.pathname.includes('/settings')) currentModule = "Settings"
  else if (location.pathname.includes('/profile')) currentModule = "User Profile"

  return (
    <div>
      <SideNavbar />
      <Header loadedModule={currentModule} />
      <main className="pt-16 ml-64">
        <Outlet />
      </main>
    </div>
  )
}

export default Home