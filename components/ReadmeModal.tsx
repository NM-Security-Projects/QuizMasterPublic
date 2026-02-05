
import React from 'react';
import { X, FileText, Copy, Terminal, Database, Server, Cpu, Shield, Brain } from 'lucide-react';

interface ReadmeModalProps {
  onClose: () => void;
}

export const ReadmeModal: React.FC<ReadmeModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/20">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-200 dark:bg-slate-700 rounded-2xl text-slate-600 dark:text-slate-300 shadow-lg">
              <FileText size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Project Documentation</h2>
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">README.md</p>
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
        <div className="flex-grow overflow-y-auto p-8 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700 prose prose-sm dark:prose-invert max-w-none">
          
          {/* Title & Badges */}
          <div className="mb-8">
            <h1 className="text-3xl font-black uppercase tracking-tight text-slate-800 dark:text-white mb-4">Adaptive Assessment Platform (Quiz Master)</h1>
            <div className="flex flex-wrap gap-2 mb-6">
              {['React 19.0', 'TypeScript 5.0', 'SQL.js WASM', 'Google Gemini AI'].map((badge) => (
                <span key={badge} className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  {badge}
                </span>
              ))}
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              A high-performance educational tool designed to transform raw SQLite question banks into a dynamic, AI-enhanced examination environment. Built on a <strong>local-first architecture</strong>, this platform processes data entirely on the client side using WebAssembly (SQL.js). This design ensures <strong>zero-latency interactions</strong> and instant feedback, regardless of dataset size.
            </p>
          </div>

          <hr className="border-slate-200 dark:border-slate-800 my-8" />

          {/* Key Features */}
          <div className="mb-10">
            <h2 className="text-xl font-black uppercase tracking-tight text-brand-600 dark:text-brand-400 mb-6 flex items-center gap-2">
               <Shield size={20} /> Key Features
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2"><Server size={14} /> Performance & Architecture</h3>
                    <ul className="list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-400 marker:text-brand-500">
                        <li><strong>Instant Local Processing:</strong> Uploads SQLite (.db) files directly to browser memory. Interactions are instantaneous.</li>
                        <li><strong>Zero Data Egress:</strong> All database queries occur locally. Your data never leaves this device.</li>
                        <li><strong>Note:</strong> Internet connection required for initial application load (CDN assets).</li>
                        <li><strong>State Persistence:</strong> Uses IndexedDB to auto-save sessions, allowing you to close the tab and resume exactly where you left off.</li>
                    </ul>
                </div>
                <div className="space-y-2">
                    <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2"><Brain size={14} /> Adaptive Learning</h3>
                    <ul className="list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-400 marker:text-brand-500">
                        <li><strong>Metacognitive Tagging:</strong> Users must rate confidence (Low/Med/High) for every answer.</li>
                        <li><strong>Multi-Format Support:</strong> Handles Multiple Choice, Multi-Select (<code>[MULTI]</code>), and Matching (<code>[MATCH]</code>).</li>
                        <li><strong>Simulation Personas:</strong> Built-in developer tools to simulate user archetypes.</li>
                    </ul>
                </div>
            </div>
            <div className="mt-6">
                 <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2"><Cpu size={14} /> AI-Powered (Google Gemini)</h3>
                 <ul className="list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-400 marker:text-brand-500 mt-2">
                    <li><strong>Deep Explanations:</strong> Generates "Plain English" simplifications and mnemonic hooks.</li>
                    <li><strong>Strategic Roadmaps:</strong> Analyzes session performance to build a JSON-structured study plan.</li>
                    <li><strong>Semantic Friction Analysis:</strong> Identifies conceptual "connective tissue" causing errors across different domains.</li>
                 </ul>
            </div>
          </div>

          <hr className="border-slate-200 dark:border-slate-800 my-8" />

          {/* Setup */}
          <div className="mb-10">
             <h2 className="text-xl font-black uppercase tracking-tight text-brand-600 dark:text-brand-400 mb-6 flex items-center gap-2">
               <Terminal size={20} /> Getting Started
            </h2>
            <div className="space-y-4">
                <div>
                    <h4 className="font-bold text-sm text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-2">1. Installation</h4>
                    <div className="bg-slate-900 rounded-xl p-4 font-mono text-xs text-slate-300 border border-slate-700">
                  <p>git clone https://github.com/NM-Security-Projects/Quiz-Master-Application</p>
                        <p>cd quiz-master</p>
                        <p>npm install</p>
                    </div>
                </div>
                <div>
                    <h4 className="font-bold text-sm text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-2">2. Configuration</h4>
                    <div className="bg-slate-900 rounded-xl p-4 font-mono text-xs text-slate-300 border border-slate-700">
                        <span className="text-slate-500"># Create a .env file in root</span><br/>
                        <span className="text-green-400">API_KEY</span>=your_google_gemini_api_key_here
                    </div>
                </div>
            </div>
          </div>

          <hr className="border-slate-200 dark:border-slate-800 my-8" />

          {/* Database Format */}
          <div className="mb-10">
            <h2 className="text-xl font-black uppercase tracking-tight text-brand-600 dark:text-brand-400 mb-6 flex items-center gap-2">
               <Database size={20} /> Database Format Guide
            </h2>
            <p className="mb-4 text-slate-600 dark:text-slate-300">
                Upload a valid <strong>SQLite 3</strong> database file. The application automatically detects the main table, but the schema must contain specific columns.
            </p>
            
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold uppercase">
                        <tr>
                            <th className="p-3">Column Name</th>
                            <th className="p-3">Description</th>
                            <th className="p-3">Example</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400">
                        <tr><td className="p-3 font-mono text-xs">ID</td><td className="p-3">Unique identifier</td><td className="p-3"><code>1</code></td></tr>
                        <tr><td className="p-3 font-mono text-xs">Domain</td><td className="p-3">High-level domain</td><td className="p-3"><code>Domain 7</code></td></tr>
                        <tr><td className="p-3 font-mono text-xs">Sub-Domain</td><td className="p-3">Specific sub-category</td><td className="p-3"><code>7.1 Investigations</code></td></tr>
                        <tr><td className="p-3 font-mono text-xs">Topic Area</td><td className="p-3">Granular topic</td><td className="p-3"><code>7.1.4 Forensics</code></td></tr>
                        <tr><td className="p-3 font-mono text-xs">Question Text</td><td className="p-3">Body of question</td><td className="p-3"><code>Which of the following...</code></td></tr>
                        <tr><td className="p-3 font-mono text-xs">Choice A...N</td><td className="p-3">Options</td><td className="p-3"><code>Option Text</code></td></tr>
                        <tr><td className="p-3 font-mono text-xs">CorrectAnswer(s)</td><td className="p-3">Correct letter(s)</td><td className="p-3"><code>C</code> or <code>A,B</code></td></tr>
                        <tr><td className="p-3 font-mono text-xs">Explanation</td><td className="p-3">Reasoning</td><td className="p-3"><code>The reason C is correct...</code></td></tr>
                    </tbody>
                </table>
            </div>

            <div className="mt-6 bg-amber-50 dark:bg-amber-900/10 p-4 rounded-xl border border-amber-100 dark:border-amber-900/30">
                <h4 className="font-bold text-amber-800 dark:text-amber-500 mb-2 uppercase text-xs tracking-wider">Special Question Types</h4>
                <ul className="list-disc pl-5 space-y-2 text-sm text-amber-900 dark:text-amber-200/80">
                    <li><strong>Multi-Select:</strong> Add <code>[MULTI]</code> to the start of Question Text OR ensure CorrectAnswer(s) contains commas.</li>
                    <li><strong>Matching:</strong> Add <code>[MATCH]</code> to the start of Question Text. Format choices as adjacent pairs (A matches B, C matches D).</li>
                </ul>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 text-center">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">MIT License &bull; Free for personal use</p>
        </div>
      </div>
    </div>
  );
};
