import React, {useState, useEffect } from 'react'

const Header = ({ loadedModule, toggleSidebar }) => {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const formatDate = (date) => {
        return date.toLocaleDateString('en-GB', { 
            weekday: 'short', 
            day: '2-digit', 
            month: 'short', 
            year: 'numeric' 
        });
    };

    const formatTime = (date) => {
        return date.toLocaleTimeString('en-GB', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit', 
            hour12: false 
        });
    };

    return (
        <header className="fixed top-0 right-0 left-0 md:left-64 h-16 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200 flex justify-between items-center px-4 md:px-8">
            <div className="flex items-center gap-4 flex-1">
                <button 
                    onClick={toggleSidebar}
                    className="md:hidden w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
                >
                    <span className="material-symbols-outlined">menu</span>
                </button>
                
                <div className="flex flex-col">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-bold leading-none mb-1 md:hidden">IMS Premium</p>
                    <p className="text-sm md:text-base uppercase tracking-widest text-blue-600 font-bold truncate max-w-[150px] md:max-w-none">
                        {loadedModule}
                    </p>
                </div>
            </div>
            
            <div className="flex items-center gap-4 md:gap-6">
                <div className="flex flex-col items-end text-right">
                    <span className="text-[10px] md:text-xs font-bold text-slate-500 leading-tight hidden sm:block">{formatDate(time)}</span>
                    <span className="text-sm md:text-base font-bold text-blue-600 font-mono tracking-wider leading-none">{formatTime(time)}</span>
                </div>
            </div>
        </header>
    )
}

export default Header


