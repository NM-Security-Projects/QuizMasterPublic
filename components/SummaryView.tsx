
import React, { useState, useMemo } from 'react';
import { UserAnswer, GroundingLink } from '../types';
import { CheckCircle2, XCircle, RotateCcw, AlertCircle, ChevronDown, ChevronUp, ArrowRight, SkipForward, Folder, FolderOpen, BrainCircuit, Sparkles, Loader2, Target, ShieldAlert, ShieldCheck, Microscope, Info, Filter, Bookmark, Hash, ListChecks, BookOpen, GraduationCap, TrendingUp, Lightbulb, Download, FileText, Check, Copy, Activity, Flag, Globe, ExternalLink } from 'lucide-react';
import { PerformanceAnalysis } from './PerformanceAnalysis';
import { ChapterAnalysis } from './ChapterAnalysis';
import { getAIStudyPlan, getAIContextualAnalysis, getAIExplanation } from '../services/aiService';
import { isMatch, parseMatchConfiguration, cleanMatchText } from '../utils/questionParser';

interface SummaryViewProps {
  answers: UserAnswer[];
  onRestart: () => void;
  isDevToolsEnabled?: boolean;
}

type ReviewFilterType = 'all' | 'correct' | 'incorrect' | 'skipped' | 'mastery' | 'danger' | 'luck' | 'gap' | 'flagged';

const FILTER_LABELS: Record<string, string> = {
  all: 'All Items',
  correct: 'Correct Only',
  incorrect: 'Wrong Only',
  mastery: 'True Mastery',
  danger: 'Danger Zone',
  luck: 'Lucky Guesses',
  gap: 'Known Gaps',
  skipped: 'Skipped Items',
  flagged: 'Flagged Errors'
};

interface TooltipProps {
  title: string;
  text: string;
  children?: React.ReactNode;
  position?: 'top' | 'left' | 'right';
  className?: string;
}

const Tooltip: React.FC<TooltipProps> = ({ title, text, children, position = 'top', className = '' }) => (
    <div className={`group relative flex flex-col items-center ${className}`}>
        {children}
        <div className={`absolute z-50 hidden group-hover:flex pointer-events-none animate-in fade-in duration-200 ${position === 'top' ? 'bottom-full left-1/2 -translate-x-1/2 mb-3 flex-col items-center' : ''} ${position === 'left' ? 'right-full top-1/2 -translate-y-1/2 mr-4 flex-row items-center' : ''} ${position === 'right' ? 'left-full top-1/2 -translate-y-1/2 ml-4 flex-row-reverse items-center' : ''}`}>
            <div className="w-56 bg-slate-900 dark:bg-slate-800 text-white rounded-2xl p-4 shadow-2xl border border-slate-700/50">
                <p className="text-[10px] font-black uppercase tracking-widest text-brand-400 mb-1">{title}</p>
                <p className="text-[11px] font-medium leading-relaxed text-slate-300">{text}</p>
            </div>
            {position === 'top' && <div className="w-3 h-3 bg-slate-900 dark:bg-slate-800 border-r border-b border-slate-700/50 rotate-45 -mt-1.5" />}
            {position === 'left' && <div className="w-3 h-3 bg-slate-900 dark:bg-slate-800 border-t border-r border-slate-700/50 rotate-45 -ml-1.5" />}
            {position === 'right' && <div className="w-3 h-3 bg-slate-900 dark:bg-slate-800 border-b border-l border-slate-700/50 rotate-45 -mr-1.5" />}
        </div>
    </div>
);

