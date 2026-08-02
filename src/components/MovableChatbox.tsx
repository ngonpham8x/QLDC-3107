/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { motion, useDragControls } from "motion/react";
import { 
  Bot, Send, X, Minimize2, Maximize2, Sparkles, 
  HelpCircle, RefreshCw, GripHorizontal, RotateCcw, 
  User, MessageSquareText, EyeOff
} from "lucide-react";

interface ChatMessage {
  sender: "user" | "bot";
  text: string;
  source?: string;
}

export default function MovableChatbox() {
  const [showAssistant, setShowAssistant] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("showAIChatbox") === "true";
    }
    return false;
  });

  const [isOpen, setIsOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { 
      sender: "bot", 
      text: "Chào cán bộ! Tôi là Trợ lý AI Ninh Phú di động. Cán bộ có thể kéo thả tôi tới mọi góc màn hình và hỏi đáp nhanh về nhân khẩu, hộ tịch, bảo hiểm, nước sạch...",
      source: "Hệ thống AI"
    }
  ]);
  const [chatLoading, setChatLoading] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const constraintsRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const handleToggle = () => {
      const isVisible = localStorage.getItem("showAIChatbox") === "true";
      setShowAssistant(isVisible);
      if (isVisible) {
        setIsOpen(true);
        setIsMinimized(false);
      }
    };
    window.addEventListener("toggle-ai-chatbox", handleToggle);
    return () => window.removeEventListener("toggle-ai-chatbox", handleToggle);
  }, []);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, isOpen, isMinimized]);

  if (!showAssistant) return null;

  const handleSendChat = async (textToSend?: string) => {
    const text = (textToSend || chatInput).trim();
    if (!text || chatLoading) return;

    if (!textToSend) {
      setChatInput("");
    }

    setChatMessages(prev => [...prev, { sender: "user", text }]);
    setChatLoading(true);

    try {
      const response = await fetch("/api/ai/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          chatHistory: chatMessages.slice(-8)
        })
      });

      const data = await response.json();
      setChatMessages(prev => [...prev, { 
        sender: "bot", 
        text: data.reply, 
        source: data.source 
      }]);
    } catch (err) {
      console.error("Chat error:", err);
      setChatMessages(prev => [...prev, { 
        sender: "bot", 
        text: "Mất kết nối máy chủ AI. Vui lòng kiểm tra internet.", 
        source: "Hệ thống" 
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSendChat();
    }
  };

  const resetPosition = () => {
    setResetKey(prev => prev + 1);
  };

  const suggestions = [
    "Ai chưa có BHYT?",
    "Hộ nghèo cần giúp đỡ?",
    "Thống kê nước sạch?",
    "Nam độ tuổi NVQS?"
  ];

  return (
    <>
      {/* Background container for viewport constraints limit */}
      <div 
        ref={constraintsRef} 
        className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden"
      >
        {/* Toggle Button / Mini floating bubble */}
        {!isOpen && (
          <motion.button
            id="floating-ai-trigger"
            drag
            dragMomentum={false}
            dragElastic={0.05}
            dragConstraints={constraintsRef}
            onClick={() => setIsOpen(true)}
            initial={{ scale: 0, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="pointer-events-auto fixed bottom-16 right-4 sm:bottom-20 sm:right-6 z-[9999] flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-3.5 py-2.5 rounded-full shadow-[0_8px_30px_rgb(16,185,129,0.3)] hover:shadow-[0_8px_30px_rgb(16,185,129,0.5)] border border-emerald-500/30 transition-all cursor-pointer select-none"
          >
            <div className="relative">
              <Bot className="w-5 h-5 animate-pulse" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-400 border border-emerald-600 rounded-full animate-ping"></span>
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider pr-1">Trợ lý AI</span>
          </motion.button>
        )}

        {/* Floating Movable Draggable Chatbox Window */}
        {isOpen && (
          <motion.div
            key={resetKey}
            drag
            dragControls={dragControls}
            dragListener={false}
            dragMomentum={false}
            dragElastic={0.05}
            dragConstraints={constraintsRef}
            dragTransition={{ bounceStiffness: 600, bounceDamping: 20 }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`pointer-events-auto fixed bottom-16 right-4 w-[calc(100vw-32px)] max-w-[345px] sm:bottom-24 sm:right-6 sm:w-[320px] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.4)] overflow-hidden flex flex-col select-none z-[9999] ${isMinimized ? "" : "backdrop-blur-md"}`}
          >
            {/* Header / Grab Bar */}
            <div 
              onPointerDown={(e) => dragControls.start(e)}
              className={`border-b border-slate-800 px-3 py-2 flex items-center justify-between shrink-0 select-none cursor-grab active:cursor-grabbing ${isMinimized ? "bg-slate-950" : "bg-slate-950/80"}`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <GripHorizontal className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shrink-0"></div>
                <h4 className="font-bold text-[11px] text-slate-200 uppercase tracking-wider truncate">Trợ lý Ninh Phú AI</h4>
              </div>
              
              <div className="flex items-center gap-1.5 sm:gap-1 pointer-events-auto">
                {/* Reset button */}
                <button 
                  onClick={(e) => { e.stopPropagation(); resetPosition(); }}
                  title="Đặt lại vị trí"
                  className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
                {/* Minimize button */}
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
                  title={isMinimized ? "Phóng to" : "Thu nhỏ"}
                  className="p-2 sm:p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition-colors cursor-pointer min-w-[36px] min-h-[36px] sm:min-w-[24px] sm:min-h-[24px] flex items-center justify-center"
                >
                  {isMinimized ? <Maximize2 className="w-4.5 h-4.5 sm:w-3 sm:h-3" /> : <Minimize2 className="w-4.5 h-4.5 sm:w-3 sm:h-3" />}
                </button>
                {/* Close button */}
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
                  title="Đóng chatbox"
                  className="p-2 sm:p-1 hover:bg-slate-800 text-slate-400 hover:text-rose-400 rounded transition-colors cursor-pointer min-w-[36px] min-h-[36px] sm:min-w-[24px] sm:min-h-[24px] flex items-center justify-center"
                >
                  <X className="w-4.5 h-4.5 sm:w-3.5 sm:h-3.5" />
                </button>
                {/* Hide Assistant button */}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm("Bạn có chắc chắn muốn ẩn hoàn toàn Trợ lý AI? Bạn có thể mở lại trợ lý bất kỳ lúc nào bằng nút ở góc trên bên phải thanh tiêu đề.")) {
                      localStorage.setItem("showAIChatbox", "false");
                      window.dispatchEvent(new Event("toggle-ai-chatbox"));
                    }
                  }}
                  title="Ẩn hoàn toàn Trợ lý AI"
                  className="p-2 sm:p-1 hover:bg-slate-800 text-slate-400 hover:text-rose-400 rounded transition-colors cursor-pointer min-w-[36px] min-h-[36px] sm:min-w-[24px] sm:min-h-[24px] flex items-center justify-center"
                >
                  <EyeOff className="w-4.5 h-4.5 sm:w-3.5 sm:h-3.5" />
                </button>
              </div>
            </div>

            {/* Expansible Content */}
            {!isMinimized && (
              <>
                {/* Message Log */}
                <div className="flex-1 p-3.5 overflow-y-auto space-y-3 max-h-[260px] min-h-[180px] bg-slate-950/40 text-slate-300">
                  {chatMessages.map((msg, idx) => (
                    <div 
                      key={idx} 
                      className={`flex gap-2 max-w-[90%] ${
                        msg.sender === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                      }`}
                    >
                      <div className={`w-6.5 h-6.5 rounded-full flex items-center justify-center shrink-0 ${
                        msg.sender === "user" ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400"
                      }`}>
                        {msg.sender === "user" ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5 text-emerald-400" />}
                      </div>

                      <div className="space-y-0.5">
                        <div className={`p-2.5 rounded-xl text-[11px] leading-relaxed shadow-sm border ${
                          msg.sender === "user" 
                            ? "bg-emerald-600 text-white border-emerald-500 rounded-tr-none" 
                            : "bg-slate-800/80 text-slate-200 border-slate-700/60 rounded-tl-none"
                        }`}>
                          {msg.text}
                        </div>
                        {msg.source && (
                          <p className="text-[8px] text-slate-500 uppercase tracking-wider font-semibold">
                            Nguồn: {msg.source}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}

                  {chatLoading && (
                    <div className="flex gap-2 max-w-[85%]">
                      <div className="w-6.5 h-6.5 rounded-full bg-slate-800 flex items-center justify-center animate-pulse shrink-0">
                        <Bot className="w-3.5 h-3.5 text-slate-500" />
                      </div>
                      <div className="bg-slate-850 border border-slate-700/50 p-2.5 rounded-xl rounded-tl-none text-[10px] text-slate-400 animate-pulse">
                        Đang rà soát dữ liệu cư dân...
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Quick Prompts */}
                <div className="px-3 py-2 bg-slate-950/20 border-t border-slate-800 shrink-0">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1">
                    <MessageSquareText className="w-3 h-3 text-emerald-500" />
                    Gợi ý truy vấn nhanh
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {suggestions.map((sug, sIdx) => (
                      <button
                        key={sIdx}
                        onClick={() => handleSendChat(sug)}
                        disabled={chatLoading}
                        className="text-[10px] bg-slate-800/80 hover:bg-emerald-950 hover:text-emerald-300 hover:border-emerald-800 border border-slate-700 text-slate-300 px-2 py-0.5 rounded-md cursor-pointer transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Input Area */}
                <div className="p-2 border-t border-slate-800 bg-slate-900 shrink-0 flex gap-1.5">
                  <input
                    type="text"
                    placeholder="Nhập câu hỏi hành chính..."
                    value={chatInput}
                    disabled={chatLoading}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-emerald-600 focus:bg-slate-950 disabled:opacity-50"
                  />
                  <button
                    onClick={() => handleSendChat()}
                    disabled={chatLoading || !chatInput.trim()}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-800 disabled:text-slate-500 text-white p-1.5 rounded-lg shrink-0 cursor-pointer transition-colors"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </div>
    </>
  );
}
