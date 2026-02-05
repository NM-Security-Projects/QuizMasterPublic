
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
    ArrowRight, ChevronRight, ChevronLeft, ChevronDown, Search, Sparkles, Timer, Flag, X, 
    CheckCircle2, XCircle, AlertTriangle, Shield, ShieldAlert, ShieldCheck, 
    Target, HelpCircle, Maximize2, Minimize2, Image as ImageIcon, ZoomIn,
    RotateCcw, Book, Library, Hash
} from 'lucide-react';
import { Question, UserAnswer, QuizMode, ConfidenceLevel } from '../types';
import { isMatch, isMultiSelect, checkAnswerCorrectness, parseMatchConfiguration, cleanMatchText } from '../utils/questionParser';
import { persistenceService } from '../services/persistenceService';
import { JourneyMetrics } from './JourneyMetrics';

interface QuizInterfaceProps {
    questions: Question[];
    mode: QuizMode;
    allowBackNavigation?: boolean;
    showTimer?: boolean;
    onFinish: (answers: UserAnswer[]) => void;
    onQuit?: () => void;
    userAnswersState: [UserAnswer[], React.Dispatch<React.SetStateAction<UserAnswer[]>>];
    indexState: [number, React.Dispatch<React.SetStateAction<number>>];
    isDevToolsEnabled?: boolean;
    isMarathonMode?: boolean;
    isBookMode?: boolean;
    enableConfidence?: boolean;
}

const confidenceOptions = [
    { val: 'low' as ConfidenceLevel, label: 'Low', icon: Shield, color: 'text-red-500 border-red-200 bg-red-50 dark:bg-red-900/20' },
    { val: 'medium' as ConfidenceLevel, label: 'Medium', icon: ShieldAlert, color: 'text-yellow-500 border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20' },
    { val: 'high' as ConfidenceLevel, label: 'High', icon: ShieldCheck, color: 'text-green-500 border-green-200 bg-green-50 dark:bg-green-900/20' }
];

