
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Settings, BookOpen, GraduationCap, Timer, Play, ListFilter, SlidersHorizontal, Navigation, Dice5, Target, AlertTriangle, Brain, UserCheck, Beaker, Info, CheckSquare, ShieldAlert, PieChart, Puzzle, ListChecks, Image, Trophy, Medal, RotateCcw, Save, ImageOff, Library, FileText, Trash2, Clock, Eye, EyeOff, Upload, Database, Loader2, AlertCircle, RefreshCcw, Check, Plus, CheckCircle, CloudDownload, Server, X, ArrowRight, ShieldCheck, Shield, Lock, Unlock } from 'lucide-react';
import { QuizConfig, DomainStat, ReviewFilter, SimMode, QuestionTypeFilter, SaveSlot, IntegrityReport, LibraryItem } from '../types';
import { getAvailableQuestionCount, getDomainStats, getBooksAndChapters, BookStructure, getQuestions, initDatabase, processAndMergeDatabases } from '../services/sqliteService';
import { persistenceService } from '../services/persistenceService';

interface ConfigFormProps {
  totalQuestionsAvailable: number;
  onStart: (config: QuizConfig) => void;
  onSimulate: (config: QuizConfig, mode: SimMode) => void;
  onStartMarathon: (isBookMode: boolean, enableConfidence: boolean) => void;
  domainStats?: DomainStat[]; 
  isDevToolsEnabled?: boolean;
  saveSlots: SaveSlot[];
  onLoadSlot: (id: number) => void;
  onClearSlot: (id: number) => void;
  activeTabState: [string, React.Dispatch<React.SetStateAction<'practice' | 'book'>>];
  isOBEMode: boolean;
  onUploadSuccess: (totalQuestions: number, bytes: Uint8Array, integrity: IntegrityReport, fileName: string) => void;
  onOBEModeSelect?: () => void;
  onDbUpdate?: (count: number) => void;
  startupError?: string | null;
}

interface RemoteSource {
    id: string;
    name: string;
    filename: string;
    desc?: string;
    description?: string;
}

const SECONDS_PER_QUESTION = 72;

const formatTime = (minutes: number) => {
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
};

