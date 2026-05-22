/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Shield, ShieldAlert, ShieldCheck, Phone, Check, AlertTriangle, Settings, Plus, Trash2, Code,
  Clock, Play, Square, RefreshCw, Volume2, VolumeX, List, HelpCircle, UserPlus, Info, Copy, CheckSquare, X, Calendar, Lock,
  PhoneCall, Eye, FileText, ChevronRight, Sliders, Smartphone, Volume1
} from 'lucide-react';
import { androidCodeFiles, CodeFile } from './data/androidCode';

// Interfaces mapping local storage models representing Room database schemas
interface Contact {
  id: string;
  name: string;
  phoneNumber: string;
  isPriority: boolean;
  addedTimestamp: string;
}

interface BypassLog {
  id: string;
  phoneNumber: string;
  contactName: string;
  timestamp: string;
  wasBypassed: boolean;
  reason: string;
  ringerModeAtCall: string;
}

interface Schedule {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
  days: string[];
}

export default function App() {
  // ---- Local Persistence States (Simulating Room) ----
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [logs, setLogs] = useState<BypassLog[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isProtectionActive, setIsProtectionActive] = useState<boolean>(true);
  
  // ---- Simulated Settings & Profiles ----
  const [simulatedRingerMode, setSimulatedRingerMode] = useState<string>('DND'); // 'Normal', 'Vibrate', 'Silent', 'DND'
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [codeTab, setCodeTab] = useState<string>('CallReceiver.kt');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  
  // ---- Form Input Controllers ----
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactIsPriority, setNewContactIsPriority] = useState(true);
  const [contactSearch, setContactSearch] = useState('');

  // ---- Simulation Dynamic Engine States ----
  const [isCalling, setIsCalling] = useState(false);
  const [callerNumber, setCallerNumber] = useState('');
  const [callerName, setCallerName] = useState('');
  const [callBypassResult, setCallBypassResult] = useState<{
    bypassed: boolean;
    reason: string;
    originalRingerMode: string;
  } | null>(null);
  
  // ---- Web Audio synthetic ringtone ----
  const [ringtoneInterval, setRingtoneInterval] = useState<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  
  // ---- Flashing strobe visual simulations ----
  const [strobeActive, setStrobeActive] = useState(false);
  const [strobeState, setStrobeState] = useState(false);
  
  // ---- Simulated Runtime Permissions ----
  const [permissions, setPermissions] = useState({
    READ_CONTACTS: true,
    READ_PHONE_STATE: true,
    READ_CALL_LOG: true,
    ACCESS_NOTIFICATION_POLICY: false, // DND Access is initially false, requiring interactive click!
    POST_NOTIFICATIONS: true,
    CAMERA: false, // For strobe
  });

  // ---- Initialize mock data if clean state ----
  useEffect(() => {
    // 1. Check protection status
    const savedActive = localStorage.getItem('bypassd_active');
    if (savedActive !== null) {
      setIsProtectionActive(savedActive === 'true');
    }

    // 2. Load and set default contacts
    const savedContacts = localStorage.getItem('bypassd_contacts');
    if (savedContacts) {
      setContacts(JSON.parse(savedContacts));
    } else {
      const defaultContacts: Contact[] = [
        { id: '1', name: 'Mom (Emergency)', phoneNumber: '+1 (555) 019-9111', isPriority: true, addedTimestamp: new Date().toISOString() },
        { id: '2', name: 'DevOps Primary Alert', phoneNumber: '+1 (555) 123-4567', isPriority: true, addedTimestamp: new Date().toISOString() },
        { id: '3', name: 'Spouse (Not marked Priority)', phoneNumber: '+1 (555) 321-7654', isPriority: false, addedTimestamp: new Date().toISOString() },
        { id: '4', name: 'Random Solicitor', phoneNumber: '+1 (555) 900-4001', isPriority: false, addedTimestamp: new Date().toISOString() }
      ];
      localStorage.setItem('bypassd_contacts', JSON.stringify(defaultContacts));
      setContacts(defaultContacts);
    }

    // 3. Load logs
    const savedLogs = localStorage.getItem('bypassd_logs');
    if (savedLogs) {
      setLogs(JSON.parse(savedLogs));
    } else {
      const initialLogs: BypassLog[] = [
        {
          id: 'log1',
          phoneNumber: '+1 (555) 019-9111',
          contactName: 'Mom (Emergency)',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          wasBypassed: true,
          reason: 'Priority Contact Bypass - Phone was on VIBRATE',
          ringerModeAtCall: 'Vibrate'
        },
        {
          id: 'log2',
          phoneNumber: '+1 (555) 900-4001',
          contactName: 'Unknown Caller',
          timestamp: new Date(Date.now() - 12000000).toISOString(),
          wasBypassed: false,
          reason: 'Normal Call - Kept muted. No bypass criteria triggered.',
          ringerModeAtCall: 'DND'
        }
      ];
      localStorage.setItem('bypassd_logs', JSON.stringify(initialLogs));
      setLogs(initialLogs);
    }

    // 4. Load schedules
    const savedSchedules = localStorage.getItem('bypassd_schedules');
    if (savedSchedules) {
      setSchedules(JSON.parse(savedSchedules));
    } else {
      const initialSchedules: Schedule[] = [
        { id: 'sch1', name: 'Night Sleep Mode', startTime: '22:00', endTime: '07:00', isActive: true, days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
        { id: 'sch2', name: 'Work Deep Focus', startTime: '09:00', endTime: '17:00', isActive: false, days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] }
      ];
      localStorage.setItem('bypassd_schedules', JSON.stringify(initialSchedules));
      setSchedules(initialSchedules);
    }
    
    // 5. Load permissions
    const savedPerms = localStorage.getItem('bypassd_perms');
    if (savedPerms) {
      setPermissions(JSON.parse(savedPerms));
    }
  }, []);

  // Save updates helper
  const saveContacts = (updated: Contact[]) => {
    setContacts(updated);
    localStorage.setItem('bypassd_contacts', JSON.stringify(updated));
  };

  const saveLogs = (updated: BypassLog[]) => {
    setLogs(updated);
    localStorage.setItem('bypassd_logs', JSON.stringify(updated));
  };

  const saveSchedules = (updated: Schedule[]) => {
    setSchedules(updated);
    localStorage.setItem('bypassd_schedules', JSON.stringify(updated));
  };

  const savePerms = (updated: typeof permissions) => {
    setPermissions(updated);
    localStorage.setItem('bypassd_perms', JSON.stringify(updated));
  };

  const handleToggleProtection = () => {
    const newState = !isProtectionActive;
    setIsProtectionActive(newState);
    localStorage.setItem('bypassd_active', String(newState));
  };

  const handleTogglePermission = (key: keyof typeof permissions) => {
    const updated = { ...permissions, [key]: !permissions[key] };
    savePerms(updated);
  };

  // ---- Contact Operations ----
  const handleAddContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactName.trim() || !newContactPhone.trim()) return;

    const cleanNum = newContactPhone.replace(/[^\d+]/g, '');
    const newContact: Contact = {
      id: Date.now().toString(),
      name: newContactName,
      phoneNumber: newContactPhone,
      isPriority: newContactIsPriority,
      addedTimestamp: new Date().toISOString()
    };

    saveContacts([newContact, ...contacts]);
    setNewContactName('');
    setNewContactPhone('');
    setNewContactIsPriority(true);
  };

  const handleDeleteContact = (id: string) => {
    const filtered = contacts.filter(c => c.id !== id);
    saveContacts(filtered);
  };

  const handleToggleContactPriority = (id: string) => {
    const updated = contacts.map(c => c.id === id ? { ...c, isPriority: !c.isPriority } : c);
    saveContacts(updated);
  };

  // ---- Synthesizer Audio Trigger ----
  const playWebRingtone = () => {
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return;

      const audioCtx = new AudioCtxClass();
      audioCtxRef.current = audioCtx;

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sawtooth'; // piercing alarm style
      osc.frequency.setValueAtTime(380, audioCtx.currentTime);

      gain.gain.setValueAtTime(0, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.4, audioCtx.currentTime + 0.1);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();

      oscillatorRef.current = osc;
      gainNodeRef.current = gain;

      // Pulsing siren effect interval
      let highTone = false;
      const interval = setInterval(() => {
        if (!osc || !audioCtx) return;
        highTone = !highTone;
        // Glide tone up and down like an emergency siren
        osc.frequency.setValueAtTime(highTone ? 580 : 380, audioCtx.currentTime);
      }, 400);

      setRingtoneInterval(interval);
    } catch (e) {
      console.error("Web Audio API not supported or blocked: ", e);
    }
  };

  const stopWebRingtone = () => {
    if (ringtoneInterval) {
      clearInterval(ringtoneInterval);
      setRingtoneInterval(null);
    }
    try {
      if (oscillatorRef.current) {
        oscillatorRef.current.stop();
        oscillatorRef.current.disconnect();
        oscillatorRef.current = null;
      }
      if (gainNodeRef.current) {
        gainNodeRef.current.disconnect();
        gainNodeRef.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
    } catch (e) {
      console.error(e);
    }
  };

  // ---- Call Simulator Logic ----
  const handleTriggerSimulatedCall = (phone: string, name: string) => {
    if (isCalling) return;
    
    setIsCalling(true);
    setCallerNumber(phone);
    setCallerName(name || "Unknown Caller");

    // Clean match numeric
    const cleanProposed = phone.replace(/[^\d]/g, '');

    // Check database
    const matchingContact = contacts.find(c => 
      c.phoneNumber.replace(/[^\d]/g, '') === cleanProposed || 
      cleanProposed.includes(c.phoneNumber.replace(/[^\d]/g, ''))
    );

    const isPriorityContact = matchingContact !== null && matchingContact !== undefined && matchingContact.isPriority;

    // Emergency Repeated Call Check:
    // Count dialings in the simulated log for this number in the last 5 minutes
    const fiveMinutes = 5 * 60 * 1000;
    const now = Date.now();
    const recentCalls = logs.filter(l => {
      const matchNum = l.phoneNumber.replace(/[^\d]/g, '') === cleanProposed;
      const inTime = (now - new Date(l.timestamp).getTime()) < fiveMinutes;
      return matchNum && inTime;
    });

    const callsCount = recentCalls.length;
    // Overrides DND if dialed 3rd call in 5 mins (meaning 2 logs already exist)
    const isEmergencyRepeated = callsCount >= 2;

    // Determine Bypass authorization:
    // Requires: Protection is ON, plus (either priority contact OR emergency repeated), and we need ACCESS_NOTIFICATION_POLICY simulation checked is true!
    const activeCoverage = isProtectionActive;
    
    let isBypassed = false;
    let reason = '';

    if (!activeCoverage) {
      isBypassed = false;
      reason = 'BypassDND Protection is globally switched OFF.';
    } else if (!permissions.ACCESS_NOTIFICATION_POLICY) {
      isBypassed = false;
      reason = 'Muted. Android blocked bypass because Special DND Access permission is denied!';
    } else if (simulatedRingerMode === 'Normal') {
      isBypassed = true;
      reason = 'Phone is in NORMAL mode. Ringtone sounds normally.';
    } else if (isPriorityContact) {
      isBypassed = true;
      reason = `Priority Bypass! Managed VIP Contact matches: '${matchingContact?.name}'. Ringtone forced.`;
    } else if (isEmergencyRepeated) {
      isBypassed = true;
      reason = `Repeated Call Override! Received ${callsCount + 1} calls from same number within 5 minutes. Treating as extreme emergency!`;
    } else {
      isBypassed = false;
      reason = `Muted call. Call from standard number under '${simulatedRingerMode}' state. (No override criteria satisfied).`;
    }

    setCallBypassResult({
      bypassed: isBypassed,
      reason,
      originalRingerMode: simulatedRingerMode
    });

    // Save Log
    const newLog: BypassLog = {
      id: 'log_' + Date.now(),
      phoneNumber: phone,
      contactName: matchingContact?.name || name || 'Unknown Number',
      timestamp: new Date().toISOString(),
      wasBypassed: isBypassed,
      reason,
      ringerModeAtCall: simulatedRingerMode
    };
    saveLogs([newLog, ...logs]);

    // Active outputs (Sounds & Strobes)
    if (isBypassed) {
      playWebRingtone();
      // Start flashlight strobe
      setStrobeActive(true);
    }
  };

  // Strobe effect interval
  useEffect(() => {
    let interval: any = null;
    if (strobeActive) {
      interval = setInterval(() => {
        setStrobeState(prev => !prev);
      }, 150);
    } else {
      setStrobeState(false);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [strobeActive]);

  const handleEndSimulatedCall = () => {
    setIsCalling(false);
    setStrobeActive(false);
    stopWebRingtone();
    setCallBypassResult(null);
  };

  // Quick action templates
  const simulateMomCall = () => {
    handleTriggerSimulatedCall('+1 (555) 019-9111', 'Mom (Emergency)');
  };

  const simulateSpouseFirstCall = () => {
    handleTriggerSimulatedCall('+1 (555) 321-7654', 'Spouse');
  };

  const simulateRandomSolicitor = () => {
    handleTriggerSimulatedCall('+1 (555) 900-4001', 'Random Solicitor');
  };

  // Clear logs helper
  const handleClearLogs = () => {
    saveLogs([]);
  };

  // Copy code feedback
  const handleCopyCode = (content: string) => {
    navigator.clipboard.writeText(content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const getActiveCode = () => {
    return androidCodeFiles.find(f => f.name === codeTab) || androidCodeFiles[0];
  };

  return (
    <div className="min-h-screen bg-[#090a0f] text-[#e2e8f0] font-sans antialiased overflow-x-hidden flex flex-col md:flex-row">
      
      {/* --- SIDE NAVIGATION --- */}
      <aside className="w-full md:w-66 bg-[#111218] border-b md:border-b-0 md:border-r border-slate-800/80 p-6 flex flex-col shrink-0">
        
        {/* Brand Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-amber-500 flex items-center justify-center shadow-[0_4px_20px_rgba(244,63,94,0.25)] ring-1 ring-white/10">
            <ShieldAlert className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold tracking-tight text-white text-[19px] leading-tight">ByPassDND</h1>
            <p className="text-[11px] font-medium text-slate-400/90 tracking-wide uppercase">Priority Bypass</p>
          </div>
        </div>

        {/* Protection Core Status Card */}
        <div className={`p-4.5 rounded-2xl border transition-all duration-300 ${isProtectionActive ? 'bg-rose-950/15 border-rose-500/30 shadow-[0_4px_20px_rgba(244,63,94,0.06)]' : 'bg-[#16171d] border-slate-800/80 shadow-none'}`}>
          <div className="flex justify-between items-center mb-2.5">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Guard Engine Status</span>
            <span className={`w-2 h-2 rounded-full ${isProtectionActive ? 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.85)] animate-pulse' : 'bg-slate-600'}`}></span>
          </div>
          
          <div className="flex items-center justify-between gap-2">
            <span className={`font-bold text-xs tracking-tight ${isProtectionActive ? 'text-rose-400' : 'text-slate-400'}`}>
              {isProtectionActive ? 'ACTIVE PROTECTION' : 'SHIELD INACTIVE'}
            </span>
            <button 
              onClick={handleToggleProtection}
              className={`px-3 py-1.5 rounded-xl text-[10.5px] font-bold transition-all cursor-pointer ${isProtectionActive ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-[0_2px_10px_rgba(244,63,94,0.25)]' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`}
            >
              Toggle
            </button>
          </div>

          <p className="text-[11px] text-slate-400 mt-2 px-0.5 leading-snug">
            {isProtectionActive ? 'Approved priority contacts will override silent state and ring.' : 'Service suspended. System mutes all calls.'}
          </p>
        </div>

        {/* Regular Tabs Navigation */}
        <nav className="space-y-1.5 flex-1 mt-2">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-semibold transition-all duration-200 cursor-pointer ${activeTab === 'dashboard' ? 'bg-[#1e1a2f] text-[#d0bcff] border border-[#d0bcff]/20 shadow-[0_4px_12px_rgba(208,188,255,0.04)]' : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'}`}
          >
            <Smartphone className={`w-4 h-4 ${activeTab === 'dashboard' ? 'text-[#d0bcff]' : 'text-slate-400'}`} />
            <span>Control Dashboard</span>
          </button>

          <button
            onClick={() => setActiveTab('contacts')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-semibold transition-all duration-200 cursor-pointer ${activeTab === 'contacts' ? 'bg-[#1e1a2f] text-[#d0bcff] border border-[#d0bcff]/20 shadow-[0_4px_12px_rgba(208,188,255,0.04)]' : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'}`}
          >
            <UserPlus className={`w-4 h-4 ${activeTab === 'contacts' ? 'text-[#d0bcff]' : 'text-slate-400'}`} />
            <span>Priority Contacts</span>
            <span className={`ml-auto text-[11px] px-2.5 py-0.5 rounded-full font-bold ${activeTab === 'contacts' ? 'bg-[#381e72] text-[#d0bcff]' : 'bg-[#2b2d35] text-slate-400'}`}>
              {contacts.filter(c => c.isPriority).length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('schedules')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-semibold transition-all duration-200 cursor-pointer ${activeTab === 'schedules' ? 'bg-[#1e1a2f] text-[#d0bcff] border border-[#d0bcff]/20 shadow-[0_4px_12px_rgba(208,188,255,0.04)]' : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'}`}
          >
            <Clock className={`w-4 h-4 ${activeTab === 'schedules' ? 'text-[#d0bcff]' : 'text-slate-400'}`} />
            <span>Silent Schedules</span>
          </button>

          <button
            onClick={() => setActiveTab('permissions')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-semibold transition-all duration-200 cursor-pointer ${activeTab === 'permissions' ? 'bg-[#1e1a2f] text-[#d0bcff] border border-[#d0bcff]/20 shadow-[0_4px_12px_rgba(208,188,255,0.04)]' : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'}`}
          >
            <CheckSquare className={`w-4 h-4 ${activeTab === 'permissions' ? 'text-[#d0bcff]' : 'text-slate-400'}`} />
            <span>Permissions & Guides</span>
            {!permissions.ACCESS_NOTIFICATION_POLICY && (
              <span className="ml-auto w-2 h-2 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.7)]"></span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-semibold transition-all duration-200 cursor-pointer ${activeTab === 'logs' ? 'bg-[#1e1a2f] text-[#d0bcff] border border-[#d0bcff]/20 shadow-[0_4px_12px_rgba(208,188,255,0.04)]' : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'}`}
          >
            <List className={`w-4 h-4 ${activeTab === 'logs' ? 'text-[#d0bcff]' : 'text-slate-400'}`} />
            <span>Bypass Call Logs</span>
            <span className={`ml-auto text-[11px] px-2.5 py-0.5 rounded-full font-bold ${activeTab === 'logs' ? 'bg-[#381e72] text-[#d0bcff]' : 'bg-[#2b2d35] text-slate-400'}`}>
              {logs.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('codehub')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-semibold transition-all duration-200 cursor-pointer ${activeTab === 'codehub' ? 'bg-[#1e1a2f] text-[#d0bcff] border border-[#d0bcff]/20 shadow-[0_4px_12px_rgba(208,188,255,0.04)]' : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'}`}
          >
            <Code className={`w-4 h-4 ${activeTab === 'codehub' ? 'text-[#d0bcff]' : 'text-slate-400'}`} />
            <span>Android Code Hub</span>
          </button>
        </nav>

        {/* Footer info */}
        <div className="mt-auto border-t border-slate-800/60 pt-4 px-2">
          <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
            <span>Core Sandbox v1.2</span>
            <span className="font-mono text-[10px]">2026-05-22</span>
          </div>
        </div>
      </aside>

      {/* --- MAIN DISPLAY CONTROLS --- */}
      <main className="flex-1 bg-[#090a0f] p-6 md:p-8 flex flex-col h-screen overflow-y-auto">

        {/* --- INCOMING CALL OVERLAY EMULATOR --- */}
        {isCalling && (
          <div className="fixed inset-0 z-50 bg-[#06070a]/90 backdrop-blur-md flex items-center justify-center p-4">
            
            {/* Flashlight Strobe representation overlay */}
            {strobeState && (
              <div className="absolute inset-0 bg-yellow-400/10 pointer-events-none transition-all duration-75"></div>
            )}

            <div className={`w-full max-w-sm rounded-[32px] border bg-[#13141f]/95 p-8 shadow-[0_15px_50px_rgba(0,0,0,0.8)] relative overflow-hidden transition-all duration-300 ring-1 ring-white/[0.04] ${callBypassResult?.bypassed ? 'border-rose-500/80 shadow-rose-950/25' : 'border-slate-800'}`}>
              
              {/* Emergency Breathing Aura background */}
              {callBypassResult?.bypassed && (
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-500 animate-pulse"></div>
              )}

              {/* Strobe simulator notifier pill */}
              {callBypassResult?.bypassed && (
                <div className="flex justify-center mb-4">
                  <span className="bg-amber-400/15 border border-amber-400/35 text-amber-300 text-[10px] tracking-wider font-semibold uppercase px-3 py-1.5 rounded-full animate-bounce">
                    ⚡ SIMULATED FLASHLIGHT FLASHING ⚡
                  </span>
                </div>
              )}

              {/* Status Indicator */}
              <div className="text-center mb-6">
                <span className={`px-3 py-1.5 rounded-full text-[11px] font-bold tracking-tight ${callBypassResult?.bypassed ? 'bg-rose-500/10 border border-rose-500/35 text-rose-400 animate-pulse' : 'bg-slate-800/80 border border-slate-700 text-slate-400'}`}>
                  {callBypassResult?.bypassed ? '🔊 EMERGENCY RINGER RE-ACTIVATED' : '🔇 CALL MUTED - SILENT STATE ACTIVE'}
                </span>
              </div>

              {/* Contact Information */}
              <div className="text-center my-8">
                <div className={`w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center transition-all duration-300 ${callBypassResult?.bypassed ? 'bg-rose-950/40 border-2 border-rose-500 text-rose-400 shadow-lg shadow-rose-900/40 scale-105' : 'bg-[#181a26] border border-slate-800 text-slate-400'}`}>
                  <PhoneCall className={`w-10 h-10 ${callBypassResult?.bypassed ? 'animate-bounce text-rose-400' : 'text-slate-400'}`} />
                </div>
                <h3 className="text-2xl font-extrabold text-white mb-1 tracking-tight">{callerName}</h3>
                <p className="text-slate-400 text-sm tracking-widest font-mono">{callerNumber}</p>
                <p className="text-slate-500 text-xs mt-3">State of original ringer: <span className="text-amber-500 font-bold">{callBypassResult?.originalRingerMode}</span></p>
              </div>

              {/* Live volume feedback */}
              {callBypassResult?.bypassed && (
                <div className="mb-6 bg-[#090a0f] p-4 rounded-2xl border border-rose-950/40 text-center">
                  <div className="flex items-center justify-center gap-2 text-rose-400 font-bold text-xs mb-2 animate-pulse">
                    <Volume2 className="w-4 h-4" />
                    SIMULATED VOLUME FORCED TO 100%
                  </div>
                  <div className="h-1.5 w-full bg-[#181a26] rounded-full overflow-hidden">
                    <div className="h-full bg-rose-500 animate-[pulse_1.5s_infinite] w-full"></div>
                  </div>
                </div>
              )}

              {/* Reason Description */}
              <div className="my-6 p-4 rounded-xl bg-[#090a0f] text-xs text-slate-400 border border-slate-800/60 leading-relaxed">
                <p className="font-bold text-slate-300 mb-1">State Logic Analysis:</p>
                {callBypassResult?.reason}
              </div>

              {/* Actions Grid */}
              <div className="grid grid-cols-2 gap-4 mt-8">
                <button
                  onClick={handleEndSimulatedCall}
                  className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[0_4px_14px_rgba(244,63,94,0.3)]"
                >
                  <X className="w-4 h-4" />
                  Decline / End
                </button>
                <button
                  onClick={handleEndSimulatedCall}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[0_4px_14px_rgba(16,185,129,0.3)]"
                >
                  <Check className="w-4 h-4" />
                  Answer Call
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- HEADER CONTROLS --- */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800/80 pb-6 mb-7 gap-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-[#d0bcff] uppercase tracking-wider mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#d0bcff] shadow-[0_0_8px_#d0bcff]"></span>
              Simulation Environment
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-white capitalize">{activeTab} Panel</h2>
            <p className="text-slate-400/90 text-[13.5px] mt-1 font-medium">Interact with ByPassDND simulation state, verify permissions, and visualize local Database activities.</p>
          </div>

          {/* Quick Ringer Toggle Bar */}
          <div className="bg-[#111218] rounded-2xl p-1.5 flex flex-wrap gap-1 self-start md:self-auto border border-slate-800/80 shadow-md">
            <span className="text-slate-500 text-[10px] flex items-center px-2.5 font-extrabold uppercase tracking-wider">Device Mode:</span>
            <button
              onClick={() => setSimulatedRingerMode('Normal')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${simulatedRingerMode === 'Normal' ? 'bg-[#381e72] text-[#d0bcff] border border-[#d0bcff]/35 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Normal
            </button>
            <button
              onClick={() => setSimulatedRingerMode('Vibrate')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${simulatedRingerMode === 'Vibrate' ? 'bg-[#381e72] text-[#d0bcff] border border-[#d0bcff]/35 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Vibrate
            </button>
            <button
              onClick={() => setSimulatedRingerMode('Silent')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${simulatedRingerMode === 'Silent' ? 'bg-[#381e72] text-[#d0bcff] border border-[#d0bcff]/35 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Silent
            </button>
            <button
              onClick={() => setSimulatedRingerMode('DND')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${simulatedRingerMode === 'DND' ? 'bg-rose-950 text-rose-300 border border-rose-800/40 shadow-sm' : 'text-slate-400 hover:text-rose-400'}`}
            >
              DND Mode
            </button>
          </div>
        </div>

        {/* --- MAIN TABS ROUTER --- */}

        {/* 1. DASHBOARD PANEL */}
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Mockup Monitor */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* Core Control Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Simulated Notification / Banner Status */}
                <div className="bg-[#13141f] border border-slate-800/85 rounded-[24px] p-6 relative overflow-hidden shadow-sm">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400 mb-4 flex items-center gap-2">
                    <Sliders className="w-3.5 h-3.5 text-rose-400" /> Active Guard Coverage
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-center bg-[#090a0f] p-4 rounded-xl border border-slate-900">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Protection Guardian</span>
                        <span className="text-sm font-semibold text-white">{isProtectionActive ? 'RUNNING FOREGROUND' : 'STOPPED'}</span>
                      </div>
                      <span className={`w-2.5 h-2.5 rounded-full ${isProtectionActive ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.7)] animate-pulse' : 'bg-slate-600'}`}></span>
                    </div>

                    <div className="flex justify-between items-center bg-[#090a0f] p-4 rounded-xl border border-slate-900">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Simulated System Volume</span>
                        <span className="text-sm font-semibold text-white">
                          {simulatedRingerMode === 'Normal' ? '🔊 Maximum Volume (100%)' : '🔇 Muted (0%)'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dashboard Setup Progress */}
                <div className="bg-[#13141f] border border-slate-800/85 rounded-[24px] p-6 relative shadow-sm">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400 mb-4 flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-rose-400" /> Settings Validation
                  </h3>
                  <div className="space-y-3.5">
                    <div className="flex items-center gap-2">
                      {permissions.ACCESS_NOTIFICATION_POLICY ? (
                        <Check className="w-4 h-4 text-emerald-500 stroke-[3px]" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-500 animate-pulse" />
                      )}
                      <span className="text-xs text-slate-300 font-medium leading-relaxed">
                        Notification Access: {permissions.ACCESS_NOTIFICATION_POLICY ? 'Granted' : 'Requires DND Bypass Permission (Special guides tab)'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-500 stroke-[3px]" />
                      <span className="text-xs text-slate-300 font-medium">Core Phone Observers: Checked & Active</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-500 stroke-[3px]" />
                      <span className="text-xs text-slate-300 font-medium font-sans">Local SQLite Room DB Context: Ready</span>
                    </div>

                    {/* Progress slider bar */}
                    <div className="pt-2">
                      <div className="flex justify-between text-[10px] text-slate-400 mb-1.5 font-bold uppercase tracking-wider">
                        <span>Setup Completed</span>
                        <span className="font-mono">{permissions.ACCESS_NOTIFICATION_POLICY ? '100%' : '75%'}</span>
                      </div>
                      <div className="h-1.5 w-full bg-[#090a0f] rounded-full overflow-hidden border border-slate-900">
                        <div 
                          className={`h-full transition-all duration-500 ${permissions.ACCESS_NOTIFICATION_POLICY ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                          style={{ width: permissions.ACCESS_NOTIFICATION_POLICY ? '100%' : '75%' }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Call Simulation Console Card */}
              <div className="bg-[#13141f] border border-slate-800/85 rounded-[24px] p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-extrabold text-white flex items-center gap-2 text-base tracking-tight">
                    <Play className="w-4 h-4 text-rose-400 fill-rose-400" /> Live Dial Simulator Sandbox
                  </h3>
                  <span className="bg-[#090a0f] text-slate-400 text-[10px] px-3 py-1 rounded-full border border-slate-800 font-semibold tracking-wider uppercase font-mono">
                    Dial Trigger Engine
                  </span>
                </div>

                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Test the ringer override features of the application. Select an event trigger below to dial.
                  If the caller is marked VIP or dials repeatedly within 5 minutes under active guard, the ringer engine will automatically unmute and sound loudly!
                </p>

                {/* Simulated Dialer Custom Input */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-7 mt-6">
                  <div className="md:col-span-2">
                    <label className="text-[10px] text-slate-400 font-bold mb-1.5 block uppercase tracking-wider">Input Custom PhoneNumber to dial</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="+1 (555) 777-8888" 
                        value={callerNumber || '+1 (555) 000-0111'}
                        onChange={(e) => setCallerNumber(e.target.value)}
                        className="flex-1 bg-[#090a0f] border border-slate-800 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#8b5cf6] transition-all font-mono"
                      />
                      <button
                        onClick={() => handleTriggerSimulatedCall(callerNumber || '+1 (555) 000-0111', 'Custom Caller')}
                        disabled={isCalling}
                        className="bg-rose-600 hover:bg-rose-500 active:scale-95 disabled:opacity-50 text-white font-bold px-5 py-3 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-[0_3px_12px_rgba(244,63,94,0.3)]"
                      >
                        <Phone className="w-3.5 h-3.5" /> Call
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col justify-end">
                    <span className="text-[11px] text-slate-400 leading-snug">
                      To test <strong className="text-amber-500 font-bold">repeated call bypass</strong>, click **Call** 3 times on Spouse/Solicitor.
                    </span>
                  </div>
                </div>

                {/* Simple quick selection buttons */}
                <div className="space-y-3 pt-2">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Quick Simulation Profiles</span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Mom (Priority VIP) */}
                    <button
                      onClick={simulateMomCall}
                      disabled={isCalling}
                      className="border border-slate-800 bg-[#090a0f] hover:bg-emerald-950/10 hover:border-emerald-500/30 p-4 rounded-2xl text-left transition-all duration-200 active:scale-98 cursor-pointer group"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"></span>
                        <span className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">Mom (Emergency)</span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono tracking-tight">+1 (555) 019-9111</p>
                      <span className="mt-2.5 inline-block bg-emerald-950/80 text-emerald-400 text-[9px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded border border-emerald-900/30">Priority VIP</span>
                    </button>

                    {/* Spouse (Non-Priority, test emergency repeated calls) */}
                    <button
                      onClick={simulateSpouseFirstCall}
                      disabled={isCalling}
                      className="border border-slate-800 bg-[#090a0f] hover:bg-amber-950/10 hover:border-amber-500/30 p-4 rounded-2xl text-left transition-all duration-200 active:scale-98 cursor-pointer group"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
                        <span className="text-xs font-bold text-white group-hover:text-amber-400 transition-colors">Spouse (Standard Contact)</span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono tracking-tight">+1 (555) 321-7654</p>
                      <span className="mt-2.5 inline-block bg-slate-800/80 text-slate-400 text-[9px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded">Standard contact</span>
                    </button>

                    {/* Unknown Telemarketing Mute Tracker */}
                    <button
                      onClick={simulateRandomSolicitor}
                      disabled={isCalling}
                      className="border border-slate-800 bg-[#090a0f] hover:bg-rose-950/10 hover:border-rose-500/30 p-4 rounded-2xl text-left transition-all duration-200 active:scale-98 cursor-pointer group"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e]"></span>
                        <span className="text-xs font-bold text-white group-hover:text-rose-400 transition-colors">Unknown Solicitor</span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono tracking-tight">+1 (555) 900-4001</p>
                      <span className="mt-2.5 inline-block bg-rose-950/50 text-rose-300 text-[9px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded border border-rose-905/30">Spam / Unsaved</span>
                    </button>
                  </div>
                </div>

              </div>

            </div>

            {/* Right Quick Settings column */}
            <div className="space-y-8">
              
              {/* Quick Contact Status block */}
              <div className="bg-[#13141f] border border-slate-800/85 rounded-[24px] p-6 shadow-sm">
                <div className="flex justify-between items-center mb-4.5">
                  <h3 className="font-bold text-white text-xs uppercase tracking-wider">Priority Directory</h3>
                  <button 
                    onClick={() => setActiveTab('contacts')}
                    className="text-xs text-[#d0bcff] font-bold hover:underline cursor-pointer"
                  >
                    Manage
                  </button>
                </div>

                <div className="space-y-2.5">
                  {contacts.map(c => (
                    <div key={c.id} className="flex justify-between items-center bg-[#090a0f] p-3 rounded-xl border border-slate-900/40">
                      <div>
                        <span className="font-bold text-xs block text-white">{c.name}</span>
                        <span className="text-[10px] font-mono text-slate-400">{c.phoneNumber}</span>
                      </div>
                      <span className={`text-[9px] font-extrabold tracking-wide px-2 py-0.5 rounded ${c.isPriority ? 'bg-rose-950/60 border border-rose-900/30 text-rose-300' : 'bg-slate-800/50 text-slate-500'}`}>
                        {c.isPriority ? 'VIP BYPASS' : 'MUTED'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Simulated DND System settings */}
              <div className="bg-[#13141f] border border-slate-800/85 rounded-[24px] p-6 shadow-sm">
                <h3 className="font-bold text-white text-xs uppercase tracking-wider mb-4">Under-the-Hook Logic</h3>
                
                <div className="border border-slate-850 rounded-2xl bg-[#090a0f] p-4.5 space-y-3.5 text-xs text-slate-300">
                  <div>
                    <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">API Interception Channel</span>
                    <span className="text-white font-semibold font-mono text-[10.5px]">android.intent.action.PHONE_STATE</span>
                  </div>

                  <div>
                    <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Bypass Ring Stream</span>
                    <span className="text-white font-semibold font-mono text-[10.5px]">AudioManager.STREAM_ALARM</span>
                  </div>

                  <div>
                    <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Hardware trigger</span>
                    <span className="text-white font-semibold">CameraManager (Led Torch blink)</span>
                  </div>

                  <div>
                    <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Repeated dials criteria</span>
                    <span className="text-amber-400 font-bold font-mono">2 calls from same number within 5 mins</span>
                  </div>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* 2. PRIORITY CONTACTS PANEL */}
        {activeTab === 'contacts' && (
          <div className="space-y-8">
            <div className="bg-[#13141f] border border-slate-800/85 rounded-[24px] p-6 shadow-sm">
              <h3 className="text-lg font-bold text-white mb-2 tracking-tight">Configure Priority Numbers Directory</h3>
              <p className="text-xs text-slate-400 mb-6">
                These numbers match SQLite records configured through Room Database wrappers. Verified incoming calls automatically trigger high-volume alarm overrides bypass.
              </p>

              {/* Add contact Form */}
              <form onSubmit={handleAddContact} className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-[#090a0f] border border-slate-900 p-4.5 rounded-2xl mb-6 items-end">
                <div>
                  <label className="text-[10px] text-slate-400 font-bold mb-1.5 block uppercase tracking-wider">Contact Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Papa Office"
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    className="w-full bg-[#111218] border border-slate-800 px-3 py-2.5 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#d0bcff] transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 font-bold mb-1.5 block uppercase tracking-wider">Phone Number</label>
                  <input 
                    type="text" 
                    placeholder="+1 (555) 777-1122" 
                    value={newContactPhone}
                    onChange={(e) => setNewContactPhone(e.target.value)}
                    className="w-full bg-[#111218] border border-slate-800 px-3 py-2.5 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#d0bcff] transition-all font-mono"
                    required
                  />
                </div>

                <div className="flex items-center gap-2 self-center md:pb-3 max-md:py-2">
                  <input 
                    type="checkbox" 
                    id="checkbox_priority"
                    checked={newContactIsPriority}
                    onChange={(e) => setNewContactIsPriority(e.target.checked)}
                    className="w-4 h-4 rounded text-rose-500 focus:ring-rose-500 focus:ring-offset-[#111218] bg-[#111218] border-slate-800 cursor-pointer"
                  />
                  <label htmlFor="checkbox_priority" className="text-xs text-slate-300 font-bold select-none cursor-pointer">
                    Grant Priority Bypass (VIP)
                  </label>
                </div>

                <button
                  type="submit"
                  className="bg-rose-600 hover:bg-rose-500 font-bold text-white px-4 py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-[0_3px_12px_rgba(244,63,94,0.3)]"
                >
                  <Plus className="w-4 h-4" /> Add Priority Contact
                </button>
              </form>

              {/* Search Bar */}
              <div className="mb-6">
                <input 
                  type="text" 
                  placeholder="Search contacts..." 
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  className="w-full max-w-sm bg-[#090a0f] border border-slate-800 px-4 py-3 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#d0bcff] transition-all"
                />
              </div>

              {/* Grid lists */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {contacts
                  .filter(c => c.name.toLowerCase().includes(contactSearch.toLowerCase()) || c.phoneNumber.includes(contactSearch))
                  .map(c => (
                    <div key={c.id} className="bg-[#090a0f] border border-slate-900 p-5 rounded-2xl flex items-start justify-between relative group hover:border-slate-800 transition-all">
                      <div>
                        <h4 className="font-bold text-sm text-white mb-0.5">{c.name}</h4>
                        <p className="text-xs font-mono text-slate-400 mb-4">{c.phoneNumber}</p>
                        
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleContactPriority(c.id)}
                            className={`text-[10px] font-extrabold px-3 py-1 rounded-lg transition-colors cursor-pointer ${c.isPriority ? 'bg-rose-950/70 border border-rose-900/40 text-rose-300' : 'bg-[#1a1b26] border border-slate-800 text-slate-500'}`}
                          >
                            {c.isPriority ? 'VIP BYPASS: ON' : 'VIP BYPASS: OFF'}
                          </button>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteContact(c.id)}
                        className="text-slate-500 hover:text-rose-400 p-2.5 rounded-xl bg-[#111218] hover:bg-[#1a1c26] transition-colors cursor-pointer"
                        title="Delete contact"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                ))}
              </div>

            </div>
          </div>
        )}

        {/* 3. SMART SCHEDULES */}
        {activeTab === 'schedules' && (
          <div className="space-y-8">
            <div className="bg-[#13141f] border border-slate-800/85 rounded-[24px] p-6 shadow-sm">
              <h3 className="text-lg font-bold text-white mb-2 tracking-tight">Automated Silent State Schedules</h3>
              <p className="text-xs text-slate-400 mb-6">
                Schedules allow automatic triggering of DND protection. During these periods, unsaved calls are muted but priority contacts bypass silently.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {schedules.map(sch => (
                  <div key={sch.id} className={`p-6 rounded-2xl border transition-all ${sch.isActive ? 'bg-[#090a0f] border-[#d0bcff]/30 shadow-[0_4px_16px_rgba(208,188,255,0.02)]' : 'bg-[#090a0f]/45 border-slate-900 opacity-60'}`}>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="font-bold text-white text-base tracking-tight">{sch.name}</h4>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1 font-mono">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          <span>{sch.startTime} - {sch.endTime}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          const updated = schedules.map(s => s.id === sch.id ? { ...s, isActive: !s.isActive } : s);
                          saveSchedules(updated);
                        }}
                        className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${sch.isActive ? 'bg-[#1e1a2f] border border-[#d0bcff]/40 text-[#d0bcff]' : 'bg-slate-800/80 text-slate-400'}`}
                      >
                        {sch.isActive ? 'Active' : 'Disabled'}
                      </button>
                    </div>

                    <div className="flex gap-1.5 mt-6">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => {
                        const isScheduled = sch.days.includes(day);
                        return (
                          <span 
                            key={day} 
                            className={`text-[9.5px] font-bold px-2 py-1 rounded-md ${isScheduled ? 'bg-[#1a1b24] text-[#d0bcff] font-semibold border border-slate-800' : 'text-slate-600 bg-transparent'}`}
                          >
                            {day[0]}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

            </div>
          </div>
        )}

        {/* 4. PERMISSIONS & CODES */}
        {activeTab === 'permissions' && (
          <div className="space-y-8">
            <div className="bg-[#13141f] border border-slate-800/85 rounded-[24px] p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <CheckSquare className="w-5 h-5 text-rose-400" />
                <h3 className="text-lg font-bold text-white tracking-tight">Interactive Settings Authorization</h3>
              </div>
              <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                On Modern Android (API 23+ / Android 6 to Android 14), overriding Do Not Disturb and listening to incoming calls requires critical declarations in your manifest and user approval in settings.
              </p>

              {/* Checklist */}
              <div className="space-y-4 max-w-2xl mb-8">
                
                {/* DND Policy ACCESS */}
                <div className="bg-[#090a0f] p-4.5 rounded-2xl border border-slate-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`w-2 h-2 rounded-full ${permissions.ACCESS_NOTIFICATION_POLICY ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-amber-500 animate-pulse shadow-[0_0_8px_#f59e0b]'}`}></span>
                      <h4 className="font-bold text-sm text-white tracking-tight">DND Policy override access (ACCESS_NOTIFICATION_POLICY)</h4>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                      Mandatory to allow ByPassDND to change audio streams out of Silent (DND) modes when VIP dials. Users must enable this under:
                      <br />
                      <span className="text-slate-500 font-mono text-[9.5px]">Settings &gt; Special App Access &gt; Do Not Disturb Permission</span>
                    </p>
                  </div>
                  <button
                    onClick={() => handleTogglePermission('ACCESS_NOTIFICATION_POLICY')}
                    className={`shrink-0 py-2 px-4 rounded-xl text-[10px] font-bold tracking-wider uppercase transition-all cursor-pointer ${permissions.ACCESS_NOTIFICATION_POLICY ? 'bg-[#1e2f24] border border-emerald-800/40 text-emerald-400' : 'bg-amber-600 hover:bg-amber-500 text-slate-950 font-extrabold shadow-sm'}`}
                  >
                    {permissions.ACCESS_NOTIFICATION_POLICY ? '✓ Granted' : 'Simulate Grant'}
                  </button>
                </div>

                {/* READ_PHONE_STATE */}
                <div className="bg-[#090a0f] p-4.5 rounded-2xl border border-slate-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"></span>
                      <h4 className="font-bold text-sm text-white tracking-tight">Read Phone State (READ_PHONE_STATE & READ_CALL_LOG)</h4>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                      Required by BroadcastReceiver to hook into raw phone events. Starting from Android 9, reading the caller number also strictly requires the READ_CALL_LOG permission due to privacy lockdowns.
                    </p>
                  </div>
                  <span className="text-emerald-400 font-bold text-xs self-start sm:self-center px-3 py-1 bg-emerald-950/40 border border-emerald-900/30 rounded-lg">Auto-Approved</span>
                </div>

                {/* CAMERA Flashlight */}
                <div className="bg-[#090a0f] p-4.5 rounded-2xl border border-slate-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`w-2 h-2 rounded-full ${permissions.CAMERA ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-slate-750'}`}></span>
                      <h4 className="font-bold text-sm text-white tracking-tight">Camera Flash Flashlight strobe (CAMERA)</h4>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                      Camera hardware permissions is required to toggle the LED Torch on/off during a simulated bypass call flash.
                    </p>
                  </div>
                  <button
                    onClick={() => handleTogglePermission('CAMERA')}
                    className={`shrink-0 py-2 px-4 rounded-xl text-[10px] font-bold tracking-wider uppercase transition-all cursor-pointer ${permissions.CAMERA ? 'bg-[#1e2f24] border border-emerald-800/40 text-emerald-400' : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-750'}`}
                  >
                    {permissions.CAMERA ? '✓ Active' : 'Enable'}
                  </button>
                </div>

              </div>

              {/* OEM Setup Guide */}
              <div className="border-t border-slate-800/80 pt-8">
                <h4 className="font-bold text-white text-base mb-2 tracking-tight">OEM Background Restrictions Troubleshooting Guide</h4>
                <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                  Android Manufacturers (OEMs) like Xiaomi, Samsung, Oppo, and OnePlus use custom hyper-aggressive battery-saving managers that kill background BroadcastReceivers and Foreground Services. Complete these checklists on real devices.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-[#090a0f] p-5.5 rounded-2xl border border-slate-900/80 hover:border-slate-800 transition-colors">
                    <span className="inline-block bg-[#161722] border border-slate-800/60 px-2.5 py-1 text-[10px] font-bold text-[#d0bcff] rounded-lg mb-3 tracking-wider uppercase font-mono">Xiaomi (MIUI / HyperOS)</span>
                    <ul className="text-xs text-slate-400 space-y-2.5 list-decimal list-inside leading-relaxed">
                      <li>Long press App icon &gt; Info</li>
                      <li>Enable <span className="text-amber-400 font-bold">Autostart</span> toggle</li>
                      <li>Go to Battery Saver</li>
                      <li>Set to <span className="text-rose-400 font-bold">No Restrictions</span></li>
                    </ul>
                  </div>

                  <div className="bg-[#090a0f] p-5.5 rounded-2xl border border-slate-900/80 hover:border-slate-800 transition-colors">
                    <span className="inline-block bg-[#161722] border border-slate-800/60 px-2.5 py-1 text-[10px] font-bold text-[#d0bcff] rounded-lg mb-3 tracking-wider uppercase font-mono">Samsung (OneUI)</span>
                    <ul className="text-xs text-slate-400 space-y-2.5 list-decimal list-inside leading-relaxed">
                      <li>Go to Device Care &gt; Battery</li>
                      <li>Add to <span className="text-amber-400 font-bold">"Never sleeping apps"</span></li>
                      <li>Disable "Put unused apps to sleep"</li>
                      <li>Set Battery to <span className="text-rose-400 font-bold">Unrestricted</span></li>
                    </ul>
                  </div>

                  <div className="bg-[#090a0f] p-5.5 rounded-2xl border border-slate-900/80 hover:border-slate-800 transition-colors">
                    <span className="inline-block bg-[#161722] border border-slate-800/60 px-2.5 py-1 text-[10px] font-bold text-[#d0bcff] rounded-lg mb-3 tracking-wider uppercase font-mono">OnePlus / Oppo / RealMe</span>
                    <ul className="text-xs text-slate-400 space-y-2.5 list-decimal list-inside leading-relaxed">
                      <li>Go to App Management &gt; ByPassDND</li>
                      <li>Toggle <span className="text-amber-400 font-bold">"Background activity"</span> ON</li>
                      <li>Turn off "Optimize battery usage"</li>
                      <li>Lock in Recent Tasks switcher</li>
                    </ul>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* 5. HISTORY EVENT LOGS */}
        {activeTab === 'logs' && (
          <div className="space-y-8">
            <div className="bg-[#13141f] border border-slate-800/85 rounded-[24px] p-6 shadow-sm">
              
              <div className="flex md:items-center justify-between mb-6 flex-col sm:flex-row gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">Database Bypass Event Logs</h3>
                  <p className="text-xs text-slate-400 mt-0.5 font-medium">Stored inside local DB tables (BypassLog Room schema).</p>
                </div>
                
                <button
                  onClick={handleClearLogs}
                  disabled={logs.length === 0}
                  className="bg-[#090a0f] hover:bg-[#151622] border border-slate-800 active:scale-95 disabled:opacity-40 text-slate-300 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition-all self-start cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" /> Clear Logs History
                </button>
              </div>

              {logs.length === 0 ? (
                <div className="text-center py-12 bg-[#090a0f] border border-slate-900 rounded-2xl">
                  <Clock className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-sm font-bold text-slate-400">No incoming logs intercepted yet.</p>
                  <p className="text-xs text-slate-600 mt-1">Dial simulated calls from the dialer sandbox to populate database registers.</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-900 rounded-2xl bg-[#090a0f]">
                  <table className="w-full text-left text-xs text-slate-400">
                    <thead className="bg-[#161722] text-slate-300 uppercase tracking-widest text-[9px] font-extrabold border-b border-slate-900">
                      <tr>
                        <th className="p-4">Timestamp</th>
                        <th className="p-4">Caller / number</th>
                        <th className="p-4">original state</th>
                        <th className="p-4">Bypass outcome</th>
                        <th className="p-4">Reason / trigger logic</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900 font-medium">
                      {logs.map(log => (
                        <tr key={log.id} className="hover:bg-[#11121c]/40 transition-colors">
                          <td className="p-4 font-mono text-[10.5px] text-slate-400 whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td className="p-4 whitespace-nowrap">
                            <span className="font-bold text-white block">{log.contactName}</span>
                            <span className="font-mono text-slate-500 text-[10.5px]">{log.phoneNumber}</span>
                          </td>
                          <td className="p-4 font-bold text-amber-500">
                            {log.ringerModeAtCall || 'DND'}
                          </td>
                          <td className="p-4">
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase border ${log.wasBypassed ? 'bg-rose-950/75 border-rose-900/30 text-rose-300' : 'bg-slate-900 border-slate-800 text-slate-550'}`}>
                              {log.wasBypassed ? '🔊 Bypassed' : '🔇 Muted'}
                            </span>
                          </td>
                          <td className="p-4 max-w-sm text-xs text-slate-400 leading-relaxed font-sans">
                            {log.reason}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

            </div>
          </div>
        )}

        {/* 6. ANDROID NATIVE CODE HUB EXPORTER */}
        {activeTab === 'codehub' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            
            {/* File List Selector */}
            <div className="space-y-3 lg:col-span-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block px-1">Source Repository</span>
              <div className="space-y-1 bg-[#13141f]/75 p-2 rounded-2xl border border-slate-850">
                {androidCodeFiles.map(file => (
                  <button
                    key={file.name}
                    onClick={() => {
                      setCodeTab(file.name);
                      setIsCopied(false);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-left text-xs font-bold transition-all cursor-pointer ${codeTab === file.name ? 'bg-[#241c38] text-[#d0bcff] border border-[#d0bcff]/20' : 'text-slate-400 hover:bg-[#111218] hover:text-slate-200 border border-transparent'}`}
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5" />
                      <span>{file.name}</span>
                    </div>
                    <ChevronRight className="w-3 h-3 text-slate-500" />
                  </button>
                ))}
              </div>
            </div>

            {/* Code Content Window */}
            <div className="lg:col-span-3 space-y-4">
              <div className="bg-[#13141f] border border-slate-800/85 rounded-[24px] p-6 relative shadow-sm">
                
                <div className="flex justify-between items-start mb-4 border-b border-slate-850 pb-4 flex-col sm:flex-row gap-4">
                  <div>
                    <h3 className="font-extrabold text-white text-base tracking-tight">{getActiveCode().name}</h3>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">{getActiveCode().path}</p>
                    <p className="text-xs text-slate-400 mt-2 italic leading-relaxed">{getActiveCode().description}</p>
                  </div>

                  <button
                    onClick={() => handleCopyCode(getActiveCode().content)}
                    className="shrink-0 bg-[#090a0f] hover:bg-[#151622] border border-slate-800 text-slate-300 font-bold px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition-all self-start cursor-pointerActive"
                  >
                    {isCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    {isCopied ? 'CopiedToClipboard!' : 'Copy Code'}
                  </button>
                </div>

                <pre className="bg-[#090a0f] border border-slate-900 rounded-2xl p-5 overflow-x-auto text-xs font-mono max-h-[500px] text-zinc-350 antialiased leading-relaxed">
                  <code>{getActiveCode().content}</code>
                </pre>
              </div>

              {/* Architectural notes */}
              <div className="bg-[#13141f]/40 p-6 rounded-2xl border border-slate-900 text-xs text-slate-400 leading-relaxed">
                <p className="font-bold text-slate-200 mb-1 flex items-center gap-1">
                  <Info className="w-4 h-4 text-rose-400" /> Architectural Overview Notes
                </p>
                <ul className="space-y-1.5 list-disc list-inside mt-2.5 text-[11.5px] leading-relaxed">
                  <li>The <span className="text-[#d0bcff] font-semibold font-mono">DndBypassService</span> registers the receiver dynamically upon foreground creation. Done to comply with Android 8+ dynamic broadcast policies.</li>
                  <li>Our <span className="text-[#d0bcff] font-semibold font-mono">CallReceiver</span> intercepts the call and launches a coroutine dispatch checking Room databases for VIP designations, bypassing main thread interruptions.</li>
                  <li>When DND bypassing triggers, it forces playing ringer tones explicitly over <span className="text-[#d0bcff] font-semibold font-mono">AudioAttributes.USAGE_ALARM</span>, allowing it to bypass native system ringer silence rules on all tested endpoints.</li>
                </ul>
              </div>
            </div>

          </div>
        )}

      </main>
    </div>
  );
}
