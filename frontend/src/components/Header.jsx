import React, { useContext } from 'react'
import { AppContext } from '../context/AppContext';

const Header = () => {
    const user = useContext(AppContext).userData;
    return (
        <header className="fixed top-0 right-0 left-64 h-16 z-40 bg-white border-b border-slate-200 flex justify-between items-center px-8">
            <div className="flex items-center flex-1 max-w-xl">
                <div className="relative w-full">
                    <span className="material-symbols-outlined absolute left-3 top-7 -translate-y-1/2 text-slate-400 text-sm" data-icon="search">search</span>
                    <input className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all" placeholder="Quick search..." type="text" />
                </div>
            </div>
            <div className="flex items-center gap-6">
                <button className="relative text-slate-500 hover:text-blue-500 transition-colors active:opacity-80">
                    <span className="material-symbols-outlined" data-icon="notifications">notifications</span>
                    <span className="absolute top-0 right-0 w-2 h-2 bg-red-600 rounded-full border-2 border-white"></span>
                </button>
                <button className="text-slate-500 hover:text-blue-500 transition-colors active:opacity-80">
                    <span className="material-symbols-outlined" data-icon="help_outline">help_outline</span>
                </button>
                <div className="h-6 w-px bg-slate-200"></div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-sans">{user?.role?.name || ""}</span>
            </div>
        </header>
    )
}

export default Header