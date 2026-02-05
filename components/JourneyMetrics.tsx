
import React, { useState, useEffect } from 'react';
import { UserAnswer } from '../types';
import { X, PieChart, ChevronLeft, ChevronRight } from 'lucide-react';
import { BarTooltip } from './ui/BarTooltip';

interface JourneyMetricsProps {
  answers: UserAnswer[];
}

interface DomainMetric {
  name: string;
  total: number;
  correct: number;
  incorrect: number;
  mastery: number;
  luckyGuess: number;
  dangerZone: number;
  knownGap: number;
}

export const JourneyMetrics: React.FC<JourneyMetricsProps> = ({ answers }) => {
  const [isOpen, setIsOpen] = useState(false);

  // Auto-calculate metrics only when answers change
  const metrics = React.useMemo(() => {
    const domainMap = new Map<string, DomainMetric>();
    const split = (s: string | undefined) => s ? s.split('|').map(x => x.trim()).filter(Boolean) : ["Uncategorized"];

    answers.forEach(ans => {
        let domains = split(ans.question.domain);
        if (domains.length === 0) domains = ["Uncategorized"];

        domains.forEach(dName => {
            if (!domainMap.has(dName)) {
                domainMap.set(dName, {
                    name: dName,
                    total: 0,
                    correct: 0,
                    incorrect: 0,
                    mastery: 0,
                    luckyGuess: 0,
                    dangerZone: 0,
                    knownGap: 0
                });
            }
            
            const node = domainMap.get(dName)!;
            node.total += 1;
            const isConf = ans.confidence === 'high';
            
            if (ans.isCorrect) {
                node.correct += 1;
                if (isConf) node.mastery += 1;
                else node.luckyGuess += 1;
            } else {
                node.incorrect += 1;
                if (isConf) node.dangerZone += 1;
                else node.knownGap += 1;
            }
        });
    });

    return Array.from(domainMap.values()).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }, [answers]);

  const confidenceEnabled = React.useMemo(() => answers.some(a => a.confidence !== null), [answers]);

  return (
    <>
      {/* Backdrop for closing when open */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[90] transition-opacity duration-300"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Drawer Container */}
      <div 
        className={`fixed top-0 right-0 h-full w-full max-w-3xl bg-white dark:bg-slate-950 shadow-2xl z-[100] transform transition-transform duration-500 ease-in-out border-l border-slate-200 dark:border-slate-800 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        
        {/* The Toggle Tab (Attached to the left edge of the drawer) */}
        <button
            onClick={() => setIsOpen(!isOpen)}
            aria-label={isOpen ? "Close Metrics Panel" : "Open Metrics Panel"}
            className="absolute top-1/2 -left-12 mt-[-80px] w-12 h-40 bg-brand-600 hover:bg-brand-700 text-white rounded-l-2xl shadow-[-4px_0_15px_rgba(0,0,0,0.1)] flex flex-col items-center justify-center gap-6 transition-all active:scale-95 border-y border-l border-brand-500/50"
            title="Toggle Journey Metrics"
        >
            {isOpen ? <ChevronRight size={24} /> : <PieChart size={24} />}
            <span className="text-xs font-black uppercase tracking-widest -rotate-90 whitespace-nowrap">
                Metrics
            </span>
        </button>

        {/* Drawer Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500 rounded-xl text-white shadow-lg shadow-indigo-500/20">
              <PieChart size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Journey Metrics</h2>
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Real-time Domain Analysis</p>
            </div>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            aria-label="Close Metrics Panel"
            className="p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-grow overflow-y-auto p-0 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700 bg-white dark:bg-slate-950">
            {metrics.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-10 text-center opacity-50">
                    <PieChart size={48} className="text-slate-300 mb-4" />
                    <p className="text-slate-400 font-bold">No data available yet.</p>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">Start answering to see stats</p>
                </div>
            ) : (
                <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-900 border-b dark:border-slate-800 text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest shadow-sm">
                        <tr>
                            <th className="px-6 py-4">Domain</th>
                            <th className="px-4 py-4 text-center">Total</th>
                            <th className="px-4 py-4 text-center">Score</th>
                            <th className="px-6 py-4 w-5/12">Distribution</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {metrics.map((m) => {
                            const masteryPct = m.total > 0 ? (m.mastery / m.total) * 100 : 0;
                            const luckyPct = m.total > 0 ? (m.luckyGuess / m.total) * 100 : 0;
                            const dangerPct = m.total > 0 ? (m.dangerZone / m.total) * 100 : 0;
                            const gapPct = m.total > 0 ? (m.knownGap / m.total) * 100 : 0;
                            const accuracy = m.total > 0 ? Math.round((m.correct / m.total) * 100) : 0;
                            const correctPct = m.total > 0 ? (m.correct / m.total) * 100 : 0;
                            const incorrectPct = m.total > 0 ? (m.incorrect / m.total) * 100 : 0;

                            return (
                                <tr key={m.name} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                                    <td className="px-6 py-4 text-xs font-bold text-slate-700 dark:text-slate-200 break-words max-w-[200px]">{m.name}</td>
                                    <td className="px-4 py-4 text-center text-xs font-mono text-slate-500">{m.total}</td>
                                    <td className="px-4 py-4 text-center">
                                        <span className={`text-xs font-black ${accuracy >= 70 ? 'text-green-600' : accuracy >= 50 ? 'text-amber-500' : 'text-red-500'}`}>{accuracy}%</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex border border-slate-200 dark:border-slate-700 w-full min-w-[100px]">
                                            {confidenceEnabled ? (
                                                <>
                                                    <BarTooltip text={`Danger Zone: ${Math.round(dangerPct)}%`} widthPct={dangerPct} colorClass="bg-red-600"><div className="bg-red-600 h-full w-full" /></BarTooltip>
                                                    <BarTooltip text={`Known Gap: ${Math.round(gapPct)}%`} widthPct={gapPct} colorClass="bg-red-400"><div className="bg-red-300 h-full w-full" /></BarTooltip>
                                                    <BarTooltip text={`Lucky Guess: ${Math.round(luckyPct)}%`} widthPct={luckyPct} colorClass="bg-amber-500"><div className="bg-amber-300 h-full w-full" /></BarTooltip>
                                                    <BarTooltip text={`True Mastery: ${Math.round(masteryPct)}%`} widthPct={masteryPct} colorClass="bg-green-600"><div className="bg-green-600 h-full w-full" /></BarTooltip>
                                                </>
                                            ) : (
                                                <>
                                                    <BarTooltip text={`Correct: ${Math.round(correctPct)}%`} widthPct={correctPct} colorClass="bg-green-600"><div className="bg-green-600 h-full w-full" /></BarTooltip>
                                                    <BarTooltip text={`Incorrect: ${Math.round(incorrectPct)}%`} widthPct={incorrectPct} colorClass="bg-red-500"><div className="bg-red-500 h-full w-full" /></BarTooltip>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}
        </div>
        
        {/* Legend Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex justify-center gap-4 flex-wrap">
             {confidenceEnabled ? (
                 <>
                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-600" /> <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase">Mastery</span></div>
                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-amber-300" /> <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase">Lucky</span></div>
                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-400" /> <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase">Known Gap</span></div>
                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-600" /> <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase">Danger Zone</span></div>
                 </>
             ) : (
                 <>
                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-600" /> <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase">Correct</span></div>
                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500" /> <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase">Incorrect</span></div>
                 </>
             )}
        </div>
      </div>
    </>
  );
};
