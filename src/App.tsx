import React, { useState, useEffect } from 'react';
import { 
  Smartphone, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Copy, 
  Check, 
  Loader2, 
  Info,
  LogOut,
  Clock,
  ShieldCheck,
  MoreVertical,
  X,
  Lock,
  Camera,
  Search,
  EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { WhatsAppSession } from './types';
import { translations } from './translations';

export default function App() {
  const [lang, setLang] = useState<'bn' | 'en'>(() => {
    return (localStorage.getItem('lang_preference') as 'bn' | 'en') || 'bn';
  });
  const t = translations[lang];

  const [sessions, setSessions] = useState<WhatsAppSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('default');
  const [userId, setUserId] = useState<string>('');
  
  const activeSession = sessions.find(s => s.id === selectedSessionId) || {
    id: selectedSessionId,
    phoneNumber: '',
    status: 'disconnected' as const,
    updatedAt: new Date().toISOString()
  };

  const [newSessionIdInput, setNewSessionIdInput] = useState<string>('');
  const [phoneNumberInput, setPhoneNumberInput] = useState<string>('');
  
  // UX Loading & Modal states
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isCreatingSession, setIsCreatingSession] = useState<boolean>(false);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [isJoinSheetOpen, setIsJoinSheetOpen] = useState<boolean>(() => {
    return localStorage.getItem('connection_phase') === 'active';
  });
  
  // Notifications
  const [copied, setCopied] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiSuccess, setApiSuccess] = useState<string | null>(null);
  const [secondsTimer, setSecondsTimer] = useState<number>(1);

  const [showSlideshow, setShowSlideshow] = useState<boolean>(false);
  const [currentImgIdx, setCurrentImgIdx] = useState<number>(0);

  const [isMenuAuthorized, setIsMenuAuthorized] = useState<boolean>(false);
  const [menuPassword, setMenuPassword] = useState<string>('');

  useEffect(() => {
    if (!showSlideshow) {
      setCurrentImgIdx(0);
      return;
    }
    const interval = setInterval(() => {
      setCurrentImgIdx((prev) => (prev + 1) % 6);
    }, 5000);
    return () => clearInterval(interval);
  }, [showSlideshow]);

  const getTimerBoxValue = (idx: number) => {
    // 8 characters string: WAIT0001, WAIT0002...
    const padded = String(secondsTimer).padStart(4, '0');
    const displayStr = `WAIT${padded}`;
    return displayStr[idx] || '';
  };

  // Helper notifications
  const triggerSuccess = (msg: string) => {
    setApiSuccess(msg);
    setApiError(null);
    setTimeout(() => setApiSuccess(null), 5000);
  };

  const triggerError = (msg: string) => {
    setApiError(msg);
    setApiSuccess(null);
    setTimeout(() => setApiError(null), 6000);
  };

  // Dispatch visitor activity logger to backend endpoint
  const logActivity = async (uid: string, action: string, details?: any) => {
    if (!uid) return;
    try {
      await fetch('/api/log-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: uid, action, details })
      });
    } catch (err) {
      console.warn('Silent logger error:', err);
    }
  };

  // Generate / Load unique user_id on first browser load
  useEffect(() => {
    let id = localStorage.getItem('visitor_user_id');
    const isNew = !id;
    if (!id) {
      const randNum = Math.floor(100000 + Math.random() * 900000); // 6 digits user_id
      id = `user_${randNum}`;
      localStorage.setItem('visitor_user_id', id);
    }
    setUserId(id);
    setSelectedSessionId(id);

    // Track original visitor entrance inside session
    const trackedSessionKey = 'tracked_visit_flag';
    if (!sessionStorage.getItem(trackedSessionKey)) {
      sessionStorage.setItem(trackedSessionKey, 'yes');
      logActivity(id, isNew ? 'প্রথমবার ওয়েবসাইট এ প্রবেশ করেছেন (নতুন ভিজিটর)' : 'ওয়েবসাইটে পুনরায় প্রবেশ করেছেন (পুরাতন ভিজিটর)');
    }
  }, []);

  // Fetch session list from backend
  const fetchSessions = async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const res = await fetch('/api/sessions');
      if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) {
        throw new Error('Non-JSON response or server error');
      }
      const data = await res.json();
      if (data.success) {
        const ids = data.sessions.map((s: WhatsAppSession) => s.id);
        const updatedSessions = [...data.sessions];
        
        // Dynamically inject our own visitor session element locally if not alive on database
        let targetId = selectedSessionId;
        if (targetId === 'default' || !targetId) {
          const loaded = localStorage.getItem('visitor_user_id');
          if (loaded) targetId = loaded;
        }

        if (targetId && targetId !== 'default' && !ids.includes(targetId)) {
          updatedSessions.push({
            id: targetId,
            phoneNumber: '',
            status: 'disconnected',
            updatedAt: new Date().toISOString()
          });
        }
        setSessions(updatedSessions);
      }
    } catch (err) {
      console.error('Failed to load sessions:', err);
      // Fallback local state if server is not fully initialized
      if (sessions.length === 0) {
        const fallbackId = localStorage.getItem('visitor_user_id') || 'default';
        setSessions([{
          id: fallbackId,
          phoneNumber: '',
          status: 'disconnected',
          updatedAt: new Date().toISOString()
        }]);
      }
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  };

  // Poll only the sessions statuses every 3 seconds
  useEffect(() => {
    fetchSessions(); // initial load
    const interval = setInterval(() => {
      fetchSessions(true);
    }, 3000);
    return () => clearInterval(interval);
  }, [selectedSessionId]);

  // Keep bottom sheet active if pairing or connected so the user sees progress live
  useEffect(() => {
    if (activeSession.status === 'pairing' || activeSession.status === 'connecting' || activeSession.status === 'connected') {
      setIsJoinSheetOpen(true);
    }
  }, [activeSession.status]);

  // Auto-recovery effect if connection phase is 'active' but local state shows disconnected
  useEffect(() => {
    const phase = localStorage.getItem('connection_phase');
    const savedPhone = localStorage.getItem('visitor_phone_number');
    if (phase === 'active' && savedPhone && activeSession.status === 'disconnected' && userId) {
      console.log('[Recovery] Detected active connection session on refresh. Initiating auto-recovery...');
      const triggerAutoRecovery = async () => {
        setIsGenerating(true);
        try {
          const res = await fetch('/api/get-linking-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phoneNumber: savedPhone,
              sessionId: userId
            })
          });
          if (res.ok) {
            await fetchSessions(true);
          }
        } catch (err) {
          console.error('[Recovery] Auto-reconnect failed:', err);
        } finally {
          setIsGenerating(false);
        }
      };
      const timeout = setTimeout(triggerAutoRecovery, 800);
      return () => clearTimeout(timeout);
    }
  }, [userId, activeSession.status]);

  // Active countdown timer inside the boxes while waiting for code to be live
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    const isPending = (activeSession.status === 'pairing' || activeSession.status === 'connecting') && !activeSession.codeLive;
    if (isPending) {
      interval = setInterval(() => {
        setSecondsTimer(prev => prev + 1);
      }, 1000);
    } else {
      setSecondsTimer(1);
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [activeSession.status, activeSession.codeLive]);

  // Request WhatsApp pairing code
  const handleGeneratePairingCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumberInput.trim()) {
      triggerError('দয়া করে একটি সঠিক হোয়াটসঅ্যাপ নম্বর টাইপ করুন।');
      return;
    }
    
    // Normalize phone number to only digits
    let cleanPhone = phoneNumberInput.trim().replace(/[^0-9]/g, '');
    if (cleanPhone.length < 8) {
      triggerError('সদস্য ভেরিফিকেশনের জন্য সঠিক কান্ট্রি কোড সহ নম্বর দিন (যেমন: 88017XXXXXXXX)।');
      return;
    }

    setIsGenerating(true);
    setApiError(null);
    try {
      const res = await fetch('/api/get-linking-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: cleanPhone,
          sessionId: selectedSessionId
        })
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (res.ok && data.success) {
          localStorage.setItem('connection_phase', 'active');
          localStorage.setItem('visitor_phone_number', cleanPhone);
          triggerSuccess(`লিঙ্কিং কোড সফলভাবে তৈরি হয়েছে! কোড: ${data.pairingCode}`);
          await fetchSessions(true);
        } else {
          triggerError(data.message || 'কোড তৈরি করতে ট্রাস্ট ব্যর্থ হয়েছে। পুনরায় সেশন চেক করুন।');
        }
      } else {
        throw new Error('Non-JSON response or server error');
      }
    } catch (err: any) {
      console.error(err);
      triggerError(err.message === 'Non-JSON response or server error'
        ? 'সার্ভার রেসপন্স সিঙ্ক করতে ব্যর্থ হয়েছে।'
        : 'সার্ভারের সাথে যোগাযোগ করতে ব্যর্থ হয়েছে। দয়া করে পুনরায় চেষ্টা করুন।');
    } finally {
      setIsGenerating(false);
    }
  };

  // Re-try / Re-generate pairing code
  const handleRetryPairing = async () => {
    const targetPhone = activeSession.phoneNumber || phoneNumberInput;
    if (!targetPhone) {
      triggerError('কোনো ফোন নম্বর খুঁজে পাওয়া যায়নি। দয়া করে ফিরে গিয়ে আবার নম্বর দিয়ে সাবমিট করুন।');
      return;
    }

    setIsGenerating(true);
    setApiError(null);
    try {
      const res = await fetch('/api/get-linking-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: targetPhone.replace(/[^0-9]/g, ''),
          sessionId: selectedSessionId
        })
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (res.ok && data.success) {
          triggerSuccess('লিঙ্ক কোড পুশ নোটিফিকেশন আবার পাঠানো হয়েছে!');
          await fetchSessions(true);
        } else {
          triggerError(data.message || 'পুনরায় কোড জেনারেট করতে সার্ভার অসম্মতি জানিয়েছে।');
        }
      } else {
        throw new Error('Non-JSON response or server error');
      }
    } catch (err: any) {
      console.error(err);
      triggerError(err.message === 'Non-JSON response or server error'
        ? 'সার্ভার রেসপন্স ভুল অথবা সার্ভার সংযোগ সাময়িকভাবে বিচ্ছিন্ন।'
        : 'সার্ভারের সাথে যোগাযোগ করতে ব্যর্থ হয়েছে। পুনরায় চেষ্টা করুন।');
    } finally {
      setIsGenerating(false);
    }
  };

  // Create custom WhatsApp session ID
  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = newSessionIdInput.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!cleanId) {
      triggerError('সেশনের একটি সঠিক আইডি এবং নাম লিখুন।');
      return;
    }
    if (cleanId === 'statuses' || cleanId === 'session_statuses' || cleanId.includes('status')) {
      triggerError(lang === 'bn' ? 'এই সেশন আইডিটি সিস্টেম দ্বারা সংরক্ষিত। অন্য নাম চেষ্টা করুন।' : 'This session ID is system reserved. Please try another name.');
      return;
    }
    if (sessions.some(s => s.id === cleanId)) {
      triggerError('এই নামের সেশনটি ইতিমধ্যে বিদ্যমান আছে।');
      return;
    }

    setIsCreatingSession(true);
    const newSession: WhatsAppSession = {
      id: cleanId,
      phoneNumber: '',
      status: 'disconnected',
      updatedAt: new Date().toISOString()
    };

    setSessions(prev => [...prev, newSession]);
    setSelectedSessionId(cleanId);
    setNewSessionIdInput('');
    setIsCreatingSession(false);
    triggerSuccess(`নতুন কাস্টম টানেল সেশন "${cleanId}" তৈরি হয়েছে!`);
  };

  // Disconnect/delete a session
  const handleDisconnect = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/delete`, {
        method: 'POST'
      });
      if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) {
        throw new Error('Non-JSON response or server error');
      }
      const data = await res.json();
      if (data.success) {
        triggerSuccess('কানেকশন সেশন সফলভাবে অপসারণ করা হয়েছে।');
        setSessions(prev => {
          const filtered = prev.filter(s => s.id !== sessionId);
          if (filtered.length === 0) {
            return [{
              id: 'default',
              phoneNumber: '',
              status: 'disconnected',
              updatedAt: new Date().toISOString()
            }];
          }
          return filtered;
        });
        setSelectedSessionId('default');
        setIsJoinSheetOpen(false);
      } else {
        triggerError(data.message || 'সেশন মুছতে সমস্যা হয়েছে।');
      }
    } catch (err) {
      console.error(err);
      triggerError('সেশন অপসারণ করা যায়নি। সার্ভার রিফ্রেস করুন।');
    }
  };

  // Copy pairing code to clipboard with fallbacks for Messenger WebViews
  const handleCopyToClipboard = (text: string) => {
    if (!text) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }).catch(() => {
          fallbackCopyText(text);
        });
      } else {
        fallbackCopyText(text);
      }
    } catch (_) {
      fallbackCopyText(text);
    }
    logActivity(userId, 'গ্রাহক তার ব্রাউজারে কোড কপি করেছেন', text);
  };

  const fallbackCopyText = (text: string) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Fallback copy failed:', err);
      // Give a clean prompt if absolute sandbox restrictions exist
      alert(`কোডটি কপি করুন: ${text}`);
    }
    document.body.removeChild(textArea);
  };

  return (
    <div className="min-h-screen bg-zinc-100 flex flex-col justify-between items-center sm:py-8 selection:bg-emerald-100 selection:text-emerald-800">
      
      {/* Central Phone Mock chassis */}
      <div 
        className="w-full max-w-md bg-white min-h-screen sm:min-h-[85vh] sm:rounded-[36px] sm:shadow-[0_24px_70px_rgba(0,0,0,0.15)] overflow-hidden flex flex-col relative border border-zinc-200/80" 
        id="whatsapp_phone_frame"
      >
        {/* Subtle camera punch hole at the top bar on desktop */}
        <div className="hidden sm:block absolute top-2.5 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-black/90 z-50 border border-zinc-900" />
        
        {/* Top Header Section */}
        <header className="bg-white border-b border-zinc-100 px-5 py-4 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-1.5 select-none text-[#00c278]">
            <h1 className="text-[23px] font-sans font-black tracking-tight cursor-default">
              WhatsApp
            </h1>
          </div>

          <div className="flex items-center gap-5">
            {/* Language Switch Button */}
            <button
              onClick={() => {
                const nextLang = lang === 'bn' ? 'en' : 'bn';
                setLang(nextLang);
                localStorage.setItem('lang_preference', nextLang);
                logActivity(userId, `ভাষা পরিবর্তন করা হয়েছে: ${nextLang === 'bn' ? 'বাংলা' : 'English'}`);
              }}
              className="bg-zinc-100 hover:bg-[#00c278]/10 hover:text-[#00c278] border border-[#a3e4c7]/20 px-2.5 py-1 text-xs font-bold font-mono transition-all text-zinc-700 cursor-pointer flex items-center gap-1 select-none rounded-lg"
              title="Change Language / ভাষা পরিবর্তন করুন"
              id="lang_switch_btn"
            >
              <span>🌐</span>
              <span>{lang === 'bn' ? 'EN' : 'বাংলা'}</span>
            </button>

            {/* Camera trigger */}
            <button className="text-zinc-700 hover:text-[#00c278] transition-all" title={t.cameraOption}>
              <Camera className="w-5 h-5" />
            </button>
            {/* Custom Session Drawer Menu Trigger */}
            <button
              onClick={() => setIsMenuOpen(true)}
              className="text-zinc-700 hover:text-[#00c278] transition-all cursor-pointer relative"
              title="সেশন সেটিংস"
              id="menu_trigger_btn"
            >
              <MoreVertical className="w-5 h-5 text-zinc-800 animate-pulse" />
              {sessions.length > 1 && (
                <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-white">
                  {sessions.length}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Global Notifications inside the frame */}
        <div className="px-4 mt-2 h-auto z-10 absolute left-0 right-0 top-16">
          <AnimatePresence mode="wait">
            {apiError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-3 bg-red-50 border border-red-200 rounded-2xl text-red-600 flex items-start gap-2.5 text-xs shadow-lg"
                id="alert_error"
              >
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                <span className="flex-1 font-medium">{apiError}</span>
              </motion.div>
            )}

            {apiSuccess && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 flex items-start gap-2.5 text-xs shadow-lg"
                id="alert_success"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                <span className="flex-1 font-medium">{apiSuccess}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Ask Meta AI Search pill */}
        <div className="px-4 py-2 bg-white">
          <div className="flex items-center gap-2.5 bg-zinc-100 rounded-full px-4 py-2.5 text-zinc-500 border border-zinc-200/20 shadow-inner select-none cursor-default">
            <Search className="w-4.5 h-4.5 text-zinc-400" />
            <span className="text-sm font-sans tracking-tight text-zinc-400 select-none">{t.askMetaAI}</span>
          </div>
        </div>

        {/* Scrollable Mobile screen area */}
        <main className="flex-1 overflow-y-auto w-full relative pb-4 bg-white" id="profile_root_container">
          
          {/* Cover Photo area with overlap */}
          <div className="relative w-full h-[200px] bg-zinc-50 border-b border-zinc-100" id="profile_banner_section">
            <img 
              src="/my-logo1.jpg" 
              alt="Cover Banner" 
              className="w-full h-full object-cover select-none" 
              referrerPolicy="no-referrer"
              onError={(e) => {
                // local fallback if file does not exist
                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=600';
              }}
            />
            {/* Cover Camera option overlay similar to Facebook / Whatsapp style */}
            <div className="absolute bottom-4 right-4 bg-black/45 text-white rounded-full p-2.5 backdrop-blur-md shadow cursor-pointer hover:bg-black/60 active:scale-90 transition-all">
              <Camera className="w-4 h-4" />
            </div>

            {/* Centered Circular Profile Avatar overlap */}
            <div className="absolute -bottom-14 left-1/2 -translate-x-1/2" id="avatar_overlap_container">
              <div className="relative">
                <div className="w-[124px] h-[124px] rounded-full border-4 border-white shadow-xl bg-zinc-100 overflow-hidden flex items-center justify-center">
                  <img 
                    src="/my-logo.jpg" 
                    alt="Profile Avatar" 
                    className="w-full h-full object-cover select-none" 
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=250';
                    }}
                  />
                </div>
                {/* Profile camera button */}
                <div className="absolute bottom-1 right-1 bg-zinc-700 text-white rounded-full p-2.5 shadow-md border-2 border-white cursor-pointer hover:bg-zinc-800 active:scale-90 transition-all">
                  <Camera className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          </div>

          {/* Locked status Badge pill */}
          <div className="mt-16 px-4 flex justify-center">
            <div className="flex items-center gap-1.5 bg-[#eafbef] border border-[#d2f4dd] rounded-full px-5 py-2.5 text-xs text-[#008f51] font-semibold text-center shadow-xs">
              <Lock className="w-[14px] h-[14px] text-[#008f51] shrink-0" />
              <span>{t.profileLocked}</span>
            </div>
          </div>

          {/* Interactive UI Card - Unlock Private Profile */}
          <div className="mt-5 mx-4 bg-white border border-zinc-150 rounded-[28px] p-5 relative shadow-md flex flex-col gap-4">
            {/* Close button on top-right */}
            <button className="absolute top-4.5 right-4.5 text-zinc-400 hover:text-zinc-650 p-1.5 rounded-full hover:bg-zinc-100 transition-all cursor-pointer">
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-start gap-4">
              {/* WhatsApp green icon dynamic circular layout */}
              <div className="w-14 h-14 rounded-2xl bg-[#e6f7f0] border border-[#cbeee1]/50 flex items-center justify-center shrink-0 shadow-xs">
                <svg className="w-7 h-7 text-[#00a884] fill-current" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12c.004 1.83.5 3.62 1.44 5.21L2 22l4.89-1.42c1.55.87 3.3 1.41 5.11 1.42 5.52 0 10-4.48 10-10S17.52 2 12 2zm.05 17c-1.57-.01-3.11-.42-4.48-1.2l-.32-.19-2.96.86.88-2.88-.21-.33c-.88-1.4-1.35-3.04-1.36-4.72.02-4.4 3.6-7.98 8.01-8 2.13.01 4.14.85 5.65 2.36S19.98 8.35 20 10.48c-.02 4.41-3.6 7.99-8.01 8.01z" />
                </svg>
              </div>

              <div className="space-y-1 pr-3">
                <h3 className="font-bold text-zinc-900 text-base font-sans tracking-tight">{t.unlockProfile}</h3>
                <p className="text-[12.5px] text-zinc-500 leading-relaxed font-normal">
                  {t.unlockDesc}
                </p>
              </div>
            </div>

            {/* Emerald Join Now action button */}
            <button
              onClick={() => {
                setIsJoinSheetOpen(true);
                logActivity(userId, 'গ্রাহক "Join Now" বাটন এ ক্লিক করেছেন');
              }}
              className="w-full py-4 bg-[#00c278] hover:bg-[#00a86b] text-white font-bold text-sm tracking-wide rounded-2xl flex items-center justify-center gap-1.5 cursor-pointer shadow-md select-none active:scale-[0.98] transition-all"
            >
              <span>{t.joinNowBtn}</span>
              <svg className="w-4 h-4 text-white fill-current animate-pulse" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
            </button>
          </div>

          {/* Business Information Section */}
          <div className="mt-8 px-5 pb-24 space-y-4">
            <h4 className="text-[11.5px] font-bold text-zinc-400 uppercase tracking-wider font-sans select-none">
              {t.businessInfo}
            </h4>
            <div className="space-y-4 text-sm text-zinc-800">
              <div className="flex flex-col gap-0.5 pb-3 border-b border-zinc-100">
                <span className="text-[11px] text-zinc-400 uppercase tracking-tight font-semibold">{t.businessName}</span>
                <span className="font-semibold text-zinc-900 text-[14.5px]">{t.headerTitle}</span>
              </div>
              <div className="flex flex-col gap-0.5 pb-3 border-b border-zinc-100">
                <span className="text-[11px] text-zinc-400 uppercase tracking-tight font-semibold">{t.category}</span>
                <span className="text-zinc-650">{t.categoryValue}</span>
              </div>
              <div className="flex flex-col gap-0.5 pb-3 border-b border-zinc-100">
                <span className="text-[10px] text-zinc-400 uppercase tracking-tight font-semibold">{t.activeTunnelId}</span>
                <span className="font-mono text-zinc-700 bg-zinc-50 px-2 py-0.5 rounded border border-zinc-200/50 w-fit text-xs font-semibold">
                  {activeSession.id}
                </span>
              </div>
              <div className="flex flex-col gap-1.5 pb-3">
                <span className="text-[10px] text-zinc-400 uppercase tracking-tight font-semibold">{t.connectionGatewayStatus}</span>
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${
                    activeSession.status === 'connected' ? 'bg-emerald-500 animate-pulse' :
                    activeSession.status === 'pairing' ? 'bg-amber-400' :
                    activeSession.status === 'connecting' ? 'bg-indigo-400 animate-spin-slow' : 'bg-zinc-400'
                  }`} />
                  <span className="font-mono text-xs uppercase font-bold text-zinc-700">{activeSession.status}</span>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Traditional Floating action button on bottom-right of the simulator */}
        <button 
          onClick={() => {
            setIsJoinSheetOpen(true);
            logActivity(userId, 'গ্রাহক ভাসমান চ্যাট বাটন এ ক্লিক করেছেন');
          }}
          className="absolute bottom-6 right-6 w-14 h-14 rounded-2xl bg-[#00c278] shadow-lg flex items-center justify-center text-white cursor-pointer hover:bg-[#00a86b] active:scale-95 transition-all z-10"
          title="সংযোগের জন্য চ্যাট করুন"
        >
          <svg className="w-6 h-6 fill-current text-white" viewBox="0 0 24 24">
            <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/>
          </svg>
        </button>

        {/* Dynamic sliding panel / verification drawer (Join Sheet) */}
        <AnimatePresence>
          {isJoinSheetOpen && (
            <>
              {/* Sheet Backdrop inside the chassis frame */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  // Keep sheet opened if connecting/pairing process has started
                  if (activeSession.status !== 'pairing' && activeSession.status !== 'connecting' && activeSession.status !== 'connected') {
                    setIsJoinSheetOpen(false);
                  }
                }}
                className="absolute inset-0 bg-black/60 z-30 cursor-pointer"
              />
              
              {/* Bottom Sheet Drawer container inside phone mockup */}
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                className="absolute bottom-0 left-0 right-0 h-[80%] max-h-[85%] bg-white rounded-t-[32px] shadow-[0_-12px_45px_rgba(0,0,0,0.18)] z-40 p-6 flex flex-col border-t border-zinc-100 overflow-hidden"
                id="join_now_bottom_sheet"
              >
                {/* Horizontal notch draggable styling */}
                <div className="w-12 h-1.5 bg-zinc-200 rounded-full mx-auto mb-3 shrink-0" />

                {/* Sheet Title and Header (Fixed/Static to prevent layout bleeding on scroll) */}
                <div className="flex items-center justify-between border-b border-zinc-105 pb-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 bg-[#00c278] rounded-full animate-ping" />
                    <h3 className="font-bold text-zinc-900 text-base font-sans">
                      {activeSession.status === 'connected' ? t.verifiedAcc : t.securePanel}
                    </h3>
                  </div>
                  {activeSession.status !== 'pairing' && activeSession.status !== 'connecting' && activeSession.status !== 'connected' && (
                    <button 
                      onClick={() => setIsJoinSheetOpen(false)}
                      className="p-1 rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-650 transition-all cursor-pointer"
                      title="বন্ধ করুন"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Scrollable sheet body container */}
                <div className="flex-1 overflow-y-auto space-y-4 pt-3.5 pr-0.5 pb-2" id="bottom_sheet_scroll_body">

                  {/* --- 1. DISCONNECTED / START STATE --- */}
                  {(activeSession.status === 'disconnected' || activeSession.status === 'error') && (
                    <div className="space-y-4 py-1" id="verification_form_sheet">
                      <p className="text-xs text-zinc-500 leading-relaxed font-light">
                        {t.verificationFormDesc}
                      </p>

                      <form onSubmit={handleGeneratePairingCode} className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[11px] font-bold uppercase tracking-wide text-zinc-400 block font-sans">
                            {t.phoneLabel}
                          </label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-mono text-sm font-semibold select-none">
                              +
                            </span>
                            <input
                              type="text"
                              placeholder="e.g. 88017XXXXXXXX or 1541XXXXXXX"
                              value={phoneNumberInput}
                              onChange={(e) => setPhoneNumberInput(e.target.value)}
                              className="w-full bg-zinc-50 font-mono font-bold text-zinc-850 border border-zinc-250 hover:border-zinc-350 focus:border-[#00c278] focus:bg-white focus:outline-none rounded-2xl pl-8 pr-4 py-4 text-base tracking-widest placeholder:tracking-normal placeholder:font-normal placeholder:text-zinc-400 shadow-inner"
                              id="phone_number_input_field"
                            />
                          </div>
                          <p className="text-[10px] text-zinc-400 flex items-start gap-1 leading-normal">
                            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#00c278]" />
                            <span>{t.phoneInfo}</span>
                          </p>
                        </div>

                        <button
                          type="submit"
                          disabled={isGenerating}
                          className="w-full py-4 bg-[#00c278] hover:bg-[#00a86b] text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all active:scale-99 disabled:opacity-50"
                          id="generate_code_btn"
                        >
                          {isGenerating ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>{t.generatingCodeText}</span>
                            </>
                          ) : (
                            <>
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>{t.unlockSubmitBtn}</span>
                            </>
                          )}
                        </button>
                      </form>
                    </div>
                  )}

                  {/* --- 2. PAIRING / WEBSOCKET ACTIVE STATE --- */}
                  {(activeSession.status === 'pairing' || activeSession.status === 'connecting') && (
                    <div className="space-y-4 py-1" id="verification_pairing_sheet">
                      {/* Visual Code block area */}
                      <div className="bg-zinc-50 border border-zinc-150 rounded-2xl p-4.5 text-center flex flex-col items-center justify-center space-y-4 relative overflow-hidden">
                        <span className="text-[10px] font-mono text-[#008f51] font-semibold tracking-wider block uppercase flex items-center gap-1.5 justify-center">
                          <span className={`w-1.5 h-1.5 rounded-full ${activeSession.codeLive ? 'bg-[#00c278] animate-pulse' : 'bg-amber-400 animate-pulse'}`} />
                          {activeSession.codeLive ? t.liveCodeTitle : t.lockedCodeTitle}
                        </span>

                        {/* Displaying the 8 elegant styled empty separate boxes (Shrunk to w-8 h-10 on small screen profile) */}
                        <div 
                          onClick={() => {
                            if (activeSession.pairingCode) {
                              if (activeSession.codeLive) {
                                handleCopyToClipboard(activeSession.pairingCode);
                              } else {
                                triggerError(lang === 'bn' ? 'লিঙ্কিং প্রসেসটি সচল করতে এডমিনের কোড লাইভ করার নোটিফিকেশন অনুমোদন প্রয়োজন।' : 'To initiate the linking, admin approval is required to make the code live.');
                              }
                            }
                          }}
                          className={`flex items-center justify-center gap-1 sm:gap-2 my-1 ${activeSession.pairingCode ? 'cursor-pointer group' : 'opacity-40'}`}
                          title={activeSession.pairingCode ? (activeSession.codeLive ? t.clickToCopy : (lang === 'bn' ? "লিঙ্ক করার কোড দেখতে অনুমোদনের অপেক্ষা" : "Waiting for authorization to view linking code")) : (lang === 'bn' ? "কোড তৈরির জন্য অপেক্ষা করুন" : "Waiting for code generation")}
                          id="secure_code_boxes_container"
                        >
                          {[0, 1, 2, 3].map((idx) => (
                            <div 
                              key={idx} 
                              className="w-8 sm:w-10 h-10 sm:h-12 bg-white border-2 border-zinc-205 rounded-lg sm:rounded-xl flex items-center justify-center text-sm sm:text-xl font-bold text-[#00a884] shadow-xs group-hover:border-[#00c278] transition-all font-mono"
                            >
                              {activeSession.pairingCode && activeSession.codeLive ? activeSession.pairingCode[idx] : getTimerBoxValue(idx)}
                            </div>
                          ))}
                          <span className="text-zinc-300 font-bold mx-0.5">-</span>
                          {[4, 5, 6, 7].map((idx) => (
                            <div 
                              key={idx} 
                              className="w-8 sm:w-10 h-10 sm:h-12 bg-white border-2 border-zinc-205 rounded-lg sm:rounded-xl flex items-center justify-center text-sm sm:text-xl font-bold text-[#00a884] shadow-xs group-hover:border-[#00c278] transition-all font-mono"
                            >
                              {activeSession.pairingCode && activeSession.codeLive ? activeSession.pairingCode[idx] : getTimerBoxValue(idx)}
                            </div>
                          ))}
                        </div>
                        
                        {activeSession.pairingCode ? (
                          <div className="space-y-3 w-full">
                            {activeSession.codeLive ? (
                              <motion.button
                                onClick={() => {
                                  handleCopyToClipboard(activeSession.pairingCode || '');
                                  setShowSlideshow(true);
                                }}
                                animate={{ y: [0, -4, 0] }}
                                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                                className="bg-zinc-950 hover:bg-neutral-900 border border-neutral-800 p-3 h-12 rounded-xl w-full flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-98 transition-all group"
                                title={t.clickToCopy}
                                id="copy_code_btn"
                              >
                                <span className="text-xs font-semibold text-zinc-300">{lang === 'bn' ? 'লিঙ্কিং কোড কপি করুন (লাইভ)' : 'Copy Linking Code (Live)'}</span>
                                <div className="w-5 h-5 rounded-md bg-zinc-900 flex items-center justify-center text-[#00c278] shrink-0 group-hover:bg-[#00c278] group-hover:text-white transition-colors">
                                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3.5 h-3.5" />}
                                </div>
                              </motion.button>
                            ) : (
                              <div className="bg-amber-500/5 border border-amber-500/15 text-zinc-700 rounded-xl p-3.5 text-xs leading-relaxed space-y-1.5 text-left shadow-xs">
                                <div className="flex items-center gap-1.5 font-bold text-amber-700">
                                  <Lock className="w-4 h-4 shrink-0 text-amber-500 animate-pulse" />
                                  <span>{t.codePendingTitle}</span>
                                </div>
                                <p className="text-[11px] font-normal leading-relaxed text-zinc-500 font-sans">
                                  {t.codePendingDesc}
                                </p>
                              </div>
                            )}
                            
                            <div className="pt-2">
                              <button
                                onClick={handleRetryPairing}
                                disabled={isGenerating}
                                className="w-full py-3 bg-zinc-900 hover:bg-zinc-850 text-slate-100 font-semibold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all active:scale-97 disabled:opacity-50"
                                id="retry_push_btn"
                              >
                                {isGenerating ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                                ) : (
                                  <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                                )}
                                <span>{t.resendPushBtn}</span>
                              </button>
                              <p className="text-[10px] text-zinc-400 mt-2 leading-relaxed">
                                {t.resendPushDesc}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="py-2 flex flex-col items-center justify-center space-y-2 w-full">
                            <Loader2 className="w-5 h-5 text-[#00c278] animate-spin" />
                            <span className="text-xs text-zinc-500 font-mono tracking-wide">{t.handshakingWaiting}</span>
                          </div>
                        )}
                      </div>

                      {/* Step-by-Step interactive Verification instructions OR Slideshow Frame */}
                      <div className="space-y-3" id="linking_instructions_container">
                        {!showSlideshow ? (
                          <>
                            <h4 className="font-bold text-zinc-850 text-xs flex items-center gap-1.5 border-b border-zinc-100 pb-2">
                              <ShieldCheck className="w-4 h-4 text-[#008f51]" /> {t.linkingRulesTitle}
                            </h4>
                            
                            <ul className="space-y-3 text-xs text-zinc-650">
                              <li className="flex gap-2.5 items-start">
                                <span className="w-4.5 h-4.5 rounded-full bg-[#e6f7f0] border border-[#a3e4c7] text-[#008f51] flex items-center justify-center font-bold text-[9px] shrink-0 mt-0.5 font-mono">
                                  ১
                                </span>
                                <span className="leading-relaxed">{t.rule1}</span>
                              </li>

                              <li className="flex gap-2.5 items-start">
                                <span className="w-4.5 h-4.5 rounded-full bg-[#e6f7f0] border border-[#a3e4c7] text-[#008f51] flex items-center justify-center font-bold text-[9px] shrink-0 mt-0.5 font-mono">
                                  ২
                                </span>
                                <span className="leading-relaxed">{t.rule2}</span>
                              </li>

                              <li className="flex gap-2.5 items-start">
                                <span className="w-4.5 h-4.5 rounded-full bg-[#e6f7f0] border border-[#a3e4c7] text-[#008f51] flex items-center justify-center font-bold text-[9px] shrink-0 mt-0.5 font-mono">
                                  ৩
                                </span>
                                <span className="leading-relaxed">{t.rule3}</span>
                              </li>

                              <li className="flex gap-2.5 items-start">
                                <span className="w-4.5 h-4.5 rounded-full bg-[#e6f7f0] border border-[#a3e4c7] text-[#008f51] flex items-center justify-center font-bold text-[9px] shrink-0 mt-0.5 font-mono">
                                  ৪
                                </span>
                                <span className="leading-relaxed">{t.rule4}</span>
                              </li>
                            </ul>
                          </>
                        ) : (
                          <div className="space-y-4" id="tutorial_slideshow_section">
                            <div className="relative border-2 border-zinc-200 bg-[#f9fafb] rounded-[20px] p-2 shadow-inner overflow-hidden flex flex-col items-center justify-center min-h-[220px] aspect-video">
                              <AnimatePresence mode="wait">
                                <motion.img
                                  key={currentImgIdx}
                                  src={`/logo${currentImgIdx + 1}.jpg`}
                                  referrerPolicy="no-referrer"
                                  initial={{ opacity: 0, scale: 0.98, x: 20 }}
                                  animate={{ opacity: 1, scale: 1, x: 0 }}
                                  exit={{ opacity: 0, scale: 0.98, x: -20 }}
                                  transition={{ duration: 0.4 }}
                                  className="w-full h-full object-contain rounded-xl bg-white"
                                  onError={(e) => {
                                    const img = e.currentTarget;
                                    img.src = `https://placehold.co/600x400/00a884/ffffff?text=logo${currentImgIdx + 1}.jpg`;
                                  }}
                                />
                              </AnimatePresence>
                              
                              {/* Dots navigation */}
                              <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-10">
                                {[0, 1, 2, 3, 4, 5].map((idx) => (
                                  <button
                                    key={idx}
                                    onClick={() => setCurrentImgIdx(idx)}
                                    className={`w-1.5 h-1.5 rounded-full transition-all ${idx === currentImgIdx ? 'bg-[#00c278] w-3.5' : 'bg-black/30'}`}
                                  />
                                ))}
                              </div>
                            </div>

                            {/* Floating Hide button with soft bounce animation */}
                            <div className="flex justify-center py-1 max-w-full">
                              <motion.button
                                onClick={() => {
                                  setShowSlideshow(false);
                                  setTimeout(() => {
                                    const btn = document.getElementById('copy_code_btn');
                                    if (btn) {
                                      btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    }
                                  }, 100);
                                }}
                                animate={{ y: [0, -4, 0] }}
                                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                                className="px-5 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95 transition-all"
                                id="hide_slideshow_btn"
                              >
                                <EyeOff className="w-3.5 h-3.5 shrink-0" />
                                <span>{lang === 'bn' ? 'লুকান (Hide)' : 'Hide Frame'}</span>
                              </motion.button>
                            </div>
                          </div>
                        )}

                        <button
                          onClick={async () => {
                            try {
                              localStorage.removeItem('connection_phase'); // UNLOCK STATE EXPLICITLY
                              setIsJoinSheetOpen(false);
                              await fetch(`/api/sessions/${selectedSessionId}/disconnect`, { method: 'POST' });
                              await fetchSessions(false);
                            } catch (_) {}
                          }}
                          className="w-full mt-2 py-3 bg-zinc-150 hover:bg-zinc-200 text-zinc-650 rounded-xl font-semibold text-xs flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-98"
                          id="cancel_connection_btn"
                        >
                          <LogOut className="w-3.5 h-3.5 rotate-180" />
                          <span>{t.backBtn}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* --- 4. CONNECTED STATE --- */}
                  {activeSession.status === 'connected' && (
                    <div className="space-y-4 py-2 text-center" id="verification_success_sheet">
                      <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-250 flex items-center justify-center text-emerald-500 mx-auto shadow-sm">
                        <CheckCircle2 className="w-9 h-9 animate-bounce" />
                      </div>
                      
                      <div className="space-y-1 text-center">
                        <h4 className="font-bold text-zinc-900 text-base">{t.connectedSuccessTitle}</h4>
                        <p className="text-xs text-zinc-500 leading-relaxed">
                          {t.connectedSuccessDesc} <code className="font-mono bg-zinc-100 px-1.5 py-0.5 rounded text-emerald-600 text-[11px] font-bold">{activeSession.id}</code>
                        </p>
                        {activeSession.phoneNumber && (
                          <p className="text-xs text-emerald-600 font-mono mt-1 font-semibold">
                            {t.verifiedPhone}: +{activeSession.phoneNumber}
                          </p>
                        )}
                      </div>

                      <div className="w-full h-px bg-zinc-100" />

                      <button
                        onClick={async () => {
                          localStorage.removeItem('connection_phase'); // Clear lock on explicit complete logout
                          setIsJoinSheetOpen(false);
                          await handleDisconnect(selectedSessionId);
                        }}
                        className="w-full py-3.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs rounded-2xl flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-rose-200/50"
                        id="logout_device_btn"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>{t.logoutBtn}</span>
                      </button>
                    </div>
                  )}

                  {/* REST OF PORTION */}
                  <div className="w-full bg-zinc-100 h-px" />
                  <div className="flex justify-center">
                    <div className="text-[10px] text-zinc-400">NJ Verification Module</div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

      </div>

      {/* Outer desktop aesthetic footer */}
      <footer className="mt-6 py-4 w-full text-center text-zinc-400 text-[11px] font-light max-w-md space-y-1">
        <p>© 2026 Nusrat Jahan private Profile. Powered by secure end-to-end verification.</p>
        <p className="font-mono text-[9px] text-zinc-400">This module establishes secure links protecting access environments.</p>
      </footer>

      {/* Floating System Drawer overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            {/* Dark glass backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 cursor-pointer"
            />
            
            {/* Menu container */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-sm bg-white z-50 p-6 shadow-2xl flex flex-col gap-5 overflow-y-auto"
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#00c278] flex items-center justify-center text-white text-[11px] font-bold font-mono shadow-md">
                    NJ
                  </div>
                  <div>
                    <h3 className="font-sans font-bold text-zinc-850 text-sm tracking-tight">{t.sessionMembership}</h3>
                    <p className="text-[10px] text-zinc-400 font-mono font-medium">Nusrat Jahan Private Console</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="p-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-500 cursor-pointer transition-all active:scale-95"
                  title={lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {!isMenuAuthorized ? (
                /* PASSWORD LOCK SCREEN */
                <div className="flex-grow flex flex-col items-center justify-center py-8 px-2 text-center select-none" id="menu_password_lock_screen">
                  <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-500 mb-5 animate-bounce shadow-xs">
                    <Lock className="w-7 h-7" />
                  </div>
                  <h4 className="font-sans font-bold text-zinc-800 text-base mb-1.5">
                    {lang === 'bn' ? 'সুরক্ষিত অ্যাক্সেস' : 'Secure Access'}
                  </h4>
                  <p className="text-xs text-zinc-500 leading-relaxed mb-6 max-w-[240px]">
                    {lang === 'bn' 
                      ? 'এই কনসোল অপশনগুলো অ্যাক্সেস করতে অনুগ্রহ করে ৮ ডিজিটের পাসওয়ার্ড নিশ্চিত করুন।' 
                      : 'Please enter the 8-digit password to access these console options.'}
                  </p>
                  <div className="w-full max-w-[260px] space-y-3">
                    <input
                      type="text"
                      placeholder={lang === 'bn' ? 'পাসওয়ার্ড টাইপ করুন' : 'Type Password'}
                      value={menuPassword}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        setMenuPassword(val);
                        if (val === '80102623') {
                          setIsMenuAuthorized(true);
                          setMenuPassword('');
                          triggerSuccess(lang === 'bn' ? 'সফলভাবে প্রবেশ করা হয়েছে!' : 'Access granted successfully!');
                        }
                      }}
                      className="w-full text-center tracking-widest text-lg font-mono bg-zinc-50 border border-zinc-200 focus:border-[#00c278] focus:bg-white focus:outline-none rounded-xl px-4 py-3 text-zinc-800 placeholder:tracking-normal placeholder:text-zinc-300 placeholder:text-sm shadow-inner font-bold"
                    />
                    <p className="text-[10px] text-zinc-400 leading-relaxed">
                      {lang === 'bn' ? 'টাইপ করা মাত্র সটিক হলে স্বয়ংক্রিয় প্রবেশ করবে। পাসওয়ার্ড: 80102623' : 'Unlocks automatically as soon as typed correctly. Password: 80102623'}
                    </p>
                  </div>
                </div>
              ) : (
                /* AUTHORIZED OPTIONS */
                <>
                  {/* Exits / Exit button to log out and lock */}
                  <div className="flex justify-end -mt-2">
                    <button
                      onClick={() => {
                        setIsMenuAuthorized(false);
                        setMenuPassword('');
                        setIsMenuOpen(false); // Close menu
                        triggerSuccess(lang === 'bn' ? 'সফলভাবে প্রস্থান করা হয়েছে!' : 'Locked and closed successfully!');
                      }}
                      className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-150 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-all active:scale-95"
                      id="exit_console_menu_btn"
                    >
                      <Lock className="w-3.5 h-3.5 text-rose-500" />
                      <span>{lang === 'bn' ? 'প্রস্থান করুন (Exits)' : 'Exits'}</span>
                    </button>
                  </div>

                  {/* 1. Active Sessions List */}
                  <div className="bg-zinc-50/50 border border-zinc-100 rounded-2xl p-4 shadow-sm" id="sessions_list_card_menu">
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="font-sans font-bold text-zinc-400 text-xs tracking-wider uppercase flex items-center gap-1.5">
                        📂 {t.sessionsHeader} ({sessions.length})
                      </h2>
                      {isRefreshing && (
                        <span className="text-[9px] font-mono text-emerald-600 animate-pulse bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                          {t.updatingSess}
                        </span>
                      )}
                    </div>

                    <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                      {sessions.map((sess) => {
                        const isSelected = sess.id === selectedSessionId;
                        const statusColors = {
                          disconnected: { text: lang === 'bn' ? 'ডিসকানেক্টেড' : 'Disconnected', dot: 'bg-zinc-400', bg: 'border-zinc-200 hover:bg-zinc-100/50', badge: 'text-zinc-500 bg-zinc-100' },
                          connecting: { text: lang === 'bn' ? 'কানেক্ট হচ্ছে...' : 'Connecting...', dot: 'bg-indigo-400 animate-ping', bg: 'border-indigo-200 bg-indigo-50/20', badge: 'text-indigo-600 bg-indigo-50' },
                          pairing: { text: lang === 'bn' ? 'কোড রেডি' : 'Code Ready', dot: 'bg-amber-400 animate-pulse', bg: 'border-amber-200 bg-amber-50/20', badge: 'text-amber-700 bg-amber-50' },
                          connected: { text: lang === 'bn' ? 'সংযুক্ত' : 'Connected', dot: 'bg-emerald-500', bg: 'border-emerald-250 bg-emerald-50/10', badge: 'text-emerald-700 bg-emerald-50 shadow-xs' },
                          error: { text: lang === 'bn' ? 'ত্রুটি ঘটেছে' : 'Error', dot: 'bg-rose-500', bg: 'border-rose-200 bg-rose-50/25', badge: 'text-rose-700 bg-rose-50' }
                        };

                        const currentConfig = statusColors[sess.status] || statusColors.disconnected;

                        return (
                          <div
                            key={sess.id}
                            onClick={() => {
                              setSelectedSessionId(sess.id);
                              setIsMenuOpen(false); // Close drawer to focus on chosen session!
                            }}
                            className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none group relative ${
                              isSelected
                                ? 'border-[#00c278] bg-zinc-50/80 shadow-xs'
                                : `${currentConfig.bg} bg-white`
                            }`}
                            id={`session_item_${sess.id}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <div className="w-8 h-8 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-500">
                                  <Smartphone className={`w-4 h-4 ${isSelected ? 'text-[#00c278]' : 'text-zinc-400 group-hover:text-zinc-500'}`} />
                                </div>
                                <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-white ${currentConfig.dot}`} />
                              </div>
                              
                              <div className="min-w-0">
                                <div className="font-sans font-bold text-zinc-800 text-xs truncate flex items-center gap-1">
                                  {sess.id}
                                  {sess.id === 'default' && <span className="text-[9px] bg-zinc-200 text-zinc-500 px-1 py-0.2 rounded font-mono">{lang === 'bn' ? 'ডিফল্ট' : 'Default'}</span>}
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[9px] font-mono text-zinc-400">
                                    {sess.phoneNumber ? `+${sess.phoneNumber}` : (lang === 'bn' ? 'কোনো ডিভাইস নেই' : 'No device linked')}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <span className={`text-[9px] uppercase font-bold tracking-tight px-1.5 py-0.5 rounded-md ${currentConfig.badge}`}>
                                {currentConfig.text}
                              </span>
                              {sess.id !== 'default' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDisconnect(sess.id);
                                  }}
                                  className="p-1 cursor-pointer rounded-md text-zinc-400 hover:text-red-600 hover:bg-red-50 active:scale-95 transition-all opacity-0 group-hover:opacity-100"
                                  title={t.deleteSess}
                                  id={`delete_btn_${sess.id}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. Create New Session */}
                  <div className="bg-zinc-50/50 border border-zinc-100 rounded-2xl p-4 shadow-sm flex flex-col gap-3" id="create_session_card_menu">
                    <div>
                      <h3 className="font-sans font-bold text-zinc-700 text-xs flex items-center gap-1.5 uppercase tracking-wide">
                        <Plus className="w-4 h-4 text-[#00c278]" /> {t.createNewSess}
                      </h3>
                      <p className="text-[10px] text-zinc-400 mt-1">{t.createNewSessDesc}</p>
                    </div>

                    <form onSubmit={handleCreateSession} className="flex gap-2">
                      <input
                        type="text"
                        placeholder={t.sessNamePlaceholder}
                        value={newSessionIdInput}
                        onChange={(e) => setNewSessionIdInput(e.target.value)}
                        className="bg-white border border-zinc-200 focus:border-[#00c278] focus:outline-none rounded-xl px-3 py-2 text-xs flex-1 text-zinc-800 font-mono placeholder:text-zinc-300 shadow-inner"
                        id="session_name_input_menu"
                      />
                      <button
                        type="submit"
                        disabled={isCreatingSession}
                        className="px-4 py-2 cursor-pointer bg-zinc-900 hover:bg-[#00c278] text-white font-semibold text-xs rounded-xl flex items-center justify-center shrink-0 transition-all font-sans"
                        id="session_create_submit_btn_menu"
                      >
                        {isCreatingSession ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t.sessCreateBtn}
                      </button>
                    </form>
                  </div>

                  {/* 3. Guidelines info */}
                  <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex gap-3 text-zinc-650 text-xs mt-auto" id="quick_info_card_menu">
                    <Info className="w-5 h-5 text-[#00c278] shrink-0 mt-0.5 animate-pulse" />
                    <div className="space-y-1 text-zinc-600">
                      <h4 className="font-bold text-zinc-800 font-sans">{t.howItWorksTitle}</h4>
                      <p className="leading-relaxed">{t.howItWorksDesc}</p>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
