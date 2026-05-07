import React, { useContext, useState, useEffect } from 'react'
import { AppContext } from '../context/AppContext';

const Header = ({ loadedModule }) => {
    const user = useContext(AppContext).userData;
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const formatDate = (date) => {
        return date.toLocaleDateString('en-GB', { 
            weekday: 'long', 
            day: '2-digit', 
            month: 'long', 
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
        <header className="fixed top-0 right-0 left-64 h-16 z-40 bg-white border-b border-slate-200 flex justify-between items-center px-8">
            <div className="flex items-center flex-1 max-w-xl">
                <p className="label-sm uppercase tracking-widest text-primary font-bold">{loadedModule}</p>
            </div>
            
            <div className="flex items-center gap-6">
                <div className="flex flex-col items-end text-right">
                    <span className="text-xs font-bold text-slate-600 leading-tight">{formatDate(time)}</span>
                    <span className="text-base font-bold text-primary font-mono tracking-wider leading-none">{formatTime(time)}</span>
                </div>
            </div>
        </header>
    )
}

export default Header


