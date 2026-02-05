import React from 'react';

interface BarTooltipProps {
  text: string;
  children?: React.ReactNode;
  widthPct: number;
  colorClass: string;
}

export const BarTooltip: React.FC<BarTooltipProps> = ({ text, children, widthPct, colorClass }) => {
  if (widthPct <= 0) return null;
  return (
    <div className="group relative h-full flex flex-col justify-center" style={{ width: `${widthPct}%` }}>
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 pointer-events-none animate-in fade-in duration-75">
        <div className={`${colorClass} text-white text-[10px] font-black py-1.5 px-3 rounded-lg shadow-2xl whitespace-nowrap border border-white/10 flex items-center gap-2`}>
          <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          {text}
        </div>
        <div className={`${colorClass} w-2 h-2 rotate-45 mx-auto -mt-1 border-r border-b border-white/10`} />
      </div>
    </div>
  );
};