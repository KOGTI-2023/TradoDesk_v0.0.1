import React, { useState, useEffect, useRef } from 'react';
import { Send, Upload, BrainCircuit, Zap, ThumbsUp, ThumbsDown, FileChartColumn, FileText, Info } from 'lucide-react';
import { GeminiService } from '../services/geminiService';
import { useAppStore } from '../store/appStore';
import { ModelLane, AppError } from '@tradodesk/shared/src/types';
import { createCorrelationId } from '@tradodesk/shared/src/errorUtils';
import { logger } from '../services/logging';

interface ChatMessage {
    id: string;
    role: 'user' | 'model';
    text: string;
    image?: string;
    feedback?: 'up' | 'down' | null;
    contextType: 'chart' | 'news' | 'general';
}

const MessageBubble: React.FC<{ 
    message: ChatMessage; 
    onFeedback: (id: string, type: 'up' | 'down') => void 
}> = ({ message, onFeedback }) => {
    const isUser = message.role === 'user';
    
    // Accessibility: Role article for individual messages
    return (
        <article 
            className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
            aria-label={isUser ? "User message" : "AI response"}
        >
            <div 
                className={`max-w-[85%] rounded-lg p-3 shadow-sm ${
                    isUser ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-200'
                }`}
            >
                {/* Context Header (AI Only) */}
                {!isUser && message.contextType !== 'general' && (
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mb-2 pb-1 border-b border-slate-600/50 uppercase tracking-wider font-semibold">
                        {message.contextType === 'chart' ? (
                            <><FileChartColumn size={12} /> Chart Analysis</>
                        ) : (
                            <><FileText size={12} /> Summary</>
                        )}
                    </div>
                )}

                {/* Image Attachment */}
                {message.image && (
                    <img 
                        src={message.image} 
                        alt="User uploaded chart or context" 
                        className="mb-2 max-h-40 rounded border border-slate-500/50" 
                    />
                )}

                {/* Text Content */}
                <div 
                    className="whitespace-pre-wrap text-sm leading-relaxed" 
                    role="status" 
                    aria-live={!isUser ? "polite" : "off"}
                >
                    {message.text}
                </div>

                {/* Feedback & Actions (AI Only) */}
                {!isUser && (
                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-600/50">
                         <div className="flex gap-2">
                            <button 
                                onClick={() => onFeedback(message.id, 'up')}
                                className={`p-1 rounded transition-colors ${message.feedback === 'up' ? 'text-emerald-400 bg-emerald-900/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-600'}`}
                                aria-label="Mark response as helpful"
                                aria-pressed={message.feedback === 'up'}
                            >
                                <ThumbsUp size={14} />
                            </button>
                            <button 
                                onClick={() => onFeedback(message.id, 'down')}
                                className={`p-1 rounded transition-colors ${message.feedback === 'down' ? 'text-red-400 bg-red-900/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-600'}`}
                                aria-label="Mark response as unhelpful"
                                aria-pressed={message.feedback === 'down'}
                            >
                                <ThumbsDown size={14} />
                            </button>
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1">
                            <Info size={10} />
                            <span>AI-Generated</span>
                        </div>
                    </div>
                )}
            </div>
        </article>
    );
};

