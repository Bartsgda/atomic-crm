import React, { useState } from 'react';
import { Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import { geminiService } from '../services/geminiService';
import { NLPResult } from '../types';

interface NLPBarProps {
  onResult: (result: NLPResult) => void;
  className?: string;
}

export const NLPBar: React.FC<NLPBarProps> = ({ onResult, className = '' }) => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    setLoading(true);
    const result = await geminiService.parseNaturalLanguage(input);
    setLoading(false);

    if (result) {
      onResult(result);
      setInput('');
    }
  };

  return (
    <div className={`relative z-20 ${className}`}>
      <form onSubmit={handleSubmit} className="relative group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          {loading ? (
             <Loader2 className="h-5 w-5 text-red-600 animate-spin" />
          ) : (
             <Sparkles className="h-5 w-5 text-zinc-400 group-focus-within:text-red-500 transition-colors" />
          )}
        </div>
        <input
          type="text"
          className="block w-full pl-12 pr-12 py-4 border border-zinc-200 rounded-2xl bg-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-500 shadow-sm transition-all font-medium text-zinc-700"
          placeholder="AI: 'Przypomnij o polisie Kowalskiego w piątek'..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-2">
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="p-2 bg-zinc-50 hover:bg-zinc-100 rounded-xl text-zinc-500 hover:text-zinc-900 transition-colors disabled:opacity-50"
          >
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </form>
    </div>
  );
};
