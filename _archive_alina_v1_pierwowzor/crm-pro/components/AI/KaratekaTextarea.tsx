
import React, { useState } from 'react';
import { UseFormRegisterReturn } from 'react-hook-form';
import { VisualDiffState } from '../../ai/KaratekaTypes';
import { Check } from 'lucide-react';
import { STANDARD_INPUT_CLASS } from '../../modules/utils/window_utils';

interface Props extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    register: UseFormRegisterReturn;
    diffState?: VisualDiffState; // Stan z AI
    onUserCorrect?: (newValue: string) => void;
}

export const KaratekaTextarea: React.FC<Props> = ({ register, diffState, onUserCorrect, className, ...props }) => {
    // Determine Visual Style Override if Diff Active
    let visualClass = className || STANDARD_INPUT_CLASS;

    if (diffState) {
        if (diffState.status === 'PENDING') {
            // AI Suggestion Active -> Override standard border/bg/text
            visualClass = "w-full p-2.5 rounded-xl text-sm font-medium outline-none transition-all border-2 border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 ring-2 ring-purple-500/20";
        } else if (diffState.status === 'MANUAL_OVERRIDE') {
            // User Corrected AI
            visualClass = "w-full p-2.5 rounded-xl text-sm font-medium outline-none transition-all border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/20";
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        register.onChange(e); // Pass to react-hook-form
        
        // If user types while diff is active, mark as Manual Override
        if (diffState && diffState.status === 'PENDING') {
            if (onUserCorrect) onUserCorrect(e.target.value);
        }
    };

    return (
        <div className="relative group">
            {/* Visual Diff Label (Above) */}
            {diffState && diffState.status === 'PENDING' && (
                <div className="absolute -top-5 left-0 text-[9px] flex items-center gap-2 animate-in fade-in slide-in-from-bottom-1 z-10 bg-white dark:bg-zinc-900 px-1 rounded shadow-sm border border-zinc-200 dark:border-zinc-700">
                    <span className="text-zinc-400 line-through decoration-red-500 decoration-2 truncate max-w-[150px]">{diffState.originalValue || '(puste)'}</span>
                    <span className="text-purple-600 font-bold">→ AI</span>
                </div>
            )}

            <textarea 
                {...register}
                {...props}
                onChange={handleChange}
                className={visualClass}
            />

            {/* Status Icons (Right) */}
            {diffState && (
                <div className="absolute right-3 top-3 pointer-events-none">
                    {diffState.status === 'PENDING' && <SparklesIcon className="text-purple-500 animate-pulse" />}
                    {diffState.status === 'MANUAL_OVERRIDE' && <Check className="text-emerald-500" size={16} />}
                </div>
            )}
        </div>
    );
};

const SparklesIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M9 3v4"/><path d="M3 5h4"/><path d="M3 9h4"/></svg>
);
