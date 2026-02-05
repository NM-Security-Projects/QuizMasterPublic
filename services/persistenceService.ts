
import { AppState, QuizConfig, UserAnswer, Question, SessionType, SaveSlot, LibraryItem } from '../types';

const DB_NAME = 'QuizMasterPersistence';
const DB_VERSION = 3; // Incremented for Cleanup
const STORES = {
  LIBRARY: 'library_store', // Unified store
  SESSION: 'session_store',
  SETTINGS: 'settings_store',
  FLAGS: 'global_flags',
  SLOTS: 'save_slots'
};

export interface PersistedSession {
  appState: AppState;
  quizConfig: QuizConfig | null;
  userAnswers: UserAnswer[];
  quizQuestions: Question[];
  currentQuestionIndex: number;
  totalQuestionsInDb: number;
  sessionType?: SessionType;
  isOBEMode?: boolean;
}

export interface GlobalFlag {
  questionId: string | number;
  reason: string;
  timestamp: number;
}

const generateUUID = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for non-secure contexts
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (event) => {
      const db = request.result;
      // Cleanup legacy store
      if (db.objectStoreNames.contains('database_store')) {
          db.deleteObjectStore('database_store');
      }
      if (!db.objectStoreNames.contains(STORES.SESSION)) db.createObjectStore(STORES.SESSION);
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) db.createObjectStore(STORES.SETTINGS);
      if (!db.objectStoreNames.contains(STORES.FLAGS)) db.createObjectStore(STORES.FLAGS);
      if (!db.objectStoreNames.contains(STORES.SLOTS)) db.createObjectStore(STORES.SLOTS);
      if (!db.objectStoreNames.contains(STORES.LIBRARY)) db.createObjectStore(STORES.LIBRARY, { keyPath: 'id' });
    };
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const persistenceService = {
  // --- LIBRARY SYSTEM ---
  
  async addToLibrary(file: File, bytes: Uint8Array): Promise<LibraryItem> {
      const db = await openDB();
      const tx = db.transaction(STORES.LIBRARY, 'readwrite');
      const id = generateUUID();
      const item = {
          id,
          name: file.name,
          timestamp: Date.now(),
          size: file.size,
          data: bytes
      };
      
      tx.objectStore(STORES.LIBRARY).put(item);
      
      return new Promise((resolve, reject) => {
          tx.oncomplete = () => resolve({ id, name: item.name, timestamp: item.timestamp, size: item.size });
          tx.onerror = () => reject(tx.error);
      });
  },

  async saveManualUpload(name: string, bytes: Uint8Array): Promise<LibraryItem> {
      const db = await openDB();
      const tx = db.transaction(STORES.LIBRARY, 'readwrite');
      const id = 'user_manual_upload';
      const item = {
          id,
          name: name,
          timestamp: Date.now(),
          size: bytes.byteLength,
          data: bytes
      };
      
      tx.objectStore(STORES.LIBRARY).put(item);
      
      return new Promise((resolve, reject) => {
          tx.oncomplete = () => resolve({ id, name: item.name, timestamp: item.timestamp, size: item.size });
          tx.onerror = () => reject(tx.error);
      });
  },

  async getLibrary(): Promise<LibraryItem[]> {
      const db = await openDB();
      const tx = db.transaction(STORES.LIBRARY, 'readonly');
      const request = tx.objectStore(STORES.LIBRARY).getAll(); 
      
      return new Promise((resolve, reject) => {
          request.onsuccess = () => {
              // Strip the heavy 'data' property for the list view
              const items = (request.result || []).map((i: any) => ({
                  id: i.id,
                  name: i.name,
                  timestamp: i.timestamp,
                  size: i.size
              }));
              resolve(items);
          };
          request.onerror = () => reject(request.error);
      });
  },

  async getLibraryItemData(id: string): Promise<Uint8Array | null> {
      const db = await openDB();
      const tx = db.transaction(STORES.LIBRARY, 'readonly');
      const request = tx.objectStore(STORES.LIBRARY).get(id);
      
      return new Promise((resolve, reject) => {
          request.onsuccess = () => resolve(request.result?.data || null);
          request.onerror = () => reject(request.error);
      });
  },

  async getDatabaseBytes(): Promise<Uint8Array | null> {
      return this.getLibraryItemData('user_manual_upload');
  },

  async removeFromLibrary(id: string): Promise<void> {
      const db = await openDB();
      const tx = db.transaction(STORES.LIBRARY, 'readwrite');
      tx.objectStore(STORES.LIBRARY).delete(id);
      return new Promise((resolve, reject) => {
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
      });
  },

  // --- SESSION ---

  async saveSession(session: PersistedSession): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(STORES.SESSION, 'readwrite');
    tx.objectStore(STORES.SESSION).put(session, 'active_session');
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async getSession(): Promise<PersistedSession | null> {
    const db = await openDB();
    const tx = db.transaction(STORES.SESSION, 'readonly');
    const request = tx.objectStore(STORES.SESSION).get('active_session');
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  },

  // --- SLOT SYSTEM ---

  async saveToSlot(slotId: number, session: PersistedSession): Promise<void> {
      const db = await openDB();
      const tx = db.transaction(STORES.SLOTS, 'readwrite');
      
      let label = 'Practice Session';
      if (session.sessionType === 'MARATHON') label = 'Journey Mode';
      else if (session.quizConfig?.books && session.quizConfig.books.length > 0) {
          label = `Book Companion: ${session.quizConfig.books.join(', ')}`;
      } else if (session.quizConfig?.book) {
          label = `Book Companion: ${session.quizConfig.book}`;
      }
      
      let details = `${session.quizConfig?.questionCount} Questions`;
      if (session.quizConfig?.chapters && session.quizConfig.chapters.length > 0) {
          details = `${session.quizConfig.chapters.length} Chapters Selected`;
      } else if (session.quizConfig?.chapter) {
          details = `Chapter ${session.quizConfig.chapter}`;
      }

      const slotData = {
          session,
          meta: {
              id: slotId,
              isEmpty: false,
              timestamp: Date.now(),
              type: session.sessionType,
              label,
              details,
              config: session.quizConfig,
              progress: { current: session.currentQuestionIndex, total: session.quizQuestions.length }
          }
      };

      tx.objectStore(STORES.SLOTS).put(slotData, slotId);
      
      return new Promise((resolve, reject) => {
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
      });
  },

  async getSlot(slotId: number): Promise<{ session: PersistedSession, meta: SaveSlot } | null> {
      const db = await openDB();
      const tx = db.transaction(STORES.SLOTS, 'readonly');
      const request = tx.objectStore(STORES.SLOTS).get(slotId);
      
      return new Promise((resolve, reject) => {
          request.onsuccess = () => resolve(request.result || null);
          request.onerror = () => reject(request.error);
      });
  },

  async getSlots(): Promise<SaveSlot[]> {
      const db = await openDB();
      const tx = db.transaction(STORES.SLOTS, 'readonly');
      const request = tx.objectStore(STORES.SLOTS).getAll();
      
      return new Promise((resolve, reject) => {
          request.onsuccess = () => {
              const raw = request.result || [];
              const slots: SaveSlot[] = [1, 2, 3].map(id => {
                  const found = raw.find((r: any) => r.meta.id === id);
                  return found ? found.meta : { id, isEmpty: true };
              });
              resolve(slots);
          };
          request.onerror = () => reject(request.error);
      });
  },

  async clearSlot(slotId: number): Promise<void> {
      const db = await openDB();
      const tx = db.transaction(STORES.SLOTS, 'readwrite');
      tx.objectStore(STORES.SLOTS).delete(slotId);
      return new Promise((resolve, reject) => {
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
      });
  },

  // --- SETTINGS & FLAGS ---

  async saveDevToolsEnabled(enabled: boolean): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(STORES.SETTINGS, 'readwrite');
    tx.objectStore(STORES.SETTINGS).put(enabled, 'dev_tools_enabled');
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async getDevToolsEnabled(): Promise<boolean> {
    const db = await openDB();
    const tx = db.transaction(STORES.SETTINGS, 'readonly');
    const request = tx.objectStore(STORES.SETTINGS).get('dev_tools_enabled');
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result === undefined ? false : request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async saveGlobalFlag(flag: GlobalFlag): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(STORES.FLAGS, 'readwrite');
    tx.objectStore(STORES.FLAGS).put(flag, flag.questionId);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async removeGlobalFlag(questionId: string | number): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(STORES.FLAGS, 'readwrite');
    tx.objectStore(STORES.FLAGS).delete(questionId);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async getGlobalFlags(): Promise<Record<string | number, GlobalFlag>> {
    const db = await openDB();
    const tx = db.transaction(STORES.FLAGS, 'readonly');
    const request = tx.objectStore(STORES.FLAGS).getAll();
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const flags: Record<string | number, GlobalFlag> = {};
        request.result.forEach((f: GlobalFlag) => { flags[f.questionId] = f; });
        resolve(flags);
      };
      request.onerror = () => reject(request.error);
    });
  },

  async clearSession(): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(STORES.SESSION, 'readwrite');
    tx.objectStore(STORES.SESSION).delete('active_session');
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async clearAll(): Promise<void> {
    const db = await openDB();
    const tx = db.transaction([STORES.SESSION, STORES.FLAGS, STORES.SLOTS, STORES.LIBRARY], 'readwrite');
    tx.objectStore(STORES.SESSION).clear();
    tx.objectStore(STORES.FLAGS).clear();
    tx.objectStore(STORES.SLOTS).clear();
    tx.objectStore(STORES.LIBRARY).clear();
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
};
