import React, { useContext, useState } from 'react'
import { AppContext } from '../context/AppContext';

const Header = ({ loadedModule }) => {
    const user = useContext(AppContext).userData;

    return (
        <header className="fixed top-0 right-0 left-64 h-16 z-40 bg-white border-b border-slate-200 flex justify-between items-center px-8">
            <div className="flex items-center flex-1 max-w-xl">
                <p className="label-sm uppercase tracking-[0.1em] text-primary font-bold mb-2">{loadedModule}</p>

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