const formatDate = (ts: number) => {
    return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// Passthrough raw values as requested
const getBookLabel = (code: string) => code;

// Passthrough raw values as requested
const getChapterLabel = (code: string) => code;

const Tooltip = ({ text, children, align = 'center' }: { text: string, children?: React.ReactNode, align?: 'left' | 'right' | 'center' }) => {
  const alignClass = {
    left: 'left-0 translate-x-0',
    right: 'right-0 translate-x-0',
    center: 'left-1/2 -translate-x-1/2'
  }[align];

  return (
    <div className="group relative flex items-center w-full h-full">
      {children}
      <div className={`absolute bottom-full mb-2 ${alignClass} hidden group-hover:flex flex-col items-center z-[100] pointer-events-none transition-all duration-200 w-48`}>
        <div className="bg-slate-900 dark:bg-slate-800 text-white text-[10px] font-bold py-2 px-3 rounded-lg shadow-2xl border border-slate-700/50 leading-tight text-center">
          {text}
        </div>
        <div className="w-2 h-2 bg-slate-900 dark:bg-slate-800 rotate-45 -mt-1 border-r border-b border-slate-700/50" />
      </div>
    </div>
  );
};

export const ConfigForm: React.FC<ConfigFormProps> = ({ 
    totalQuestionsAvailable, onStart, onSimulate, onStartMarathon, 
    domainStats, isDevToolsEnabled = false, saveSlots, onLoadSlot, onClearSlot, activeTabState,
    isOBEMode, onUploadSuccess, onOBEModeSelect, onDbUpdate, startupError
}) => {
  const [activeTab, setActiveTab] = activeTabState;
  const [count, setCount] = useState<number>(totalQuestionsAvailable);
  const [userManualCount, setUserManualCount] = useState(false); 
  const [mode, setMode] = useState<'BLIND' | 'FULL_VIEW'>('FULL_VIEW');
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [allowBackNavigation, setAllowBackNavigation] = useState<boolean>(true);
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all'); 
  const [questionType, setQuestionType] = useState<QuestionTypeFilter>('all');
  const [showTimer, setShowTimer] = useState<boolean>(true);
  const [excludeImages, setExcludeImages] = useState<boolean>(false);
  const [enableConfidence, setEnableConfidence] = useState<boolean>(true);
  
  // Book Companion Mode State (New Library Architecture)
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [availableBooks, setAvailableBooks] = useState<BookStructure[]>([]);
  const [selectedBooks, setSelectedBooks] = useState<string[]>([]);
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]); 
  const [bookAvailableCount, setBookAvailableCount] = useState<number>(0);
  const [isMerging, setIsMerging] = useState(false);
  const [loadingSourceId, setLoadingSourceId] = useState<string | null>(null);
  const [importCount, setImportCount] = useState<number | null>(null);
  
  // Dynamic Manifest State
  const [remoteSources, setRemoteSources] = useState<RemoteSource[]>([]);
  const [isFetchingManifest, setIsFetchingManifest] = useState(false);
  const [manifestError, setManifestError] = useState<string | null>(null);
  const [manifestBasePath, setManifestBasePath] = useState<string>('OBE');

  // Inline Uploader State
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialized flag for domain selection
  const [hasInitializedDomains, setHasInitializedDomains] = useState(false);
  const [showResumeToast, setShowResumeToast] = useState(true);

  // No smart filtering - show all domains from stats
  const visibleDomainStats = useMemo(() => {
      return getDomainStats(reviewFilter);
  }, [reviewFilter, totalQuestionsAvailable]);

  // Determine latest slot for Toast
  const latestSlot = useMemo(() => {
      const activeSlots = saveSlots.filter(s => !s.isEmpty);
      if (activeSlots.length === 0) return null;
      return activeSlots.sort((a,b) => (b.timestamp || 0) - (a.timestamp || 0))[0];
  }, [saveSlots]);

  // Initial Library Load
  useEffect(() => {
      const loadLibrary = async () => {
          const items = await persistenceService.getLibrary();
          setLibrary(items);
      };
      loadLibrary();
  }, []);

  const fetchManifest = async () => {
      setIsFetchingManifest(true);
      setManifestError(null);
      
      const attempts = [
          { path: './OBE/manifest.json', base: './OBE' },
          { path: 'OBE/manifest.json', base: 'OBE' },
          { path: '/OBE/manifest.json', base: '/OBE' },
          { path: 'public/OBE/manifest.json', base: 'public/OBE' },
          { path: './obe/manifest.json', base: './obe' }
      ];

      for (const attempt of attempts) {
          try {
              let response = await fetch(attempt.path);
              if (!response.ok) {
                  response = await fetch(`${attempt.path}?t=${Date.now()}`);
              }
              if (response.ok) {
                  const contentType = response.headers.get("content-type");
                  if (contentType && contentType.includes("text/html")) continue; 
                  
                  const data = await response.json();
                  const validSources = Array.isArray(data) ? data.filter((s: any) => !s.id.startsWith('_')) : [];
                  setRemoteSources(validSources);
                  setManifestBasePath(attempt.base);
                  setIsFetchingManifest(false);
                  return; 
              }
          } catch (e) { }
      }
      setManifestError("Could not locate manifest.json. Ensure 'OBE' folder exists in public directory.");
      setIsFetchingManifest(false);
  };

  useEffect(() => {
      if (activeTab === 'book' && remoteSources.length === 0) {
          fetchManifest();
      }
  }, [activeTab]);

  useEffect(() => {
      const syncDatabase = async () => {
          if (activeTab === 'book' && selectedSourceIds.length === 0) {
              setAvailableBooks([]);
              setSelectedBooks([]);
              setSelectedChapters([]);
              setBookAvailableCount(0);
              setImportCount(null);
              if (onDbUpdate) onDbUpdate(0);
              return;
          }

          setIsMerging(true);
          setImportCount(null);
          
          try {
              if (activeTab === 'book') {
                  const sourcesToMerge = [];
                  for (const id of selectedSourceIds) {
                      const item = library.find(i => i.id === id);
                      if (item) {
                          const bytes = await persistenceService.getLibraryItemData(id);
                          if (bytes) sourcesToMerge.push({ id, name: item.name, bytes });
                      }
                  }
                  
                  if (sourcesToMerge.length > 0) {
                      const totalImported = await processAndMergeDatabases(sourcesToMerge);
                      setImportCount(totalImported);
                      if (onDbUpdate) onDbUpdate(totalImported);

                      const newBooks = getBooksAndChapters();
                      setAvailableBooks(newBooks);
                      
                      if (newBooks.length > 0) {
                          setSelectedBooks(prev => prev.length === 0 ? [newBooks[0].book] : prev);
                      }
                  } else {
                      if (onDbUpdate) onDbUpdate(0);
                  }
              } else {
                  const userBytes = await persistenceService.getDatabaseBytes();
                  if (userBytes) {
                      const totalImported = await processAndMergeDatabases([{ id: 'user_upload', name: 'User Database', bytes: userBytes }]);
                      setImportCount(totalImported);
                      if (onDbUpdate) onDbUpdate(totalImported);
                      
                      setAvailableBooks([]);
                      setSelectedBooks([]);
                      setSelectedChapters([]);
                  } else {
                      if (onDbUpdate) onDbUpdate(0);
                  }
              }
          } catch (e) {
              console.error("Database Sync Failed", e);
          } finally {
              setIsMerging(false);
          }
      };
      
      const t = setTimeout(syncDatabase, 50);
      return () => clearTimeout(t);
  }, [selectedSourceIds, library, activeTab]);

  useEffect(() => {
      if (activeTab === 'book' && selectedSourceIds.length > 0 && selectedBooks.length > 0) {
          if (selectedChapters.length > 0) {
              const qs = getQuestions(9999, undefined, undefined, undefined, questionType, false, undefined, undefined, false, selectedBooks, selectedChapters);
              setBookAvailableCount(qs.length);
          } else {
              setBookAvailableCount(0);
          }
      } else {
          setBookAvailableCount(0);
      }
  }, [selectedSourceIds, selectedBooks, selectedChapters, activeTab, questionType]);

  const rawAvailable = useMemo(() => {
    if (selectedDomains.length === 0) return 0;
    return getAvailableQuestionCount(selectedDomains, reviewFilter, questionType, excludeImages);
  }, [selectedDomains, reviewFilter, questionType, excludeImages]);

  const uniqueMax = useMemo(() => {
    return rawAvailable;
  }, [rawAvailable]);
  
  const presets = [
    { q: 5 }, { q: 10 }, { q: 15 }, { q: 20 },
    { q: 25 }, { q: 30 }, { q: 45 }, { q: 50 },
    { q: 60 }, { q: 100, label: "Exam Min" }, { q: 150, label: "Exam Max" },
    { q: uniqueMax, label: "Max Avail", isCrazy: true },
  ];

  useEffect(() => {
    if (!hasInitializedDomains && visibleDomainStats.length > 0) {
        setSelectedDomains(visibleDomainStats.map(d => d.name));
        setHasInitializedDomains(true);
    }
  }, [visibleDomainStats, hasInitializedDomains]);

  const minQuestions = uniqueMax > 0 ? 1 : 0;
  
  useEffect(() => {
     if (!userManualCount) {
         if (uniqueMax > 0 && count !== uniqueMax) setCount(uniqueMax);
         else if (uniqueMax === 0) setCount(0);
     } else {
         if (count > uniqueMax) setCount(uniqueMax > 0 ? uniqueMax : 0);
         else if (count < minQuestions && uniqueMax > 0) setCount(minQuestions);
     }
  }, [uniqueMax, minQuestions, count, userManualCount]);

  const handleSetCount = (val: number) => {
      setCount(val);
      setUserManualCount(true);
  };

  const toggleDomain = (name: string) => setSelectedDomains(prev => prev.includes(name) ? prev.filter(d => d !== name) : [...prev, name]);
  
  const toggleAll = () => {
      const allVisible = visibleDomainStats.map(d => d.name);
      const isAllSelected = allVisible.every(d => selectedDomains.includes(d));
      if (isAllSelected) setSelectedDomains([]);
      else setSelectedDomains(allVisible);
  };

  const getCurrentConfig = (): QuizConfig => ({ 
      questionCount: count, 
      mode, 
      selectedDomains, 
      allowBackNavigation, 
      reviewFilter, 
      questionType,
      showTimer,
      excludeImages,
      enableConfidence
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'book') {
        if (selectedBooks.length === 0 || selectedChapters.length === 0) {
            alert("Please select at least one Book and one Chapter/Section.");
            return;
        }
        onStart({
            questionCount: bookAvailableCount,
            mode: 'FULL_VIEW', 
            allowBackNavigation: true,
            books: selectedBooks,
            chapters: selectedChapters,
            sourceIds: selectedSourceIds,
            showTimer: true,
            questionType: questionType,
            enableConfidence
        });
        return;
    }

    if (selectedDomains.length === 0) {
        alert("Select at least one focus objective.");
        return;
    }
    if (count === 0) {
        alert("No questions available for the selected criteria.");
        return;
    }
    onStart(getCurrentConfig());
  };

  const handleSimPersonaClick = (simId: SimMode) => {
    if (activeTab === 'book') {
        if (selectedBooks.length === 0 || selectedChapters.length === 0) {
            alert("Please select books and chapters to simulate.");
            return;
        }
        const bookConfig: QuizConfig = {
            questionCount: bookAvailableCount,
            mode: 'FULL_VIEW',
            books: selectedBooks,
            chapters: selectedChapters,
            sourceIds: selectedSourceIds,
            showTimer: true,
            questionType: questionType,
            enableConfidence
        };
        onSimulate(bookConfig, simId);
        return;
    }

    if (selectedDomains.length === 0) {
        alert("Select focus objectives for simulation.");
        return;
    }
    
    const maxConfig: QuizConfig = {
      ...getCurrentConfig(),
      questionCount: uniqueMax
    };

    onSimulate(maxConfig, simId);
  };

  const handleToggleRemoteSource = async (source: RemoteSource) => {
      if (loadingSourceId === source.id) return;

      const existing = library.find(item => item.name === source.name);
      
      if (existing) {
          setSelectedSourceIds(prev => prev.includes(existing.id) ? prev.filter(x => x !== existing.id) : [...prev, existing.id]);
      } else {
          setLoadingSourceId(source.id);
          try {
              let path = `${manifestBasePath}/${source.filename}`;
              let response = await fetch(path);
              const contentType = response.headers.get("content-type");
              if (!response.ok) {
                  throw new Error(`Server returned ${response.status} ${response.statusText}`);
              }
              if (contentType && contentType.includes("text/html")) {
                  throw new Error(`Invalid file content (HTML returned instead of DB binary). Check path.`);
              }

              const buffer = await response.arrayBuffer();
              if (!buffer || buffer.byteLength === 0) throw new Error("Downloaded file is empty");

              const bytes = new Uint8Array(buffer);
              const file = new File([bytes], source.name, { type: 'application/x-sqlite3' });
              const newItem = await persistenceService.addToLibrary(file, bytes);
              
              setLibrary(prev => [...prev, newItem]);
              setSelectedSourceIds(prev => [...prev, newItem.id]);
          } catch (e: any) {
              console.error(`Could not load ${source.filename}`, e);
              alert(`Failed to load database: ${source.filename}\n\nReason: ${e.message}\n\nPlease verify that '${source.filename}' exists in the '${manifestBasePath}' folder of your server.`);
          } finally {
              setLoadingSourceId(null);
          }
      }
  };

  const handleToggleBook = (book: string) => {
      setSelectedBooks(prev => {
          const newState = prev.includes(book) ? prev.filter(x => x !== book) : [...prev, book];
          return newState;
      });
  };

  const handleToggleChapter = (chap: string) => {
      if (chap === 'All') {
          setSelectedChapters(prev => prev.includes('All') ? [] : ['All']);
          return;
      }
      setSelectedChapters(prev => {
          if (prev.includes('All')) {
              const allVisibleChapters = new Set<string>();
              availableBooks.forEach(b => {
                  if (selectedBooks.includes(b.book)) {
                      b.chapters.forEach(c => {
                          if (c !== 'All') allVisibleChapters.add(c);
                      });
                  }
              });
              allVisibleChapters.delete(chap);
              return Array.from(allVisibleChapters);
          }

          let next = prev.filter(c => c !== 'All');
          if (next.includes(chap)) next = next.filter(c => c !== chap);
          else next = [...next, chap];
          return next;
      });
  };

  const processFile = async (file: File) => {
    setIsLoading(true);
    setError(null);
    try {
      const { bytes, integrity } = await initDatabase(file);
      const count = integrity.totalRows;
      if (count === 0) throw new Error(`Database is empty (0 rows found).`);
      await onUploadSuccess(count, bytes, integrity, file.name);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Invalid SQLite file.");
    } finally {
      setIsLoading(false);
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files?.[0]) processFile(files[0]);
  }, []);

  const renderPreset = (p: any, idx: number) => {
    const isSelected = count === p.q;
    const isDisabled = p.q > uniqueMax || p.q === 0;
    const estimatedMinutes = (p.q * SECONDS_PER_QUESTION) / 60;

    return (
        <button key={idx} type="button" disabled={isDisabled} onClick={() => handleSetCount(p.q)} className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl border-2 transition-all active:scale-95 min-h-[42px] ${isSelected ? 'bg-brand-600 border-brand-500 text-white shadow-lg scale-105 z-10' : isDisabled ? 'bg-slate-50 dark:bg-slate-900/40 border-slate-100 dark:border-slate-800 opacity-30 grayscale' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-brand-300 hover:bg-brand-50 dark:hover:bg-brand-900/20'}`}>
            <span className="text-[11px] font-black uppercase tracking-tight leading-none mb-0.5 text-center">{p.label ? p.label : `${p.q} Questions`}</span>
            <span className={`text-[9px] font-bold ${isSelected ? 'text-brand-100' : 'text-slate-400 dark:text-slate-500'}`}>~ {formatTime(estimatedMinutes)}</span>
        </button>
    );
  };

  // ... (rest of the file content unchanged) ...
  const personas = [
    { id: 'RANDOM', label: 'Random Noise', icon: Dice5, desc: '1/N Accuracy, Mixed Confidence' },
    { id: 'PERFECT', label: 'Perfect Score', icon: Target, desc: '100% Accuracy & Confidence' },
    { id: 'OVERCONFIDENT', label: 'Overconfident', icon: AlertTriangle, desc: 'Wrong but certain (25% Acc)' },
    { id: 'IMPOSTER', label: 'The Imposter', icon: Brain, desc: 'Right but unsure (92% Acc)' },
    { id: 'SPECIALIST', label: 'Specialist', icon: UserCheck, desc: 'Domain Expert (95% Acc)' },
    { id: 'SEVEN_EIGHTHS', label: '7/8ths Master', icon: PieChart, desc: 'Generalist with 1 gap' },
  ];

  const relevantSlots = saveSlots.filter(slot => {
      if (slot.isEmpty) return false;
      const isBookSession = slot.config?.book || (slot.config?.books && slot.config.books.length > 0) || slot.config?.marathonBookMode;
      if (activeTab === 'book') return isBookSession;
      if (activeTab === 'practice') return !isBookSession;
      return false;
  });

  const renderSaveSlots = () => {
      if (relevantSlots.length === 0) return null;
      return (
          <div className="mt-8 border-t border-slate-100 dark:border-slate-800 pt-6 animate-in fade-in slide-in-from-bottom-2" id="save-slots-section">
              <div className="flex items-center gap-2 mb-4 px-1">
                  <Save size={16} className="text-slate-400" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Resumable Sessions</span>
              </div>
              <div className="grid grid-cols-1 gap-3">
                  {relevantSlots.map(slot => (
                      <div key={slot.id} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between group hover:border-brand-300 dark:hover:border-brand-800 transition-colors">
                          <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center font-black text-slate-400 text-sm shadow-sm">
                                  {slot.id}
                              </div>
                              <div>
                                  <div className="flex items-center gap-2 mb-1">
                                      <span className="text-xs font-bold text-slate-800 dark:text-white">{slot.label}</span>
                                      {slot.config?.marathonBookMode && (
                                          <span className="text-[8px] font-black uppercase tracking-wider text-cyan-600 bg-cyan-50 dark:bg-cyan-900/30 px-1.5 py-0.5 rounded border border-cyan-100 dark:border-cyan-800">Book Mode</span>
                                      )}
                                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-100 dark:border-slate-700">{formatDate(slot.timestamp || 0)}</span>
                                  </div>
                                  <div className="flex items-center gap-3 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                                      <span className="flex items-center gap-1"><CheckSquare size={10} /> {slot.details}</span>
                                      {slot.progress && (
                                          <span className="flex items-center gap-1"><Clock size={10} /> {Math.round((slot.progress.current / slot.progress.total) * 100)}% Complete</span>
                                      )}
                                  </div>
                              </div>
                          </div>
                          <div className="flex items-center gap-2">
                              <button type="button" onClick={() => onLoadSlot(slot.id)} aria-label={`Resume session ${slot.id}`} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-brand-600/20 transition-all flex items-center gap-2"><Play size={10} fill="currentColor" /> Resume</button>
                              <button type="button" onClick={() => { if(confirm("Delete this save?")) onClearSlot(slot.id); }} aria-label="Delete Saved Session" className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"><Trash2 size={14} /></button>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      );
  };

  const isPracticeEmptyState = totalQuestionsAvailable === 0 || isOBEMode;

  return (
    <div className={`relative max-w-6xl mx-auto w-full flex flex-col items-center lg:items-start lg:flex-row gap-6 ${!isDevToolsEnabled ? 'justify-center' : ''}`}>
      {latestSlot && showResumeToast && (
          <div className="fixed bottom-6 right-6 z-[60] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-brand-200 dark:border-brand-900 p-4 max-w-sm w-full animate-in slide-in-from-bottom-10 fade-in duration-500 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 text-brand-600 dark:text-brand-400">
                      <Save size={18} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Saved Session Available</span>
                  </div>
                  <button onClick={() => setShowResumeToast(false)} aria-label="Close Notification" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"><X size={14} /></button>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800/50">
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">{latestSlot.label}</p>
                  <div className="flex items-center justify-between text-[9px] text-slate-500 dark:text-slate-400">
                      <span>{latestSlot.details}</span>
                      <span>{formatDate(latestSlot.timestamp || 0)}</span>
                  </div>
              </div>
              <button 
                  onClick={() => onLoadSlot(latestSlot.id)} 
                  className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-brand-600/20 flex items-center justify-center gap-2 transition-all"
              >
                  Resume Last Session <ArrowRight size={12} />
              </button>
          </div>
      )}

      <div className={`flex-grow ${isDevToolsEnabled ? 'max-w-4xl' : 'max-w-5xl'} w-full bg-white dark:bg-slate-950 rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 transition-all z-10 mx-auto overflow-hidden`}>
        <div className="flex border-b border-slate-100 dark:border-slate-800">
            <button 
                onClick={() => setActiveTab('practice')}
                className={`flex-1 py-4 text-xs font-black uppercase tracking-[0.2em] transition-colors ${activeTab === 'practice' ? 'bg-white dark:bg-slate-950 text-brand-600 border-b-2 border-brand-500' : 'bg-slate-50 dark:bg-slate-900/50 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900'}`}
            >
                Bring Your Own Database
            </button>
            <button 
                onClick={() => setActiveTab('book')}
                className={`flex-1 py-4 text-xs font-black uppercase tracking-[0.2em] transition-colors ${activeTab === 'book' ? 'bg-white dark:bg-slate-950 text-cyan-600 border-b-2 border-cyan-500' : 'bg-slate-50 dark:bg-slate-900/50 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900'}`}
            >
                Book Companion
            </button>
        </div>

        {activeTab === 'book' && (
             <div className="p-4 md:p-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 rounded-xl"><Settings size={22} /></div>
                            <div>
                                <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight leading-none">Session Configuration</h2>
                                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-widest">{totalQuestionsAvailable} Total &bull; <span className="text-cyan-600 dark:text-cyan-400">{bookAvailableCount} Filtered</span></p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                            <label className="text-[10px] font-black text-slate-500 dark:text-slate-300 uppercase tracking-[0.2em] flex items-center gap-2">
                                1. Data Repositories
                                <button type="button" onClick={fetchManifest} aria-label="Refresh Repository List" className="text-cyan-600 hover:text-cyan-700 active:scale-95 transition-transform" title="Refresh List">
                                    <RefreshCcw size={12} className={isFetchingManifest ? "animate-spin" : ""} />
                                </button>
                            </label>
                            {isFetchingManifest && <span className="text-[9px] text-slate-400 animate-pulse flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Updating Catalog...</span>}
                        </div>
                        
                        {manifestError ? (
                            <div className="p-4 rounded-xl border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs flex flex-col items-center gap-2">
                                <AlertCircle size={20} />
                                <span className="font-bold">Failed to load manifest.json</span>
                                <span className="text-[10px] font-mono">{manifestError}</span>
                                <button type="button" onClick={fetchManifest} className="mt-2 px-3 py-1.5 bg-white dark:bg-slate-900 rounded-lg shadow-sm font-bold text-[10px] hover:bg-slate-50 transition-colors uppercase tracking-wider">Retry</button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {remoteSources.length === 0 && !isFetchingManifest && (
                                    <div className="col-span-2 p-4 text-center text-xs text-slate-400 italic border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                                        No repositories found in manifest.json
                                    </div>
                                )}
                                {remoteSources.map(source => {
                                    const libraryEntry = library.find(item => item.name === source.name);
                                    const isLoaded = !!libraryEntry;
                                    const isSelected = libraryEntry ? selectedSourceIds.includes(libraryEntry.id) : false;
                                    const isLoadingSource = loadingSourceId === source.id;

                                    return (
                                        <button 
                                            type="button"
                                            key={source.id}
                                            onClick={() => handleToggleRemoteSource(source)}
                                            className={`flex items-start gap-4 p-4 rounded-xl border-2 transition-all text-left group ${isSelected ? 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-500 shadow-md' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-cyan-300'}`}
                                            disabled={isLoadingSource}
                                        >
                                            <div className={`p-2 rounded-lg ${isSelected ? 'bg-cyan-100 dark:bg-cyan-800 text-cyan-700' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                                                {isLoadingSource ? <Loader2 size={18} className="animate-spin" /> : (isLoaded ? <Server size={18} /> : <CloudDownload size={18} />)}
                                            </div>
                                            <div className="min-w-0 flex-grow">
                                                <div className={`text-xs font-bold mb-0.5 ${isSelected ? 'text-cyan-900 dark:text-cyan-100' : 'text-slate-700 dark:text-slate-200'}`}>{source.name}</div>
                                                <div className="text-[10px] opacity-70 leading-tight">{source.desc || source.description}</div>
                                                {isLoadingSource && (
                                                    <div className="mt-2 text-[9px] font-black uppercase tracking-widest flex items-center gap-1 text-cyan-500">
                                                        Downloading...
                                                    </div>
                                                )}
                                            </div>
                                            {isSelected && <div className="w-5 h-5 rounded-full bg-cyan-600 text-white flex items-center justify-center shadow-lg"><Check size={12} strokeWidth={4} /></div>}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {selectedSourceIds.length > 0 && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                            <label className="text-[10px] font-black text-slate-500 dark:text-slate-300 uppercase tracking-[0.2em] px-1">2. Material Selection</label>
                            {isMerging ? (
                                <div className="flex items-center gap-2 text-xs text-slate-400 p-4"><Loader2 className="animate-spin" size={14} /> Indexing sources...</div>
                            ) : availableBooks.length === 0 ? (
                                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-xl text-xs text-slate-400 text-center">
                                    No categorized books found in selected sources.
                                </div>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {availableBooks.map(b => {
                                        const isSelected = selectedBooks.includes(b.book);
                                        return (
                                            <button 
                                                type="button"
                                                key={b.book}
                                                onClick={() => handleToggleBook(b.book)}
                                                className={`px-3 py-2 rounded-lg text-xs font-bold border-2 transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-indigo-400'}`}
                                            >
                                                {getBookLabel(b.book)}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {selectedBooks.length > 0 && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                            <div className="flex items-center justify-between px-1">
                                <label className="text-[10px] font-black text-slate-500 dark:text-slate-300 uppercase tracking-[0.2em]">3. Target Sections</label>
                                <button 
                                    type="button" 
                                    onClick={() => selectedChapters.includes('All') ? setSelectedChapters([]) : setSelectedChapters(['All'])} 
                                    className="text-[9px] font-bold text-indigo-500 hover:text-indigo-600 uppercase tracking-wider"
                                >
                                    {selectedChapters.includes('All') ? "Deselect All" : "Select All"}
                                </button>
                            </div>
                            <div className="max-h-60 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-xl grid grid-cols-2 md:grid-cols-3 gap-2 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
                                {availableBooks.filter(b => selectedBooks.includes(b.book)).map(b => (
                                    <React.Fragment key={b.book}>
                                        {b.chapters.map(c => {
                                            const isSelected = selectedChapters.includes(c) || selectedChapters.includes('All');
                                            return (
                                                <button
                                                    type="button"
                                                    key={`${b.book}-${c}`}
                                                    onClick={() => handleToggleChapter(c)}
                                                    className={`text-left px-3 py-2 rounded-lg text-[10px] font-medium border transition-all ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-100' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-indigo-300'}`}
                                                >
                                                    <span className="opacity-50 mr-1">{getBookLabel(b.book)}:</span> {getChapterLabel(c)}
                                                </button>
                                            );
                                        })}
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                    )}

                    {selectedBooks.length > 0 && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                            <label className="text-[10px] font-black text-slate-500 dark:text-slate-300 uppercase tracking-[0.2em] px-1">Confidence Grading</label>
                            <div className="flex flex-row bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-1 rounded-xl gap-1 max-w-sm">
                                <Tooltip text="Rate certainty for every answer to track Mastery vs. Luck." align="left">
                                    <button type="button" onClick={() => setEnableConfidence(true)} className={`flex-1 w-full flex flex-row items-center justify-center gap-2 py-2 rounded-lg text-xs font-black uppercase transition-all ${enableConfidence ? 'bg-brand-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400'}`}><ShieldCheck size={16} /> On</button>
                                </Tooltip>
                                <Tooltip text="Standard Right/Wrong scoring only. Faster flow." align="right">
                                    <button type="button" onClick={() => setEnableConfidence(false)} className={`flex-1 w-full flex flex-row items-center justify-center gap-2 py-2 rounded-lg text-xs font-black uppercase transition-all ${!enableConfidence ? 'bg-brand-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400'}`}><Shield size={16} /> Off</button>
                                </Tooltip>
                            </div>
                        </div>
                    )}

                    <div className="max-w-md mx-auto pt-4 space-y-3">
                        <button 
                            type="submit" 
                            disabled={bookAvailableCount === 0}
                            className="w-full bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-4 px-6 rounded-2xl shadow-xl shadow-cyan-600/30 transition-all flex items-center justify-center gap-3 group uppercase tracking-[0.2em] text-xs"
                        >
                            <Play size={16} fill="currentColor" /> Start Session
                        </button>

                        <div className="relative flex items-center py-2">
                            <div className="flex-grow border-t border-slate-100 dark:border-slate-800"></div>
                            <span className="flex-shrink-0 mx-4 text-[9px] font-bold text-slate-300 dark:text-slate-600 uppercase tracking-widest">OR</span>
                            <div className="flex-grow border-t border-slate-100 dark:border-slate-800"></div>
                        </div>

                        <Tooltip text="Start a Journey Mode session with ALL questions from the selected repositories. Question text will be HIDDEN (Book View)." align="center">
                            <button
                                type="button"
                                onClick={() => onStartMarathon(true, enableConfidence)}
                                disabled={totalQuestionsAvailable === 0}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-4 px-6 rounded-2xl shadow-xl shadow-indigo-600/30 transition-all flex items-center justify-center gap-3 group uppercase tracking-[0.2em] text-xs"
                            >
                                <Trophy size={16} fill="currentColor" /> Begin Journey
                            </button>
                        </Tooltip>
                    </div>
                </form>
                {renderSaveSlots()}
             </div>
        )}
        
        {/* Practice Tab Content ... (rest of file) ... */}
        {activeTab === 'practice' && (
        <div className="p-4 md:p-6">
            {isPracticeEmptyState ? (
                <div className="flex flex-col items-center justify-center py-10 animate-in fade-in zoom-in-95 duration-300">
                     <div className="text-center mb-6">
                         <div className="bg-amber-100 dark:bg-amber-900/30 w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 text-amber-600 dark:text-amber-400"><Database size={24} /></div>
                         <h1 className="text-xl font-black text-slate-800 dark:text-white mb-1 uppercase tracking-tight">
                            Upload Database
                         </h1>
                         <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest max-w-xs mx-auto leading-relaxed">
                            Please upload a database to begin configuring your session. <br/>
                            <span className="text-brand-500">Processed locally in your browser.</span>
                         </p>
                         {startupError && (
                             <div className="mt-4 max-w-xs mx-auto p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-[9px] text-red-600 dark:text-red-400 font-mono">
                                Error: {startupError}
                             </div>
                         )}
                     </div>

                     <div
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={onDrop}
                        className={`w-full max-w-md border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center transition-all cursor-pointer ${isDragging ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-brand-400'} ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}
                     >
                        <input type="file" id="inlineFileInput" className="hidden" accept=".db,.sqlite,.sqlite3" onChange={(e)=>e.target.files?.[0] && processFile(e.target.files[0])} disabled={isLoading} />
                        {isLoading ? (
                            <div className="flex flex-col items-center"><Loader2 className="animate-spin text-brand-600 mb-2" size={24} /><p className="text-[8px] font-black text-slate-500 uppercase">Processing...</p></div>
                        ) : (
                            <label htmlFor="inlineFileInput" className="flex flex-col items-center cursor-pointer w-full text-center">
                                <div className="p-3 rounded-full mb-3 bg-slate-50 dark:bg-slate-800 text-slate-300"><Upload size={24} /></div>
                                <p className="text-sm font-black text-slate-700 dark:text-slate-200 mb-1 uppercase">Select SQLite File</p>
                                <p className="text-[8px] font-bold text-slate-400 uppercase">Drag and drop or browse</p>
                            </label>
                        )}
                     </div>
                     {error && <div className="mt-4 max-w-md w-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-xl p-3 flex items-start text-red-700 dark:text-red-400"><AlertCircle className="flex-shrink-0 mr-2 mt-0.5" size={14} /><span className="text-[10px] font-bold">{error}</span></div>}
                </div>
            ) : (
            <>
            <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-brand-50 dark:bg-brand-900/20 text-brand-600 rounded-xl"><Settings size={22} /></div>
                    <div>
                        <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight leading-none">Session Configuration</h2>
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-widest">{totalQuestionsAvailable} Total &bull; <span className="text-brand-600 dark:text-brand-400">{uniqueMax} Filtered</span></p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                <div className="flex flex-col space-y-2 h-full">
                    <div className="flex justify-between items-center px-1">
                        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-300"><ListFilter size={14} /><label className="text-[10px] font-black uppercase tracking-[0.2em]">Focus Objectives</label></div>
                        <button 
                            type="button" 
                            onClick={toggleAll} 
                            className="text-[10px] font-black text-brand-600 dark:text-brand-400 uppercase tracking-widest hover:underline underline-offset-4"
                        >
                            {visibleDomainStats.length > 0 && visibleDomainStats.every(d => selectedDomains.includes(d.name)) ? "Deselect All" : "Include All"}
                        </button>
                    </div>
                    <div className="flex-grow grid grid-cols-2 gap-2 border border-slate-100 dark:border-slate-800/60 p-2 rounded-2xl bg-slate-50/50 dark:bg-slate-900/30 overflow-y-auto h-64 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600">
                        {visibleDomainStats.length > 0 ? visibleDomainStats.map((stat) => {
                            const isSelected = selectedDomains.includes(stat.name);
                            return (
                                <button key={stat.name} type="button" onClick={() => toggleDomain(stat.name)} className={`flex flex-col justify-center px-2 py-1.5 rounded-lg border-2 transition-all text-left ${isSelected ? 'bg-brand-600 border-brand-500 text-white shadow-md' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-300 hover:border-brand-400'}`}>
                                    <div className="flex items-center justify-between gap-2 w-full">
                                        <span className="text-[9px] font-bold truncate leading-tight">{stat.name}</span>
                                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded transition-colors ${isSelected ? 'bg-white text-brand-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300'}`}>{stat.count}</span>
                                    </div>
                                </button>
                            )
                        }) : (
                            <div className="col-span-2 py-8 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-center">No objectives found.</div>
                        )}
                    </div>
                </div>

                <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 dark:text-slate-300 uppercase tracking-[0.2em] px-1">Evaluation Mode</label>
                            <div className="flex flex-row bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-1 rounded-xl gap-1">
                                <Tooltip text="Immediate feedback after every question. Ideal for learning new concepts." align="left">
                                    <button type="button" onClick={() => setMode('FULL_VIEW')} className={`flex-1 w-full flex flex-row items-center justify-center gap-2 py-2 rounded-lg text-xs font-black uppercase transition-all ${mode === 'FULL_VIEW' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400'}`}><BookOpen size={16} /> Study</button>
                                </Tooltip>
                                <Tooltip text="No feedback until the end. Simulates real testing conditions." align="right">
                                    <button type="button" onClick={() => setMode('BLIND')} className={`flex-1 w-full flex flex-row items-center justify-center gap-2 py-2 rounded-lg text-xs font-black uppercase transition-all ${mode === 'BLIND' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400'}`}><GraduationCap size={16} /> Exam</button>
                                </Tooltip>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 dark:text-slate-300 uppercase tracking-[0.2em] px-1">Navigation Mode</label>
                            <div className="flex flex-row bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-1 rounded-xl gap-1">
                                <Tooltip text="Open Navigation: Freely move back and forth between questions." align="left">
                                    <button type="button" onClick={() => setAllowBackNavigation(true)} className={`flex-1 w-full flex flex-row items-center justify-center gap-2 py-2 rounded-lg text-xs font-black uppercase transition-all ${allowBackNavigation ? 'bg-brand-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400'}`}><Navigation size={16} /> Flexible</button>
                                </Tooltip>
                                <Tooltip text="Linear Navigation: Strict forward progression only. Cannot revisit answers." align="right">
                                    <button type="button" onClick={() => setAllowBackNavigation(false)} className={`flex-1 w-full flex flex-row items-center justify-center gap-2 py-2 rounded-lg text-xs font-black uppercase transition-all ${!allowBackNavigation ? 'bg-brand-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400'}`}><ArrowRight size={16} /> Strict</button>
                                </Tooltip>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 dark:text-slate-300 uppercase tracking-[0.2em] px-1">Confidence Grading</label>
                            <div className="flex flex-row bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-1 rounded-xl gap-1">
                                <Tooltip text="Rate certainty for every answer to track Mastery vs. Luck." align="left">
                                    <button type="button" onClick={() => setEnableConfidence(true)} className={`flex-1 w-full flex flex-row items-center justify-center gap-2 py-2 rounded-lg text-xs font-black uppercase transition-all ${enableConfidence ? 'bg-brand-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400'}`}><ShieldCheck size={16} /> On</button>
                                </Tooltip>
                                <Tooltip text="Standard Right/Wrong scoring only. Faster flow." align="right">
                                    <button type="button" onClick={() => setEnableConfidence(false)} className={`flex-1 w-full flex flex-row items-center justify-center gap-2 py-2 rounded-lg text-xs font-black uppercase transition-all ${!enableConfidence ? 'bg-brand-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400'}`}><Shield size={16} /> Off</button>
                                </Tooltip>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 dark:text-slate-300 uppercase tracking-[0.2em] px-1">Image Content</label>
                            <div className="flex flex-row bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-1 rounded-xl gap-1">
                                <Tooltip text="Include questions that require external diagrams or reference images." align="left">
                                    <button type="button" onClick={() => setExcludeImages(false)} className={`flex-1 w-full flex flex-row items-center justify-center gap-2 py-2 rounded-lg text-xs font-black uppercase transition-all ${!excludeImages ? 'bg-brand-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400'}`}><Image size={16} /> Show</button>
                                </Tooltip>
                                <Tooltip text="Filter out all image-based questions for text-only practice." align="right">
                                    <button type="button" onClick={() => setExcludeImages(true)} className={`flex-1 w-full flex flex-row items-center justify-center gap-2 py-2 rounded-lg text-xs font-black uppercase transition-all ${excludeImages ? 'bg-brand-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400'}`}><ImageOff size={16} /> Hide</button>
                                </Tooltip>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 px-1">
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-300">
                        <Timer size={14} />
                        <label className="text-[10px] font-black uppercase tracking-[0.2em]">Session Length</label>
                    </div>

                    <div className="flex items-center gap-4 w-full sm:w-auto flex-grow max-w-lg">
                        <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900/40 p-2 pl-3 rounded-xl border border-slate-100 dark:border-slate-800/60 flex-grow">
                                <SlidersHorizontal size={16} className="text-slate-400" />
                                <input type="range" min={minQuestions} max={uniqueMax} value={count} onChange={(e) => handleSetCount(Number(e.target.value))} className="flex-grow h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full appearance-none cursor-pointer accent-brand-600" />
                        </div>
                        <div className="flex items-baseline gap-1.5 bg-brand-50 dark:bg-brand-900/20 px-4 py-2 rounded-xl border border-brand-100 dark:border-brand-800 min-w-[100px] justify-center">
                            <span className="text-xl font-black text-brand-600">{count}</span>
                            <span className="text-[10px] font-black text-brand-400 uppercase tracking-widest">Questions</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    {presets.map((p, idx) => renderPreset(p, idx))}
                </div>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <button 
                    type="submit" 
                    className="w-full bg-brand-600 hover:bg-brand-700 text-white font-black py-4 px-6 rounded-2xl shadow-xl shadow-brand-600/30 transition-all flex items-center justify-center gap-3 group uppercase tracking-[0.2em] text-xs"
                >
                    <Play size={16} fill="currentColor" /> Start Session
                </button>

                <div className="relative flex items-center py-2">
                    <div className="flex-grow border-t border-slate-100 dark:border-slate-800"></div>
                    <span className="flex-shrink-0 mx-4 text-[9px] font-bold text-slate-300 dark:text-slate-600 uppercase tracking-widest">OR</span>
                    <div className="flex-grow border-t border-slate-100 dark:border-slate-800"></div>
                </div>

                <Tooltip text="Start a Journey Mode session with ALL uploaded questions. Standard text view." align="center">
                    <button
                        type="button"
                        onClick={() => onStartMarathon(false, enableConfidence)}
                        disabled={totalQuestionsAvailable === 0}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-4 px-6 rounded-2xl shadow-xl shadow-indigo-600/30 transition-all flex items-center justify-center gap-3 group uppercase tracking-[0.2em] text-xs"
                    >
                        <Trophy size={16} fill="currentColor" /> Begin Journey
                    </button>
                </Tooltip>
            </div>
            </form>
            {renderSaveSlots()}
            </>
            )}
        </div>
        )}
      </div>

      {isDevToolsEnabled && activeTab === 'practice' && (
        <div className="w-full lg:w-48 flex flex-col gap-4 sticky top-20">
          <div className="bg-slate-900 dark:bg-slate-800 rounded-[2rem] p-3 shadow-2xl border border-slate-700/50 flex flex-col gap-2">
              <div className="flex items-center gap-2 px-1 text-cyan-400 border-b border-slate-700 pb-2">
                  <CheckSquare size={14} />
                  <label className="text-[10px] font-black uppercase tracking-[0.2em]">Question Format</label>
              </div>
              
              <div className="flex flex-col gap-1.5">
                  <Tooltip text="Include all question types (Single Choice, Multi-Select, Matching)." align="right">
                      <button 
                          type="button" 
                          onClick={() => setQuestionType('all')} 
                          className={`w-full flex items-center justify-center py-1 px-2 rounded-lg border-2 transition-all group ${questionType === 'all' ? 'bg-cyan-600 border-cyan-500 text-white shadow-md' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-cyan-500/50 hover:bg-cyan-600/10 hover:text-cyan-400'}`}
                      >
                          <span className="text-[9px] font-black uppercase tracking-tight leading-none">Mixed / All</span>
                      </button>
                  </Tooltip>

                  <Tooltip text="Only include Drag-and-Drop Matching questions." align="right">
                      <button 
                          type="button" 
                          onClick={() => setQuestionType('match')} 
                          className={`w-full flex items-center justify-center py-1 px-2 rounded-lg border-2 transition-all group ${questionType === 'match' ? 'bg-cyan-600 border-cyan-500 text-white shadow-md' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-cyan-500/50 hover:bg-cyan-600/10 hover:text-cyan-400'}`}
                      >
                          <span className="text-[9px] font-black uppercase tracking-tight leading-none">Matching Only</span>
                      </button>
                  </Tooltip>

                  <Tooltip text="Only include questions requiring multiple answers." align="right">
                      <button 
                          type="button" 
                          onClick={() => setQuestionType('multi')} 
                          className={`w-full flex items-center justify-center py-1 px-2 rounded-lg border-2 transition-all group ${questionType === 'multi' ? 'bg-cyan-600 border-cyan-500 text-white shadow-md' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-cyan-500/50 hover:bg-cyan-600/10 hover:text-cyan-400'}`}
                      >
                          <span className="text-[9px] font-black uppercase tracking-tight leading-none">Multi-Select</span>
                      </button>
                  </Tooltip>

                  <Tooltip text="Only include questions requiring visual assets." align="right">
                      <button 
                          type="button" 
                          onClick={() => setQuestionType('image')} 
                          className={`w-full flex items-center justify-center py-1 px-2 rounded-lg border-2 transition-all group ${questionType === 'image' ? 'bg-cyan-600 border-cyan-500 text-white shadow-md' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-cyan-500/50 hover:bg-cyan-600/10 hover:text-cyan-400'}`}
                      >
                          <span className="text-[9px] font-black uppercase tracking-tight leading-none">Image Based</span>
                      </button>
                  </Tooltip>
              </div>
          </div>

          <div className="bg-slate-900 dark:bg-slate-800 rounded-[2rem] p-3 shadow-2xl border border-slate-700/50 flex flex-col gap-2">
              <div className="flex items-center gap-2 px-1 text-indigo-400 border-b border-slate-700 pb-2">
                  <Beaker size={14} />
                  <label className="text-[10px] font-black uppercase tracking-[0.2em]">Simulation</label>
              </div>
              <div className="flex flex-col gap-1.5">
                  {personas.map(p => {
                      const Icon = p.icon;
                      return (
                      <React.Fragment key={p.id}>
                        <Tooltip text={p.desc} align="right">
                            <button 
                                type="button" 
                                onClick={() => handleSimPersonaClick(p.id as SimMode)}
                                className="w-full flex items-center justify-start gap-3 py-2 px-3 rounded-lg border-2 border-slate-700 bg-slate-800/50 text-slate-400 hover:border-indigo-500/50 hover:bg-indigo-600/10 hover:text-indigo-400 transition-all group"
                            >
                                <Icon size={14} className="shrink-0 group-hover:scale-110 transition-transform" />
                                <span className="text-[9px] font-black uppercase tracking-tight leading-none">{p.label}</span>
                            </button>
                        </Tooltip>
                      </React.Fragment>
                      );
                  })}
              </div>
          </div>

          {activeTab === 'practice' && !isOBEMode && (
          <div className="px-4 py-3 bg-slate-100 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800/50 flex items-start gap-3">
              <Info size={12} className="text-slate-500 dark:text-slate-300 mt-0.5 flex-shrink-0" />
              <p className="text-[9px] font-bold text-slate-600 dark:text-slate-300 leading-relaxed uppercase">Instant simulation will trigger using all {uniqueMax} filtered questions.</p>
          </div>
          )}
        </div>
      )}
    </div>
  );
};