export const QuizInterface: React.FC<QuizInterfaceProps> = ({
    questions,
    mode,
    allowBackNavigation = true,
    showTimer = true,
    onFinish,
    onQuit,
    userAnswersState,
    indexState,
    isDevToolsEnabled,
    isMarathonMode,
    isBookMode,
    enableConfidence = true
}) => {
    const [userAnswers, setUserAnswers] = userAnswersState;
    const [currentIndex, setCurrentIndex] = indexState;
    const [selectedOption, setSelectedOption] = useState<string | string[] | null>(null);
    const [activeMatchLeft, setActiveMatchLeft] = useState<string | null>(null);
    const [confidence, setConfidence] = useState<ConfidenceLevel | null>(null);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [revealedHints, setRevealedHints] = useState({ h1: false, h2: false, h3: false });
    const [startTime, setStartTime] = useState(Date.now());
    const [elapsed, setElapsed] = useState(0);
    const [eliminatedOptions, setEliminatedOptions] = useState<string[]>([]);
    const [flagReason, setFlagReason] = useState("");
    const [showFlagModal, setShowFlagModal] = useState(false);

    // Jump Dropdown State
    const [isJumpDropdownOpen, setIsJumpDropdownOpen] = useState(false);
    const [jumpSearchTerm, setJumpSearchTerm] = useState("");
    const jumpInputRef = useRef<HTMLInputElement>(null);

    const timerRef = useRef<number | null>(null);
    const currentQuestion = questions[currentIndex];

    // Strictly Parse Reference based on ID (Same logic as sqliteService)
    const bookReference = useMemo(() => {
        const refId = currentQuestion.refId || "";
        const parts = refId.split(/[_\.]+/).filter(Boolean);
        
        if (parts.length >= 3) {
            return {
                book: parts[0],
                chapter: parts[1],
                question: parts.slice(2).join('.')
            };
        }
        
        // Fallbacks if ID structure is not 3-part
        if (parts.length === 2) {
             return { book: parts[0], chapter: "General", question: parts[1] };
        }
        
        let bookName = "Uncategorized";
        if (currentQuestion.sourceFile) {
            bookName = currentQuestion.sourceFile.replace(/\.(db|sqlite|sqlite3)$/i, '');
        }
        
        return {
            book: bookName,
            chapter: currentQuestion.chapter || "All",
            question: parts[0] || "0"
        };
    }, [currentQuestion]);

    // Simple Source Label: Book • Chapter • Q Question
    const sourceLabel = useMemo(() => {
        if (!bookReference) return "";
        return `${bookReference.book} • ${bookReference.chapter} • Q ${bookReference.question}`;
    }, [bookReference]);

    // Restore state if revisiting a question
    useEffect(() => {
        const existing = userAnswers.find(a => a.questionId === currentQuestion.id);
        if (existing) {
            setSelectedOption(existing.selectedOption);
            setConfidence(existing.confidence);
            setEliminatedOptions(existing.eliminatedOptions || []);
            setIsSubmitted(true);
            setRevealedHints({ h1: true, h2: true, h3: true }); // Reveal all on review
        } else {
            setSelectedOption(isMatch(currentQuestion.question_text) ? [] : null);
            setConfidence(null);
            setEliminatedOptions([]);
            setIsSubmitted(false);
            setRevealedHints({ h1: false, h2: false, h3: false });
            setActiveMatchLeft(null);
        }
    }, [currentIndex, currentQuestion, userAnswers]);

    // Timer Logic
    useEffect(() => {
        if (showTimer && !timerRef.current) {
            timerRef.current = window.setInterval(() => {
                setElapsed(Math.floor((Date.now() - startTime) / 1000));
            }, 1000);
        }
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [showTimer, startTime]);

    // Jump Dropdown Effects
    useEffect(() => {
        if (isJumpDropdownOpen && jumpInputRef.current) {
            setTimeout(() => jumpInputRef.current?.focus(), 50);
        }
    }, [isJumpDropdownOpen]);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const handleOptionSelect = (key: string) => {
        if (isSubmitted && mode === 'FULL_VIEW') return;

        if (isMatch(currentQuestion.question_text)) {
             return;
        }

        if (isMultiSelect(currentQuestion)) {
            setSelectedOption(prev => {
                const arr = Array.isArray(prev) ? prev : [];
                return arr.includes(key) ? arr.filter(k => k !== key) : [...arr, key];
            });
        } else {
            setSelectedOption(key);
        }
    };

    // Match Handlers
    const handleMatchLeftClick = (item: string) => {
        if (isSubmitted && mode === 'FULL_VIEW') return;
        setActiveMatchLeft(item);
    };

    const handleMatchRightClick = (choiceKey: string) => {
        if (isSubmitted && mode === 'FULL_VIEW') return;
        if (!activeMatchLeft) return;

        const link = `${activeMatchLeft}||${choiceKey}`;
        setSelectedOption(prev => {
            const arr = Array.isArray(prev) ? prev : [];
            // Remove existing link starting with activeMatchLeft (One-to-One from left perspective)
            const filtered = arr.filter(l => !l.startsWith(`${activeMatchLeft}||`));
            return [...filtered, link];
        });
        setActiveMatchLeft(null);
    };
    
    const handleMatchDisconnect = (link: string) => {
        if (isSubmitted && mode === 'FULL_VIEW') return;
        setSelectedOption(prev => {
            const arr = Array.isArray(prev) ? prev : [];
            return arr.filter(l => l !== link);
        });
    };

    const handleRightClickOption = (e: React.MouseEvent, key: string) => {
        e.preventDefault();
        if (isSubmitted) return;
        setEliminatedOptions(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
    };

    const handleConfidenceChange = (level: ConfidenceLevel) => {
        if (isSubmitted && mode === 'FULL_VIEW') return;
        setConfidence(level);
    };

    const submitAnswer = () => {
        if (!selectedOption) return;
        
        const isCorrect = checkAnswerCorrectness(currentQuestion, selectedOption);
        const answer: UserAnswer = {
            questionId: currentQuestion.id,
            question: currentQuestion,
            selectedOption,
            isCorrect,
            confidence: enableConfidence ? (confidence || 'low') : null, 
            eliminatedOptions,
            isErrorFlagged: false
        };

        setUserAnswers(prev => {
            const filtered = prev.filter(a => a.questionId !== currentQuestion.id);
            return [...filtered, answer];
        });
        
        setIsSubmitted(true);

        if (mode === 'BLIND') {
            setTimeout(handleNext, 150);
        }
    };

    const handleNext = useCallback(() => {
        if (currentIndex < questions.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            onFinish(userAnswers);
        }
    }, [currentIndex, questions.length, onFinish, userAnswers]);

    const handlePrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        }
    };

    const handleJumpTo = (index: number) => {
        setCurrentIndex(index);
        setIsJumpDropdownOpen(false);
        setJumpSearchTerm("");
    };

    const handleSkip = () => {
        const answer: UserAnswer = {
            questionId: currentQuestion.id,
            question: currentQuestion,
            selectedOption: null,
            isCorrect: false,
            confidence: null,
            isSkipped: true
        };
        setUserAnswers(prev => [...prev.filter(a => a.questionId !== currentQuestion.id), answer]);
        handleNext();
    };

    const handleFlagQuestion = async () => {
        if (!flagReason.trim()) return;
        
        const newAnswer: UserAnswer = {
            questionId: currentQuestion.id,
            question: currentQuestion,
            selectedOption: selectedOption || null,
            isCorrect: false, 
            confidence: null,
            isErrorFlagged: true,
            flagReason
        };

        await persistenceService.saveGlobalFlag({
            questionId: currentQuestion.id,
            reason: flagReason,
            timestamp: Date.now()
        });

        setUserAnswers(prev => [...prev.filter(a => a.questionId !== currentQuestion.id), newAnswer]);
        setShowFlagModal(false);
        setFlagReason("");
        handleNext();
    };

    // Filter questions for jump dropdown
    const jumpList = useMemo(() => {
        if (!isJumpDropdownOpen) return [];
        
        let candidates = questions.map((q, i) => ({ q, i }));
        const term = jumpSearchTerm.toLowerCase().trim();

        if (term) {
            candidates = candidates.filter(({ q, i }) => {
                const idxStr = (i + 1).toString();
                const idStr = String(q.id).toLowerCase();
                const bodyStr = q.question_text.toLowerCase();
                return idxStr.startsWith(term) || idStr.includes(term) || bodyStr.includes(term);
            });
        }
        
        return candidates.slice(0, 100); // Limit for performance
    }, [questions, jumpSearchTerm, isJumpDropdownOpen]);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (showFlagModal) return;
            if (isJumpDropdownOpen && e.key === 'Escape') {
                setIsJumpDropdownOpen(false);
                return;
            }
            if (isJumpDropdownOpen) return; // Disable other shortcuts when dropdown is open

            if (e.key === 'ArrowRight' && (isSubmitted || mode === 'BLIND')) handleNext();
            if (e.key === 'ArrowLeft' && allowBackNavigation) handlePrev();
            if (['1','2','3','4','5','6'].includes(e.key) && !isMatch(currentQuestion.question_text)) {
                const keys = Object.keys(currentQuestion.choices).sort(); // Basic sort for 1-6 keys
                const idx = parseInt(e.key) - 1;
                if (keys[idx]) handleOptionSelect(keys[idx]);
            }
            if (e.key === 'Enter' && !isSubmitted && selectedOption) submitAnswer();
            if (e.key === ' ' && isSubmitted) {
                 e.preventDefault();
                 handleNext();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isSubmitted, selectedOption, currentIndex, showFlagModal, isJumpDropdownOpen]);

    const isNoSelection = !selectedOption || (Array.isArray(selectedOption) && selectedOption.length === 0);
    const isNoSelectionDisabled = isNoSelection || (enableConfidence && !confidence);

    const matchConfig = useMemo(() => isMatch(currentQuestion.question_text) ? parseMatchConfiguration(currentQuestion) : null, [currentQuestion]);
    const isMulti = isMultiSelect(currentQuestion);

    const progressPercentage = Math.round(((currentIndex + 1) / questions.length) * 100);

    return (
        <div className="flex flex-col h-full max-w-7xl mx-auto w-full relative">
            {isMarathonMode && <JourneyMetrics answers={userAnswers} />}

            {/* Header */}
            <div className="flex items-center justify-between mb-4 px-2">
                <div className="flex items-center gap-4">
                     <button 
                        onClick={() => onQuit ? onQuit() : onFinish(userAnswers)}
                        aria-label="Quit Session"
                        className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title="Quit Session"
                     >
                        <X size={20} />
                     </button>
                     <div className="flex flex-col relative z-20">
                        <div className="flex items-baseline gap-2">
                            <button
                                onClick={() => isDevToolsEnabled && setIsJumpDropdownOpen(!isJumpDropdownOpen)}
                                disabled={!isDevToolsEnabled}
                                className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-colors ${isDevToolsEnabled ? 'text-slate-600 dark:text-slate-300 hover:text-brand-600 cursor-pointer' : 'text-slate-400 cursor-default'}`}
                            >
                                Question {currentIndex + 1} of {questions.length}
                                {isDevToolsEnabled && <ChevronDown size={12} className={`transition-transform ${isJumpDropdownOpen ? 'rotate-180' : ''}`} />}
                            </button>
                            
                            {/* Book Mode Header Info (Stacked) */}
                            {(isBookMode && sourceLabel) && (
                                <span className="hidden sm:inline-block text-[10px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider truncate max-w-[300px] flex items-center gap-1">
                                    <span className="text-slate-300">•</span> {sourceLabel}
                                </span>
                            )}
                        </div>

                        {/* Dropdown Panel */}
                        {isJumpDropdownOpen && (
                            <>
                                <div className="fixed inset-0 z-30" onClick={() => setIsJumpDropdownOpen(false)} />
                                <div className="absolute top-full left-0 mt-2 w-80 max-h-96 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 z-40 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                    <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                                        <div className="relative">
                                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                ref={jumpInputRef}
                                                type="text"
                                                value={jumpSearchTerm}
                                                onChange={(e) => setJumpSearchTerm(e.target.value)}
                                                placeholder="Search Index, ID, or Text..."
                                                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all placeholder:text-slate-400"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex-grow overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
                                        {jumpList.length > 0 ? (
                                            jumpList.map(({ q, i }) => (
                                                <button
                                                    key={i}
                                                    onClick={() => handleJumpTo(i)}
                                                    className={`w-full text-left px-3 py-2.5 rounded-lg flex flex-col gap-0.5 border border-transparent transition-all ${i === currentIndex ? 'bg-brand-50 dark:bg-brand-900/20 border-brand-100 dark:border-brand-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-100 dark:hover:border-slate-700'}`}
                                                >
                                                    <div className="flex items-center justify-between w-full">
                                                        <span className={`text-[10px] font-black uppercase tracking-wider ${i === currentIndex ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500'}`}>
                                                            Question {i + 1}
                                                        </span>
                                                        <span className="text-[9px] font-mono text-slate-400 opacity-70">
                                                            {String(q.id).split('_').pop()}
                                                        </span>
                                                    </div>
                                                    <div className={`text-xs font-medium truncate w-full ${i === currentIndex ? 'text-slate-800 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>
                                                        {q.question_text.replace(/\[.*?\]/g, '').trim()}
                                                    </div>
                                                </button>
                                            ))
                                        ) : (
                                            <div className="p-4 text-center text-xs text-slate-400 font-medium italic">
                                                No matching questions found.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}

                        <div className="w-32 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mt-1 overflow-hidden">
                            <div className="h-full bg-brand-500 transition-all duration-300" style={{ width: `${progressPercentage}%` }} />
                        </div>
                     </div>
                </div>

                <div className="flex items-center gap-4">
                     {showTimer && (
                         <div aria-label="Time Elapsed" className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-mono text-sm font-bold text-slate-600 dark:text-slate-300">
                             <Timer size={14} /> {formatTime(elapsed)}
                         </div>
                     )}
                     <button 
                        onClick={() => setShowFlagModal(true)}
                        aria-label="Report Question Issue"
                        className="text-slate-300 hover:text-amber-500 transition-colors"
                        title="Report Issue"
                     >
                        <Flag size={18} />
                     </button>
                </div>
            </div>

            <div className="flex-grow grid grid-cols-1 lg:grid-cols-12 gap-6 pb-20 lg:pb-0">
                
                {/* Left Column: Question & Options */}
                <div className="lg:col-span-8 flex flex-col gap-6">
                    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 md:p-10 shadow-2xl border border-slate-200 dark:border-slate-800 min-h-[400px] flex flex-col">
                        
                        {/* Meta Tags */}
                        <div className="flex flex-wrap gap-2 mb-6">
                            {(isBookMode && sourceLabel) && (
                                <span className="px-2 py-1 rounded-md bg-cyan-50 dark:bg-cyan-900/20 text-[9px] font-black uppercase tracking-wider text-cyan-600 dark:text-cyan-400 flex items-center gap-1">
                                    <Book size={10} /> {sourceLabel}
                                </span>
                            )}
                            {isMulti && <span className="px-2 py-1 rounded-md bg-indigo-50 dark:bg-indigo-900/20 text-[9px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Multi-Select</span>}
                            {matchConfig && <span className="px-2 py-1 rounded-md bg-fuchsia-50 dark:bg-fuchsia-900/20 text-[9px] font-black uppercase tracking-wider text-fuchsia-600 dark:text-fuchsia-400">Matching</span>}
                            
                            {isDevToolsEnabled && (
                                <span className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-[9px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1 border border-slate-200 dark:border-slate-700" title="Question ID">
                                    <Hash size={10} /> {String(currentQuestion.id).split('_').pop()}
                                </span>
                            )}
                        </div>

                        {/* Question Area */}
                        <div className="mb-8">
                            {/* Book Mode Reference Card */}
                            {isBookMode && bookReference && (
                                <div className="mb-6 p-6 rounded-2xl bg-cyan-50 dark:bg-cyan-900/10 border-2 border-cyan-100 dark:border-cyan-800/50 flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-300">
                                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-400 mb-3">
                                        <Library size={14} /> Reference Locator
                                    </div>
                                    <h3 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tight mb-2">
                                        {bookReference.book}
                                    </h3>
                                    <div className="flex flex-wrap justify-center gap-3 md:gap-6">
                                        <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-cyan-100 dark:border-cyan-900">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                {bookReference.chapter === 'AS' ? 'Section' : 'Chapter'}
                                            </span>
                                            <span className="text-lg font-black text-slate-700 dark:text-cyan-100">
                                                {bookReference.chapter}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-cyan-100 dark:border-cyan-900">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Question</span>
                                            <span className="text-lg font-black text-slate-700 dark:text-cyan-100">{bookReference.question}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Actual Question Text */}
                            <div className="text-lg md:text-xl font-medium text-slate-800 dark:text-slate-100 leading-relaxed">
                                {currentQuestion.question_text.replace(/\[MATCH\]|\[MULTI\]|\[PIC\]/g, '').trim()}
                            </div>
                        </div>

                        {/* Options Area */}
                        <div className="flex-grow">
                            {matchConfig ? (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4 md:gap-8">
                                        {/* Left Side (Items) */}
                                        <div className="flex flex-col gap-2">
                                            <h4 className="text-[10px] font-black uppercase text-slate-400 mb-1">Items</h4>
                                            {matchConfig.leftItems.map((item, idx) => {
                                                const isActive = activeMatchLeft === item;
                                                const isConnected = (Array.isArray(selectedOption) ? selectedOption : []).some(l => l.startsWith(`${item}||`));
                                                
                                                return (
                                                    <button 
                                                        key={idx}
                                                        onClick={() => handleMatchLeftClick(item)}
                                                        className={`p-3 rounded-xl border-2 text-left transition-all ${isActive ? 'bg-brand-50 border-brand-500 text-brand-700 shadow-md ring-2 ring-brand-200' : isConnected ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-500' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-brand-300'}`}
                                                    >
                                                        <span className="font-bold text-sm">{item}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {/* Right Side (Choices) */}
                                        <div className="flex flex-col gap-2">
                                            <h4 className="text-[10px] font-black uppercase text-slate-400 mb-1">Matches</h4>
                                            {matchConfig.rightChoices.map((key) => {
                                                const text = cleanMatchText(currentQuestion.choices[key]);
                                                const isConnected = (Array.isArray(selectedOption) ? selectedOption : []).some(l => l.endsWith(`||${key}`));
                                                const canConnect = !!activeMatchLeft;

                                                return (
                                                    <div key={key} className="relative flex items-center">
                                                        <button
                                                            onClick={() => handleMatchRightClick(key)}
                                                            disabled={!canConnect}
                                                            className={`w-full p-3 rounded-xl border-2 text-left transition-all ${canConnect ? 'cursor-pointer hover:border-brand-400 hover:shadow-sm' : 'cursor-default'} ${isConnected ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'}`}
                                                        >
                                                            <div className="flex gap-2">
                                                                <span className="text-sm font-medium">{text}</span>
                                                            </div>
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Active Connections Display */}
                                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                                        <h4 className="text-[10px] font-black uppercase text-slate-400 mb-2">Active Connections</h4>
                                        <div className="flex flex-wrap gap-2 min-h-[40px]">
                                            {(Array.isArray(selectedOption) ? selectedOption : []).map(link => {
                                                const [l, r] = link.split('||');
                                                const rightText = cleanMatchText(currentQuestion.choices[r] || r);
                                                
                                                // Determine styling based on submission state
                                                let containerClass = "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-100 dark:border-indigo-800";
                                                let StatusIcon = null;

                                                if (isSubmitted) {
                                                    const isCorrect = matchConfig.correctLinks.has(link);
                                                    if (isCorrect) {
                                                        containerClass = "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800";
                                                        StatusIcon = CheckCircle2;
                                                    } else {
                                                        containerClass = "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800";
                                                        StatusIcon = XCircle;
                                                    }
                                                }

                                                return (
                                                    <span key={link} className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border animate-in zoom-in duration-200 ${containerClass}`}>
                                                        <span className="font-mono bg-white dark:bg-slate-900 px-1.5 rounded border border-transparent dark:border-slate-800 opacity-80 max-w-[150px] truncate" title={l}>{l}</span>
                                                        <ArrowRight size={12} className="opacity-50 shrink-0" />
                                                        <span className="font-mono bg-white dark:bg-slate-900 px-1.5 rounded border border-transparent dark:border-slate-800 opacity-80 max-w-[150px] truncate" title={rightText}>{rightText}</span>
                                                        
                                                        {isSubmitted && StatusIcon && <StatusIcon size={14} className="shrink-0" />}
                                                        
                                                        {!isSubmitted && (
                                                            <button 
                                                                onClick={() => handleMatchDisconnect(link)} 
                                                                className="ml-1 p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10"
                                                                aria-label="Remove connection"
                                                            >
                                                                <X size={12} />
                                                            </button>
                                                        )}
                                                    </span>
                                                );
                                            })}

                                            {/* Show Missed Connections if Submitted */}
                                            {isSubmitted && mode === 'FULL_VIEW' && Array.from(matchConfig.correctLinks).filter(cl => !(Array.isArray(selectedOption) ? selectedOption : []).includes(cl)).map((link: string) => {
                                                 const [l, r] = link.split('||');
                                                 const rightText = cleanMatchText(currentQuestion.choices[r] || r);
                                                 return (
                                                    <span key={link} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-50 dark:bg-green-900/10 text-green-700 dark:text-green-300 text-xs font-bold border border-green-200 dark:border-green-800 border-dashed opacity-60">
                                                        <span className="font-mono bg-white dark:bg-slate-900 px-1.5 rounded border border-transparent dark:border-slate-800 opacity-80 max-w-[150px] truncate" title={l}>{l}</span>
                                                        <ArrowRight size={12} className="opacity-50 shrink-0" />
                                                        <span className="font-mono bg-white dark:bg-slate-900 px-1.5 rounded border border-transparent dark:border-slate-800 opacity-80 max-w-[150px] truncate" title={rightText}>{rightText}</span>
                                                        <span className="text-[9px] uppercase ml-1 font-black shrink-0">(Missed)</span>
                                                    </span>
                                                 );
                                            })}

                                            {(Array.isArray(selectedOption) ? selectedOption : []).length === 0 && !isSubmitted && <span className="text-xs text-slate-400 italic py-1.5">Select an item on the left, then a match on the right.</span>}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {Object.entries(currentQuestion.choices)
                                        .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: 'base' }))
                                        .map(([key, text]) => {
                                        // Update selection check for Multi-Select
                                        const isSelected = isMulti ? (selectedOption as string[])?.includes(key) : selectedOption === key;
                                        const isEliminated = eliminatedOptions.includes(key);
                                        
                                        // Updated correctness check
                                        const correctStr = (currentQuestion.correct_answer || "").trim().toUpperCase();
                                        let isActualCorrect = false;
                                        if (isSubmitted) {
                                            if (isMulti) {
                                                if (correctStr.includes(',')) {
                                                    const correctSet = new Set(correctStr.split(',').map(s => s.trim().replace(/['"]/g, '')));
                                                    isActualCorrect = correctSet.has(key);
                                                } else {
                                                    // Fallback for concatenated strings like "AC"
                                                    isActualCorrect = correctStr.includes(key);
                                                }
                                            } else {
                                                isActualCorrect = currentQuestion.correct_answer === key;
                                            }
                                        }

                                        const isWrongSelection = isSubmitted && isSelected && !isActualCorrect;
                                        const isMissed = isSubmitted && !isSelected && isActualCorrect;

                                        let containerClass = "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:border-brand-300 dark:hover:border-brand-700";
                                        if (isEliminated) containerClass = "opacity-40 grayscale border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900";
                                        else if (isWrongSelection) containerClass = "border-red-500 bg-red-50 dark:bg-red-900/20";
                                        else if (isMissed) containerClass = "border-green-500 bg-green-50 dark:bg-green-900/20 border-dashed";
                                        else if (isActualCorrect) containerClass = "border-green-500 bg-green-50 dark:bg-green-900/20";
                                        else if (isSelected) containerClass = "border-brand-500 bg-brand-50 dark:bg-brand-900/20 shadow-md transform scale-[1.01]";

                                        return (
                                            <div 
                                                key={key}
                                                onClick={() => !isEliminated && handleOptionSelect(key)}
                                                onContextMenu={(e) => handleRightClickOption(e, key)}
                                                className={`relative group p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-4 ${containerClass}`}
                                            >
                                                <div className={`flex items-center justify-center w-8 h-8 rounded-lg text-sm font-black uppercase transition-colors shrink-0 ${isSelected || isActualCorrect ? (isWrongSelection ? 'bg-red-500 text-white' : 'bg-brand-600 text-white') : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                                    {isActualCorrect ? <CheckCircle2 size={18} /> : (isWrongSelection ? <XCircle size={18} /> : key)}
                                                </div>
                                                <div className={`flex-grow text-sm font-medium ${isEliminated ? 'line-through decoration-slate-400' : 'text-slate-700 dark:text-slate-200'}`}>
                                                    {text}
                                                </div>
                                                {isSubmitted && mode === 'FULL_VIEW' && (isActualCorrect || isWrongSelection) && (
                                                    <div className={`text-[10px] font-black uppercase px-2 py-1 rounded ${isActualCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                        {isActualCorrect ? "Correct" : "Incorrect"}
                                                    </div>
                                                )}
                                                {/* Multi-Select Indicator */}
                                                {!isSubmitted && isMulti && (
                                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${isSelected ? 'bg-brand-600 border-brand-600' : 'border-slate-300 dark:border-slate-600'}`}>
                                                        {isSelected && <CheckCircle2 size={12} className="text-white" />}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Explanation Area */}
                        {isSubmitted && mode === 'FULL_VIEW' && (
                            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-bottom-2">
                                <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 mb-3">
                                    <Sparkles size={14} className="text-brand-500" /> Explanation
                                </h4>
                                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                                    {currentQuestion.explanation || "No explanation provided for this question."}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Navigation Footer */}
                    <div className="flex items-center justify-between">
                        {allowBackNavigation ? (
                            <button 
                                onClick={handlePrev} 
                                disabled={currentIndex === 0}
                                className="px-6 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-widest text-xs hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-all flex items-center gap-2"
                            >
                                <ChevronLeft size={16} /> Previous
                            </button>
                        ) : <div />}
                    </div>
                </div>

                {/* Right Column: Sidebar */}
                <div className="lg:col-span-4 flex flex-col gap-4">
                    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-4 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col gap-4 sticky top-4">
                        <div className="space-y-3">
                            {enableConfidence && (
                                <div className="grid grid-cols-3 gap-2">
                                    {confidenceOptions.map(opt => {
                                        const Icon = opt.icon;
                                        const isSel = confidence === opt.val;
                                        return (
                                            <button 
                                                key={opt.val} 
                                                onClick={() => handleConfidenceChange(opt.val)} 
                                                className={`flex flex-col items-center gap-1.5 p-2 rounded-2xl border-2 transition-all ${isSel ? opt.color + ' border-current scale-[1.05] shadow-md z-10' : 'bg-slate-50 dark:bg-slate-800/50 border-transparent text-slate-400 hover:border-slate-200'}`}
                                            >
                                                <Icon size={20} />
                                                <span className="text-[9px] font-black uppercase tracking-tight">{opt.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                            
                            {/* Visual cue for required confidence */}
                            {!isSubmitted && enableConfidence && !confidence && !isNoSelection && (
                                <div className="text-center text-[9px] font-bold text-red-500 animate-pulse uppercase tracking-wide">
                                    Rate your confidence to submit
                                </div>
                            )}
                        </div>

                        <div className="space-y-3 pt-3 border-t dark:border-slate-800">
                            {!isSubmitted ? (
                                <>
                                    <button onClick={submitAnswer} disabled={isNoSelectionDisabled} className={`w-full py-3 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl transition-all flex items-center justify-center gap-3 ${isNoSelectionDisabled ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed' : 'bg-brand-600 hover:bg-brand-700 text-white shadow-brand-500/30'}`}>
                                        Commit Selection <ArrowRight size={16} />
                                    </button>
                                    <button onClick={handleSkip} className="w-full py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-slate-600">Skip to Next</button>
                                </>
                            ) : (
                                <button onClick={handleNext} className="w-full py-3 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-black text-xs uppercase tracking-[0.2em] shadow-xl transition-all flex items-center justify-center gap-3">
                                    {currentIndex === questions.length - 1 ? "Finish Session" : `Proceed to Question ${currentIndex + 2}`} <ChevronRight size={16} />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="bg-slate-900 rounded-[2rem] p-4 shadow-2xl border border-slate-700 flex flex-col gap-3">
                        <div className="flex items-center gap-2 text-brand-400 border-b border-slate-800 pb-2">
                            <Sparkles size={16} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Contextual Hints</span>
                        </div>
                        <div className="space-y-2">
                            {[
                                { level: '1', label: 'Domain', value: currentQuestion.domain, key: 'h1' },
                                { level: '2', label: 'Sub-Domain', value: currentQuestion.subDomain, key: 'h2' },
                                { level: '3', label: 'Topic', value: currentQuestion.topic, key: 'h3' },
                            ].map(hint => (
                                <div key={hint.key}>
                                    {!revealedHints[hint.key as keyof typeof revealedHints] ? (
                                        <button onClick={() => setRevealedHints(prev => ({...prev, [hint.key]: true}))} className="w-full py-2 rounded-xl bg-slate-800/50 border border-slate-700 text-slate-500 text-[9px] font-black uppercase hover:text-brand-400 transition-all">Reveal Level {hint.level} Clue</button>
                                    ) : (
                                        <div className="p-2 rounded-xl bg-slate-800 border border-slate-700 animate-in fade-in">
                                            <span className="block text-[8px] font-black text-slate-500 uppercase mb-1">{hint.label}</span>
                                            <span className="text-[11px] font-bold text-slate-300">{hint.value || "General Knowledge"}</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Flag Modal */}
            {showFlagModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-3 mb-4 text-amber-500">
                            <Flag size={24} />
                            <h3 className="text-lg font-black uppercase tracking-tight text-slate-800 dark:text-white">Report Question Issue</h3>
                        </div>
                        <textarea 
                            value={flagReason}
                            onChange={(e) => setFlagReason(e.target.value)}
                            placeholder="Describe the error (e.g., wrong answer key, typo, outdated info)..."
                            className="w-full h-32 p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 focus:border-brand-500 outline-none resize-none text-sm mb-4"
                        />
                        <div className="flex gap-3">
                            <button onClick={() => setShowFlagModal(false)} className="flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">Cancel</button>
                            <button onClick={handleFlagQuestion} className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20">Submit Report</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
