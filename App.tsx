
import React, { useState, useEffect, useRef } from 'react';
import { Moon, Sun, Menu, X, Wrench, LogOut, RotateCcw, Database, Play, Info, ChevronRight, Loader2, Target, Brain, AlertTriangle, Dice5, UserCheck, HelpCircle, AlertCircle, CheckCircle2, PieChart, FileText, Save, Clock, Trash2, Beaker } from 'lucide-react';
import { FileUpload } from './components/FileUpload';
import { ConfigForm } from './components/ConfigForm';
import { QuizInterface } from './components/QuizInterface';
import { SummaryView } from './components/SummaryView';
import { HelpMenu } from './components/HelpMenu';
import { ReadmeModal } from './components/ReadmeModal';
import { AppState, Question, QuizConfig, UserAnswer, DomainStat, ConfidenceLevel, SimMode, IntegrityReport, SessionType, SaveSlot } from './types';
import { getQuestions, getDomainStats, initDatabase, getAbsoluteTotalCount, processAndMergeDatabases } from './services/sqliteService';
import { persistenceService, PersistedSession } from './services/persistenceService';

const PERSONA_INFO: Record<SimMode, { label: string, icon: any, desc: string, tech: string }> = {
  RANDOM: {
    label: "Random Noise",
    icon: Dice5,
    desc: "Simulates a user clicking randomly without reading. Useful for stress-testing UI limits and checking distribution randomness.",
    tech: "Logic: 1/N probability for correctness. Randomly rotates through Low/Med/High confidence states."
  },
  PERFECT: {
    label: "Perfect Score",
    icon: Target,
    desc: "The 'God Mode'. Simulates a total master of the material who is fully aware of their expertise.",
    tech: "Logic: 100% Accuracy + 100% High Confidence. Effectively tests the 'True Mastery' and 'Calibration' summary metrics."
  },
  OVERCONFIDENT: {
    label: "Overconfident",
    icon: AlertTriangle,
    desc: "Simulates the Dunning-Kruger effect. The user is frequently wrong but remains absolutely certain of their correctness.",
    tech: "Logic: 25% Accuracy + 100% High Confidence. Populates the 'Danger Zone' metric to test error visibility."
  },
  IMPOSTER: {
    label: "The Imposter",
    icon: Brain,
    desc: "High performance coupled with low self-evaluation. The user gets nearly everything right but feels like it was all luck.",
    tech: "Logic: 92% Accuracy + 100% Low Confidence. Converts correct answers into 'Lucky Guesses' for calibration testing."
  },
  SPECIALIST: {
    label: "Domain Specialist",
    icon: UserCheck,
    desc: "Expertise in a single silo. High mastery in one domain but falls back to guessing on cross-domain concepts.",
    tech: "Logic: Specialty = 95% Acc/High Conf. General = 25% Acc/Low-Med Conf. Tests the Hierarchy Heatmap functionality."
  },
  SEVEN_EIGHTHS: {
    label: "7/8ths Master",
    icon: PieChart,
    desc: "High mastery in all domains EXCEPT the target. Simulates a specific knowledge gap in an otherwise expert profile.",
    tech: "Logic: General = 95% Acc/High Conf. Target = 25% Acc/Low Conf. Tests gap detection."
  }
};

