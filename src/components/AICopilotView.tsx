/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  Bot, Send, ShieldAlert, Sparkles, AlertTriangle, 
  RefreshCw, TrendingUp, HelpCircle, CheckCircle, User 
} from "lucide-react";

interface AICopilotViewProps {
  isMobile: boolean;
}

interface ChatMessage {
  sender: "user" | "bot";
  text: string;
  source?: string;
}

export default function AICopilotView({ isMobile }: AICopilotViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<"chatbot" | "duplicates" | "anomalies" | "forecast">("chatbot");
  
  // Chat state
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { 
      sender: "bot", 
      text: "Xin chào cán bộ! Tôi là Trợ lý Trí tuệ Nhân tạo hỗ trợ quản lý dân cư khu phố. Cán bộ có thể hỏi tôi bất kỳ câu hỏi thống kê nào, ví dụ: 'Có bao nhiêu hộ nghèo?', 'Danh sách người già chưa có BHYT?', hay 'Dự báo dân cư tổ 5 năm tới' để tôi tìm kiếm tức thì.",
      source: "Hệ thống AI"
    }
  ]);
  const [chatLoading, setChatLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // AI Audits states
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [forecast, setForecast] = useState<any[]>([]);
  const [forecastAnalysis, setForecastAnalysis] = useState("");
  const [loadingAudits, setLoadingAudits] = useState(false);

  // Fetch duplicates and anomalies
  const fetchAIAudits = async () => {
    setLoadingAudits(true);
    try {
      const [dupRes, anoRes, foreRes] = await Promise.all([
        fetch("/api/ai/duplicates").then(r => r.json()),
        fetch("/api/ai/anomalies").then(r => r.json()),
        fetch("/api/ai/forecast").then(r => r.json())
      ]);

      setDuplicates(dupRes.duplicates || []);
      setAnomalies(anoRes.anomalies || []);
      setForecast(foreRes.forecast || []);
      setForecastAnalysis(foreRes.analysis || "");
    } catch (err) {
      console.error("Failed to load AI audits:", err);
    } finally {
      setLoadingAudits(false);
    }
  };

  useEffect(() => {
    fetchAIAudits();
  }, []);

  useEffect(() => {
    // Scroll chat to bottom
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userMsg = chatInput.trim();
    setChatInput("");
    setChatMessages(prev => [...prev, { sender: "user", text: userMsg }]);
    setChatLoading(true);

    try {
      const response = await fetch("/api/ai/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg,
          chatHistory: chatMessages.slice(-10) // Send recent context
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
        text: "Không thể kết nối đến máy chủ AI. Vui lòng kiểm tra kết nối mạng của bạn.", 
        source: "Hệ thống" 
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div id="ai-copilot-container" className="flex-1 p-4 md:p-6 overflow-y-auto space-y-6 flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-emerald-600" />
            Trợ lý Trí tuệ Nhân tạo (Gemini Copilot)
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Tự động tìm kiếm dữ liệu trùng lắp, kiểm lỗi nhập sai chính tả pháp lý, và dự báo dân số vĩ mô
          </p>
        </div>

        {/* Subtabs selectors */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
          {[
            { id: "chatbot", label: "Hỏi đáp Chatbot", icon: <Bot className="w-3.5 h-3.5" /> },
            { id: "duplicates", label: "Dữ liệu trùng lắp", icon: <ShieldAlert className="w-3.5 h-3.5" /> },
            { id: "anomalies", label: "Sai sót lý lịch", icon: <AlertTriangle className="w-3.5 h-3.5" /> },
            { id: "forecast", label: "Dự báo tăng trưởng", icon: <TrendingUp className="w-3.5 h-3.5" /> }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
                activeSubTab === tab.id
                  ? "bg-white text-emerald-700 shadow-sm font-bold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeSubTab === "chatbot" && (
        /* CHATBOT INTERFACE (occupies maximum screen height cleanly) */
        <div className="flex-1 bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col min-h-[400px]">
          {/* Chat header */}
          <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-emerald-600 animate-bounce" />
              <span className="text-xs font-bold text-slate-700">Trợ lý Cán bộ số (Online)</span>
            </div>
            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">
              Gemini 2.5 Flash
            </span>
          </div>

          {/* Chat Messages Log */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4 max-h-[300px] bg-slate-50/50">
            {chatMessages.map((msg, idx) => (
              <div 
                key={idx} 
                className={`flex gap-3 max-w-[85%] ${
                  msg.sender === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                }`}
              >
                {/* Avatar icon */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  msg.sender === "user" ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600"
                }`}>
                  {msg.sender === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4 text-emerald-700" />}
                </div>

                <div className="space-y-1">
                  <div className={`p-3 rounded-2xl text-xs leading-relaxed shadow-sm border ${
                    msg.sender === "user" 
                      ? "bg-emerald-600 text-white border-emerald-500 rounded-tr-none" 
                      : "bg-white text-slate-800 border-slate-200 rounded-tl-none"
                  }`}>
                    {msg.text}
                  </div>
                  {msg.source && (
                    <p className={`text-[8px] uppercase tracking-wider font-bold ${
                      msg.sender === "user" ? "text-right text-slate-400" : "text-slate-400"
                    }`}>
                      Nguồn: {msg.source}
                    </p>
                  )}
                </div>
              </div>
            ))}

            {chatLoading && (
              <div className="flex gap-3 max-w-[80%]">
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center animate-pulse">
                  <Bot className="w-4 h-4 text-slate-400" />
                </div>
                <div className="bg-white border border-slate-200 p-3.5 rounded-2xl rounded-tl-none text-xs text-slate-500 animate-pulse">
                  Đang rà soát dữ liệu cư dân địa phương...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input form */}
          <form onSubmit={handleSendChat} className="p-4 border-t border-slate-200 bg-white shrink-0 flex gap-2">
            <input
              type="text"
              placeholder="Hỏi trợ lý: 'Có bao nhiêu trẻ em mầm non?' hoặc 'Ai chưa tham gia Bảo hiểm Y tế?'..."
              value={chatInput}
              disabled={chatLoading}
              onChange={(e) => setChatInput(e.target.value)}
              className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-emerald-600 focus:bg-slate-50 disabled:bg-slate-50 disabled:text-slate-400"
            />
            <button
              type="submit"
              disabled={chatLoading || !chatInput.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1 shadow-md transition-colors disabled:bg-slate-200 disabled:text-slate-400 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              Gửi tin
            </button>
          </form>
        </div>
      )}

      {activeSubTab === "duplicates" && (
        /* DUPLICATES AUDITOR LIST */
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-slate-50 p-4 border border-slate-200 rounded-xl shrink-0">
            <div>
              <h3 className="font-bold text-slate-700 text-sm">Rà soát trùng lắp nhân khẩu</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Tìm các cá nhân đăng ký tại 2 hộ khẩu khác nhau hoặc trùng số CCCD/Định danh
              </p>
            </div>
            <button 
              onClick={fetchAIAudits}
              disabled={loadingAudits}
              className="p-2 text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg hover:bg-slate-100 flex items-center gap-1 cursor-pointer text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingAudits ? "animate-spin" : ""}`} />
              Quét lại
            </button>
          </div>

          <div className="space-y-4">
            {duplicates.map((dup, idx) => (
              <div key={idx} className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs border-l-4 border-l-amber-500 flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="bg-amber-100 text-amber-700 px-2.5 py-0.5 rounded text-[10px] font-bold">
                      {dup.severity} PRIORITY
                    </span>
                    <h4 className="font-bold text-slate-800 text-sm">{dup.type}</h4>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 font-mono">
                    <div>
                      <p className="font-bold text-slate-700 uppercase text-[9px]">Bản ghi gốc #1</p>
                      <p className="mt-1">Họ tên: {dup.resident1.name}</p>
                      <p>Ngày sinh: {dup.resident1.bdate}</p>
                      <p>Hộ tịch: Hộ {dup.resident1.householdId}</p>
                    </div>
                    <div>
                      <p className="font-bold text-slate-700 uppercase text-[9px]">Bản ghi nghi vấn #2</p>
                      <p className="mt-1">Họ tên: {dup.resident2.name}</p>
                      <p>Ngày sinh: {dup.resident2.bdate}</p>
                      <p>Hộ tịch: Hộ {dup.resident2.householdId}</p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed">
                    💡 <b>Khuyên dùng của Gemini:</b> {dup.recommendation}
                  </p>
                </div>
              </div>
            ))}

            {duplicates.length === 0 && (
              <div className="bg-white border border-slate-200 p-8 rounded-xl text-center text-slate-400 text-xs">
                Tuyệt vời! Không phát hiện trường hợp trùng lắp thông tin nào.
              </div>
            )}
          </div>
        </div>
      )}

      {activeSubTab === "anomalies" && (
        /* ANOMALIES & INFORMATION CORRECTOR */
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-slate-50 p-4 border border-slate-200 rounded-xl shrink-0">
            <div>
              <h3 className="font-bold text-slate-700 text-sm">Kiểm lỗi mâu thuẫn lô-gích</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Quét mâu thuẫn về tuổi tác, trình độ đào tạo phổ cập, và hạn Bảo hiểm Y tế của nhân khẩu
              </p>
            </div>
            <button 
              onClick={fetchAIAudits}
              disabled={loadingAudits}
              className="p-2 text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg hover:bg-slate-100 flex items-center gap-1 cursor-pointer text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingAudits ? "animate-spin" : ""}`} />
              Quét lại
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {anomalies.map((an, idx) => (
              <div key={idx} className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs border-l-4 border-l-rose-500 flex flex-col justify-between h-full">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded text-[10px] font-bold">
                      {an.severity}
                    </span>
                    <span className="text-[10px] text-slate-400">Trường lỗi: {an.field}</span>
                  </div>

                  <h4 className="font-bold text-slate-800 text-sm">Nhân khẩu: {an.residentName}</h4>
                  
                  <div className="space-y-1 text-xs text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-150">
                    <p><b>Hiện trạng lưu:</b> <span className="font-mono text-rose-600 font-bold">{an.value}</span></p>
                    <p><b>Lý do cảnh báo:</b> {an.reason}</p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 mt-4 text-[11px] text-slate-500 leading-relaxed">
                  🔧 <b>Giải pháp đề nghị:</b> {an.fixSuggestion}
                </div>
              </div>
            ))}

            {anomalies.length === 0 && (
              <div className="col-span-full bg-white border border-slate-200 p-8 rounded-xl text-center text-slate-400 text-xs">
                Không phát hiện mâu thuẫn lô-gích thông tin nào trong dữ liệu.
              </div>
            )}
          </div>
        </div>
      )}

      {activeSubTab === "forecast" && (
        /* POPULATION FORECASTING & ADVISORY */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white border border-slate-200 p-5 rounded-2xl shadow-xs space-y-4">
            <h3 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-3 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              Biểu đồ ước lượng Dân số Tổ dân phố (2026 - 2030)
            </h3>

            {/* Custom SVG Line Chart plotting forecasted populations */}
            <div className="h-64 border border-slate-100 bg-slate-50 rounded-xl p-4 flex flex-col justify-between">
              <div className="flex-1 flex items-end justify-between px-6 pb-2 relative">
                {/* Grid lines */}
                <div className="absolute inset-x-0 h-1/4 border-b border-slate-200/50 bottom-1/4"></div>
                <div className="absolute inset-x-0 h-1/4 border-b border-slate-200/50 bottom-2/4"></div>
                <div className="absolute inset-x-0 h-1/4 border-b border-slate-200/50 bottom-3/4"></div>

                {forecast.map((pt, idx) => {
                  // Normalize height between min population 10 and max 30 for visualization
                  const maxPop = 30;
                  const pct = (pt.population / maxPop) * 100;

                  return (
                    <div key={idx} className="flex flex-col items-center gap-2 z-10 w-1/5">
                      <span className="text-xs font-bold text-slate-800">{pt.population}</span>
                      <div className="w-8 bg-emerald-600/20 hover:bg-emerald-600 hover:scale-105 border-t-2 border-emerald-500 rounded-t-md transition-all" style={{ height: `${pct}px` }}></div>
                      <span className="text-[10px] text-slate-400 font-mono font-bold">{pt.year}</span>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between text-[10px] text-slate-400 pt-2 border-t border-slate-100">
                <span>Dự toán xu hướng biến đổi ròng: sinh sản, tử vong và chuyển dịch lao động tự do</span>
                <span>Phương án: Trung bình</span>
              </div>
            </div>
          </div>

          {/* AI public services advisor panel */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex flex-col justify-between shadow-xs">
            <div className="space-y-4">
              <h3 className="font-bold text-emerald-900 text-sm flex items-center gap-1.5 border-b border-emerald-100 pb-3">
                <Sparkles className="w-4.5 h-4.5 text-emerald-700 animate-pulse" />
                Đánh giá chất lượng hạ tầng công ích AI
              </h3>

              <div className="text-xs text-emerald-800 leading-relaxed whitespace-pre-line bg-white/70 p-4 rounded-xl border border-emerald-100">
                {forecastAnalysis || "Đang phân tích cơ cấu cơ sở dữ liệu để đưa ra dự báo..."}
              </div>
            </div>

            <div className="bg-emerald-950 text-emerald-200 rounded-xl p-3 text-[10px] leading-relaxed mt-4">
              💡 <b>Khuyên dùng của Gemini:</b> Hãy tăng cường chỉ tiêu ngân sách mua sắm trang thiết bị cho Nhà Văn hóa cộng đồng trước năm 2028 nhằm phục vụ người cao tuổi đang tăng nhanh.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
