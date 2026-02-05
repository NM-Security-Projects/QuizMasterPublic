
import React, { useCallback, useState } from 'react';
import { Upload, Database, Loader2, AlertCircle } from 'lucide-react';
import { initDatabase } from '../services/sqliteService';
import { IntegrityReport } from '../types';

interface FileUploadProps {
  onUploadSuccess: (totalQuestions: number, bytes: Uint8Array, integrity: IntegrityReport, fileName: string) => void;
  onOBEModeSelect?: () => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onUploadSuccess }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processFile = async (file: File) => {
    setIsLoading(true);
    setError(null);
    try {
      const { bytes, integrity } = await initDatabase(file);
      // Fix: Use the integrity count derived from the file itself, not the global DB state
      const count = integrity.totalRows;
      
      if (count === 0) throw new Error(`Database is empty (0 rows found).`);
      
      onUploadSuccess(count, bytes, integrity, file.name);
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

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-lg mx-auto p-4">
      <div className="text-center mb-6">
        <div className="bg-brand-100 dark:bg-brand-900/30 w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 text-brand-600 dark:text-brand-400"><Database size={24} /></div>
        <h1 className="text-xl font-black text-slate-800 dark:text-white mb-1 uppercase tracking-tight">Load Question Bank</h1>
        <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">SQLite format (.db, .sqlite)</p>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={`w-full border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center transition-all cursor-pointer ${isDragging ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-brand-400'} ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <input type="file" id="fileInput" className="hidden" accept=".db,.sqlite,.sqlite3" onChange={(e)=>e.target.files?.[0] && processFile(e.target.files[0])} disabled={isLoading} />
        {isLoading ? (
          <div className="flex flex-col items-center"><Loader2 className="animate-spin text-brand-600 mb-2" size={24} /><p className="text-[8px] font-black text-slate-500 uppercase">Processing...</p></div>
        ) : (
          <label htmlFor="fileInput" className="flex flex-col items-center cursor-pointer w-full text-center">
            <div className="p-3 rounded-full mb-3 bg-slate-50 dark:bg-slate-800 text-slate-300"><Upload size={24} /></div>
            <p className="text-sm font-black text-slate-700 dark:text-slate-200 mb-1 uppercase">Select SQLite File</p>
            <p className="text-[8px] font-bold text-slate-400 uppercase">Drag and drop or browse</p>
          </label>
        )}
      </div>
      {error && <div className="mt-4 w-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-xl p-3 flex items-start text-red-700 dark:text-red-400"><AlertCircle className="flex-shrink-0 mr-2 mt-0.5" size={14} /><span className="text-[10px] font-bold">{error}</span></div>}
    </div>
  );
};
