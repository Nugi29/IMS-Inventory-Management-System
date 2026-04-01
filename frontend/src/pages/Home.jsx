import React from 'react'
import SideNavbar from '../components/SideNavbar'
import Header from '../components/Header'
import HomeContent from '../components/HomeContent'

const Home = () => {
  return (
    <div>
      <SideNavbar />
      <Header />
      <main className="pt-16 ml-64">
        <HomeContent />
      </main>
    </div>
  )
}

export default Home