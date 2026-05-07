import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Languages, 
  Upload, 
  Smartphone, 
  Usb, 
  ShieldCheck, 
  FileText, 
  Settings2, 
  CreditCard, 
  Printer, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft,
  X,
  Plus,
  Minus,
  RefreshCw,
  Clock,
  LayoutDashboard
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

import { Step, Language, FileData, PrintSettings, SessionState } from './types';
import { PRICING, UI_STRINGS } from './constants';
import { cn, formatCurrency } from './lib/utils';

// pdfjs worker setup
import { pdfjs } from 'react-pdf';
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const SESSION_TIMEOUT = 300; // 5 minutes in seconds


function MobileUploadUI() {
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get('session');

  const handleUpload = async () => {
    if (!sessionId || files.length === 0) return;
    setIsUploading(true);
    
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));

    try {
      await fetch(`/api/session/${sessionId}/upload`, {
        method: 'POST',
        body: formData,
      });
      setIsDone(true);
    } catch (err) {
      console.error(err);
      alert('Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8 text-center">
        <div className="bg-white p-12 rounded-[2rem] shadow-xl space-y-6">
          <X size={64} className="text-red-500 mx-auto" />
          <h1 className="text-3xl font-bold">Invalid Session</h1>
          <p className="text-gray-500">Please scan the QR code on the kiosk again.</p>
        </div>
      </div>
    );
  }

  if (isDone) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center p-8 text-center">
        <div className="bg-white p-12 rounded-[2rem] shadow-xl space-y-6">
          <CheckCircle2 size={80} className="text-green-500 mx-auto" />
          <h1 className="text-3xl font-bold">Upload Complete!</h1>
          <p className="text-gray-500 text-xl">Your files are now on the kiosk. You can close this window.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-50 p-8 flex flex-col items-center">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden mt-12 flex flex-col">
        <div className="p-8 bg-blue-600 text-white text-center">
          <Smartphone size={48} className="mx-auto mb-4" />
          <h1 className="text-2xl font-bold">Mobile Upload</h1>
          <p className="opacity-80">Select documents to print</p>
        </div>

        <div className="p-8 space-y-8 flex-1">
          <label className="block w-full border-4 border-dashed border-gray-200 rounded-[2rem] p-12 text-center hover:border-blue-500 transition-colors cursor-pointer">
            <input 
              type="file" 
              multiple 
              className="hidden" 
              onChange={(e) => setFiles(prev => [...prev, ...Array.from(e.target.files || [])])} 
            />
            <Upload size={48} className="mx-auto mb-4 text-gray-300" />
            <p className="text-xl font-bold text-gray-700">Choose Files</p>
            <p className="text-sm text-gray-400 mt-2">PDF, Images, DOCX supported</p>
          </label>

          {files.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-bold text-gray-400 uppercase tracking-widest text-xs">Files to upload</h3>
              <div className="space-y-2">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <span className="truncate font-medium flex-1">{f.name}</span>
                    <button onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}>
                      <X size={20} className="text-gray-400" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-8 bg-gray-50 border-t">
          <button 
            disabled={files.length === 0 || isUploading}
            onClick={handleUpload}
            className="w-full py-6 bg-blue-600 text-white rounded-2xl text-2xl font-bold shadow-xl active:scale-95 disabled:opacity-50 disabled:active:scale-100 transition-all flex items-center justify-center gap-3"
          >
            {isUploading ? <RefreshCw size={24} className="animate-spin" /> : <Smartphone size={24} />}
            {isUploading ? 'Uploading...' : 'Send to Kiosk'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [isMobileUploadPage, setIsMobileUploadPage] = useState(false);

  useEffect(() => {
    if (window.location.pathname.startsWith('/upload')) {
      setIsMobileUploadPage(true);
    }
  }, []);

  // --- State ---
  const [step, setStep] = useState<Step>('welcome');
  const [isAdmin, setIsAdmin] = useState(false);
  const [showMobileQR, setShowMobileQR] = useState(false);
  const [session, setSession] = useState<SessionState>({
    id: null,
    language: 'en',
    files: [],
    currentFileIndex: 0,
    settings: {
      copies: 1,
      type: 'bw',
      orientation: 'portrait',
      paperSize: 'A4',
      sides: 'single',
      pages: 'all',
      quality: 'standard'
    },
    totalCost: 0,
    paymentStatus: 'pending'
  });

  const [timeLeft, setTimeLeft] = useState(SESSION_TIMEOUT);
  const [isScanning, setIsScanning] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printProgress, setPrintProgress] = useState(0);

  // --- Refs ---
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // --- Translations Helper ---
  const t = (key: string) => UI_STRINGS[session.language][key] || key;

  // --- Handlers ---
  const startSession = async () => {
    try {
      const res = await fetch('/api/session/start', { method: 'POST' });
      const data = await res.json();
      setSession(prev => ({ ...prev, id: data.sessionId, files: [] }));
      setStep('language');
      resetTimer();
    } catch (err) {
      console.error("Failed to start session", err);
    }
  };

  const endSession = () => {
    setStep('welcome');
    setSession({
      id: null,
      language: 'en',
      files: [],
      currentFileIndex: 0,
      settings: {
        copies: 1,
        type: 'bw',
        orientation: 'portrait',
        paperSize: 'A4',
        sides: 'single',
        pages: 'all',
        quality: 'standard'
      },
      totalCost: 0,
      paymentStatus: 'pending'
    });
    setTimeLeft(SESSION_TIMEOUT);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const resetTimer = () => {
    setTimeLeft(SESSION_TIMEOUT);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          endSession();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleLanguageSelect = (lang: Language) => {
    setSession(prev => ({ ...prev, language: lang }));
    setStep('upload-source');
    resetTimer();
  };

  const calculateCost = useCallback(() => {
    const { files, settings } = session;
    const totalPages = files.reduce((acc, file) => acc + (file.pages || 1), 0);
    const pricePerPage = settings.type === 'color' ? PRICING.color : PRICING.bw;
    let cost = totalPages * settings.copies * pricePerPage;
    
    // Simple double side logic
    if (settings.sides === 'double') {
      cost = cost * 0.9; // 10% discount for double side
    }
    
    setSession(prev => ({ ...prev, totalCost: Math.ceil(cost) }));
  }, [session.files, session.settings]);

  useEffect(() => {
    if (step === 'payment' || step === 'settings') {
      calculateCost();
    }
  }, [step, session.settings, calculateCost]);

  // Simulate local file upload (USB/Type-C)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = Array.from(e.target.files || []) as File[];
    if (uploadedFiles.length === 0) return;

    setIsScanning(true);
    setStep('security-scan');
    
    // Simulate scan
    setTimeout(() => {
      const newFiles: FileData[] = uploadedFiles.map(file => ({
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        url: URL.createObjectURL(file),
        size: file.size,
        type: file.type,
        pages: Math.floor(Math.random() * 5) + 1 // Simulated page count
      }));
      
      setSession(prev => ({ ...prev, files: [...prev.files, ...newFiles] }));
      setIsScanning(false);
      setStep('preview');
    }, 3000);
  };

  // --- UI Sections ---

  const renderWelcome = () => (
    <div 
      className="flex flex-col items-center justify-center h-full text-center space-y-12 cursor-pointer"
      onClick={startSession}
    >
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, repeat: Infinity, repeatType: 'reverse' }}
      >
        <div className="w-48 h-48 bg-blue-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-500/20">
          <Printer size={80} className="text-white" />
        </div>
      </motion.div>
      <div className="space-y-4">
        <h1 className="text-6xl font-bold tracking-tight text-gray-900">{t('welcome')}</h1>
        <p className="text-2xl text-gray-500 font-medium">{t('secure')}</p>
      </div>
      <motion.div 
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="text-3xl font-semibold text-blue-600 border-b-2 border-blue-600 pb-2"
      >
        {t('touchToStart')}
      </motion.div>
      
      <div className="absolute bottom-12 text-gray-400 flex items-center gap-2">
        <ShieldCheck size={20} />
        <span className="text-sm uppercase tracking-widest font-bold">Secure Local Infrastructure</span>
      </div>
    </div>
  );

  const renderLanguage = () => (
    <div className="flex flex-col items-center justify-center h-full space-y-12">
      <h2 className="text-4xl font-bold">{t('selectLanguage')}</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-4xl px-8">
        {(['en', 'hi', 'mr'] as Language[]).map((lang) => (
          <button
            key={lang}
            onClick={() => handleLanguageSelect(lang)}
            className="h-48 rounded-3xl bg-white border-2 border-gray-100 shadow-xl hover:border-blue-500 hover:text-blue-600 transition-all group active:scale-95"
          >
            <div className="flex flex-col items-center gap-4">
              <Languages size={48} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
              <span className="text-3xl font-bold">
                {lang === 'en' ? 'English' : lang === 'hi' ? 'हिंदी' : 'मराठी'}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  // --- Polling for Mobile Uploads ---
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === 'upload-source' && session.id) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/session/${session.id}/files`);
          const data = await res.json();
          if (data.files && data.files.length > 0) {
            // New files found!
            const newFiles: FileData[] = data.files.map((url: string) => ({
              id: Math.random().toString(36).substr(2, 9),
              name: url.split('/').pop() || 'mobile-doc.pdf',
              url: url,
              size: 1024 * 1024 * 2, // 2MB estimated
              type: 'application/pdf',
              pages: Math.floor(Math.random() * 5) + 1
            }));
            
            setSession(prev => {
              // Only update if we actually have new files (compare by name/url if needed)
              // For simplicity, if count is different, we update
              if (prev.files.length !== newFiles.length) {
                setStep('security-scan');
                setIsScanning(true);
                setTimeout(() => {
                  setIsScanning(false);
                  setStep('preview');
                }, 2000);
                return { ...prev, files: newFiles };
              }
              return prev;
            });
          }
        } catch (err) {
          console.error("Polling error", err);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [step, session.id]);

  const renderUploadSource = () => {
    const mobileUploadUrl = `${window.location.origin}/upload?session=${session.id}`;
    
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-12">
        <AnimatePresence>
          {showMobileQR && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-8"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-white rounded-[3rem] p-12 max-w-lg w-full text-center space-y-8 relative"
              >
                <button 
                  onClick={() => setShowMobileQR(false)}
                  className="absolute top-8 right-8 p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X size={32} />
                </button>
                <Smartphone size={64} className="mx-auto text-blue-600" />
                <div className="space-y-2">
                  <h3 className="text-3xl font-bold">Scan to Upload</h3>
                  <p className="text-gray-500">Scan this QR code with your phone camera to start uploading documents.</p>
                </div>
                <div className="bg-gray-50 p-8 rounded-3xl inline-block border border-gray-100">
                  <QRCodeSVG value={mobileUploadUrl} size={240} />
                </div>
                <div className="flex items-center justify-center gap-4 text-blue-600 font-bold animate-pulse">
                   <RefreshCw size={24} className="animate-spin" />
                   Waiting for files...
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="text-center space-y-2">
          <h2 className="text-4xl font-bold">{t('selectUploadSource')}</h2>
          <p className="text-xl text-gray-500">Insert your device or scan to upload</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl px-8">
          <label className="cursor-pointer h-72 rounded-3xl bg-white border-2 border-gray-100 shadow-xl hover:border-blue-500 hover:text-blue-600 transition-all flex flex-col items-center justify-center group active:scale-95">
            <input type="file" multiple className="hidden" onChange={handleFileUpload} />
            <Usb size={64} className="mb-4 text-gray-400 group-hover:text-blue-500" />
            <span className="text-2xl font-bold">{t('usb')}</span>
            <span className="text-sm text-gray-400 mt-2">Connect Flash Drive</span>
          </label>
          
          <button 
            onClick={() => setShowMobileQR(true)}
            className="h-72 rounded-3xl bg-white border-2 border-gray-100 shadow-xl hover:border-blue-500 hover:text-blue-600 transition-all flex flex-col items-center justify-center group active:scale-95"
          >
            <Smartphone size={64} className="mb-4 text-gray-400 group-hover:text-blue-500" />
            <span className="text-2xl font-bold">{t('mobile')}</span>
            <span className="text-sm text-gray-400 mt-2">Scan QR on Phone</span>
          </button>

        <label className="cursor-pointer h-72 rounded-3xl bg-white border-2 border-gray-100 shadow-xl hover:border-blue-500 hover:text-blue-600 transition-all flex flex-col items-center justify-center group active:scale-95">
          <input type="file" multiple className="hidden" onChange={handleFileUpload} />
          <Upload size={64} className="mb-4 text-gray-400 group-hover:text-blue-500" />
          <span className="text-2xl font-bold">{t('typec')}</span>
          <span className="text-sm text-gray-400 mt-2">Mobile via Cable</span>
        </label>
      </div>
      
      <button onClick={() => setStep('language')} className="text-gray-500 flex items-center gap-2 text-xl font-bold">
        <ChevronLeft size={24} /> {t('back')}
      </button>
    </div>
  );

  const renderSecurityScan = () => (
    <div className="flex flex-col items-center justify-center h-full space-y-12">
      <div className="relative">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
          className="w-48 h-48 border-4 border-blue-100 border-t-blue-600 rounded-full"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <ShieldCheck size={64} className="text-blue-600" />
        </div>
      </div>
      <div className="text-center space-y-4">
        <h2 className="text-4xl font-bold">{isScanning ? t('scanning') : t('securityCheck')}</h2>
        <p className="text-xl text-gray-400">Please wait while we secure your files</p>
      </div>
    </div>
  );

  const renderPreview = () => {
    const currentFile = session.files[session.currentFileIndex];
    if (!currentFile) return null;

    return (
      <div className="flex flex-col h-full bg-gray-50">
        <div className="flex items-center justify-between p-6 bg-white border-b border-gray-200">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
              <FileText size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold truncate max-w-xs">{currentFile.name}</h3>
              <p className="text-sm text-gray-500">{(currentFile.size / 1024 / 1024).toFixed(2)} MB • {currentFile.pages} {t('pages')}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => {
                const newFiles = session.files.filter((_, i) => i !== session.currentFileIndex);
                setSession(prev => ({ ...prev, files: newFiles, currentFileIndex: 0 }));
                if (newFiles.length === 0) setStep('upload-source');
              }}
              className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="flex-1 p-8 flex items-center justify-center overflow-auto">
          <div className="bg-white shadow-2xl rounded-lg p-4 w-full max-w-3xl aspect-[1/1.4] flex items-center justify-center text-gray-300 italic border-4 border-dashed border-gray-100">
             {/* PDF preview would go here */}
             [ PDF Preview of {currentFile.name} ]
          </div>
        </div>

        <div className="p-8 bg-white border-t border-gray-200 flex justify-between items-center">
          <div className="flex gap-2">
            {session.files.map((_, i) => (
              <button 
                key={i}
                onClick={() => setSession(prev => ({ ...prev, currentFileIndex: i }))}
                className={cn(
                  "w-3 h-3 rounded-full transition-all",
                  i === session.currentFileIndex ? "w-8 bg-blue-600" : "bg-gray-300"
                )}
              />
            ))}
          </div>
          <div className="flex gap-4">
             <button onClick={() => setStep('upload-source')} className="px-8 py-4 text-xl font-bold border-2 border-gray-200 rounded-2xl active:scale-95 transition-all">
               + Add More
             </button>
             <button onClick={() => setStep('settings')} className="px-12 py-4 text-xl font-bold bg-blue-600 text-white rounded-2xl active:scale-95 transition-all flex items-center gap-2">
               {t('next')} <ChevronRight size={24} />
             </button>
          </div>
        </div>
      </div>
    );
  };

  const renderSettings = () => (
    <div className="flex h-full bg-gray-50 overflow-hidden">
      <div className="flex-1 p-12 overflow-y-auto space-y-12">
        <h2 className="text-4xl font-bold flex items-center gap-4">
          <Settings2 className="text-blue-600" size={40} />
          {t('printSettings')}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Copies */}
          <div className="space-y-6">
            <label className="text-2xl font-bold text-gray-700">{t('copies')}</label>
            <div className="flex items-center gap-8 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <button 
                onClick={() => setSession(prev => ({ ...prev, settings: { ...prev.settings, copies: Math.max(1, prev.settings.copies - 1) } }))}
                className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center active:scale-90"
              >
                <Minus size={32} />
              </button>
              <span className="text-5xl font-bold w-24 text-center">{session.settings.copies}</span>
              <button 
                onClick={() => setSession(prev => ({ ...prev, settings: { ...prev.settings, copies: prev.settings.copies + 1 } }))}
                className="w-20 h-20 rounded-2xl bg-blue-600 text-white flex items-center justify-center active:scale-90"
              >
                <Plus size={32} />
              </button>
            </div>
          </div>

          {/* Color/BW */}
          <div className="space-y-6">
            <label className="text-2xl font-bold text-gray-700">{t('printType')}</label>
            <div className="flex gap-4">
              {(['bw', 'color'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setSession(prev => ({ ...prev, settings: { ...prev.settings, type } }))}
                  className={cn(
                    "flex-1 p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-2",
                    session.settings.type === type ? "bg-blue-600 border-blue-600 text-white shadow-xl scale-105" : "bg-white border-gray-100 text-gray-500 hover:border-gray-300"
                  )}
                >
                  <div className={cn("w-12 h-12 rounded-full", type === 'bw' ? "bg-gray-800" : "bg-gradient-to-tr from-red-500 via-green-500 to-blue-500")} />
                  <span className="text-xl font-bold">{t(type)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Sides */}
          <div className="space-y-6">
             <label className="text-2xl font-bold text-gray-700">{t('printSide')}</label>
             <div className="flex gap-4">
               {(['single', 'double'] as const).map(side => (
                 <button
                   key={side}
                   onClick={() => setSession(prev => ({ ...prev, settings: { ...prev.settings, sides: side } }))}
                   className={cn(
                     "flex-1 p-6 rounded-3xl border-2 transition-all flex items-center justify-center gap-4",
                     session.settings.sides === side ? "bg-blue-600 border-blue-600 text-white shadow-xl scale-105" : "bg-white border-gray-100 text-gray-500 hover:border-gray-300"
                   )}
                 >
                   <span className="text-xl font-bold">{t(side)}</span>
                 </button>
               ))}
             </div>
          </div>

          {/* Quality */}
          <div className="space-y-6">
             <label className="text-2xl font-bold text-gray-700">Print Quality</label>
             <div className="flex gap-4">
               {(['draft', 'standard', 'high'] as const).map(q => (
                 <button
                   key={q}
                   onClick={() => setSession(prev => ({ ...prev, settings: { ...prev.settings, quality: q } }))}
                   className={cn(
                     "flex-1 p-6 rounded-3xl border-2 transition-all flex items-center justify-center",
                     session.settings.quality === q ? "bg-blue-600 border-blue-600 text-white shadow-xl scale-105" : "bg-white border-gray-100 text-gray-500 hover:border-gray-300"
                   )}
                 >
                   <span className="text-lg font-bold capitalize">{q}</span>
                 </button>
               ))}
             </div>
          </div>
        </div>
      </div>

      <div className="w-1/3 bg-white border-l border-gray-200 p-12 flex flex-col">
        <div className="flex-1 space-y-8">
           <h3 className="text-2xl font-bold border-b pb-4">{t('totalAmount')}</h3>
           <div className="space-y-4">
             <div className="flex justify-between text-xl text-gray-500">
               <span>Total Pages</span>
               <span>{session.files.reduce((acc, f) => acc + f.pages, 0)}</span>
             </div>
             <div className="flex justify-between text-xl text-gray-500">
               <span>Price per page ({t(session.settings.type)})</span>
               <span>₹{session.settings.type === 'color' ? PRICING.color : PRICING.bw}</span>
             </div>
             <div className="flex justify-between text-xl text-gray-500">
               <span>Copies</span>
               <span>{session.settings.copies}x</span>
             </div>
             <div className="pt-4 border-t flex justify-between items-baseline">
                <span className="text-2xl font-bold">Total</span>
                <motion.span 
                  key={session.totalCost}
                  initial={{ scale: 1.2, color: '#2563eb' }}
                  animate={{ scale: 1, color: '#000' }}
                  className="text-5xl font-black"
                >
                  {formatCurrency(session.totalCost)}
                </motion.span>
             </div>
           </div>
        </div>
        <div className="space-y-4">
           <button onClick={() => setStep('preview')} className="w-full py-4 text-xl font-bold border-2 border-gray-100 rounded-2xl">
             {t('back')}
           </button>
           <button 
             onClick={() => setStep('payment')}
             className="w-full py-6 text-2xl font-bold bg-green-600 text-white rounded-2xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3"
           >
             <CreditCard size={32} />
             {t('payNow')}
           </button>
        </div>
      </div>
    </div>
  );

  const renderPayment = () => (
    <div className="flex flex-col items-center justify-center h-full space-y-12 bg-white">
      <div className="text-center space-y-2">
        <h2 className="text-5xl font-bold text-gray-900">{t('totalAmount')}: {formatCurrency(session.totalCost)}</h2>
        <p className="text-2xl text-gray-500 italic">Scan QR with any UPI app to pay</p>
      </div>

      <div className="relative p-12 bg-white rounded-[4rem] shadow-2xl border border-gray-100">
        <QRCodeSVG 
          value={`upi://pay?pa=shop@upi&pn=SmartPrint&am=${session.totalCost}&cu=INR`}
          size={320}
          level="H"
          includeMargin={true}
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-2 rounded-2xl shadow-lg">
           <Smartphone size={48} className="text-blue-600" />
        </div>
      </div>

      <div className="flex flex-col items-center gap-8">
        <div className="flex items-center gap-6">
          <div className="w-24 h-12 bg-gray-100 rounded-xl flex items-center justify-center font-bold text-gray-400">PhonePe</div>
          <div className="w-24 h-12 bg-gray-100 rounded-xl flex items-center justify-center font-bold text-gray-400">GPay</div>
          <div className="w-24 h-12 bg-gray-100 rounded-xl flex items-center justify-center font-bold text-gray-400">Paytm</div>
        </div>
        
        <div className="flex items-center gap-4 text-2xl font-bold text-blue-600">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <RefreshCw size={32} />
          </motion.div>
          Waiting for verification...
        </div>

        <button 
          onClick={() => {
            setSession(prev => ({ ...prev, paymentStatus: 'completed' }));
            setStep('printing');
            setIsPrinting(true);
            let progress = 0;
            const int = setInterval(() => {
              progress += 2;
              setPrintProgress(progress);
              if (progress >= 100) {
                clearInterval(int);
                setIsPrinting(false);
                setStep('thank-you');
              }
            }, 100);
          }}
          className="text-gray-300 hover:text-gray-400 text-sm italic"
        >
          (Simulate Successful Payment)
        </button>
      </div>

      <div className="flex items-center gap-3 text-red-500 font-bold text-xl px-6 py-3 bg-red-50 rounded-full">
        <Clock size={24} />
        02:59
      </div>
    </div>
  );

  const renderPrinting = () => (
    <div className="flex flex-col items-center justify-center h-full space-y-12">
       <div className="relative">
          <motion.div 
            animate={{ 
              scale: [1, 1.1, 1],
              rotate: [0, 5, -5, 0]
            }}
            transition={{ duration: 0.5, repeat: Infinity }}
            className="w-64 h-48 bg-gray-800 rounded-3xl relative overflow-hidden"
          >
             <div className="absolute inset-x-4 top-4 h-1 bg-blue-500 shadow-[0_0_10px_#3b82f6]" />
             <div className="absolute inset-x-4 bottom-8 flex justify-center">
                <motion.div 
                  initial={{ y: 20 }}
                  animate={{ y: [20, -100] }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-56 h-72 bg-white rounded-lg shadow-lg"
                />
             </div>
          </motion.div>
       </div>
       <div className="text-center space-y-4 w-full max-w-xl">
          <h2 className="text-4xl font-bold">{t('printing')}</h2>
          <div className="w-full h-8 bg-gray-100 rounded-full overflow-hidden border">
             <motion.div 
               className="h-full bg-blue-600"
               initial={{ width: 0 }}
               animate={{ width: `${printProgress}%` }}
             />
          </div>
          <p className="text-2xl font-bold text-blue-600">{printProgress}% Complete</p>
          <p className="text-gray-500">Printing page {Math.ceil((printProgress/100) * session.files.length)} of {session.files.length}</p>
       </div>
    </div>
  );

  const renderThankYou = () => (
    <div className="flex flex-col items-center justify-center h-full text-center space-y-12">
       <motion.div
         initial={{ scale: 0, opacity: 0 }}
         animate={{ scale: 1, opacity: 1 }}
         transition={{ type: 'spring', damping: 10, stiffness: 100 }}
       >
         <CheckCircle2 size={160} className="text-green-500" />
       </motion.div>
       <div className="space-y-4">
         <h1 className="text-6xl font-bold leading-tight">{t('thankYou')}</h1>
         <p className="text-3xl text-gray-500 underline underline-offset-8 decoration-green-500 decoration-4">{t('collectDocs')}</p>
       </div>
       
       <div className="p-8 bg-gray-50 rounded-[3rem] border border-gray-100 max-w-lg w-full">
         <p className="text-xl text-gray-400 mb-4 uppercase tracking-widest font-bold">Session Security</p>
         <div className="flex items-center justify-center gap-3 text-red-500 font-bold text-2xl">
           <RefreshCw size={32} className="animate-spin" />
           Deleting your files...
         </div>
       </div>

       <button 
         onClick={endSession}
         className="px-16 py-6 text-3xl font-bold bg-blue-600 text-white rounded-3xl shadow-xl shadow-blue-500/30 active:scale-95 transition-all"
       >
         Done
       </button>
    </div>
  );

  const renderAdmin = () => (
    <div className="h-full bg-slate-900 text-white p-12 overflow-y-auto font-mono">
       <div className="flex justify-between items-center mb-12">
         <h1 className="text-4xl font-bold flex items-center gap-4">
           <LayoutDashboard /> KIOS_ADMIN_V1.0
         </h1>
         <button onClick={() => setIsAdmin(false)} className="px-6 py-2 border border-slate-700 rounded hover:bg-slate-800">EXIT</button>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {[
            { label: 'TOTAL_REVENUE', value: '₹42,500', color: 'text-green-400' },
            { label: 'PRINTS_TODAY', value: '156', color: 'text-blue-400' },
            { label: 'PRINTER_LEVEL', value: '82%', color: 'text-orange-400' },
            { label: 'UPTIME', value: '142h 12m', color: 'text-purple-400' }
          ].map((stat, i) => (
            <div key={i} className="p-8 bg-slate-800 rounded-xl border border-slate-700">
               <p className="text-xs text-slate-500 mb-2">{stat.label}</p>
               <p className={cn("text-4xl font-bold", stat.color)}>{stat.value}</p>
            </div>
          ))}
       </div>

       <div className="p-8 bg-slate-800 rounded-xl border border-slate-700">
         <h3 className="text-xl font-bold mb-6">LIVE_SYSTEM_LOGS</h3>
         <div className="space-y-2 text-sm text-slate-400">
            <p><span className="text-green-500">[OK]</span> Session_Ended_AutoCleanup_Success: S-451293</p>
            <p><span className="text-blue-500">[INFO]</span> New_Mobile_Connection: IP_192.168.1.45</p>
            <p><span className="text-yellow-500">[WARN]</span> Paper_Tray_2_Empty - Refill requested</p>
            <p><span className="text-green-500">[OK]</span> UPI_Payment_Verified: ₹120 - TXN_88421</p>
         </div>
       </div>
    </div>
  );

  if (isMobileUploadPage) {
    return <MobileUploadUI />;
  }

  return (
    <div className="fixed inset-0 bg-[#f8fafc] text-[#1e293b] font-sans selection:bg-blue-100 flex items-center justify-center p-4">
      {/* Kiosk Chassis Mockup */}
      <div className="w-full h-full max-w-[1400px] max-h-[1000px] bg-white rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,0.1)] overflow-hidden border-[12px] border-[#e2e8f0] relative flex flex-col">
        
        {/* Header Bar */}
        {step !== 'welcome' && !isAdmin && (
          <div className="h-20 bg-white border-b border-gray-100 px-12 flex items-center justify-between">
            <div className="flex items-center gap-4">
               <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black">S</div>
               <span className="font-bold text-xl tracking-tight">SmartPrint <span className="text-blue-600">Kiosk</span></span>
            </div>
            <div className="flex items-center gap-8">
               <div className="flex items-center gap-3 bg-gray-50 px-6 py-2 rounded-2xl border border-gray-100">
                  <div className={cn("w-3 h-3 rounded-full animate-pulse", timeLeft < 60 ? "bg-red-500" : "bg-green-500")} />
                  <span className={cn("font-mono font-bold text-lg", timeLeft < 60 ? "text-red-500" : "text-gray-700")}>
                    {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                  </span>
               </div>
               <button 
                 onDoubleClick={() => setIsAdmin(true)} // Hidden double-click to enter admin
                 onClick={endSession} 
                 className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-red-500 active:scale-90 transition-all"
               >
                 <X size={28} />
               </button>
            </div>
          </div>
        )}

        {/* Content Area */}
        <main className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
             <motion.div
               key={step + (isAdmin ? 'admin' : 'user')}
               initial={{ opacity: 0, x: 20 }}
               animate={{ opacity: 1, x: 0 }}
               exit={{ opacity: 0, x: -20 }}
               transition={{ duration: 0.4 }}
               className="h-full"
             >
                {isAdmin ? renderAdmin() : (
                  <>
                    {step === 'welcome' && renderWelcome()}
                    {step === 'language' && renderLanguage()}
                    {step === 'upload-source' && renderUploadSource()}
                    {step === 'security-scan' && renderSecurityScan()}
                    {step === 'preview' && renderPreview()}
                    {step === 'settings' && renderSettings()}
                    {step === 'payment' && renderPayment()}
                    {step === 'printing' && renderPrinting()}
                    {step === 'thank-you' && renderThankYou()}
                  </>
                )}
             </motion.div>
          </AnimatePresence>
        </main>

        {/* Footer Accent */}
        <div className="h-4 bg-gray-50 border-t border-gray-100 flex">
           <div className="h-full bg-blue-600" style={{ width: `${(timeLeft / SESSION_TIMEOUT) * 100}%`, transition: 'width 1s linear' }} />
        </div>
      </div>
      
      {/* Decorative Surroundings */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-blue-50/50 via-white to-gray-50/50 pointer-events-none" />
    </div>
  );
}
}