const App: React.FC = () => {
  const [isHydrating, setIsHydrating] = useState(true);
  const [appState, setAppState] = useState<AppState>(AppState.CONFIG);
  const [sessionType, setSessionType] = useState<SessionType>('STANDARD');
  const [totalQuestionsInDb, setTotalQuestionsInDb] = useState(0);
  const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);
  const [quizConfig, setQuizConfig] = useState<QuizConfig | null>(null);
  const [userAnswers, setUserAnswers] = useState<UserAnswer[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [darkMode, setDarkMode] = useState(true);
  const [domainStats, setDomainStats] = useState<DomainStat[]>([]);
  const [showMenu, setShowMenu] = useState(false);
  const [isDevToolsEnabled, setIsDevToolsEnabled] = useState(false);
  const [showDevToolsMenu, setShowDevToolsMenu] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showReadme, setShowReadme] = useState(false);
  const [showIntegrityModal, setShowIntegrityModal] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [hoveredPersona, setHoveredPersona] = useState<SimMode | null>(null);
  const [integrityReport, setIntegrityReport] = useState<IntegrityReport | null>(null);
  const [activeTab, setActiveTab] = useState<'practice' | 'book'>('practice');
  const [saveSlots, setSaveSlots] = useState<SaveSlot[]>([]);
  const [showSlotSelection, setShowSlotSelection] = useState(false);
  const [isOBEMode, setIsOBEMode] = useState(false);
  const [startupError, setStartupError] = useState<string | null>(null);
  
  const [showSpecialistModal, setShowSpecialistModal] = useState(false);
  const [pendingSimData, setPendingSimData] = useState<{config?: QuizConfig, mode: SimMode} | null>(null);
  
  const menuRef = useRef<HTMLDivElement>(null);

  const refreshSlots = async () => {
      const slots = await persistenceService.getSlots();
      setSaveSlots(slots);
  };

  useEffect(() => {
    const hydrate = async () => {
      try {
        const bytes = await persistenceService.getLibraryItemData('user_manual_upload');
        const devToolsStatus = await persistenceService.getDevToolsEnabled();
        setIsDevToolsEnabled(devToolsStatus);
        
        await refreshSlots();

        if (bytes) {
          // Standardize schema using merge logic even for single DB
          // This ensures table is named 'questions' and columns are mapped
          await processAndMergeDatabases([{ id: 'user_manual_upload', name: 'User Database', bytes }]);
          
          // Re-calculate integrity is tricky on standardized DB, but basic row count is easy
          const totalRows = getAbsoluteTotalCount();
          setIntegrityReport({ totalRows, missingTextCount: 0 }); // Simplified for hydration

          const session = await persistenceService.getSession();
          if (session) {
            setAppState(session.appState);
            setQuizConfig(session.quizConfig);
            setUserAnswers(session.userAnswers);
            setQuizQuestions(session.quizQuestions);
            setCurrentQuestionIndex(session.currentQuestionIndex);
            setTotalQuestionsInDb(session.totalQuestionsInDb);
            setSessionType(session.sessionType || 'STANDARD');
            setIsOBEMode(session.isOBEMode || false);
            setDomainStats(getDomainStats('all'));
            // Restore correct tab based on stored session type or mode
            if (session.isOBEMode) setActiveTab('book');
            else setActiveTab('practice');
          } else {
            setTotalQuestionsInDb(totalRows);
            setDomainStats(getDomainStats('all'));
            setAppState(AppState.CONFIG);
            setSessionType('STANDARD');
          }
          setIsHydrating(false);
        } else {
            // No DB found: Initialize empty state instead of loading default library
            setTotalQuestionsInDb(0);
            setDomainStats([]);
            setAppState(AppState.CONFIG);
            setSessionType('STANDARD');
            setActiveTab('practice');
            setIsOBEMode(false);
            setIsHydrating(false);
        }
      } catch (e) {
        console.error("Hydration failed", e);
        setIsHydrating(false);
      }
    };
    hydrate();
  }, []);

  useEffect(() => {
    if (isHydrating || appState === AppState.UPLOAD) return;

    const session: PersistedSession = {
      appState,
      quizConfig,
      userAnswers,
      quizQuestions,
      currentQuestionIndex,
      totalQuestionsInDb,
      sessionType,
      isOBEMode
    };
    
    // Auto-save active session
    persistenceService.saveSession(session);
    
  }, [appState, quizConfig, userAnswers, quizQuestions, currentQuestionIndex, totalQuestionsInDb, isHydrating, sessionType, isOBEMode]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
        setShowDevToolsMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDarkMode = () => setDarkMode(!darkMode);

  const toggleDevTools = async () => {
    const newValue = !isDevToolsEnabled;
    setIsDevToolsEnabled(newValue);
    await persistenceService.saveDevToolsEnabled(newValue);
  };

  const handleUploadSuccess = async (rawCount: number, bytes: Uint8Array, integrity: IntegrityReport, fileName: string) => {
    await persistenceService.saveManualUpload(fileName, bytes);
    
    // Normalize and Initialize the database
    // This creates the 'questions' table and maps columns like 'Domain' or 'Category' to 'domain'
    // We update the total count based on what was successfully imported into the standardized table
    const importedCount = await processAndMergeDatabases([{ id: 'user_manual_upload', name: fileName, bytes }]);

    setTotalQuestionsInDb(importedCount);
    setIntegrityReport(integrity);
    const stats = getDomainStats('all'); 
    setDomainStats(stats);
    setAppState(AppState.CONFIG);
    setSessionType('STANDARD');
    setIsOBEMode(false); // Disable OBE mode on new manual upload
    setActiveTab('practice');
    setStartupError(null);
  };

  const handleStartQuiz = async (config: QuizConfig) => {
    try {
      let questions = getQuestions(
          config.questionCount * 2, 
          config.selectedDomains, 
          config.reviewFilter, 
          config.searchText, 
          config.questionType, 
          config.excludeImages,
          config.book,
          config.chapter,
          // Pass the necessary parameters for Book Mode filtering & sorting
          !!(config.marathonBookMode || (config.books && config.books.length > 0)),
          config.books,
          config.chapters
      );
      
      if (config.excludeFlagged) {
          const globalFlags = await persistenceService.getGlobalFlags();
          questions = questions.filter(q => !globalFlags[q.id]);
      }

      questions = questions.slice(0, config.questionCount);

      setQuizQuestions(questions);
      setQuizConfig(config);
      setUserAnswers([]);
      setCurrentQuestionIndex(0);
      setSessionType('STANDARD');
      setAppState(AppState.QUIZ);
    } catch (e) {
      alert("Error starting quiz: " + (e as Error).message);
    }
  };

  const handleStartMarathon = (isBookMode: boolean = false, enableConfidence: boolean = true) => {
      try {
          // If totalQuestionsInDb is 0 but we suspect data exists (due to state desync), force a recount
          let activeCount = totalQuestionsInDb;
          if (activeCount === 0) {
              activeCount = getAbsoluteTotalCount();
              if (activeCount > 0) setTotalQuestionsInDb(activeCount);
          }

          let allQuestions: Question[];
          
          if (isBookMode) {
              // Book Companion Mode: Strict Sequential Order
              // 1. Fetch all questions from DB without randomization (sortRefId=true ensures ORDER BY rowid in SQL)
              allQuestions = getQuestions(activeCount, undefined, undefined, undefined, 'all', false, undefined, undefined, true);
              
              // Note: Removed JS sort to rely purely on DB insertion order as requested
          } else {
              // Standard Practice Mode: Pure Random
              allQuestions = getQuestions(activeCount, undefined, undefined, undefined, 'all');
          }

          if (allQuestions.length === 0) throw new Error("No questions found in database.");

          const marathonConfig: QuizConfig = {
              questionCount: allQuestions.length,
              mode: 'BLIND',
              allowBackNavigation: true,
              reviewFilter: 'all',
              showTimer: true,
              questionType: 'all',
              marathonBookMode: isBookMode,
              enableConfidence: enableConfidence
          };
          
          setQuizQuestions(allQuestions);
          setQuizConfig(marathonConfig);
          setUserAnswers([]);
          setCurrentQuestionIndex(0);
          setSessionType('MARATHON');
          setAppState(AppState.QUIZ);
      } catch (e) {
          alert("Error starting journey: " + (e as Error).message);
      }
  };

  const generateSimulatedAnswers = (questions: Question[], mode: SimMode, specificDomain?: string) => {
    const inferredDomain = questions[0]?.domain?.split('|')[0]?.trim();
    const targetDomain = specificDomain || inferredDomain;

    return questions.map(q => {
        const isMultiSelect = /\[MULTI\]/i.test(q.question_text);
        const choiceKeys = Object.keys(q.choices);
        const correctStr = (q.correct_answer || "").trim().toUpperCase();
        const correctKeys = correctStr.includes(',') ? correctStr.split(',').map(s => s.trim()) : [correctStr];
        
        let selected: string | string[];
        let confidence: ConfidenceLevel;

        const pickWrong = () => {
          const wrongOptions = choiceKeys.filter(k => !correctKeys.includes(k));
          if (isMultiSelect) {
            const count = Math.max(1, Math.floor(Math.random() * choiceKeys.length));
            const shuffled = [...choiceKeys].sort(() => 0.5 - Math.random());
            const picked = shuffled.slice(0, count);
            const isActuallyCorrect = picked.length === correctKeys.length && picked.every(k => correctKeys.includes(k));
            if (isActuallyCorrect) {
              return [wrongOptions[0] || choiceKeys[0]];
            }
            return picked;
          }
          return wrongOptions[0] || choiceKeys.find(k => !correctKeys.includes(k)) || 'A';
        };

        switch (mode) {
          case 'PERFECT':
            selected = isMultiSelect ? correctKeys : correctKeys[0];
            confidence = 'high';
            break;
          case 'OVERCONFIDENT':
            const isRightOver = Math.random() < 0.25;
            selected = isRightOver ? (isMultiSelect ? correctKeys : correctKeys[0]) : pickWrong();
            confidence = 'high';
            break;
          case 'IMPOSTER':
            const isRightImposter = Math.random() < 0.92;
            selected = isRightImposter ? (isMultiSelect ? correctKeys : correctKeys[0]) : pickWrong();
            confidence = 'low';
            break;
          case 'SPECIALIST':
            const qDomains = q.domain ? q.domain.split('|').map(d => d.trim()) : [];
            const isInSpecialty = targetDomain && qDomains.some(d => d.includes(targetDomain));
            
            const accuracy = isInSpecialty ? 0.95 : 0.25;
            const isRightSpec = Math.random() < accuracy;
            selected = isRightSpec ? (isMultiSelect ? correctKeys : correctKeys[0]) : pickWrong();
            confidence = isInSpecialty ? 'high' : (Math.random() < 0.5 ? 'low' : 'medium');
            break;
          case 'SEVEN_EIGHTHS':
            const qDomains78 = q.domain ? q.domain.split('|').map(d => d.trim()) : [];
            const isInSpecialty78 = targetDomain && qDomains78.some(d => d.includes(targetDomain));
            
            const accuracy78 = isInSpecialty78 ? 0.25 : 0.95;
            const isRight78 = Math.random() < accuracy78;
            selected = isRight78 ? (isMultiSelect ? correctKeys : correctKeys[0]) : pickWrong();
            confidence = !isInSpecialty78 ? 'high' : (Math.random() < 0.5 ? 'low' : 'medium');
            break;
          case 'RANDOM':
          default:
            const randomCount = isMultiSelect ? Math.max(1, Math.floor(Math.random() * choiceKeys.length)) : 1;
            const shuffled = [...choiceKeys].sort(() => 0.5 - Math.random());
            selected = isMultiSelect ? shuffled.slice(0, randomCount) : shuffled[0];
            
            const levels: ConfidenceLevel[] = ['low', 'medium', 'high'];
            confidence = levels[Math.floor(Math.random() * 3)];
            break;
        }

        let isCorrect = false;
        if (isMultiSelect) {
          const userSet = new Set(Array.isArray(selected) ? selected : []);
          const correctSet = new Set(correctKeys);
          isCorrect = userSet.size === correctSet.size && [...userSet].every(v => correctSet.has(v));
        } else {
          isCorrect = selected === correctKeys[0];
        }

        return {
            questionId: q.id,
            question: q,
            selectedOption: selected,
            isCorrect: isCorrect,
            confidence: confidence
        };
    });
  };

  const executeSimulation = (targetDomain?: string) => {
      if (!pendingSimData) return;
      
      setIsSimulating(true);
      setShowSpecialistModal(false);

      setTimeout(() => {
          try {
              let questionsToUse = quizQuestions;
              
              if (pendingSimData.config) {
                 questionsToUse = getQuestions(
                    pendingSimData.config.questionCount, 
                    pendingSimData.config.selectedDomains, 
                    pendingSimData.config.reviewFilter, 
                    pendingSimData.config.searchText,
                    pendingSimData.config.questionType,
                    pendingSimData.config.excludeImages,
                    pendingSimData.config.book,
                    pendingSimData.config.chapter,
                    // Pass book parameters if simulating book mode
                    !!(pendingSimData.config.marathonBookMode || (pendingSimData.config.books && pendingSimData.config.books.length > 0)),
                    pendingSimData.config.books,
                    pendingSimData.config.chapters
                 );
                 setQuizQuestions(questionsToUse);
                 setQuizConfig(pendingSimData.config);
              }
              
              const answers = generateSimulatedAnswers(questionsToUse, pendingSimData.mode, targetDomain);
              
              if (pendingSimData.config) {
                 handleFinishQuiz(answers);
              } else {
                 const merged = answers.map(ans => {
                    const existing = userAnswers.find(ea => ea.questionId === ans.questionId);
                    return existing || ans;
                 });
                 handleFinishQuiz(merged);
              }
          } catch (e) {
              alert("Error in simulation: " + (e as Error).message);
              setIsSimulating(false);
          } finally {
              setPendingSimData(null);
          }
      }, 800);
  };

  const handleSimulateFromConfig = (config: QuizConfig, mode: SimMode) => {
    if (mode === 'SPECIALIST' || mode === 'SEVEN_EIGHTHS') {
        setPendingSimData({ config, mode });
        setShowSpecialistModal(true);
        return;
    }
    
    setPendingSimData({ config, mode });
    setTimeout(() => {
         setIsSimulating(true);
         setTimeout(() => {
             try {
                const questions = getQuestions(
                    config.questionCount, 
                    config.selectedDomains, 
                    config.reviewFilter, 
                    config.searchText, 
                    config.questionType, 
                    config.excludeImages,
                    config.book, 
                    config.chapter,
                    !!(config.marathonBookMode || (config.books && config.books.length > 0)),
                    config.books,
                    config.chapters
                );
                setQuizQuestions(questions);
                const answers = generateSimulatedAnswers(questions, mode);
                handleFinishQuiz(answers);
             } catch(e) {
                 alert("Error: " + (e as Error).message);
                 setIsSimulating(false);
             } finally {
                 setPendingSimData(null);
             }
         }, 800);
    }, 0);
  };

  const handleSimulateMenuClick = (mode: SimMode) => {
    setShowMenu(false);
    setShowDevToolsMenu(false);

    if (mode === 'SPECIALIST' || mode === 'SEVEN_EIGHTHS') {
        setPendingSimData({ mode });
        setShowSpecialistModal(true);
        return;
    }

    setIsSimulating(true);
    setTimeout(() => {
      const newAnswers = generateSimulatedAnswers(quizQuestions, mode);
      const merged = newAnswers.map(ans => {
          const existing = userAnswers.find(ea => ea.questionId === ans.questionId);
          return existing || ans;
      });
      handleFinishQuiz(merged);
    }, 800);
  };

  const handleFinishQuiz = (answers: UserAnswer[]) => {
    setUserAnswers([...answers]);
    setAppState(AppState.SUMMARY);
    setShowMenu(false);
    setShowDevToolsMenu(false);
    setIsSimulating(false);
  };

  const handleRestart = async () => {
    await persistenceService.clearSession();
    setAppState(AppState.CONFIG);
    setSessionType('STANDARD');
    setUserAnswers([]);
    setQuizQuestions([]);
    setCurrentQuestionIndex(0);
    setShowMenu(false);
    setShowDevToolsMenu(false);
  };

  const handleNewDatabase = async () => {
    if (appState === AppState.QUIZ) {
        if (!window.confirm("Abandon current test and upload new database?")) return;
    }
    await persistenceService.clearAll();
    setTotalQuestionsInDb(0);
    setQuizQuestions([]);
    setQuizConfig(null);
    setUserAnswers([]);
    setDomainStats([]);
    setCurrentQuestionIndex(0);
    setIntegrityReport(null);
    setStartupError(null);
    setAppState(AppState.CONFIG);
    setActiveTab('practice');
    setSessionType('STANDARD');
    setIsOBEMode(false);
    
    setShowMenu(false);
    setShowDevToolsMenu(false);
    refreshSlots();
  };

  // Deprecated usage from Logo, left here to minimize refactor risk
  const handleLogoClick = () => {
    if (appState === AppState.UPLOAD) return;
    if (appState === AppState.QUIZ) {
      handleQuitSession();
      return;
    }
    if (appState === AppState.CONFIG) {
        handleNewDatabase();
        return;
    }
    handleRestart();
  };

  const handleQuitSession = () => {
    setShowQuitConfirm(true);
    setShowMenu(false);
    setShowDevToolsMenu(false);
  };

  const handleSaveToSlot = async (slotId: number) => {
      const currentSession: PersistedSession = {
          appState,
          quizConfig,
          userAnswers,
          quizQuestions,
          currentQuestionIndex,
          totalQuestionsInDb,
          sessionType,
          isOBEMode
      };

      await persistenceService.saveToSlot(slotId, currentSession);
      await persistenceService.clearSession();
      await refreshSlots();
      
      // Determine redirection based on sessionType/config
      setAppState(AppState.CONFIG);
      setShowSlotSelection(false);
      setShowQuitConfirm(false);
      
      if (sessionType === 'MARATHON') {
          // If saving a journey session, redirect back to relevant tab based on mode
          if (isOBEMode || quizConfig?.marathonBookMode) setActiveTab('book');
          else setActiveTab('practice');
      } else if (quizConfig?.book) {
          setActiveTab('book');
      } else {
          setActiveTab('practice');
      }
      
      // Reset state
      setUserAnswers([]);
      setQuizQuestions([]);
      setCurrentQuestionIndex(0);
  };

  const handleLoadSlot = async (slotId: number) => {
      const result = await persistenceService.getSlot(slotId);
      if (result && result.session) {
          const s = result.session;
          setAppState(s.appState);
          setQuizConfig(s.quizConfig);
          setUserAnswers(s.userAnswers);
          setQuizQuestions(s.quizQuestions);
          setCurrentQuestionIndex(s.currentQuestionIndex);
          setTotalQuestionsInDb(s.totalQuestionsInDb);
          setSessionType(s.sessionType || 'STANDARD');
          setIsOBEMode(s.isOBEMode || false);
          
          if (s.isOBEMode || s.quizConfig?.marathonBookMode || s.quizConfig?.book) {
              setActiveTab('book');
          } else {
              setActiveTab('practice');
          }
      }
  };

  const handleClearSlot = async (slotId: number) => {
      await persistenceService.clearSlot(slotId);
      refreshSlots();
  };

  const confirmQuit = () => {
    setAppState(AppState.SUMMARY);
    setShowQuitConfirm(false);
  };

  if (isHydrating) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center transition-colors">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin mb-4" />
        <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Hydrating Session...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col transition-colors duration-200">
      <nav className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-50 border-b border-slate-200 dark:border-slate-800 px-4 h-14 flex items-center">
        <div className="max-w-6xl mx-auto flex items-center justify-between w-full">
            <div 
              className="flex items-center gap-2"
            >
                <div className="w-7 h-7 bg-brand-600 rounded-lg flex items-center justify-center text-white font-black text-base shadow-lg shadow-brand-500/20">Q</div>
                <span className="font-black text-base text-slate-800 dark:text-white tracking-tight">Quiz Master</span>
            </div>

            <div className="flex items-center gap-2 relative" ref={menuRef}>
              {isDevToolsEnabled && integrityReport && integrityReport.missingTextCount > 0 && appState === AppState.CONFIG && !isOBEMode && (
                  <button
                      onClick={() => setShowIntegrityModal(true)}
                      aria-label="View Data Integrity Alerts"
                      className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-[9px] font-black uppercase tracking-widest border border-amber-200 dark:border-amber-800 animate-in fade-in slide-in-from-top-1 duration-500 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
                  >
                      <AlertCircle size={12} /> {integrityReport.missingTextCount} Data Integrity Alerts
                  </button>
              )}

              {appState !== AppState.UPLOAD && (
                <button 
                  type="button"
                  onClick={() => { setShowMenu(!showMenu); setShowDevToolsMenu(false); }}
                  aria-label={showMenu ? "Close Menu" : "Open Menu"}
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 border border-transparent dark:border-slate-800"
                >
                  {showMenu ? <X size={16} /> : <Menu size={16} />}
                </button>
              )}
              {showMenu && (
                <div className="absolute top-full right-0 mt-1 w-52 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 p-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-200">
                  <button onClick={toggleDarkMode} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold uppercase tracking-wider text-left">
                    {darkMode ? <Sun size={14} /> : <Moon size={14} />} {darkMode ? "Light Mode" : "Dark Mode"}
                  </button>

                  <button 
                    onClick={() => { setShowHelp(true); setShowMenu(false); }} 
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold uppercase tracking-wider text-left"
                  >
                    <HelpCircle size={14} /> Application Help
                  </button>

                  <button 
                    onClick={() => { setShowReadme(true); setShowMenu(false); }} 
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold uppercase tracking-wider text-left"
                  >
                    <FileText size={14} /> View Documentation
                  </button>

                  {appState !== AppState.QUIZ && (
                    <button onClick={handleNewDatabase} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold uppercase tracking-wider text-left">
                      <Database size={14} /> Upload New Database
                    </button>
                  )}
                  
                  {appState === AppState.QUIZ && (
                    <>
                      <button onClick={handleQuitSession} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-xs font-bold uppercase tracking-wider mt-1 border-t border-slate-100 dark:border-slate-800 pt-2 text-left">
                        <LogOut size={14} /> Quit Session
                      </button>
                    </>
                  )}

                  {appState === AppState.SUMMARY && (
                    <button onClick={handleRestart} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 text-xs font-bold uppercase tracking-wider border-t border-slate-100 dark:border-slate-800 mt-1 pt-2 text-left">
                      <RotateCcw size={14} /> New Practice Session
                    </button>
                  )}

                  <div className="border-t border-slate-100 dark:border-slate-800 mt-1 pt-2 px-3 pb-1">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input 
                        type="checkbox" 
                        checked={isDevToolsEnabled}
                        onChange={toggleDevTools}
                        className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-700 text-brand-600 focus:ring-brand-500 cursor-pointer"
                      />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors">Enable Dev Tools</span>
                    </label>
                  </div>

                  {isDevToolsEnabled && appState === AppState.QUIZ && (
                      <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800 mt-1">
                          <p className="text-[9px] font-black uppercase tracking-widest text-indigo-500 mb-2 flex items-center gap-2"><Beaker size={12} /> Simulation Protocols</p>
                          <div className="grid grid-cols-2 gap-1.5">
                              {(Object.keys(PERSONA_INFO) as SimMode[]).map(mode => (
                                  <button
                                      key={mode}
                                      onClick={() => handleSimulateMenuClick(mode)}
                                      className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-indigo-500 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all group"
                                      title={PERSONA_INFO[mode].desc}
                                  >
                                      {React.createElement(PERSONA_INFO[mode].icon, { size: 12 })}
                                      <span className="text-[9px] font-bold uppercase tracking-tight truncate max-w-[60px]">{PERSONA_INFO[mode].label.split(' ')[0]}</span>
                                  </button>
                              ))}
                          </div>
                      </div>
                  )}
                </div>
              )}
              {appState === AppState.UPLOAD && (
                <button type="button" onClick={toggleDarkMode} aria-label="Toggle Dark Mode" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">{darkMode ? <Sun size={16} /> : <Moon size={16} />}</button>
              )}
            </div>
        </div>
      </nav>

      <main className={`flex-grow flex flex-col ${appState === AppState.SUMMARY ? 'px-2 md:px-4 pt-0' : 'p-2 md:p-4'} max-w-6xl mx-auto w-full`}>
        {appState === AppState.UPLOAD && <div className="flex-grow flex flex-col justify-center py-10"><FileUpload onUploadSuccess={handleUploadSuccess} /></div>}
        {appState === AppState.CONFIG && (
            <div className="flex-grow flex flex-col py-2">
                <ConfigForm 
                    totalQuestionsAvailable={totalQuestionsInDb} 
                    onStart={handleStartQuiz} 
                    onSimulate={handleSimulateFromConfig}
                    onStartMarathon={handleStartMarathon}
                    domainStats={domainStats} 
                    isDevToolsEnabled={isDevToolsEnabled}
                    saveSlots={saveSlots}
                    onLoadSlot={handleLoadSlot}
                    onClearSlot={handleClearSlot}
                    activeTabState={[activeTab, setActiveTab]}
                    isOBEMode={isOBEMode}
                    onUploadSuccess={handleUploadSuccess}
                    onDbUpdate={setTotalQuestionsInDb}
                    startupError={startupError}
                />
            </div>
        )}
        {appState === AppState.QUIZ && quizConfig && (
          <div className="py-1 flex-grow flex flex-col">
             <QuizInterface 
                questions={quizQuestions} 
                mode={quizConfig.mode} 
                allowBackNavigation={quizConfig.allowBackNavigation} 
                showTimer={quizConfig.showTimer}
                onFinish={handleFinishQuiz} 
                onQuit={handleQuitSession}
                userAnswersState={[userAnswers, setUserAnswers]}
                indexState={[currentQuestionIndex, setCurrentQuestionIndex]}
                isDevToolsEnabled={isDevToolsEnabled}
                isMarathonMode={sessionType === 'MARATHON'}
                // FIX: Check for array existence as well as single property
                isBookMode={!!quizConfig.book || (quizConfig.books && quizConfig.books.length > 0) || !!quizConfig.marathonBookMode}
                enableConfidence={quizConfig.enableConfidence}
             />
          </div>
        )}
        {appState === AppState.SUMMARY && <SummaryView answers={userAnswers} onRestart={handleRestart} isDevToolsEnabled={isDevToolsEnabled} />}
      </main>

      {/* Modals ... (unchanged) ... */}
      {showSpecialistModal && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
           {/* ... existing modal implementation ... */}
           <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-lg shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200">
             <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-brand-100 dark:bg-brand-900/30 rounded-xl text-brand-600 dark:text-brand-400">
                        <UserCheck size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">
                            {pendingSimData?.mode === 'SEVEN_EIGHTHS' ? "Select Weakness" : "Select Specialty"}
                        </h3>
                    </div>
                 </div>
                 <button onClick={() => { setShowSpecialistModal(false); setPendingSimData(null); }} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
                    <X size={20} />
                 </button>
             </div>
             <div className="flex-grow overflow-y-auto p-4 space-y-2 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
                {domainStats.map((stat) => (
                    <button 
                        key={stat.name}
                        onClick={() => executeSimulation(stat.name)}
                        className="w-full flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-all text-left"
                    >
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{stat.name}</span>
                        <span className="text-[10px] font-black bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-500">{stat.count} Qs</span>
                    </button>
                ))}
             </div>
          </div>
        </div>
      )}

      {showQuitConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight mb-3">Quit Session?</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-bold leading-relaxed mb-8">
                {showSlotSelection 
                    ? "Select a slot to save your progress. This will overwrite any existing data in that slot." 
                    : "You can save your progress to a specific slot and resume later, or end the session now to view your performance report."}
            </p>
            
            {showSlotSelection ? (
                 <div className="flex flex-col gap-3">
                     {saveSlots.map(slot => (
                         <button 
                             key={slot.id}
                             onClick={() => handleSaveToSlot(slot.id)}
                             className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/10 flex items-center justify-between group transition-all"
                         >
                             <div className="flex items-center gap-3">
                                 <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-slate-500 text-xs">
                                     {slot.id}
                                 </div>
                                 <div className="text-left">
                                     <div className={`text-xs font-bold ${slot.isEmpty ? 'text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}>
                                         {slot.isEmpty ? "Empty Slot" : slot.label}
                                     </div>
                                     {!slot.isEmpty && <div className="text-[9px] text-slate-400">{slot.details}</div>}
                                 </div>
                             </div>
                             <div className="text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                 <Save size={16} />
                             </div>
                         </button>
                     ))}
                     <button onClick={() => setShowSlotSelection(false)} className="mt-2 text-slate-400 text-xs font-bold uppercase hover:text-slate-600">Cancel</button>
                 </div>
            ) : (
                <div className="flex flex-col gap-3">
                    <button 
                        onClick={() => setShowSlotSelection(true)} 
                        className="w-full bg-brand-600 hover:bg-brand-700 text-white font-black py-4 rounded-2xl shadow-xl shadow-brand-600/20 transition-all uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-2"
                    >
                        <Save size={16} /> Save & Exit
                    </button>
                    <button 
                        onClick={confirmQuit} 
                        className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 font-black py-4 rounded-2xl transition-all uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-2"
                    >
                        <FileText size={16} /> Quit & View Report
                    </button>
                    <button 
                        onClick={() => setShowQuitConfirm(false)} 
                        className="w-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-bold py-2 rounded-xl transition-all uppercase tracking-widest text-[10px]"
                    >
                        Cancel
                    </button>
                </div>
            )}
          </div>
        </div>
      )}

      {showIntegrityModal && integrityReport && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200 relative">
             <button
                onClick={() => setShowIntegrityModal(false)}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
             >
                <X size={20} />
             </button>

            <div className="flex items-center gap-3 mb-4 text-amber-600 dark:text-amber-500">
                <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
                    <AlertCircle size={24} />
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight text-slate-800 dark:text-white">Data Quality Report</h3>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed mb-6">
                The application detected <strong className="text-amber-600 dark:text-amber-400">{integrityReport.missingTextCount} rows</strong> in your database where the <code>Question Text</code> was empty or null.
            </p>

            <button
                onClick={() => setShowIntegrityModal(false)}
                className="w-full mt-6 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-black py-3 rounded-xl transition-all uppercase tracking-[0.2em] text-xs"
            >
                Dismiss
            </button>
          </div>
        </div>
      )}

      {showHelp && <HelpMenu onClose={() => setShowHelp(false)} />}
      
      {showReadme && <ReadmeModal onClose={() => setShowReadme(false)} />}
    </div>
  );
};

export default App;
