
import React, { useState, useMemo } from 'react';
import { UserAnswer } from '../types';
import { ChevronRight, ChevronDown, ChevronUp, BookOpen, Bookmark, Maximize2, Minimize2, Filter, Activity, Folder, FolderOpen, FileText } from 'lucide-react';
import { BarTooltip } from './ui/BarTooltip';

interface ChapterAnalysisProps {
  answers: UserAnswer[];
  activeFilter?: string;
  confidenceEnabled?: boolean;
}

interface MetricNode {
  id: string;
  name: string;
  type: 'chapter' | 'heading' | 'domain' | 'subdomain' | 'topic';
  total: number;
  correct: number;
  incorrect: number;
  mastery: number;
  luckyGuess: number;
  dangerZone: number;
  knownGap: number;
  children: MetricNode[];
  questionIds: Set<string | number>;
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

export const ChapterAnalysis: React.FC<ChapterAnalysisProps> = ({ answers, activeFilter = 'all', confidenceEnabled = true }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [isCompact, setIsCompact] = useState(true);

  const toggleNode = (id: string) => {
    const newSet = new Set(expandedNodes);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedNodes(newSet);
  };

  const treeData = useMemo(() => {
    const split = (s: string | undefined) => s ? s.split('|').map(x => x.trim()).filter(Boolean) : [];
    const getPrefix = (str: string) => { const match = str.match(/^(\d+(\.\d+)*)/); return match ? match[1] : null; };
    const createNode = (name: string, type: MetricNode['type'], id: string): MetricNode => ({ 
        id, name, type, total: 0, correct: 0, incorrect: 0, mastery: 0, luckyGuess: 0, dangerZone: 0, knownGap: 0, children: [], questionIds: new Set() 
    });

    const chapterMap = new Map<string, MetricNode>();
    const UNMAPPED_KEY = "Not directly covered in the book ¯\\_(•_•)_/¯";

    answers.forEach(ans => {
        let chapters = split(ans.question.chapter); 
        let headings = split(ans.question.heading);
        
        // --- LOGIC BRANCH 1: Standard Chapter/Heading Mapped Questions ---
        if (chapters.length > 0) {
            const pairs: { c: string, h: string }[] = [];
            if (chapters.length === 1 && headings.length > 1) headings.forEach(h => pairs.push({ c: chapters[0], h }));
            else if (chapters.length > 1 && headings.length === 1) chapters.forEach(c => pairs.push({ c, h: headings[0] }));
            else {
                 const maxLen = Math.max(chapters.length, headings.length);
                 for(let i=0; i<maxLen; i++) {
                     const c = chapters[i] || chapters[chapters.length-1];
                     const h = headings[i] || "General"; 
                     pairs.push({ c, h });
                 }
            }

            new Set(pairs.map(p => `${p.c}|||${p.h}`)).forEach(pairStr => {
                const [cName, hName] = pairStr.split('|||');
                if (!chapterMap.has(cName)) chapterMap.set(cName, createNode(cName, 'chapter', `c-${cName}`));
                
                const cNode = chapterMap.get(cName)!; 
                cNode.questionIds.add(ans.questionId);
                
                let hNode = cNode.children.find(c => c.name === hName);
                if (!hNode) { 
                    hNode = createNode(hName, 'heading', `h-${cName}-${hName}`);
                    cNode.children.push(hNode); 
                }
                hNode.questionIds.add(ans.questionId);
            });
            return;
        }

        // --- LOGIC BRANCH 2: Unmapped / Missing Chapter Questions ---
        if (!chapterMap.has(UNMAPPED_KEY)) chapterMap.set(UNMAPPED_KEY, createNode(UNMAPPED_KEY, 'chapter', 'c-unmapped'));
        const root = chapterMap.get(UNMAPPED_KEY)!;
        root.questionIds.add(ans.questionId);

        // Parse Domain/Sub/Topic hierarchy for unmapped items
        // This mirrors the logic in PerformanceAnalysis to correctly nest aligned items
        const domains = split(ans.question.domain);
        if (domains.length === 0) domains.push("Uncategorized Domain");
        
        const subDomains = split(ans.question.subDomain);
        if (subDomains.length === 0) subDomains.push("General");
        
        const topics = split(ans.question.topic).filter(t => t.toLowerCase() !== "uncategorized");
        
        const paths: [string, string, string | null][] = [];
        
        // Alignment Logic: Try to match SubDomain prefix (e.g. 1.2) to Domain prefix (e.g. 1.)
        if (topics.length === 0) {
            // No topics, just map Domains -> SubDomains
            subDomains.forEach((sName, sIdx) => {
                 const sPrefix = getPrefix(sName);
                 const dName = domains.find(d => { 
                     const dNumMatch = d.match(/\d+/); 
                     return dNumMatch && sPrefix && sPrefix.startsWith(dNumMatch[0]); 
                 }) || domains[sIdx] || domains[0];
                 paths.push([dName, sName, null]);
            });
        } else {
            // Map Domains -> SubDomains -> Topics
            topics.forEach((tName, tIdx) => {
                const tPrefix = getPrefix(tName);
                let sName = subDomains.find(s => tPrefix && getPrefix(s) && tPrefix.startsWith(getPrefix(s)!)) || subDomains[tIdx] || subDomains[0];
                const sPrefix = getPrefix(sName);
                const dName = domains.find(d => { 
                    const dNumMatch = d.match(/\d+/); 
                    return dNumMatch && sPrefix && sPrefix.startsWith(dNumMatch[0]); 
                }) || domains[tIdx] || domains[0];
                paths.push([dName, sName, tName]);
            });
        }

        // Build the tree from paths
        paths.forEach(([dName, sName, tName]) => {
            // Level 1: Domain
            let dNode = root.children.find(c => c.name === dName);
            if (!dNode) {
                dNode = createNode(dName, 'domain', `d-unmapped-${dName}`);
                root.children.push(dNode);
            }
            dNode.questionIds.add(ans.questionId);

            // Level 2: SubDomain
            let sNode = dNode.children.find(c => c.name === sName);
            if (!sNode) {
                sNode = createNode(sName, 'subdomain', `s-unmapped-${dName}-${sName}`);
                dNode.children.push(sNode);
            }
            sNode.questionIds.add(ans.questionId);

            // Level 3: Topic (Optional)
            if (tName) {
                let tNode = sNode.children.find(c => c.name === tName);
                if (!tNode) {
                    tNode = createNode(tName, 'topic', `t-unmapped-${dName}-${sName}-${tName}`);
                    sNode.children.push(tNode);
                }
                tNode.questionIds.add(ans.questionId);
            }
        });
    });

    const calculateStats = (node: MetricNode) => {
        node.total = 0; node.correct = 0; node.incorrect = 0; node.mastery = 0; node.luckyGuess = 0; node.dangerZone = 0; node.knownGap = 0;
        node.questionIds.forEach(qid => {
            const a = answers.find(ans => ans.questionId === qid); if (!a) return;
            node.total++; const isConf = a.confidence === 'high';
            if (a.isCorrect) { node.correct++; if (isConf) node.mastery++; else node.luckyGuess++; }
            else { node.incorrect++; if (isConf) node.dangerZone++; else node.knownGap++; }
        });
        node.children.forEach(calculateStats);
    };
    
    const rootNodes = Array.from(chapterMap.values());
    rootNodes.forEach(calculateStats);
    
    // Sort logic: Chapters numerically, Unmapped usually naturally falls at end due to 'N' or can be forced
    rootNodes.sort((a, b) => {
        if (a.name === UNMAPPED_KEY) return 1;
        if (b.name === UNMAPPED_KEY) return -1;
        return a.name.localeCompare(b.name, undefined, { numeric: true });
    });
    
    rootNodes.forEach(c => {
        // Recursive sort for children
        const recursiveSort = (nodes: MetricNode[]) => {
            nodes.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
            nodes.forEach(n => recursiveSort(n.children));
        };
        recursiveSort(c.children);
    });

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
      const masteryPct = node.total > 0 ? (node.mastery / node.total) * 100 : 0;
      const luckyPct = node.total > 0 ? (node.luckyGuess / node.total) * 100 : 0;
      const dangerPct = node.total > 0 ? (node.dangerZone / node.total) * 100 : 0;
      const gapPct = node.total > 0 ? (node.knownGap / node.total) * 100 : 0;
      
      const correctPct = node.total > 0 ? (node.correct / node.total) * 100 : 0;
      const incorrectPct = node.total > 0 ? (node.incorrect / node.total) * 100 : 0;
      
      let paddingLeft = 'pl-4';
      let borderClass = '';
      let Icon = BookOpen;
      let iconColor = 'text-indigo-500';
      let textSize = isCompact ? 'text-xs' : 'text-sm';
      let textWeight = 'font-semibold';
      let textColor = 'text-slate-700 dark:text-slate-200';

      switch (node.type) {
          case 'chapter':
              paddingLeft = 'pl-4';
              borderClass = 'border-l-4 border-indigo-500';
              Icon = BookOpen;
              textWeight = 'font-black uppercase tracking-tight';
              textColor = 'text-slate-800 dark:text-slate-100';
              break;
          case 'heading':
              paddingLeft = 'pl-12';
              borderClass = 'border-l-4 border-slate-200 dark:border-slate-700';
              Icon = Bookmark;
              iconColor = 'text-slate-400';
              break;
          case 'domain':
              paddingLeft = 'pl-12';
              borderClass = 'border-l-4 border-indigo-300 dark:border-indigo-800';
              Icon = Folder;
              iconColor = 'text-indigo-400';
              break;
          case 'subdomain':
              paddingLeft = 'pl-20';
              borderClass = 'border-l-4 border-slate-200 dark:border-slate-700';
              Icon = FolderOpen;
              iconColor = 'text-slate-400';
              break;
          case 'topic':
              paddingLeft = 'pl-28';
              borderClass = 'border-l-4 border-slate-100 dark:border-slate-800';
              Icon = FileText;
              iconColor = 'text-slate-300';
              textSize = 'text-[11px]';
              break;
      }

      const verticalPadding = isCompact ? 'py-1' : 'py-4';

      return (
          <React.Fragment key={node.id}>
              <tr onClick={() => hasChildren && toggleNode(node.id)} className={`group border-b dark:border-slate-800 transition-colors cursor-pointer ${node.type === 'chapter' ? 'bg-slate-50 dark:bg-slate-800/40' : 'bg-white dark:bg-slate-900'} hover:bg-slate-100 dark:hover:bg-slate-800`}>
                  <td className={`${verticalPadding} pr-4 ${paddingLeft} ${borderClass}`}>
                    <div className="flex items-center gap-2">
                      <div className="w-6 shrink-0 flex items-center justify-center">
                        {hasChildren && <div className="p-1 rounded text-slate-400">{isExpanded ? <ChevronDown size={isCompact ? 12 : 14} /> : <ChevronRight size={isCompact ? 12 : 14} />}</div>}
                      </div>
                      <div className="flex items-center gap-2">
                          <Icon size={isCompact ? 12 : 14} className={iconColor} />
                          <span className={`leading-tight ${textSize} ${textWeight} ${textColor}`}>{node.name}</span>
                      </div>
                    </div>
                  </td>
                  <td className={`px-6 text-center text-[10px] font-bold text-slate-500 dark:text-slate-400`}>{node.total}</td>
                  
                  <td className={`px-6 text-center`}>
                    {confidenceEnabled ? (
                        node.dangerZone > 0 ? <span className="inline-flex items-center px-2 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-[9px] font-black uppercase tracking-widest animate-pulse">{node.dangerZone} Danger</span> : (node.luckyGuess > 0 ? <span className="inline-flex items-center px-2 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[9px] font-black uppercase tracking-widest">{node.luckyGuess} Guess</span> : <span className="text-slate-200 dark:text-slate-800">-</span>)
                    ) : (
                        <span className={`text-[10px] font-black ${node.correct === node.total ? 'text-green-600' : 'text-slate-600 dark:text-slate-300'}`}>{node.correct} / {node.total}</span>
                    )}
                  </td>
                  
                  <td className={`px-6 w-1/3 min-w-[280px]`}>
                    <div className={`rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex border border-slate-200 dark:border-slate-700 ${isCompact ? 'h-2' : 'h-4'}`}>
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
              {isExpanded && node.children.map(child => renderRow(child))}
          </React.Fragment>
      );
  };

  return (
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden transition-all">
           <button onClick={() => setIsOpen(!isOpen)} aria-expanded={isOpen} aria-label={isOpen ? "Collapse Chapter Analysis" : "Expand Chapter Analysis"} className="w-full flex items-center justify-between p-5 text-left bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"><BookOpen size={20} /></div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-base font-black uppercase tracking-tight text-slate-800 dark:text-white">Chapter Analysis</h3>
                            {answers.length > 0 && (
                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-300 text-[8px] font-black uppercase tracking-widest border border-brand-200 dark:border-brand-800">
                                    <Activity size={10} className="animate-pulse" /> Active Filter: {FILTER_LABELS[activeFilter]}
                                </div>
                            )}
                        </div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Performance</p>
                    </div>
                </div>
                <div className="text-slate-400">{isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</div>
           </button>
           {isOpen && (
                <div className="border-t border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-2 duration-300">
                  <div className="max-h-[700px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 z-30">
                        <tr className="bg-slate-100 dark:bg-slate-800 border-b dark:border-slate-700 shadow-sm">
                          <th className="px-6 py-4 pl-12 text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Chapter / Hierarchy</th>
                          <th className="px-6 text-center w-24 text-[8px] font-black text-slate-400 uppercase tracking-widest">Total</th>
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
                                  <input type="checkbox" checked={isCompact} onChange={() => setIsCompact(!isCompact)} className="w-3 h-3 accent-brand-600" />
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
                      <tbody>{treeData.map(node => renderRow(node))}</tbody>
                    </table>
                  </div>
                </div>
           )}
      </div>
  );
};
