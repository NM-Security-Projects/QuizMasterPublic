
export interface QuizConfig {
  questionCount: number;
  mode: QuizMode;
  selectedDomains?: string[];
  allowBackNavigation?: boolean;
  reviewFilter?: ReviewFilter;
  questionType?: QuestionTypeFilter;
  searchText?: string;
  excludeFlagged?: boolean;
  showTimer?: boolean;
  excludeImages?: boolean;
  enableConfidence?: boolean;
  // Book Companion Mode Support
  books?: string[]; // Array of selected Book codes
  chapters?: string[]; // Array of selected Chapter codes
  sourceIds?: string[]; // Array of selected Database IDs
  marathonBookMode?: boolean;
  // Legacy support (optional)
  book?: string;
  chapter?: string;
}

export interface LibraryItem {
    id: string;
    name: string;
    timestamp: number;
    size: number;
    tableCount?: number;
}

export interface DomainStat {
  name: string;
  count: number;
}

export type QuizMode = 'FULL_VIEW' | 'BLIND';

export type ReviewFilter = 'all' | 'exclude' | 'only';

export type QuestionTypeFilter = 'all' | 'match' | 'multi' | 'image';

export interface IntegrityReport {
    totalRows: number;
    missingTextCount: number;
}

export interface Question {
    id: string | number;
    question_text: string;
    choices: Record<string, string>;
    correct_answer: string;
    explanation: string;
    domain: string;
    subDomain: string;
    topic: string;
    chapter: string;
    heading: string;
    hint_1?: string;
    hint_2?: string;
    hint_3?: string;
    refId?: string; // The Book/Chapter ID (e.g. PT_1.1)
    sourceFile?: string; // Name of the source DB
}

export type ConfidenceLevel = 'low' | 'medium' | 'high';

export interface GroundingLink {
    uri: string;
    title?: string;
}

export interface UserAnswer {
    questionId: string | number;
    question: Question;
    selectedOption: string | string[] | null;
    isCorrect: boolean;
    confidence: ConfidenceLevel | null;
    isSkipped?: boolean;
    eliminatedOptions?: string[];
    aiExplanation?: string;
    aiGroundingLinks?: GroundingLink[];
    isErrorFlagged?: boolean;
    flagReason?: string;
}

export enum AppState {
    UPLOAD = 'UPLOAD',
    CONFIG = 'CONFIG',
    QUIZ = 'QUIZ',
    SUMMARY = 'SUMMARY'
}

export type SimMode = 'RANDOM' | 'PERFECT' | 'OVERCONFIDENT' | 'IMPOSTER' | 'SPECIALIST' | 'SEVEN_EIGHTHS';

export type SessionType = 'STANDARD' | 'MARATHON';

export interface SaveSlot {
    id: number;
    isEmpty: boolean;
    timestamp?: number;
    type?: SessionType;
    label?: string;
    details?: string;
    config?: QuizConfig;
    progress?: { current: number, total: number };
}
