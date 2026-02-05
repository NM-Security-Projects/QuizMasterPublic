
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { UserAnswer } from '../types';
import { ChevronRight, ChevronDown, ChevronUp, PieChart, Maximize2, Minimize2, Filter, Activity } from 'lucide-react';
import { BarTooltip } from './ui/BarTooltip';

interface PerformanceAnalysisProps {
  answers: UserAnswer[];
  activeFilter?: string;
  confidenceEnabled?: boolean;
}

type NodeType = 'domain' | 'subDomain' | 'topic';

interface MetricNode {
  id: string;
  name: string;
  type: NodeType;
  questionIds: Set<string | number>;
  total: number;
  correct: number;
  incorrect: number;
  mastery: number;
  luckyGuess: number;
  dangerZone: number;
  knownGap: number;
  children: MetricNode[];
}

const FILTER_LABELS: Record<string, string> = {
  all: 'All Items',
  correct: 'Correct Only',
  incorrect: 'Wrong Only',
  mastery: 'True Mastery',
  danger: 'Danger Zone',
  luck: 'Lucky Guesses',
  gap: 'Known Gaps',
  skipped: 'Skipped Items'
};

export const PerformanceAnalysis: React.FC<PerformanceAnalysisProps> = ({ answers, activeFilter = 'all', confidenceEnabled = true }) => {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [isCompact, setIsCompact] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isScrollable, setIsScrollable] = useState(false);
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    const checkScrollable = () => {
      if (scrollContainerRef.current) {
        const { scrollHeight, clientHeight } = scrollContainerRef.current;
        setIsScrollable(scrollHeight > clientHeight);
      }
    };
    const timeout = setTimeout(checkScrollable, 100);
    window.addEventListener('resize', checkScrollable);
    return () => { window.removeEventListener('resize', checkScrollable); clearTimeout(timeout); };
  }, [expandedNodes, isCompact, isOpen]);

  const treeData = useMemo(() => {
    if (answers.length === 0) return [];
    const split = (s: string | undefined) => s ? s.split('|').map(x => x.trim()).filter(Boolean) : [];
    const getPrefix = (str: string) => { const match = str.match(/^(\d+(\.\d+)*)/); return match ? match[1] : null; };
    const createNode = (name: string, type: NodeType, id: string): MetricNode => ({ id, name, type, questionIds: new Set(), total: 0, correct: 0, incorrect: 0, mastery: 0, luckyGuess: 0, dangerZone: 0, knownGap: 0, children: [] });

    const domainMap = new Map<string, MetricNode>();
    answers.forEach((ans) => {
      const domains = split(ans.question.domain); const subDomains = split(ans.question.subDomain);
      const topics = split(ans.question.topic).filter(t => t.toLowerCase() !== "uncategorized");
      if (domains.length === 0) domains.push("Uncategorized"); if (subDomains.length === 0) subDomains.push("Uncategorized");
      const paths: [string, string, string | null][] = [];
      if (topics.length === 0) {
          const sName = subDomains[0]; const sPrefix = getPrefix(sName);
          const dName = domains.find(d => { const dNumMatch = d.match(/\d+/); return dNumMatch && sPrefix && sPrefix.startsWith(dNumMatch[0]); }) || domains[0];
          paths.push([dName, sName, null]);
      } else {
          topics.forEach((tName, tIdx) => {
              const tPrefix = getPrefix(tName);
              let sName = subDomains.find(s => tPrefix && getPrefix(s) && tPrefix.startsWith(getPrefix(s)!)) || subDomains[tIdx] || subDomains[0];
              const sPrefix = getPrefix(sName);
              const dName = domains.find(d => { const dNumMatch = d.match(/\d+/); return dNumMatch && sPrefix && sPrefix.startsWith(dNumMatch[0]); }) || domains[tIdx] || domains[0];
              paths.push([dName, sName, tName]);
          });
      }
      Array.from(new Set(paths.map(p => JSON.stringify(p)))).map(p => JSON.parse(p) as [string, string, string | null]).forEach(([dName, sName, tName]) => {
          if (!domainMap.has(dName)) domainMap.set(dName, createNode(dName, 'domain', `d-${dName}`));
          const dNode = domainMap.get(dName)!; dNode.questionIds.add(ans.questionId);
          let sNode = dNode.children.find(c => c.name === sName);
          if (!sNode) { sNode = createNode(sName, 'subDomain', `s-${dName}-${sName}`); dNode.children.push(sNode); }
          sNode.questionIds.add(ans.questionId);
          if (tName && tName.toLowerCase() !== "uncategorized") {
            let tNode = sNode.children.find(c => c.name === tName);
            if (!tNode) { tNode = createNode(tName, 'topic', `t-${dName}-${sName}-${tName}`); sNode.children.push(tNode); }
            tNode.questionIds.add(ans.questionId);
          }
      });
    });
    const finalizeAndSort = (node: MetricNode) => {
        node.questionIds.forEach(qId => {
            const ans = answers.find(a => a.questionId === qId); if (!ans) return;
            node.total += 1; const isConf = ans.confidence === 'high';
            if (ans.isCorrect) { node.correct += 1; if (isConf) node.mastery += 1; else node.luckyGuess += 1; }
            else { node.incorrect += 1; if (isConf) node.dangerZone += 1; else node.knownGap += 1; }
        });
        node.children.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        node.children.forEach(finalizeAndSort);
    };
    const rootNodes = Array.from(domainMap.values());
    rootNodes.forEach(finalizeAndSort);
    rootNodes.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    return rootNodes;
  }, [answers]);

  const allNodeIds = useMemo(() => {
    const ids: string[] = [];
    const walk = (nodes: MetricNode[]) => { nodes.forEach(n => { ids.push(n.id); if (n.children.length > 0) walk(n.children); }); };
    walk(treeData); return ids;
  }, [treeData]);

  const renderRow = (node: MetricNode) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children.length > 0;
    let paddingLeft = "pl-4"; let borderClass = "border-l-4 border-transparent";
    let verticalPadding = isCompact ? "py-1" : "py-4";
    if (node.type === 'domain') { paddingLeft = "pl-4"; borderClass = "border-l-4 border-brand-500"; }
    else if (node.type === 'subDomain') { paddingLeft = "pl-12"; borderClass = "border-l-4 border-slate-200 dark:border-slate-700"; }
    else { paddingLeft = "pl-20"; borderClass = "border-l-4 border-slate-100 dark:border-slate-800"; }

    const masteryPct = node.total > 0 ? (node.mastery / node.total) * 100 : 0;
    const luckyPct = node.total > 0 ? (node.luckyGuess / node.total) * 100 : 0;
    const dangerPct = node.total > 0 ? (node.dangerZone / node.total) * 100 : 0;
    const gapPct = node.total > 0 ? (node.knownGap / node.total) * 100 : 0;
    
    const correctPct = node.total > 0 ? (node.correct / node.total) * 100 : 0;
    const incorrectPct = node.total > 0 ? (node.incorrect / node.total) * 100 : 0;

    return (
      <React.Fragment key={node.id}>
        <tr onClick={() => hasChildren && setExpandedNodes(prev => { const n = new Set(prev); if (n.has(node.id)) n.delete(node.id); else n.add(node.id); return n; })} className={`group border-b dark:border-slate-800 transition-colors cursor-pointer ${node.type === 'domain' ? 'bg-slate-50 dark:bg-slate-800/40' : 'bg-white dark:bg-slate-900'} hover:bg-slate-100 dark:hover:bg-slate-800`}>
          <td className={`${verticalPadding} pr-4 ${paddingLeft} ${borderClass}`}>
            <div className="flex items-center gap-2">
              <div className="w-6 shrink-0 flex items-center justify-center">
                {hasChildren ? <div className="p-1 rounded text-slate-400">{isExpanded ? <ChevronDown size={isCompact ? 12 : 14} /> : <ChevronRight size={isCompact ? 12 : 14} />}</div> : null}
              </div>
              <span className={`${isCompact ? 'text-[11px]' : 'text-sm'} leading-tight ${node.type === 'domain' ? 'font-black uppercase tracking-tight text-slate-800 dark:text-slate-100' : 'font-semibold text-slate-700 dark:text-slate-200'}`}>{node.name}</span>
            </div>
          </td>
          <td className={`px-6 text-center text-[10px] font-bold text-slate-500 dark:text-slate-400`}>{node.total}</td>
          
          <td className="px-6 text-center">
            {confidenceEnabled ? (
                node.dangerZone > 0 ? <span className="inline-flex items-center px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-[9px] font-black uppercase tracking-widest animate-pulse">{node.dangerZone} Danger</span> : (node.luckyGuess > 0 ? <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[9px] font-black uppercase tracking-widest">{node.luckyGuess} Guess</span> : <span className="text-slate-200 dark:text-slate-800">-</span>)
            ) : (
                <span className={`text-[10px] font-black ${node.correct === node.total ? 'text-green-600' : 'text-slate-600 dark:text-slate-300'}`}>{node.correct} / {node.total}</span>
            )}
          </td>
          
          <td className={`px-6 w-1/3 min-w-[280px]`}>
             <div className="flex flex-col gap-1"><div className={`flex-grow ${isCompact ? 'h-2 rounded' : 'h-4 rounded-full'} bg-slate-100 dark:bg-slate-800 overflow-hidden flex border border-slate-200 dark:border-slate-700`}>
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
             </div></div>
          </td>
        </tr>
        {isExpanded && node.children.map(child => renderRow(child))}
      </React.Fragment>
    );
  };

  return (
      <div className={`bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden ${isScrollable && isOpen ? 'overscroll-y-contain' : ''}`}>
        <button onClick={() => setIsOpen(!isOpen)} aria-expanded={isOpen} aria-label={isOpen ? "Collapse Domain Analysis" : "Expand Domain Analysis"} className="w-full flex items-center justify-between p-5 text-left bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50">
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-brand-500 text-white shadow-lg shadow-brand-500/20"><PieChart size={20} /></div>
                <div>
                    <div className="flex items-center gap-2">
                        <h3 className="text-base font-black uppercase tracking-tight text-slate-800 dark:text-white">Domain Analysis</h3>
                        {answers.length > 0 && (
                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-300 text-[8px] font-black uppercase tracking-widest border border-brand-200 dark:border-brand-800 animate-in fade-in duration-300">
                                <Activity size={10} className="animate-pulse" /> Active Filter: {FILTER_LABELS[activeFilter]}
                            </div>
                        )}
                    </div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Hierarchy Performance</p>
                </div>
            </div>
            <div className="text-slate-400">{isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</div>
        </button>
        {isOpen && (
            <div className="border-t border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-2 duration-300">
              <div ref={scrollContainerRef} className="max-h-[700px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-30">
                    <tr className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm">
                      <th className="px-6 py-4 pl-12 text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Domain / Objective</th>
                      <th className="px-6 text-center w-24 text-[8px] font-black text-slate-400 uppercase tracking-widest">Items</th>
                      <th className="px-6 text-center w-28 text-[8px] font-black text-slate-400 uppercase tracking-widest">{confidenceEnabled ? "Alerts" : "Score"}</th>
                      <th className="px-6 w-1/3 min-w-[280px]">
                        <div className="flex items-center justify-between gap-4">
                          {confidenceEnabled ? (
                              <div className="flex items-center gap-2 p-1 px-2 bg-slate-200/50 dark:bg-slate-700/50 rounded-full">
                                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-600" /> <span className="text-[7px] font-black text-slate-500 dark:text-slate-400 uppercase">Danger</span></div>
                                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-400" /> <span className="text-[7px] font-black text-slate-500 dark:text-slate-400 uppercase">Gap</span></div>
                                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-300" /> <span className="text-[7px] font-black text-slate-500 dark:text-slate-400 uppercase">Lucky</span></div>
                                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-600" /> <span className="text-[7px] font-black text-slate-500 dark:text-slate-400 uppercase">Mastery</span></div>
                              </div>
                          ) : (
                              <div className="flex items-center gap-2 p-1 px-2 bg-slate-200/50 dark:bg-slate-700/50 rounded-full">
                                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-600" /> <span className="text-[7px] font-black text-slate-500 dark:text-slate-400 uppercase">Correct</span></div>
                                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500" /> <span className="text-[7px] font-black text-slate-500 dark:text-slate-400 uppercase">Incorrect</span></div>
                              </div>
                          )}
                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-1.5 cursor-pointer bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-1 rounded-lg">
                              <input type="checkbox" checked={isCompact} onChange={() => setIsCompact(!isCompact)} className="w-3 h-3 text-brand-600 accent-brand-600" />
                              <span className="text-[7px] font-black uppercase text-slate-500 dark:text-slate-400">Compact</span>
                            </label>
                            <button onClick={() => setExpandedNodes(expandedNodes.size >= allNodeIds.length ? new Set() : new Set(allNodeIds))} aria-label={expandedNodes.size >= allNodeIds.length ? "Collapse All" : "Expand All"} className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 rounded-lg text-[7px] font-black uppercase tracking-widest transition-colors hover:bg-slate-50 dark:hover:bg-slate-800">
                              {expandedNodes.size >= allNodeIds.length ? "Collapse" : "Expand"}
                            </button>
                          </div>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">{treeData.map(node => renderRow(node))}</tbody>
                </table>
              </div>
            </div>
        )}
      </div>
  );
};
