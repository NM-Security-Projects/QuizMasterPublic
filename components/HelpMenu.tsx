
import React from 'react';
import { X, Info, ShieldCheck, Database, BrainCircuit, Zap, BarChart3, Settings2, HelpCircle, Lock } from 'lucide-react';

interface HelpMenuProps {
  onClose: () => void;
}

export const HelpMenu: React.FC<HelpMenuProps> = ({ onClose }) => {
  const features = [
    {
      icon: Database,
      title: "Secure Local Processing",
      desc: "Process large question banks locally via SQL.js. Your custom database never leaves this device."
    },
    {
      icon: Lock,
      title: "Zero Data Egress",
      desc: "With the exception of optional AI features and reports you download, no data is transmitted to the cloud."
    },
    {
      icon: Zap,
      title: "Interactive Quiz Engine",
      desc: "Right-click to eliminate options, utilize a 3-tier hint system, and manage multi-select questions."
    },
    {
      icon: BarChart3,
      title: "Hierarchy Analytics",
      desc: "Deep-dive performance tracking across Domains, Sub-domains, and specific Topics."
    },
    {
      icon: ShieldCheck,
      title: "Mastery Metrics",
      desc: "Go beyond accuracy with 'True Mastery'—identifying where you are both correct and confident."
    },
    {
      icon: BrainCircuit,
      title: "AI Strategy Suite",
      desc: "Leverage Gemini AI for conceptual explanations, personalized study plans, and semantic gap analysis."
    }
  ];

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/20">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-brand-600 rounded-2xl text-white shadow-lg shadow-brand-500/20">
              <HelpCircle size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Help & Documentation</h2>
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Protocol Version 5.0.0</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-grow overflow-y-auto p-8 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
          
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-4 text-brand-600 dark:text-brand-400">
              <Info size={18} />
              <h3 className="text-xs font-black uppercase tracking-[0.2em]">Application Overview</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              Quiz Master is a high-performance, local-first examination environment designed for professionals tackling complex certifications like the CISSP. By combining client-side SQLite processing with advanced AI diagnostics, it creates an instant, zero-latency feedback loop for mastery and retention.
            </p>
          </section>

          <section className="mb-10">
            <div className="flex items-center gap-2 mb-6 text-brand-600 dark:text-brand-400">
              <Zap size={18} />
              <h3 className="text-xs font-black uppercase tracking-[0.2em]">Core Capabilities</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {features.map((f, i) => (
                <div key={i} className="flex gap-4 p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50">
                  <div className="shrink-0 p-2 bg-white dark:bg-slate-700 rounded-xl text-brand-600 dark:text-brand-400 shadow-sm">
                    <f.icon size={20} />
                  </div>
                  <div>
                    <h4 className="text-[13px] font-black text-slate-800 dark:text-white uppercase tracking-tight mb-1">{f.title}</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-bold">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-4 text-brand-600 dark:text-brand-400">
              <ShieldCheck size={18} />
              <h3 className="text-xs font-black uppercase tracking-[0.2em]">The Calibration Method</h3>
            </div>
            <div className="p-6 rounded-3xl bg-brand-50 dark:bg-brand-900/10 border border-brand-100 dark:border-brand-800/50">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                Unlike standard testing tools, Quiz Master tracks your confidence alongside your accuracy. This allows us to map your knowledge into four distinct quadrants:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
                {[
                  { l: "True Mastery", c: "bg-green-500", d: "Correct + High Confidence" },
                  { l: "Danger Zone", c: "bg-red-600", d: "Incorrect + High Confidence" },
                  { l: "Lucky Guess", c: "bg-amber-400", d: "Correct + Low Confidence" },
                  { l: "Known Gap", c: "bg-red-400", d: "Incorrect + Low Confidence" }
                ].map((q, i) => (
                  <div key={i} className="text-center">
                    <div className={`w-3 h-3 rounded-full ${q.c} mx-auto mb-2 shadow-lg`} />
                    <div className="text-[9px] font-black uppercase tracking-tight text-slate-800 dark:text-white mb-1">{q.l}</div>
                    <div className="text-[8px] font-bold text-slate-400 uppercase leading-tight">{q.d}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 text-center">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Built for CISSP Mastery &bull; 2025</p>
        </div>
      </div>
    </div>
  );
};
