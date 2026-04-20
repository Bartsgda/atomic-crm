import React, { useState, useEffect } from 'react';
import { Shield, Key, Eye, EyeOff, Lock, AlertTriangle, Check, X, ShieldCheck, Database, Cloud } from 'lucide-react';
import { STANDARD_INPUT_CLASS } from '../modules/utils/window_utils';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (passphrase: string) => void;
    mode?: 'SET' | 'ENTER';
    title?: string;
    description?: string;
}

export const PassphraseModal: React.FC<Props> = ({ isOpen, onClose, onConfirm, mode = 'SET', title, description }) => {
    const [passphrase, setPassphrase] = useState('');
    const [confirmPassphrase, setConfirmPassphrase] = useState('');
    const [showPassphrase, setShowPassphrase] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Walidacja siły hasła (tylko dla trybu SET)
    const hasMinLength = passphrase.length >= 8;
    const hasUppercase = /[A-Z]/.test(passphrase);
    const hasNumber = /[0-9]/.test(passphrase);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(passphrase);
    const matches = passphrase === confirmPassphrase && passphrase.length > 0;

    const isStrong = mode === 'ENTER' ? passphrase.length > 0 : (hasMinLength && hasUppercase && (hasNumber || hasSpecial));
    const canSubmit = mode === 'ENTER' ? passphrase.length > 0 : (isStrong && matches);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (mode === 'SET' && !isStrong) {
            setError("Hasło nie spełnia wymogów bezpieczeństwa.");
            return;
        }

        if (mode === 'SET' && !matches) {
            setError("Hasła nie są identyczne.");
            return;
        }

        onConfirm(passphrase);
        setPassphrase('');
        setConfirmPassphrase('');
    };

    if (!isOpen) return null;

    const modalTitle = title || (mode === 'SET' ? 'Zabezpiecz Synchonizację' : 'Odszyfruj Dane');
    const modalDesc = description || (mode === 'SET' 
        ? 'Twoje dane zostaną zaszyfrowane kluczem AES-GCM przed wysyłką do chmury.' 
        : 'Wprowadź hasło, aby pobrać i odszyfrować dane z chmury.');

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white dark:bg-zinc-900 w-full max-w-lg max-h-[95vh] rounded-3xl shadow-[0_0_100px_rgba(79,70,229,0.15)] overflow-hidden border border-zinc-200 dark:border-zinc-800 animate-in zoom-in-95 duration-200 flex flex-col">
                
                {/* HEADER */}
                <div className="px-8 py-7 text-center bg-zinc-50 dark:bg-zinc-950/50 border-b border-zinc-100 dark:border-zinc-800/50 flex-shrink-0">
                    <div className="w-14 h-14 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner ring-4 ring-indigo-50 dark:ring-indigo-900/10">
                        {mode === 'SET' ? <Lock size={28} /> : <Database size={28} />}
                    </div>
                    <h3 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight mb-1">
                        {modalTitle}
                    </h3>
                    <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 max-w-[320px] mx-auto leading-relaxed">
                        {modalDesc}
                    </p>
                </div>

                {/* CONTENT */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-8 pt-6">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        
                        <div className="space-y-4">
                            <div className="relative">
                                <label className="text-[10px] font-black uppercase text-zinc-500 mb-1.5 block pl-1 tracking-widest">
                                    {mode === 'SET' ? 'Twoje Hasło Szyfrujące' : 'Hasło Deszyfrujące'}
                                </label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-indigo-500 transition-colors">
                                        <Key size={16} />
                                    </div>
                                    <input 
                                        type={showPassphrase ? 'text' : 'password'}
                                        value={passphrase}
                                        onChange={(e) => setPassphrase(e.target.value)}
                                        className="w-full bg-zinc-100 dark:bg-zinc-800 border-2 border-transparent focus:border-indigo-500 rounded-xl py-3.5 pl-11 pr-11 text-sm font-bold transition-all focus:ring-4 focus:ring-indigo-500/10 outline-none"
                                        placeholder={mode === 'SET' ? "Minimum 8 znaków..." : "Wpisz hasło..."}
                                        autoFocus
                                    />
                                    <button 
                                        type="button"
                                        onClick={() => setShowPassphrase(!showPassphrase)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                                    >
                                        {showPassphrase ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            {mode === 'SET' && (
                                <div className="relative">
                                    <label className="text-[10px] font-black uppercase text-zinc-500 mb-1.5 block pl-1 tracking-widest">Powtórz Hasło</label>
                                    <div className="relative group">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-indigo-500 transition-colors">
                                            <Shield size={16} />
                                        </div>
                                        <input 
                                            type={showPassphrase ? 'text' : 'password'}
                                            value={confirmPassphrase}
                                            onChange={(e) => setConfirmPassphrase(e.target.value)}
                                            className={`w-full bg-zinc-100 dark:bg-zinc-800 border-2 border-transparent focus:border-indigo-500 rounded-xl py-3.5 pl-11 pr-11 text-sm font-bold transition-all focus:ring-4 focus:ring-indigo-500/10 outline-none
                                                ${passphrase && confirmPassphrase && !matches ? 'border-red-500 ring-red-500/10' : ''}`}
                                            placeholder="Potwierdź hasło..."
                                        />
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                            {matches && <Check size={16} className="text-emerald-500 animate-in zoom-in" />}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {mode === 'SET' && (
                            <>
                                {/* REQUIREMENTS CHIP */}
                                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800 flex flex-wrap gap-x-3 gap-y-1.5">
                                    <div className={`flex items-center gap-1.5 text-[9px] font-black ${hasMinLength ? 'text-emerald-600' : 'text-zinc-400'}`}>
                                        <div className={`w-1.5 h-1.5 rounded-full ${hasMinLength ? 'bg-emerald-500' : 'bg-zinc-300'}`} />
                                        8+ ZNAKÓW
                                    </div>
                                    <div className={`flex items-center gap-1.5 text-[9px] font-black ${hasUppercase ? 'text-emerald-600' : 'text-zinc-400'}`}>
                                        <div className={`w-1.5 h-1.5 rounded-full ${hasUppercase ? 'bg-emerald-500' : 'bg-zinc-300'}`} />
                                        WIELKA LITERA
                                    </div>
                                    <div className={`flex items-center gap-1.5 text-[9px] font-black ${hasSpecial || hasNumber ? 'text-emerald-600' : 'text-zinc-400'}`}>
                                        <div className={`w-1.5 h-1.5 rounded-full ${hasSpecial || hasNumber ? 'bg-emerald-500' : 'bg-zinc-300'}`} />
                                        CYFRA / ZNAK SPEC.
                                    </div>
                                </div>

                                {/* WARNING BOX */}
                                <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-900/30 flex items-start gap-4">
                                    <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-lg text-amber-600 dark:text-amber-400 flex-shrink-0">
                                        <AlertTriangle size={18} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-amber-800 dark:text-amber-300 uppercase tracking-widest mb-0.5">Zero-Knowledge</p>
                                        <p className="text-[9px] font-bold text-amber-700/80 dark:text-amber-400/80 leading-relaxed">
                                            Serwer nigdy nie pozna Twojego hasła. Jeśli je zgubisz, dane w chmurze przepadną na zawsze.
                                        </p>
                                    </div>
                                </div>
                            </>
                        )}

                        {error && (
                            <div className="text-center text-red-500 text-[10px] font-black uppercase tracking-tighter animate-pulse">
                                {error}
                            </div>
                        )}

                        {/* ACTIONS */}
                        <div className="flex gap-3 pt-2">
                            <button 
                                type="button"
                                onClick={onClose}
                                className="flex-1 py-4 rounded-xl text-[10px] font-black uppercase text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
                            >
                                Anuluj
                            </button>
                            <button 
                                type="submit"
                                disabled={!canSubmit}
                                className={`flex-[1.8] py-4 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-all shadow-xl
                                    ${canSubmit 
                                        ? 'bg-indigo-600 text-white hover:bg-indigo-500 hover:scale-[1.02] active:scale-95 shadow-indigo-600/20' 
                                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed'}`}
                            >
                                {mode === 'SET' ? <Cloud size={14} /> : <ShieldCheck size={14} />}
                                {mode === 'SET' ? 'Synchronizuj z Chmurą' : 'Deszyfruj i Przywróć'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};
