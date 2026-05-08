import React from 'react';

const LoadingScreen = ({ error, onRetry, onLogout }) => {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#f8f9fa] px-4">
      <div className="relative flex flex-col items-center w-full max-w-md">
        <>
          {/* Modern, premium spinner matching app primary color */}
          <div className="relative w-20 h-20">
            {/* Background circle */}
            <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
            
            {/* Animated ring using primary color */}
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-400 border-r-blue-400/40 animate-spin shadow-[0_0_15px_rgba(0,74,198,0.15)]"></div>
            
            {/* Inner pulse */}
            <div className="absolute inset-4 rounded-full bg-blue-400 animate-pulse"></div>
          </div>

          {/* Brand Text */}
          <div className="mt-8 text-center">
            <h1 className="text-3xl font-bold tracking-tight text-gray-800 mb-2">
              IMS <span className="text-primary">Inventory</span>
            </h1>
            <div className="flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]"></span>
              <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]"></span>
              <span className="w-2 h-2 rounded-full bg-primary animate-bounce"></span>
            </div>
            <p className="mt-6 text-xs font-bold text-slate-400 tracking-[0.2em] uppercase">
              Loading System
            </p>
          </div>
        </>
      </div>

      {/* Decorative progress bar at the top */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-slate-100">
          <div className="h-full bg-primary animate-[loading_2s_ease-in-out_infinite]" style={{ width: '30%' }}></div>
        </div>

      
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes loading {
          0% { transform: translateX(-100%); width: 10%; }
          50% { width: 40%; }
          100% { transform: translateX(400%); width: 10%; }
        }
      `}} />
    </div>
  );
};

export default LoadingScreen;