export const ChatInterface: React.FC = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lane, setLane] = useState<ModelLane>(ModelLane.FAST);
  const [isTyping, setIsTyping] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const { addUsageRecord, apiKey } = useAppStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if ((window as any).electron) {
        (window as any).electron.onScreenshot((base64: string) => {
            setPendingImage(base64);
            setLane(ModelLane.DEEP); // Switch to deep model for image analysis automatically
        });
    }
  }, []);

  const handleFeedback = (id: string, type: 'up' | 'down') => {
      setMessages(prev => prev.map(m => {
          if (m.id === id) {
              const newFeedback = m.feedback === type ? null : type;
              logger.info("User Feedback", id, { type: newFeedback, textSnippet: m.text.substring(0, 50) });
              return { ...m, feedback: newFeedback };
          }
          return m;
      }));
  };

  const handleSend = async () => {
    if ((!input.trim() && !pendingImage) || !apiKey) return;
    setErrorMsg(null);

    const corrId = createCorrelationId();
    // Infer context type: if image is present, it's likely a chart analysis task.
    // If text contains keywords like "news" or "summary", mark as news (heuristic).
    const contextType = pendingImage ? 'chart' : input.toLowerCase().includes('news') ? 'news' : 'general';

    const userMsg: ChatMessage = { 
        id: corrId, 
        role: 'user', 
        text: input, 
        image: pendingImage || undefined,
        feedback: null,
        contextType
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setPendingImage(null);
    setIsTyping(true);

    const service = new GeminiService(apiKey);
    const startTime = Date.now();
    let responseText = '';
    
    const botMsgId = createCorrelationId();
    setMessages(prev => [...prev, { 
        id: botMsgId, 
        role: 'model', 
        text: '', 
        feedback: null,
        contextType // Inherit context type for the response
    }]);

    const history = messages.map(m => ({
        role: m.role,
        parts: m.image 
            ? [{ inlineData: { mimeType: 'image/png', data: m.image.split(',')[1] } }, { text: m.text }] 
            : [{ text: m.text }]
    }));

    const stream = service.streamResponse(userMsg.text, lane, history, userMsg.image || undefined, corrId);

    try {
        for await (const result of stream) {
            if (result.ok) {
                if (result.value.text) {
                    responseText += result.value.text;
                    setMessages(prev => {
                        const newMsgs = [...prev];
                        const lastMsg = newMsgs[newMsgs.length - 1];
                        if (lastMsg.id === botMsgId) {
                            lastMsg.text = responseText;
                        }
                        return newMsgs;
                    });
                }
                
                if (result.value.usage) {
                    const record = {
                        id: createCorrelationId(),
                        timestamp: Date.now(),
                        model: lane,
                        lane: lane === ModelLane.DEEP ? 'deep' : 'fast',
                        promptTokens: result.value.usage.promptTokenCount || 0,
                        outputTokens: result.value.usage.candidatesTokenCount || 0,
                        totalTokens: result.value.usage.totalTokenCount || 0,
                        latencyMs: Date.now() - startTime,
                        cost: 0 
                    };
                    addUsageRecord(record as any);
                }
            } else {
                // Handle Error
                const err = result.error as AppError;
                setErrorMsg(`Fehler: ${err.message_de} (${err.suggested_action_de})`);
                logger.error("Chat Error", corrId, { err });
                setMessages(prev => {
                    const newMsgs = [...prev];
                    const lastMsg = newMsgs[newMsgs.length - 1];
                    if (lastMsg.id === botMsgId) {
                         lastMsg.text += `\n\n[SYSTEM FEHLER]: ${err.message_de}`;
                    }
                    return newMsgs;
                });
            }
        }
    } catch (e) {
        logger.fatal("Critical Stream Failure", corrId, { error: e });
        setErrorMsg("Ein kritischer Fehler ist aufgetreten.");
    } finally {
        setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-full" role="region" aria-label="Chat Interface">
      {/* Lane Toggle */}
      <div className="p-2 bg-slate-800/50 flex justify-center gap-2">
        <button
            onClick={() => setLane(ModelLane.FAST)}
            className={`px-4 py-1 text-xs rounded-full flex items-center gap-1 transition-colors ${lane === ModelLane.FAST ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400'}`}
            aria-pressed={lane === ModelLane.FAST}
        >
            <Zap size={12} /> Schnell (Flash)
        </button>
        <button
            onClick={() => setLane(ModelLane.DEEP)}
            className={`px-4 py-1 text-xs rounded-full flex items-center gap-1 transition-colors ${lane === ModelLane.DEEP ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-400'}`}
            aria-pressed={lane === ModelLane.DEEP}
        >
            <BrainCircuit size={12} /> Analyse (Pro+Thinking)
        </button>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div role="alert" className="bg-red-900/50 text-red-200 text-xs p-2 text-center border-b border-red-800">
            {errorMsg}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" role="log" aria-label="Message history">
        {messages.map((m) => (
            <MessageBubble key={m.id} message={m} onFeedback={handleFeedback} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-slate-800 border-t border-slate-700">
        {pendingImage && (
            <div className="mb-2 flex items-center gap-2 bg-slate-700 p-2 rounded text-xs animate-pulse">
                <span className="text-emerald-400 font-semibold">Analyzing Image Context...</span>
                <button 
                    onClick={() => setPendingImage(null)} 
                    className="text-red-400 hover:text-red-300 ml-auto"
                    aria-label="Remove image"
                >
                    Entfernen
                </button>
            </div>
        )}
        <div className="flex gap-2">
            <input 
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder={pendingImage ? "Frage zum Chart/Bild..." : "Nachricht an TradoDesk..."}
                className="flex-1 bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                aria-label="Chat input"
            />
            <button 
                onClick={handleSend}
                disabled={isTyping}
                className="bg-indigo-600 hover:bg-indigo-500 text-white p-2 rounded-md disabled:opacity-50 transition-colors focus:ring-2 focus:ring-indigo-400"
                aria-label="Send message"
            >
                <Send size={18} />
            </button>
        </div>
        <div className="text-[10px] text-slate-500 mt-1 text-center">
            Ctrl+Shift+S für Screenshot • DEMO MODE: Aktiv
        </div>
      </div>
    </div>
  );
};