export const SummaryView: React.FC<SummaryViewProps> = ({ answers, onRestart, isDevToolsEnabled = false }) => {
  // Detect if confidence was enabled for this session
  const confidenceEnabled = useMemo(() => answers.some(a => a.confidence !== null), [answers]);

  const correctCount = answers.filter(a => a.isCorrect).length;
  const incorrectCount = answers.length - correctCount;
  const skippedCount = answers.filter(a => a.isSkipped).length;
  const flaggedCount = answers.filter(a => a.isErrorFlagged).length;
  const masteryCount = answers.filter(a => a.isCorrect && a.confidence === 'high').length;
  const dangerCount = answers.filter(a => !a.isCorrect && a.confidence === 'high').length;
  const luckyGuessCount = answers.filter(a => a.isCorrect && a.confidence !== 'high' && !a.isSkipped).length;
  const knownGapCount = answers.filter(a => !a.isCorrect && a.confidence !== 'high' && !a.isSkipped).length;
  const percentage = answers.length > 0 ? Math.round((correctCount / answers.length) * 100) : 0;
  const masteryScore = answers.length > 0 ? Math.round((masteryCount / answers.length) * 100) : 0;
  
  const [expandedId, setExpandedId] = useState<string | number | null>(null);
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState<ReviewFilterType>('all');
  const [isReviewOpen, setIsReviewOpen] = useState(true);
  
  const [aiPlan, setAiPlan] = useState<any | null>(null);
  const [isAiPlanLoading, setIsAiPlanLoading] = useState(false);
  const [contextualAnalysis, setContextualAnalysis] = useState<string | null>(null);
  const [isContextLoading, setIsContextLoading] = useState(false);
  const [isAiLoadingMap, setIsAiLoadingMap] = useState<Record<string | number, boolean>>({});
  const [copiedMap, setCopiedMap] = useState<Record<string | number, boolean>>({});
  const [copiedIdMap, setCopiedIdMap] = useState<Record<string | number, boolean>>({});

  const filteredAnswersList = useMemo(() => {
    return answers.filter(a => {
        if (activeFilter === 'all') return true;
        if (activeFilter === 'correct') return a.isCorrect && !a.isSkipped;
        if (activeFilter === 'incorrect') return !a.isCorrect && !a.isSkipped;
        if (activeFilter === 'skipped') return !!a.isSkipped;
        if (activeFilter === 'flagged') return !!a.isErrorFlagged;
        const isHigh = a.confidence === 'high';
        if (activeFilter === 'mastery') return a.isCorrect && isHigh;
        if (activeFilter === 'danger') return !a.isCorrect && isHigh;
        if (activeFilter === 'luck') return a.isCorrect && !isHigh && !a.isSkipped;
        if (activeFilter === 'gap') return !a.isCorrect && !isHigh && !a.isSkipped;
        return true;
    });
  }, [answers, activeFilter]);

  const domainGroups = useMemo(() => {
    const groups: Record<string, UserAnswer[]> = {};
    const split = (s: string | undefined) => s ? s.split('|').map(x => x.trim()).filter(Boolean) : ["Uncategorized"];
    filteredAnswersList.forEach(ans => {
        const domains = split(ans.question.domain);
        domains.forEach(d => { if (!groups[d]) groups[d] = []; groups[d].push(ans); });
    });
    return groups;
  }, [filteredAnswersList]);

  const sortedDomains = useMemo(() => Object.keys(domainGroups).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), [domainGroups]);

  const handleGenerateStudyPlan = async () => {
    setIsAiPlanLoading(true);
    const plan = await getAIStudyPlan(answers);
    setAiPlan(plan);
    setIsAiPlanLoading(false);
  };

  const handleGenerateContextAnalysis = async () => {
    setIsContextLoading(true);
    const analysis = await getAIContextualAnalysis(answers);
    setContextualAnalysis(analysis);
    setIsContextLoading(false);
  };

  const handleAskAiForAnswer = async (ans: UserAnswer) => {
      setIsAiLoadingMap(prev => ({...prev, [ans.question.id]: true}));
      const result = await getAIExplanation(ans.question, ans.selectedOption);
      ans.aiExplanation = result.text;
      ans.aiGroundingLinks = result.links;
      setIsAiLoadingMap(prev => ({...prev, [ans.question.id]: false}));
  }

  const handleCopyAi = (ans: UserAnswer) => {
      if (!ans.aiExplanation) return;
      navigator.clipboard.writeText(ans.aiExplanation);
      setCopiedMap(prev => ({...prev, [ans.question.id]: true}));
      setTimeout(() => setCopiedMap(prev => ({...prev, [ans.question.id]: false})), 2000);
  }

  const handleCopyId = (ans: UserAnswer) => {
      navigator.clipboard.writeText(String(ans.question.id));
      setCopiedIdMap(prev => ({...prev, [ans.question.id]: true}));
      setTimeout(() => setCopiedIdMap(prev => ({...prev, [ans.question.id]: false})), 2000);
  }

  const handleExport = () => {
      const data = answers.map(a => ({
          id: a.question.id,
          question: a.question.question_text,
          correct: a.isCorrect,
          confidence: a.confidence,
          selected: a.selectedOption,
          aiExplanation: a.aiExplanation,
          aiGroundingLinks: a.aiGroundingLinks,
          flagged: a.isErrorFlagged,
          flagReason: a.flagReason
      }));
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quiz-results-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
  }

  const renderReviewAnswer = (ans: UserAnswer) => {
    if (ans.isSkipped) return <div className="p-1.5 rounded-lg border bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 text-yellow-800 dark:text-yellow-400 flex items-center gap-2 mb-1.5"><SkipForward size={14} /><span className="font-black text-[10px] uppercase">Skipped</span></div>;
    
    if (isMatch(ans.question.question_text)) {
        const config = parseMatchConfiguration(ans.question);
        const userConnections = (Array.isArray(ans.selectedOption) ? ans.selectedOption : []) as string[];
        
        // Sort user connections based on the sequence of the Left Item in the original question
        // This ensures the review looks like "1 -> A, 2 -> B" instead of random order
        const sortedConnections = [...userConnections].sort((a, b) => {
            const leftA = a.split('||')[0];
            const leftB = b.split('||')[0];
            const idxA = config.leftItems.indexOf(leftA);
            const idxB = config.leftItems.indexOf(leftB);
            // If item not found (unlikely), put at end
            return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
        });

        return (
            <div className="grid grid-cols-1 gap-1 mb-1.5">
                {sortedConnections.map((link, idx) => {
                    const [leftItem, rightKey] = link.split('||');
                    // Get full text for right side
                    const rightText = cleanMatchText(ans.question.choices[rightKey] || rightKey);
                    
                    const isCorrect = config.correctLinks.has(link);
                    return (
                        <div key={idx} className={`p-1 rounded border flex flex-col sm:flex-row items-start sm:items-center gap-1.5 ${isCorrect ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'}`}>
                            <div className="flex-1 text-[10px] font-bold bg-white dark:bg-slate-800 px-2 py-0.5 rounded border dark:border-slate-700">{leftItem}</div>
                            <ArrowRight size={10} className="rotate-90 sm:rotate-0 text-slate-400 shrink-0" />
                            <div className={`flex-1 text-[10px] font-normal px-2 py-0.5 rounded border ${isCorrect ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200'}`}>
                                {rightText}
                            </div>
                            <div className="ml-auto">{isCorrect ? <CheckCircle2 size={12} className="text-green-600" /> : <XCircle size={12} className="text-red-600" />}</div>
                        </div>
                    );
                })}
                {sortedConnections.length === 0 && <span className="text-[10px] text-slate-400 italic">No matches made.</span>}
            </div>
        );
    }
    
    return (
        <div className="space-y-0.5 mb-1.5">
            {Object.entries(ans.question.choices)
                .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: 'base' }))
                .map(([key, text]) => {
                const isSelected = Array.isArray(ans.selectedOption) ? ans.selectedOption.includes(key) : ans.selectedOption === key;
                
                // Determine Correctness for UI highlighting
                let isActualCorrect = false;
                const correctStr = (ans.question.correct_answer || "").trim().toUpperCase();
                // Check if simple match, comma list, or multi-char string
                if (correctStr.includes(',')) {
                    isActualCorrect = correctStr.split(',').map(s=>s.trim().replace(/['"]/g, '')).includes(key);
                } else if (correctStr.length > 1 && /\[MULTI\]/i.test(ans.question.question_text)) {
                    isActualCorrect = correctStr.includes(key);
                } else {
                    isActualCorrect = correctStr === key;
                }

                let style = isActualCorrect && isSelected ? "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-800 text-green-900 dark:text-green-300" : (isActualCorrect && !isSelected ? "bg-green-50/50 dark:bg-green-900/10 border-green-400 dark:border-green-800 border-dashed" : (!isActualCorrect && isSelected ? "bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-800 text-red-900 dark:text-red-300" : "opacity-60 grayscale bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"));
                return (
                    <div key={key} className={`p-1.5 rounded-lg border flex items-center gap-2 text-[11px] min-h-[32px] ${style}`}>
                        <div className="min-w-[1.25rem] font-black">{key}.</div>
                        <div className="flex-grow font-normal leading-tight">{text}</div>
                        {isActualCorrect && isSelected ? <CheckCircle2 size={14} className="ml-auto text-green-600" /> : (isActualCorrect && !isSelected ? <CheckCircle2 size={14} className="ml-auto text-green-400" /> : (!isActualCorrect && isSelected ? <XCircle size={14} className="ml-auto text-red-600" /> : null))}
                    </div>
                );
            })}
        </div>
    );
  };

  const filterChips: { id: ReviewFilterType, label: string, count: number, color?: string }[] = [
    { id: 'all', label: 'All', count: answers.length },
    { id: 'correct', label: 'Correct', count: correctCount },
    { id: 'incorrect', label: 'Wrong', count: incorrectCount },
    ...(confidenceEnabled ? [
        { id: 'mastery', label: 'Mastery', count: masteryCount },
        { id: 'danger', label: 'Danger', count: dangerCount },
        { id: 'luck', label: 'Lucky', count: luckyGuessCount },
        { id: 'gap', label: 'Gap', count: knownGapCount },
    ] : []) as any[],
    { id: 'skipped', label: 'Skipped', count: skippedCount },
    { id: 'flagged', label: 'Flagged', count: flaggedCount, color: 'text-red-500' },
  ];

  return (
    <div className="w-full max-w-5xl mx-auto pb-12 animate-in fade-in duration-500">
      <div className="sticky top-14 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 -mx-2 md:-mx-4 px-2 md:px-4 py-1.5 mb-8 transition-all shadow-sm">
        <div className="max-w-5xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 shrink-0">
                    <Filter size={14} className="text-brand-500" />
                    <span className="text-[9px] font-black uppercase tracking-[0.2em]">Filters</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-300 text-[8px] font-black uppercase tracking-widest border border-brand-200 dark:border-brand-800 animate-in fade-in duration-300 whitespace-nowrap">
                    <Activity size={10} className="animate-pulse" /> Active: {FILTER_LABELS[activeFilter]}
                </div>
            </div>
            <div className="flex flex-nowrap overflow-x-auto gap-1 items-center justify-start md:justify-end w-full lg:w-auto pb-1 lg:pb-0 scrollbar-hide">
                {filterChips.map((chip) => (
                    <button 
                        key={chip.id} 
                        onClick={() => setActiveFilter(chip.id)} 
                        className={`shrink-0 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-tight transition-all border ${activeFilter === chip.id ? 'bg-brand-600 text-white border-brand-500 shadow-sm' : 'text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'} ${chip.color || ''}`}
                    >
                        {chip.label} <span className="opacity-60 ml-0.5">({chip.count})</span>
                    </button>
                ))}
            </div>
        </div>
      </div>

      <div className="px-4 sm:px-0">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 mb-6 overflow-hidden">
            <div className="bg-brand-600 p-8 text-white text-center relative">
            <button onClick={onRestart} aria-label="Start New Session" className="absolute top-4 left-4 p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors group" title="New Session">
                <RotateCcw size={20} className="group-hover:-rotate-180 transition-transform duration-500" />
            </button>
            <button onClick={handleExport} aria-label="Export Results to JSON" className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors group">
                <Download size={20} className="group-hover:scale-110 transition-transform" />
            </button>
            <h2 className="text-3xl font-black tracking-tight mb-1 uppercase">Session Report</h2>
            <div className="flex justify-center gap-8 mt-4">
                <Tooltip title="Accuracy" text="The total percentage of questions you answered correctly." position="left">
                    <div className="flex flex-col items-center"><span className="text-[11px] font-black uppercase tracking-[0.25em] opacity-80">Accuracy</span><span className="text-3xl font-black">{percentage}%</span></div>
                </Tooltip>
                <div className="w-px h-12 bg-white/20" />
                {confidenceEnabled ? (
                    <Tooltip title="True Mastery" text="Correct and highly certain." position="right">
                        <div className="flex flex-col items-center"><span className="text-[11px] font-black uppercase tracking-[0.25em] opacity-80">True Mastery</span><span className="text-3xl font-black">{masteryScore}%</span></div>
                    </Tooltip>
                ) : (
                    <Tooltip title="Score" text="Total questions answered correctly." position="right">
                        <div className="flex flex-col items-center"><span className="text-[11px] font-black uppercase tracking-[0.25em] opacity-80">Score</span><span className="text-3xl font-black">{correctCount} / {answers.length}</span></div>
                    </Tooltip>
                )}
            </div>
            </div>
            <div className={`p-4 grid ${confidenceEnabled ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-3'} gap-4 text-center`}>
                {confidenceEnabled ? (
                    [
                        { 
                            label: 'Danger', 
                            count: dangerCount, 
                            icon: ShieldAlert, 
                            color: 'red',
                            desc: "High Confidence + Incorrect. Indicates a specific misconception or un-learning required."
                        }, 
                        { 
                            label: 'Gap', 
                            count: knownGapCount, 
                            icon: Microscope, 
                            color: 'red',
                            desc: "Low Confidence + Incorrect. Represents a lack of knowledge or exposure to this topic."
                        }, 
                        { 
                            label: 'Lucky', 
                            count: luckyGuessCount, 
                            icon: Target, 
                            color: 'amber',
                            desc: "Low Confidence + Correct. You guessed right, but may not fully understand the underlying concept."
                        }, 
                        { 
                            label: 'Mastery', 
                            count: masteryCount, 
                            icon: ShieldCheck, 
                            color: 'green',
                            desc: "High Confidence + Correct. Demonstrates solid understanding and retention of the material."
                        }
                    ].map(stat => (
                        <Tooltip key={stat.label} title={stat.label} text={stat.desc} position="top" className="w-full">
                            <div className={`p-4 rounded-xl bg-${stat.color}-50 dark:bg-${stat.color}-900/10 border border-${stat.color}-100 dark:border-${stat.color}-900/30 w-full`}>
                                <div className={`flex justify-center mb-1 text-${stat.color}-600 dark:text-${stat.color}-400`}><stat.icon size={22} /></div>
                                <div className={`text-2xl font-black text-${stat.color}-600 dark:text-${stat.color}-400`}>{stat.count}</div>
                                <div className={`text-[10px] font-black text-${stat.color}-600 dark:text-${stat.color}-400 uppercase tracking-widest`}>{stat.label}</div>
                            </div>
                        </Tooltip>
                    ))
                ) : (
                    [
                        { label: 'Correct', count: correctCount, icon: CheckCircle2, color: 'green', desc: 'Questions answered correctly.' },
                        { label: 'Incorrect', count: incorrectCount, icon: XCircle, color: 'red', desc: 'Questions answered incorrectly.' },
                        { label: 'Skipped', count: skippedCount, icon: SkipForward, color: 'amber', desc: 'Questions skipped.' },
                    ].map(stat => (
                        <Tooltip key={stat.label} title={stat.label} text={stat.desc} position="top" className="w-full">
                            <div className={`p-4 rounded-xl bg-${stat.color}-50 dark:bg-${stat.color}-900/10 border border-${stat.color}-100 dark:border-${stat.color}-900/30 w-full`}>
                                <div className={`flex justify-center mb-1 text-${stat.color}-600 dark:text-${stat.color}-400`}><stat.icon size={22} /></div>
                                <div className={`text-2xl font-black text-${stat.color}-600 dark:text-${stat.color}-400`}>{stat.count}</div>
                                <div className={`text-[10px] font-black text-${stat.color}-600 dark:text-${stat.color}-400 uppercase tracking-widest`}>{stat.label}</div>
                            </div>
                        </Tooltip>
                    ))
                )}
            </div>
        </div>

        {/* ... (AI Analysis Sections) ... */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 p-5">
                <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-xl bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400"><TrendingUp size={20} /></div>
                    <div>
                        <h3 className="text-base font-black uppercase tracking-tight text-slate-800 dark:text-white">AI Tactical Roadmap</h3>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Growth Vector Analysis</p>
                    </div>
                </div>
                
                {!aiPlan ? (
                    <button onClick={handleGenerateStudyPlan} disabled={isAiPlanLoading} className="w-full py-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-center gap-3 hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-all text-slate-400 hover:text-brand-600">
                        {isAiPlanLoading ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
                        <span className="text-[10px] font-black uppercase tracking-widest">{isAiPlanLoading ? 'Calculating Trajectories...' : 'Generate AI Study Plan'}</span>
                    </button>
                ) : (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border dark:border-slate-700">
                            <p className="text-[11px] font-medium leading-relaxed italic text-slate-600 dark:text-slate-300">"{aiPlan.overallAssessment}"</p>
                        </div>
                        <div className="space-y-2">
                            <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"><Target size={12} /> Focus Vector</h4>
                            {aiPlan.topWeaknesses.map((w: any, i: number) => (
                                <div key={i} className="flex gap-3">
                                    <div className="text-[10px] font-black text-brand-600">0{i+1}</div>
                                    <div>
                                        <div className="text-[11px] font-black uppercase text-slate-700 dark:text-slate-200">{w.topic}</div>
                                        <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400">{w.reason}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="pt-2 border-t dark:border-slate-800">
                            <p className="text-[10px] font-bold text-brand-600 dark:text-brand-400 flex items-center gap-2"><Lightbulb size={12} /> {aiPlan.encouragement}</p>
                        </div>
                    </div>
                )}
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 p-5 flex flex-col">
                <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"><BrainCircuit size={20} /></div>
                    <div>
                        <h3 className="text-base font-black uppercase tracking-tight text-slate-800 dark:text-white">Semantic Friction Analysis</h3>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Pattern Recognition Diagnostics</p>
                    </div>
                </div>

                {!contextualAnalysis ? (
                    <button onClick={handleGenerateContextAnalysis} disabled={isContextLoading} className="w-full flex-grow py-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-center gap-3 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all text-slate-400 hover:text-indigo-600">
                        {isContextLoading ? <Loader2 className="animate-spin" size={20} /> : <Microscope size={20} />}
                        <span className="text-[10px] font-black uppercase tracking-widest">{isContextLoading ? 'Analyzing Connective Tissue...' : 'Detect Conceptual Patterns'}</span>
                    </button>
                ) : (
                    <div className="flex-grow max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 pr-2 animate-in fade-in duration-500">
                        <div className="prose prose-sm dark:prose-invert">
                            <div className="text-[12px] text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap font-medium">
                                {contextualAnalysis}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>

        <div className="space-y-10 relative">
            <PerformanceAnalysis answers={filteredAnswersList} activeFilter={activeFilter} confidenceEnabled={confidenceEnabled} />
            <ChapterAnalysis answers={filteredAnswersList} activeFilter={activeFilter} confidenceEnabled={confidenceEnabled} />
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden mb-10 mt-10">
            <button onClick={() => setIsReviewOpen(!isReviewOpen)} aria-expanded={isReviewOpen} aria-label={isReviewOpen ? "Collapse Question Review" : "Expand Question Review"} className="w-full flex items-center justify-between p-5 transition-colors text-left bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-slate-500 text-white shadow-lg shadow-slate-500/20"><ListChecks size={20} /></div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-base font-black uppercase tracking-tight text-slate-800 dark:text-white">Question Review</h3>
                            {answers.length > 0 && (
                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-300 text-[8px] font-black uppercase tracking-widest border border-brand-200 dark:border-brand-800">
                                    <Filter size={10} /> Active Filter: {FILTER_LABELS[activeFilter]}
                                </div>
                            )}
                        </div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Filtered Result List</p>
                    </div>
                </div>
                <div className="text-slate-400">{isReviewOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</div>
            </button>
            {isReviewOpen && (
                <div className="border-t border-slate-100 dark:border-slate-800">
                    <div className="max-h-[700px] overflow-y-auto px-4 pb-4 pt-0 space-y-3 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
                        {sortedDomains.map((domain) => (
                            <div key={domain} className="first:mt-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-sm transition-all hover:shadow-md">
                                <button onClick={() => { const newSet = new Set(expandedDomains); if (newSet.has(domain)) newSet.delete(domain); else newSet.add(domain); setExpandedDomains(newSet); }} className="sticky top-0 z-10 w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl shadow-sm border-b border-transparent">
                                    <div className="flex items-center gap-3"><div className="p-1 rounded-lg bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400">{expandedDomains.has(domain) ? <FolderOpen size={16} /> : <Folder size={16} />}</div><span className="font-black uppercase tracking-tight text-[14px] text-slate-800 dark:text-slate-100">{domain}</span></div>
                                    <div className="text-slate-400">{expandedDomains.has(domain) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</div>
                                </button>
                                {expandedDomains.has(domain) && (
                                    <div className="p-1.5 space-y-1.5 bg-slate-50 dark:bg-slate-900">
                                        {domainGroups[domain].map((ans) => (
                                            <div key={ans.question.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 transition-all hover:border-brand-500/30">
                                                <button onClick={() => setExpandedId(expandedId === ans.question.id ? null : ans.question.id)} aria-expanded={expandedId === ans.question.id} aria-label={expandedId === ans.question.id ? "Hide Details" : "Show Details"} className="w-full flex items-center justify-between p-2 text-left">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className="shrink-0">{ans.isSkipped ? <SkipForward className="text-yellow-500" size={14} /> : ans.isCorrect ? <CheckCircle2 className="text-green-500" size={14} /> : <XCircle className="text-red-500" size={14} />}</div>
                                                        <div className="min-w-0 flex-grow">
                                                            <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                                                {isDevToolsEnabled && (
                                                                    <span className="inline-flex items-center gap-1 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded border dark:border-slate-700"><Hash size={9} /> {ans.question.id}</span>
                                                                )}
                                                                {confidenceEnabled && (
                                                                    <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border ${ans.confidence === 'high' ? 'bg-green-100 dark:bg-green-900/30 text-green-700' : 'bg-red-100 dark:bg-red-900/30 text-red-700'}`}>{ans.confidence}</span>
                                                                )}
                                                                {ans.isErrorFlagged && (
                                                                    <Tooltip title="Quarantined Item" text={`Reason: ${ans.flagReason}`}>
                                                                        <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-red-600 text-white cursor-help">
                                                                            <Flag size={8} /> Flagged
                                                                        </span>
                                                                    </Tooltip>
                                                                )}
                                                            </div>
                                                            <p className="font-semibold text-slate-800 dark:text-slate-200 truncate text-[12px] leading-snug">{ans.question.question_text.replace(/\[MATCH\]|\[MULTI\]|\[EXP\]|\[PIC\]/gi, '').trim()}</p>
                                                        </div>
                                                    </div>
                                                    <div className="shrink-0 ml-4">{expandedId === ans.question.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</div>
                                                </button>
                                                {expandedId === ans.question.id && (
                                                    <div className="p-2 bg-slate-50 dark:bg-slate-900/40 border-t dark:border-slate-700 rounded-b-xl animate-in fade-in duration-300">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <p className="text-[12px] font-normal text-slate-700 dark:text-slate-300">{ans.question.question_text.replace(/\[MATCH\]|\[MULTI\]|\[EXP\]|\[PIC\]/gi, '').trim()}</p>
                                                            <button 
                                                                onClick={() => handleCopyId(ans)}
                                                                className="flex items-center gap-1 px-2 py-1 rounded bg-slate-200 dark:bg-slate-800 text-[8px] font-black uppercase text-slate-500 hover:text-brand-600 transition-colors"
                                                            >
                                                                {copiedIdMap[ans.question.id] ? <Check size={8} /> : <Copy size={8} />}
                                                                {copiedIdMap[ans.question.id] ? "ID Copied" : "Copy ID"}
                                                            </button>
                                                        </div>
                                                        {renderReviewAnswer(ans)}

                                                        {ans.isErrorFlagged && (
                                                            <div className="mb-2 p-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30">
                                                                <div className="flex items-center gap-1.5 font-black uppercase tracking-widest text-[9px] mb-0.5 text-red-800 dark:text-red-400">
                                                                    <ShieldAlert size={10} /> User Reported Error
                                                                </div>
                                                                <p className="text-[11px] leading-relaxed text-red-700 dark:text-red-300 italic">" {ans.flagReason} "</p>
                                                            </div>
                                                        )}

                                                        <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-xl border border-blue-100 dark:border-blue-900/30 text-[11px] mb-2">
                                                            <div className="flex items-center gap-1.5 font-black uppercase tracking-widest text-[9px] mb-0.5 text-blue-800 dark:text-blue-400"><AlertCircle size={10} /> Database Explanation Analysis</div>
                                                            <p className="leading-relaxed text-slate-600 dark:text-slate-300">{ans.question.explanation}</p>
                                                        </div>
                                                        <div className="bg-brand-50 dark:bg-brand-900/10 p-2 rounded-xl border border-brand-100 dark:border-brand-900/30 text-[11px]">
                                                            <div className="flex items-center justify-between mb-1">
                                                                <div className="flex items-center gap-1.5 font-black uppercase tracking-widest text-[9px] text-brand-700 dark:text-brand-300"><Sparkles size={10} /> AI Deep Analysis</div>
                                                                {ans.aiExplanation && (
                                                                    <button onClick={() => handleCopyAi(ans)} className="text-[8px] font-black uppercase text-brand-400 hover:text-brand-700">
                                                                        {copiedMap[ans.question.id] ? "Copied" : "Copy"}
                                                                    </button>
                                                                )}
                                                            </div>
                                                            {!ans.aiExplanation ? (
                                                                <button 
                                                                    onClick={() => handleAskAiForAnswer(ans)} 
                                                                    disabled={isAiLoadingMap[ans.question.id]} 
                                                                    className="w-full py-2 border border-dashed border-brand-300 dark:border-brand-700 rounded-lg text-brand-600 font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-brand-100 transition-colors"
                                                                >
                                                                    {isAiLoadingMap[ans.question.id] ? <Loader2 className="animate-spin" size={10} /> : <Sparkles size={10} />}
                                                                    Ask AI Tutor
                                                                </button>
                                                            ) : (
                                                                <div className="space-y-3">
                                                                    <p className="leading-relaxed text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{ans.aiExplanation}</p>
                                                                    {ans.aiGroundingLinks && ans.aiGroundingLinks.length > 0 && (
                                                                        <div className="mt-2 pt-2 border-t border-brand-100 dark:border-brand-900/20">
                                                                            <h5 className="text-[8px] font-black text-brand-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                                                                                <Globe size={8} /> Verified Sources
                                                                            </h5>
                                                                            <div className="flex flex-wrap gap-1">
                                                                                {ans.aiGroundingLinks.map((link, lidx) => (
                                                                                    <a 
                                                                                        key={lidx} 
                                                                                        href={link.uri} 
                                                                                        target="_blank" 
                                                                                        rel="noopener noreferrer"
                                                                                        className="text-[9px] px-1.5 py-0.5 rounded bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 border border-brand-100 dark:border-brand-800 flex items-center gap-1 hover:bg-brand-100"
                                                                                    >
                                                                                        {link.title || "Source"} <ExternalLink size={8} />
                                                                                    </a>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
        <div className="mt-10 text-center"><button onClick={onRestart} aria-label="Start New Session" className="inline-flex items-center gap-3 bg-brand-600 hover:bg-brand-700 text-white font-black py-3.5 px-12 rounded-2xl shadow-xl shadow-brand-600/20 transition-all uppercase tracking-[0.2em] text-sm"><RotateCcw size={18} /> New Practice Session</button></div>
      </div>
    </div>
  );
};
