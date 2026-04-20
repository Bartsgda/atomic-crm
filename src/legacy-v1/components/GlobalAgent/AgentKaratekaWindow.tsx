
import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send, Bot, ArrowRight, Eraser, Terminal, User, Hash, ChevronRight } from 'lucide-react';
import { karateka } from '../../ai/KaratekaService';

interface Props {
    state?: any;
    onNavigate?: (page: string, data?: any) => void;
    onRefresh?: () => void;
    onAgentAction?: (action: any) => Promise<{ clientId?: string, policyId?: string } | void>;
}

interface Message {
    role: 'user' | 'ai';
    text: string;
}

export const AgentKaratekaWindow: React.FC<Props> = ({ state, onNavigate, onRefresh, onAgentAction }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { role: 'ai', text: "Terminal Agenta v2.0 gotowy. Wpisz polecenie (np. 'Znajdź Kowalskiego', 'Nowa polisa')." }
    ]);
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
    
    // Context Memory
    const [activeContext, setActiveContext] = useState<{ 
        clientId?: string, 
        policyId?: string,
        label?: string,
        path?: string
    }>({ path: '~/dashboard' });
    
    const scrollRef = useRef<HTMLDivElement>(null);
    const logsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages, isThinking]);

    useEffect(() => {
        if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }, [consoleLogs]);

    // --- NAVIGATOR LISTENER ---
    useEffect(() => {
        const handleNav = (e: CustomEvent) => {
            // Update Fake CLI Path
            let newPath = `~/${e.detail.page}`;
            let newContext = { ...activeContext };

            if (e.detail.clientId) {
                const client = state?.clients.find((c: any) => c.id === e.detail.clientId);
                if (client) {
                    newPath = `~/clients/${client.lastName.toLowerCase()}`;
                    newContext.clientId = client.id;
                    newContext.label = `${client.lastName} ${client.firstName}`;
                }
            } else {
                newContext.clientId = undefined;
                newContext.label = undefined;
            }
            
            if (e.detail.policyId || e.detail.highlightPolicyId) {
                 const pid = e.detail.policyId || e.detail.highlightPolicyId;
                 newContext.policyId = pid;
                 // SAFE SUBSTRING: Ensure pid is string
                 const safePid = String(pid);
                 newPath += `/policy_${safePid.substring(0,4)}`;
            } else {
                 newContext.policyId = undefined;
            }
            
            newContext.path = newPath;
            setActiveContext(newContext);

            if (onNavigate) {
                if (e.detail.page === 'client-details') {
                    const client = state?.clients.find((c: any) => c.id === e.detail.clientId);
                    if (client) {
                        onNavigate('client-details', { client, highlightPolicyId: e.detail.highlightPolicyId });
                    }
                } else {
                    onNavigate(e.detail.page);
                }
            }
        };
        window.addEventListener('AGENT_NAVIGATE', handleNav as EventListener);
        return () => window.removeEventListener('AGENT_NAVIGATE', handleNav as EventListener);
    }, [state?.clients, onNavigate, activeContext]);

    // --- MAIN LOGIC ---
    const handleSend = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!input.trim()) return;

        const userMsg = input;
        setInput('');
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setIsThinking(true);
        setConsoleLogs([]); 

        // 1. Context Build
        const contextData = { 
            location: activeContext.path,
            client: activeContext.clientId ? { id: activeContext.clientId } : undefined,
            contextPolicyId: activeContext.policyId
        };

        // 2. Generate
        const response = await karateka.generateExecutionPlan(userMsg, contextData);
        
        // 3. Execute
        if (response.plan && response.plan.length > 0) {
            setConsoleLogs(prev => [...prev, `> Wykonuję ${response.plan.length} instrukcji...`]);
            
            const results = await karateka.executePlan(response.plan, (msg) => {
                setConsoleLogs(prev => [...prev, `> ${msg}`]);
            });

            if (results.requestedAction && onAgentAction) {
                await onAgentAction(results.requestedAction);
            }
            if (onRefresh) onRefresh(); 

            // Final message
            const chatStep = response.plan.find((s: any) => s.op === 'CHAT');
            if (chatStep) {
                setMessages(prev => [...prev, { role: 'ai', text: chatStep.message }]);
            }
        } else {
            setMessages(prev => [...prev, { role: 'ai', text: "Brak operacji. Spróbuj inaczej." }]);
        }

        setIsThinking(false);
    };

    const clearContext = () => {
        setActiveContext({ path: '~/dashboard' });
        setMessages([{ role: 'ai', text: "Kontekst zresetowany." }]);
        setConsoleLogs([]);
    };

    // Listener na globalny event — otwiera agenta z StatusEye panel
    useEffect(() => {
        const open = () => setIsOpen(true);
        window.addEventListener('crm:open-agent', open);
        return () => window.removeEventListener('crm:open-agent', open);
    }, []);

    if (!isOpen) return null;

    return (
        <div className="fixed bottom-6 right-6 z-[9999] w-96 h-[600px] bg-zinc-900 border-2 border-zinc-700 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 fade-in font-mono text-xs">
            {/* CLI Header */}
            <div className="bg-zinc-800 p-2 flex justify-between items-center border-b border-zinc-700 text-zinc-400 select-none">
                <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                    </div>
                    <span className="font-bold ml-2">sys_admin@crm:{activeContext.path}$</span>
                </div>
                <button onClick={() => setIsOpen(false)} className="hover:text-white"><X size={14}/></button>
            </div>

            {/* Context Info */}
            {activeContext.label && (
                <div className="bg-blue-900/30 border-b border-blue-800 p-2 flex items-center gap-2 text-blue-300">
                    <User size={12} />
                    <span>Active: {activeContext.label}</span>
                    <button onClick={clearContext} className="ml-auto hover:text-white"><Eraser size={12}/></button>
                </div>
            )}

            {/* Console Output (Logs) */}
            <div className="h-32 bg-black p-3 overflow-y-auto border-b border-zinc-800 text-emerald-500 font-mono leading-tight shadow-inner" ref={logsRef}>
                {consoleLogs.map((log, i) => (
                    <div key={i} className="mb-1 opacity-90">{log}</div>
                ))}
                {isThinking && <div className="animate-pulse text-amber-500">_ przetwarzanie polecenia...</div>}
            </div>

            {/* Chat History */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-zinc-900" ref={scrollRef}>
                {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[90%] p-2 rounded-lg border ${
                            m.role === 'user' 
                            ? 'bg-zinc-800 border-zinc-700 text-zinc-300' 
                            : 'bg-transparent border-transparent text-zinc-400 italic'
                        }`}>
                            <span className="font-bold mr-1">{m.role === 'user' ? '>' : '#'}</span> {m.text}
                        </div>
                    </div>
                ))}
            </div>

            {/* CLI Input */}
            <form onSubmit={handleSend} className="p-2 bg-zinc-800 border-t border-zinc-700 flex gap-2 items-center">
                <span className="text-emerald-500 font-bold px-1 animate-pulse">_</span>
                <input 
                    className="flex-1 bg-transparent border-none outline-none text-white placeholder-zinc-600 font-bold"
                    placeholder="Wpisz polecenie..."
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    autoFocus
                />
                <button type="submit" className="text-zinc-500 hover:text-white"><ChevronRight size={16}/></button>
            </form>
        </div>
    );
};
