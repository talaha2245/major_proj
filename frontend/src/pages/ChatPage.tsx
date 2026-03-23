import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Cpu, Wrench, Globe, CloudRain, Newspaper, Clock, ScanLine, LineChart, GraduationCap, Mail, Inbox, Zap, MessageSquare, Brain } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAtomValue } from 'jotai';
import { userAtom, googleCredentialsAtom } from '@/store';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  tools_used?: string[];
}

export const AVAILABLE_TOOLS = [
  { id: 'weather_tool', name: 'Global Weather', icon: CloudRain },
  { id: 'news_tool', name: 'Live News', icon: Newspaper },
  { id: 'search_tool', name: 'DuckDuckGo Search', icon: Globe },
  { id: 'time_tool', name: 'System Clock', icon: Clock },
  { id: 'scrape_webpage', name: 'Web Scraper', icon: ScanLine },
  { id: 'finance_tool', name: 'Finance / Crypto', icon: LineChart },
  { id: 'arxiv_tool', name: 'ArXiv Papers', icon: GraduationCap },
  { id: 'read_recent_emails', name: 'Gmail Inbox', icon: Inbox },
  { id: 'send_email', name: 'Send Email', icon: Mail },
];

export default function ChatPage() {
  const user = useAtomValue(userAtom);
  const googleCredentials = useAtomValue(googleCredentialsAtom);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: 'assistant',
      content: "Hi there! I'm EchoMind, your elite system assistant. I have live access to tools like **Weather**, **News**, and **Search**. How can I assist you today?"
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatMode, setChatMode] = useState<'fast' | 'normal' | 'deep'>('fast');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      // Direct scrollTo strictly targets this container, preventing the browser 
      // from attempting to shift the entire parent window up to meet an element.
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Gather messages for context awareness based on selected mode
      let historyToSend: { role: string, content: string }[] = [];
      if (chatMode === 'fast') {
        historyToSend = []; // Send no previous contextual messages
      } else if (chatMode === 'normal') {
        historyToSend = messages.slice(-2).map(m => ({ role: m.role, content: m.content })); // 1 previous interaction pair
      } else if (chatMode === 'deep') {
        historyToSend = messages.slice(-10).map(m => ({ role: m.role, content: m.content })); // Up to 5 previous pairs
      }

      // https://myapp-backend-2-p1nh.onrender.com
      // http://localhost:8000
      const response = await fetch('https://myapp-backend-2-p1nh.onrender.com/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: userMessage.content,
          history: historyToSend,
          google_credentials: googleCredentials,
          mode: chatMode
        }),
      });

      if (!response.ok) throw new Error('Network response was not ok');
      if (!response.body) throw new Error('No response body');

      const assistantId = (Date.now() + 1).toString();
      
      // Seed empty assistant message to stream into
      setMessages((prev) => [
        ...prev, 
        { id: assistantId, role: 'assistant', content: '', tools_used: [] }
      ]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let done = false;
      let buffer = '';

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep the incomplete line in the buffer for the next chunk
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6).trim();
              if (!dataStr) continue;
              
              try {
                const parsed = JSON.parse(dataStr);
                
                if (parsed.type === 'token') {
                  setMessages(prev => prev.map(msg => 
                    msg.id === assistantId 
                      ? { ...msg, content: msg.content + parsed.content }
                      : msg
                  ));
                } else if (parsed.type === 'tool') {
                  setMessages(prev => prev.map(msg => 
                    msg.id === assistantId 
                      ? { ...msg, tools_used: [...(msg.tools_used || []), parsed.name] }
                      : msg
                  ));
                } else if (parsed.type === 'error') {
                   setMessages(prev => prev.map(msg => 
                    msg.id === assistantId 
                      ? { ...msg, content: msg.content + '\n\n**Error:** ' + parsed.content }
                      : msg
                  ));
                }
              } catch (e) {
                console.error("Error parsing SSE JSON:", dataStr, e);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching chat response:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I encountered an error connecting to the backend. Please ensure the server is running on `http://localhost:8000`.',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div 
      key="chat"
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      transition={{ duration: 0.2 }}
      className="w-full max-w-6xl flex-1 min-h-0 flex flex-col md:flex-row gap-6 relative"
    >
      {/* Sidebar Tools Panel */}
      <div className="hidden md:flex flex-col w-64 border border-white/5 bg-[#0a0a0a] rounded-xl p-4">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-4">Plugin Ecosystem</h3>
        <div className="space-y-2 flex-1">
          {AVAILABLE_TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <div 
                key={tool.id} 
                className="flex items-center gap-3 p-3 rounded-lg border border-white/5 bg-zinc-900/50 hover:bg-zinc-800/50 transition-colors"
              >
                <Icon className="w-4 h-4 text-zinc-400" />
                <span className="text-sm font-medium text-zinc-300">{tool.name}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-auto pt-4 border-t border-white/5 border-b border-transparent">
          <div className="flex items-center gap-3 px-2 py-1 bg-indigo-500/5 rounded-md border border-indigo-500/10">
            <Cpu className="w-4 h-4 text-indigo-400" />
            <span className="text-[11px] font-bold tracking-widest text-indigo-300/80 uppercase">Llama 3.1 8B Live</span>
          </div>
        </div>
      </div>

      {/* Chat Container */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 border border-white/5 bg-black/40 backdrop-blur-md rounded-xl overflow-hidden relative shadow-2xl">
        <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto px-4 lg:px-6 custom-scrollbar">
          <div className="flex flex-col gap-6 py-6">
            <AnimatePresence initial={false}>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex items-start gap-4 ${
                    message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  <div className={`mt-1 w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden border ${
                    message.role === 'user' 
                      ? 'bg-zinc-100 border-zinc-200' 
                      : 'bg-black border-white/10'
                  }`}>
                    {message.role === 'user' ? (
                      user?.picture ? (
                        <img src={user.picture} alt="User" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-zinc-800" />
                      )
                    ) : (
                      <img src="/avatar.png" alt="EchoMind" className="w-full h-full object-cover" />
                    )}
                  </div>
                  
                  <div className="flex flex-col gap-2 max-w-[85%] min-w-0">
                    {/* Tool Usage Badge */}
                    {message.role === 'assistant' && message.tools_used && message.tools_used.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-1">
                        {message.tools_used.map(toolId => {
                          const toolInfo = AVAILABLE_TOOLS.find(t => t.id === toolId) || { name: toolId, icon: Wrench };
                          const Icon = toolInfo.icon;
                          return (
                            <div key={toolId} className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-900 border border-white/10 text-xs font-medium text-zinc-300">
                              <Icon className="w-3 h-3 text-zinc-400" />
                              <span>Used {toolInfo.name}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div
                      className={`px-5 py-3.5 text-[15px] leading-relaxed shadow-sm overflow-hidden ${
                        message.role === 'user'
                          ? 'bg-zinc-100 text-black rounded-2xl rounded-tr-sm font-medium shadow-white/5 whitespace-pre-wrap break-words'
                          : 'bg-black/80 backdrop-blur-md text-zinc-300 rounded-2xl rounded-tl-sm border border-white/5 prose prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-zinc-950 prose-pre:border prose-pre:border-white/10 prose-strong:text-zinc-100 placeholder:text-zinc-500 break-words'
                      }`}
                    >
                      {message.role === 'user' ? (
                        <p className="break-words">{message.content}</p>
                      ) : (
                        <div className="markdown-body text-zinc-200 break-words">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            
            
            {isLoading && (
              <motion.div 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-4"
              >
                <div className="mt-1 w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden border bg-black border-white/10">
                   <img src="/avatar.png" alt="EchoMind" className="w-full h-full object-cover opacity-50 pulse-anim" />
                </div>
                <div className="px-5 py-3.5 rounded-2xl bg-zinc-900 border border-white/5 rounded-tl-sm flex items-center gap-3">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
        
        <div className="p-4 bg-[#0a0a0a] border-t border-white/5 shrink-0 flex flex-col gap-3">
          {/* Mode Selector */}
          <div className="flex items-center justify-center gap-2 max-w-4xl mx-auto w-full">
            <button
              type="button"
              onClick={() => setChatMode('fast')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                chatMode === 'fast' 
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                  : 'bg-zinc-900 text-zinc-500 hover:bg-zinc-800 border border-transparent'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              Quick Reply
            </button>
            <button
              type="button"
              onClick={() => setChatMode('normal')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                chatMode === 'normal' 
                  ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' 
                  : 'bg-zinc-900 text-zinc-500 hover:bg-zinc-800 border border-transparent'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Standard
            </button>
            <button
              type="button"
              onClick={() => setChatMode('deep')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                chatMode === 'deep' 
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                  : 'bg-zinc-900 text-zinc-500 hover:bg-zinc-800 border border-transparent'
              }`}
            >
              <Brain className="w-3.5 h-3.5" />
              Deep Research
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex items-center gap-3 max-w-4xl mx-auto w-full">
            <Input
              value={input}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
              placeholder="Message EchoMind..."
              className="flex-1 h-12 px-5 rounded-lg border-white/10 bg-zinc-900 text-white placeholder:text-zinc-600 focus-visible:ring-1 focus-visible:ring-zinc-700 focus-visible:ring-offset-0 focus-visible:bg-zinc-800 text-base transition-colors"
              disabled={isLoading}
            />
            <Button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="h-12 w-12 rounded-lg bg-zinc-100 hover:bg-white text-black transition-colors shrink-0 p-0 flex items-center justify-center disabled:opacity-50"
            >
              <span className="sr-only">Send</span>
              <Send className="w-5 h-5" />
            </Button>
          </form>
        </div>
      </div>
    </motion.div>
  );
}
