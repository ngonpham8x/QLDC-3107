/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { 
  Users, Home, Calendar, Award, Building, Sparkles, FileText, 
  Activity, User, LogOut, ShieldCheck, KeyRound, Smartphone, Check, HelpCircle,
  RefreshCw, AlertTriangle, Download, Wifi, WifiOff, Menu, ChevronLeft, ChevronRight, ChevronUp, ChevronDown,
  Eye, EyeOff, Bot, ZoomIn, ZoomOut, Sun, Moon, ArrowRight, Clock
} from "lucide-react";
import { Household, Resident, BusinessHousehold, RuralCriteria, DemographicsChange, DemographicsChangeType, User as UserType, UserRole, AllowedEmail, canUserPerformAction } from "./types";

// Import components
import XLSX from "xlsx-js-style";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import DeviceSimulator from "./components/DeviceSimulator";
import DashboardView from "./components/DashboardView";
import HouseholdView from "./components/HouseholdView";
import ResidentView from "./components/ResidentView";
import DemographicsChangeView from "./components/DemographicsChangeView";
import SocialSecurityView from "./components/SocialSecurityView";
import BusinessView from "./components/BusinessView";
import NewRuralView from "./components/NewRuralView";
import AICopilotView from "./components/AICopilotView";
import AllowedEmailsView from "./components/AllowedEmailsView";
import AdminPanel from "./components/AdminPanel";
import QuarterDocumentsView from "./components/QuarterDocumentsView";
import { ExportColumnModal } from "./components/ExportColumnModal";
import { useAuth } from "./context/AuthContext";
import MovableChatbox from "./components/MovableChatbox";
const officialLogo = "/logo_default.png";

export default function App() {
  const { user, loading: authLoading, login: contextLogin, loginWithRedirect: contextLoginWithRedirect, logout: contextLogout } = useAuth();
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);

  // 2FA Phone Verification States
  const [require2FA, setRequire2FA] = useState(false);
  const [otpPhoneInput, setOtpPhoneInput] = useState("");
  const [otpCodeInput, setOtpCodeInput] = useState("");
  const [generatedOtpCode, setGeneratedOtpCode] = useState<string | null>(null);
  const [otpMessage, setOtpMessage] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);

/**
 * Tránh hiện Login khi hệ thống vẫn đang xác thực quyền.
 */
const [checkingAccess, setCheckingAccess] = useState(true);

/**
 * Chống gọi checkUserAccess nhiều lần cùng lúc.
 */
const checkingAccessRef = useRef(false);

  // Login Form States
  const [loginPhone, setLoginPhone] = useState("");
  const [loginRole, setLoginRole] = useState<UserRole>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("selected_login_role");
      if (saved && Object.values(UserRole).includes(saved as UserRole)) {
        return saved as UserRole;
      }
    }
    return UserRole.SUPER_ADMIN;
  });
  const [loginMethod, setLoginMethod] = useState<"google" | "phone">("google");

  // Registration States
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [regEmail, setRegEmail] = useState("");
  const [regFullName, setRegFullName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regRole, setRegRole] = useState<UserRole>(UserRole.WARD_LEADER);
  const [regReason, setRegReason] = useState("");
  const [regSuccessMessage, setRegSuccessMessage] = useState("");

  // 2FA & admin routing States
  
  const [showAIChatbox, setShowAIChatbox] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("showAIChatbox") === "true";
    }
    return false;
  });

  useEffect(() => {
    const handleToggle = () => {
      setShowAIChatbox(localStorage.getItem("showAIChatbox") === "true");
    };
    window.addEventListener("toggle-ai-chatbox", handleToggle);
    return () => window.removeEventListener("toggle-ai-chatbox", handleToggle);
  }, []);

  const handleToggleAIChatbox = () => {
    const newVal = !showAIChatbox;
    localStorage.setItem("showAIChatbox", newVal ? "true" : "false");
    window.dispatchEvent(new Event("toggle-ai-chatbox"));
  };

  const [isMobileNavCollapsed, setIsMobileNavCollapsed] = useState<boolean>(false);

  const [isAdminPath, setIsAdminPath] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return window.location.pathname === "/admin" || window.location.pathname === "/admin/";
    }
    return false;
  });

  // PDF Export Column Selection Modal State
  const [exportPdfModalConfig, setExportPdfModalConfig] = useState<{
    isOpen: boolean;
    reportTitle: string;
    unitName: string;
    headers: string[];
    rows: any[][];
  } | null>(null);

  // Keep state in sync with URL popstate events (for in-app back/forward navigation)
  useEffect(() => {
    const handlePopState = () => {
      setIsAdminPath(window.location.pathname === "/admin" || window.location.pathname === "/admin/");
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigateTo = (path: string) => {
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", path);
      setIsAdminPath(path === "/admin" || path === "/admin/");
    }
  };


  useEffect(() => {
    //localStorage.removeItem("currentUser");
    // localStorage.removeItem("passed2FA");
  }, []);

  // Synchronize Google login session with local currentUser state
  const checkUserAccess = useCallback(async () => {
    console.count("CHECK USER EFFECT");
    console.log("APP UID:", user?.uid);

    // Nếu Firebase vẫn đang xác thực, chỉ giữ trạng thái loading và chờ lần hiệu ứng tiếp theo
    if (authLoading) {
      setCheckingAccess(true);
      return;
    }

    // Không chạy song song nhiều lần
    if (checkingAccessRef.current) {
      return;
    }

    checkingAccessRef.current = true;
    setCheckingAccess(true);

    try {
      console.log("========== CHECK USER ==========");
      console.log("authLoading =", authLoading);
      console.log("firebase user =", user);
      console.log("currentUser =", currentUser);
      console.log("explicit_logout =", sessionStorage.getItem("explicit_logout"));

      // Người dùng chủ động logout
      if (sessionStorage.getItem("explicit_logout") === "true") {
        setCurrentUser(null);
        return;
      }

      // Chưa đăng nhập Google
      if (!user) {
        console.log(">>> CLEAR CURRENT USER");
        setCurrentUser(null);
        return;
      }

      const email = user.email || "";
      const googleDisplayName = user.displayName;

      const selectedRole = (typeof window !== "undefined" && localStorage.getItem("selected_login_role")) || loginRole;
      const res = await fetch(
        `/api/auth/session-check?email=${encodeURIComponent(email)}&requestedRole=${encodeURIComponent(selectedRole)}`
      );

      if (!res.ok) {
        throw new Error("Session check failed");
      }

      const access = await res.json();

      if (access.allowed && access.role) {
        setRequire2FA(false);
        console.log(">>> SET CURRENT USER", access.role);

        // Uu tien ho va ten thuc te tu tai khoan Google, sau do den fullName tu danh sach phan quyen backend, cuoi cung fall back theo email
        let resolvedFullName = (googleDisplayName && googleDisplayName.trim()) || (access.fullName && access.fullName.trim()) || "";
        if (!resolvedFullName || resolvedFullName === "Cán bộ số" || resolvedFullName === "Linh Tinh") {
          const lowerEmail = email.toLowerCase().trim();
          if (lowerEmail === "tayninhdoimoi@gmail.com") {
            resolvedFullName = "Phạm Duy Ngôn";
          } else if (lowerEmail === "bhttq3@gmail.com") {
            resolvedFullName = "Quýt Trần";
          } else if (lowerEmail === "nguyentanbinh3005@gmail.com") {
            resolvedFullName = "Nguyễn Tấn Bình";
          } else if (lowerEmail === "sonngocholtel@gmail.com") {
            resolvedFullName = "HOLTEL SƠN NGỌC";
          } else {
            resolvedFullName = email.includes("@") ? email.split("@")[0] : "Cán bộ Quản lý";
          }
        }

        const newUser = {
          id: user.uid,
          username: email,
          fullName: resolvedFullName,
          role: access.role,
          phone: user.phoneNumber || "0912345678",
          avatarUrl: user.photoURL || undefined,
          permissions: access.permissions,
        };

        setCurrentUser(prev => {
          if (
            prev &&
            prev.id === newUser.id &&
            prev.username === newUser.username &&
            prev.role === newUser.role &&
            prev.fullName === newUser.fullName &&
            prev.phone === newUser.phone &&
            JSON.stringify(prev.permissions) === JSON.stringify(newUser.permissions)
          ) {
            console.log(">>> CURRENT USER KHÔNG ĐỔI");
            return prev;
          }

          console.log(">>> SET CURRENT USER", newUser.role, newUser.permissions);
          return newUser;
        });

        setLoginError("");
        return;
      }

      // Log unauthorized login attempt to alert Super Admin
      try {
        await fetch("/api/auth/unauthorized-attempt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, displayName: googleDisplayName || email })
        });
      } catch (logErr) {
        console.error("Failed to post unauthorized attempt alert", logErr);
      }

      setLoginError(
        `Tài khoản Google ${email} chưa được cấp quyền truy cập. Vui lòng liên hệ Người quản lý (0912.012.114) để được cấp quyền.`
      );

      setCurrentUser(null);
      localStorage.removeItem("currentUser");
      await contextLogout();

    } catch (err) {
      console.error(err);
      setCurrentUser(null);
    } finally {
      checkingAccessRef.current = false;
      setCheckingAccess(false);
    }
  }, [authLoading, user, loginRole, contextLogout, otpPhoneInput]);

  useEffect(() => {
    checkUserAccess();
  }, [checkUserAccess]);

  // Real-time access/revoke and role change checking heartbeat
  useEffect(() => {
    if (!currentUser) return;

    const checkCurrentSession = async () => {
      try {
        const res = await fetch(`/api/auth/session-check?email=${encodeURIComponent(currentUser.username)}&requestedRole=${encodeURIComponent(currentUser.role)}`);
        if (res.ok) {
          const ct = res.headers.get("content-type");
          if (ct && ct.includes("application/json")) {
            const data = await res.json();
            if (!data.allowed) {
              // User was removed or is not allowed anymore! Kick them immediately!
              sessionStorage.setItem("explicit_logout", "true");
              console.log(">>> CLEAR CURRENT USER (Session revoked)");
              setCurrentUser(null);
              localStorage.removeItem("currentUser");
              await contextLogout();
              alert(`[QUYỀN TRUY CẬP BỊ HỦY] Tài khoản của bạn (${currentUser.username}) đã bị Người quản lý thu hồi quyền truy cập hệ thống. Bạn sẽ bị đăng xuất ngay lập tức.`);
            } else if (data.role !== currentUser.role) {
              // Role was modified! Update immediately!
              const updatedUser = { ...currentUser, role: data.role };
              setCurrentUser(updatedUser);
              alert(`[CẬP NHẬT QUYỀN TRUY CẬP] Vai trò của bạn đã được thay đổi thành: ${data.role === UserRole.SUPER_ADMIN ? "Quản trị viên" : data.role === UserRole.WARD_LEADER ? "Trưởng khu phố" : "Cộng tác viên"}. Hệ thống đã cập nhật phân quyền mới.`);
            }
          }
        }
      } catch (err) {
        console.warn("Heartbeat session check failed, skipping", err);
      }
    };

    // Run check every 3 seconds for immediate response
    const interval = setInterval(checkCurrentSession, 300000);
    return () => clearInterval(interval);
  }, [currentUser]);
  
  // Data State
  const [households, setHouseholds] = useState<Household[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [businesses, setBusinesses] = useState<BusinessHousehold[]>([]);
  const [criteria, setCriteria] = useState<RuralCriteria[]>([]);
  const [changes, setChanges] = useState<DemographicsChange[]>([]);
  const [existingEntityIds, setExistingEntityIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Backup States
  const [lastBackupDate, setLastBackupDate] = useState<string | null>(null);
  const [showBackupReminder, setShowBackupReminder] = useState<boolean>(false);
  const [latestSecurityAlert, setLatestSecurityAlert] = useState<any | null>(null);
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("dismissed_security_alerts");
        return saved ? JSON.parse(saved) : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const handleDismissSecurityAlert = (alertKey: string) => {
    if (!alertKey) {
      setLatestSecurityAlert(null);
      return;
    }
    const updated = [...dismissedAlerts, alertKey];
    setDismissedAlerts(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem("dismissed_security_alerts", JSON.stringify(updated));
    }
    setLatestSecurityAlert(null);
  };

  const formatVietnameseFullName = (nameStr: string): string => {
    if (!nameStr) return "Cán bộ số";
    const trimmed = nameStr.trim();
    return trimmed || "Cán bộ số";
  };

  const prettyNameFromEmail = (email: string): string => {
    if (!email) return "Cán bộ Quản lý";
    const localPart = email.split("@")[0] || "";
    const cleaned = localPart
      .replace(/[._\-]+/g, " ")
      .replace(/\d+/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!cleaned) return "Cán bộ Quản lý";
    return cleaned
      .split(" ")
      .filter(Boolean)
      .map(word => word[0].toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  const getUserInitials = (nameStr: string): string => {
    if (!nameStr) return "CB";
    const parts = nameStr.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "CB";
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const handleSelectRole = (role: UserRole) => {
    setLoginRole(role);
    if (typeof window !== "undefined") {
      localStorage.setItem("selected_login_role", role);
    }
  };

  // Navigation tab state
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [isSidebarHidden, setIsSidebarHidden] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth < 768;
    }
    return false;
  });

  // Login Form States
  
  const [loginError, setLoginError] = useState<React.ReactNode>("");

  // Offline & Synchronize state and helpers (Disabled dynamic offline per user request)
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [offlineQueue, setOfflineQueue] = useState<{ id: string; url: string; method: string; body: any; description: string }[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Beautiful Custom Alert state
  const [appAlert, setAppAlert] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  // Welcome Officer Modal state
  const [welcomeModal, setWelcomeModal] = useState<{
    isOpen: boolean;
    fullName: string;
    role: string;
  } | null>(null);

  // Real-time Clock State (Hiển thị ngày giờ thực tế thời gian thực)
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format Vietnamese Date & Time
  const formatVietnameseDateTime = (date: Date) => {
    const days = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
    const dayName = days[date.getDay()];
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    
    return {
      dateStr: `${dayName}, ${dd}/${mm}/${yyyy}`,
      timeStr: `${hh}:${min}:${ss}`,
      fullStr: `${dayName}, ${dd}/${mm}/${yyyy} • ${hh}:${min}:${ss}`
    };
  };

  // Dynamic Daily Wishes Array (Cập nhật câu chúc năng động tươi mới mỗi ngày)
  const getDailyWish = (date: Date) => {
    const hours = date.getHours();
    let timeGreeting = "Chúc Cán bộ ngày mới tràn đầy năng lượng";
    if (hours >= 5 && hours < 11) {
      timeGreeting = "Chúc Cán bộ buổi sáng khởi đầu rực rỡ & dồi dào năng lượng";
    } else if (hours >= 11 && hours < 14) {
      timeGreeting = "Chúc Cán bộ buổi trưa vui vẻ & hăng say công tác";
    } else if (hours >= 14 && hours < 18) {
      timeGreeting = "Chúc Cán bộ buổi chiều công tác hiệu quả, hanh thông";
    } else {
      timeGreeting = "Chúc Cán bộ buổi tối làm việc tập trung & thành công";
    }

    const DYNAMIC_WISHES = [
      "🌟 Xử lý hồ sơ nhanh gọn, chính xác tuyệt đối và đạt nhiều kết quả bứt phá!",
      "🚀 Khởi đầu ngày mới cực kỳ năng động! Hoàn thành xuất sắc nhiệm vụ phục vụ Nhân dân Ninh Phú!",
      "☀️ Mỗi ngày làm việc là một cơ hội lan tỏa giá trị văn minh và tinh thần trách nhiệm!",
      "🎯 Tập trung cao độ, giải quyết thủ tục tức thì, mang đến sự hài lòng trọn vẹn!",
      "🌈 Năng lượng tích cực bứt phá! Luôn nhiệt huyết và giữ vững mục tiêu công tác!",
      "💡 Sáng tạo đổi mới trong từng nhiệm vụ quản lý dân cư, làm chủ chuyển đổi số!",
      "🔥 Làm việc hăng say, nâng cao hiệu suất và đón nhận nhiều hân hoan trong ngày mới!",
      "🏆 Tận tụy phục vụ Nhân dân, gương mẫu đi đầu, xứng danh Cán bộ năng động Phường Ninh Phú!",
      "✨ Giữ nụ cười tươi mới, tinh thần chủ động và gặt hái nhiều niềm vui công tác!",
      "☘️ Công việc hanh thông, phối hợp nhịp nhàng, đóng góp cho Khu phố ngày càng giàu đẹp!"
    ];

    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);
    const wishIndex = (dayOfYear + date.getDay()) % DYNAMIC_WISHES.length;

    return `${timeGreeting}! ${DYNAMIC_WISHES[wishIndex]}`;
  };

  const prevUserLoginIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (currentUser) {
      const userUniqueKey = `${currentUser.id || currentUser.username}_${currentUser.role}`;
      // Mỗi khi đăng nhập lại hoặc chuyển đổi tài khoản, hiển thị popup chào mừng
      if (prevUserLoginIdRef.current !== userUniqueKey) {
        const roleText =
          currentUser.role === UserRole.SUPER_ADMIN
            ? "Quản trị viên Cấp cao"
            : currentUser.role === UserRole.WARD_LEADER
            ? "Trưởng Khu phố / Tổ trưởng"
            : "Cộng tác viên Nhập liệu";
        setWelcomeModal({
          isOpen: true,
          fullName: currentUser.fullName || prettyNameFromEmail(currentUser.username || ""),
          role: roleText
        });
        prevUserLoginIdRef.current = userUniqueKey;
      }
    } else {
      prevUserLoginIdRef.current = null;
    }
  }, [currentUser]);

  // Zoom scaling state
  const [zoomScale, setZoomScale] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("appZoomScale");
      return saved ? parseInt(saved, 10) : 100;
    }
    return 100;
  });

  // Theme state: day (light) and night (dark)
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("appTheme");
      return (saved as "light" | "dark") || "light";
    }
    return "light";
  });

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === "light" ? "dark" : "light";
      localStorage.setItem("appTheme", next);
      return next;
    });
  };

  const handleZoomIn = () => {
    setZoomScale(prev => {
      const next = Math.min(prev + 10, 155);
      localStorage.setItem("appZoomScale", next.toString());
      return next;
    });
  };

  const handleZoomOut = () => {
    setZoomScale(prev => {
      const next = Math.max(prev - 10, 75);
      localStorage.setItem("appZoomScale", next.toString());
      return next;
    });
  };

  const handleZoomReset = () => {
    setZoomScale(100);
    localStorage.setItem("appZoomScale", "100");
  };

  // Sync state helpers
  const syncOfflineCache = (type: string, data: any) => {
    localStorage.setItem(`off_${type}`, JSON.stringify(data));
  };

  const enqueueOfflineAction = (url: string, method: string, body: any, description: string) => {
    const newItem = {
      id: `QUE-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      url,
      method,
      body,
      description
    };
    setOfflineQueue(prev => {
      const updated = [...prev, newItem];
      localStorage.setItem("offline_queue", JSON.stringify(updated));
      return updated;
    });
  };

  const triggerSync = async () => {
    const savedQueue = localStorage.getItem("offline_queue");
    if (!savedQueue) return;
    let queue: any[] = [];
    try {
      queue = JSON.parse(savedQueue);
    } catch (e) {
      return;
    }
    if (queue.length === 0) return;

    setIsSyncing(true);
    let successCount = 0;
    const remainingQueue = [...queue];

    for (const item of queue) {
      try {
        const response = await fetch(item.url, {
          method: item.method,
          headers: item.body ? { "Content-Type": "application/json" } : undefined,
          body: item.body ? JSON.stringify(item.body) : undefined
        });

        if (response.ok) {
          successCount++;
          remainingQueue.shift(); // Remove from processing
          localStorage.setItem("offline_queue", JSON.stringify(remainingQueue));
          setOfflineQueue([...remainingQueue]);
        } else {
          console.warn(`Sync failed for action: ${item.description}`, response.statusText);
          break; // Stop sequencing if offline/error persists
        }
      } catch (err) {
        console.error(`Sync network exception for action: ${item.description}`, err);
        break; // Stop on network issues
      }
    }

    setIsSyncing(false);
    setIsOnline(true);

    if (successCount > 0) {
      await fetchData();
    }
  };

  // Fetch initial data from Express backend with offline fallbacks
  const fetchData = async () => {
    setLoading(true);
    try {
      const safeJson = async (p: Promise<Response>) => {
        try {
          const res = await p;
          if (!res.ok) return {};
          const ct = res.headers.get("content-type");
          if (ct && ct.includes("application/json")) {
            return await res.json();
          }
          const text = await res.text();
          return JSON.parse(text);
        } catch {
          return {};
        }
      };

      const [hhRes, resRes, busRes, critRes, changesRes] = await Promise.all([
        safeJson(fetch("/api/households")),
        safeJson(fetch("/api/residents")),
        safeJson(fetch("/api/businesses")),
        safeJson(fetch("/api/criteria")),
        safeJson(fetch("/api/changes"))
      ]);

      let hh = Array.isArray(hhRes) ? hhRes : (hhRes.households || []);
      let rs = Array.isArray(resRes) ? resRes : (resRes.residents || []);
      const bs = Array.isArray(busRes) ? busRes : (busRes.businesses || []);
      const cr = Array.isArray(critRes) ? critRes : (critRes.criteria || []);
      const ch = Array.isArray(changesRes) ? changesRes : (changesRes.changes || []);

      // 1. Tự động phục hồi/tạo hộ gia đình bị thiếu từ nhân khẩu chủ hộ
      const hhMap = new Map<string, Household>(hh.map((h: any) => [h.id, h]));
      rs.forEach((r: any) => {
        if (r.householdId && !hhMap.has(r.householdId)) {
          const synthesizedHh: Household = {
            id: r.householdId,
            ownerId: r.id,
            ownerName: r.fullName,
            ownerOldCmnd: r.oldCmnd,
            address: r.permanentAddress || r.temporaryAddress || "Chưa cập nhật địa chỉ",
            wardId: r.wardId || "Tổ 5",
            status: "Bình thường" as any,
            waterSource: "Nước máy / Nước sạch" as any,
            wasteCollectionStatus: "Đã đăng ký" as any,
            housingType: "Có" as any,
            isWasteFeePaid: true,
            isPolicyFamily: false,
            isMeritoriousFamily: false,
            isCulturalFamily: true,
            createdAt: new Date().toISOString().split("T")[0],
            photoUrl: r.photoUrl || "",
            gpsLat: r.gpsLat || 11.365123,
            gpsLng: r.gpsLng || 106.112345,
            notes: `Tự động tổng hợp từ nhân khẩu chủ hộ ${r.fullName}`
          };
          hhMap.set(r.householdId, synthesizedHh);
          hh.push(synthesizedHh);
        }
      });

      // 2. Đồng bộ tọa độ vị trí GPS của hộ dân cho các nhân khẩu thuộc hộ (lấy tọa độ hộ khẩu làm mặc định)
      rs = rs.map((r: any) => {
        if (r.householdId && hhMap.has(r.householdId)) {
          const parentHh = hhMap.get(r.householdId)!;
          if (parentHh.gpsLat !== undefined && parentHh.gpsLng !== undefined) {
            return {
              ...r,
              gpsLat: parentHh.gpsLat,
              gpsLng: parentHh.gpsLng
            };
          }
        }
        return r;
      });

      setHouseholds(hh);
      setResidents(rs);
      setBusinesses(bs);
      setCriteria(cr);
      setChanges(ch);

      // Populate existingEntityIds only once on initial load
      setExistingEntityIds(prev => {
        if (prev.size > 0) return prev;
        const ids = new Set<string>();
        hh.forEach((h: any) => ids.add(h.id));
        rs.forEach((r: any) => ids.add(r.id));
        bs.forEach((b: any) => ids.add(b.id));
        ch.forEach((c: any) => ids.add(c.id));
        return ids;
      });

      // Save to localStorage for robust offline capability
      localStorage.setItem("off_households", JSON.stringify(hh));
      localStorage.setItem("off_residents", JSON.stringify(rs));
      localStorage.setItem("off_businesses", JSON.stringify(bs));
      localStorage.setItem("off_criteria", JSON.stringify(cr));
      localStorage.setItem("off_changes", JSON.stringify(ch));

      setIsOnline(true);
    } catch (err) {
      console.warn("Backend API not reachable. Loading from offline cache.", err);
      setIsOnline(false);

      // Load cached offline copies
      const cachedHh = localStorage.getItem("off_households");
      const cachedRes = localStorage.getItem("off_residents");
      const cachedBus = localStorage.getItem("off_businesses");
      const cachedCrit = localStorage.getItem("off_criteria");
      const cachedCh = localStorage.getItem("off_changes");

      if (cachedHh) setHouseholds(JSON.parse(cachedHh));
      if (cachedRes) setResidents(JSON.parse(cachedRes));
      if (cachedBus) setBusinesses(JSON.parse(cachedBus));
      if (cachedCrit) setCriteria(JSON.parse(cachedCrit));
      if (cachedCh) setChanges(JSON.parse(cachedCh));

      setExistingEntityIds(prev => {
        if (prev.size > 0) return prev;
        const ids = new Set<string>();
        if (cachedHh) JSON.parse(cachedHh).forEach((h: any) => ids.add(h.id));
        if (cachedRes) JSON.parse(cachedRes).forEach((r: any) => ids.add(r.id));
        if (cachedBus) JSON.parse(cachedBus).forEach((b: any) => ids.add(b.id));
        if (cachedCh) JSON.parse(cachedCh).forEach((c: any) => ids.add(c.id));
        return ids;
      });
    } finally {
      setLoading(false);
    }
  };

  const safeFetchJson = async (url: string, options?: RequestInit) => {
    try {
      const res = await fetch(url, options);
      if (!res.ok) return { ok: false, data: null };
      const ct = res.headers.get("content-type");
      if (ct && ct.includes("application/json")) {
        return { ok: true, data: await res.json() };
      }
      const text = await res.text();
      try {
        return { ok: true, data: JSON.parse(text) };
      } catch {
        return { ok: false, data: null };
      }
    } catch {
      return { ok: false, data: null };
    }
  };

  const checkSecurityAlerts = async () => {
    if (currentUser && currentUser.role === UserRole.SUPER_ADMIN) {
      try {
        const { ok, data: logs } = await safeFetchJson("/api/logs");
        if (ok && Array.isArray(logs)) {
          // Filter logs that are security warnings (like unauthorized access attempts)
          const securityLogs = logs.filter((log: any) => {
            const isWarning = log.action?.includes("CẢNH BÁO") || log.details?.includes("chưa được cấp quyền");
            const alertKey = log.id || log.timestamp?.toString() || log.details;
            return isWarning && alertKey && !dismissedAlerts.includes(alertKey);
          });
          if (securityLogs && securityLogs.length > 0) {
            const topAlert = securityLogs[0];
            setLatestSecurityAlert(topAlert);
            
            // Native Web Browser Notification (Desktop & Phone Screen Alert)
            if (typeof window !== "undefined" && "Notification" in window) {
              const triggerWebNotif = () => {
                try {
                  new Notification("🚨 CẢNH BÁO TÀI KHOẢN LẠ ĐĂNG NHẬP", {
                    body: topAlert.details || "Phát hiện đăng nhập tài khoản chưa được cấp quyền!",
                    icon: officialLogo
                  });
                } catch (e) {
                  console.error("Desktop notification error:", e);
                }
              };
              if (Notification.permission === "granted") {
                triggerWebNotif();
              } else if (Notification.permission !== "denied") {
                Notification.requestPermission().then((permission) => {
                  if (permission === "granted") triggerWebNotif();
                });
              }
            }
          } else {
            setLatestSecurityAlert(null);
          }
        }
      } catch (e) {
        // Quietly ignore
      }
    } else {
      setLatestSecurityAlert(null);
    }
  };

  useEffect(() => {
    // Read saved queue on startup
    const savedQueue = localStorage.getItem("offline_queue");
    if (savedQueue) {
      try {
        setOfflineQueue(JSON.parse(savedQueue));
      } catch (e) {
        console.error("Failed to parse offline queue on startup", e);
      }
    }

    fetchData();
  }, []);

  // Check security alerts periodically for SUPER_ADMIN
  useEffect(() => {
    if (currentUser && currentUser.role === UserRole.SUPER_ADMIN) {
      checkSecurityAlerts();
      const alertInterval = setInterval(() => {
        checkSecurityAlerts();
      }, 10000); // Poll every 10s for new security alerts
      return () => clearInterval(alertInterval);
    } else {
      setShowBackupReminder(false);
      setLatestSecurityAlert(null);
    }
  }, [currentUser, dismissedAlerts]);

  // Google Login state and trigger using real Firebase Auth
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleLogin = async () => {
    sessionStorage.removeItem("explicit_logout");
    setGoogleLoading(true);
    setLoginError("");
    try {
      await contextLogin();
    } catch (error: any) {
      const errorStr = (error && error.message) ? String(error.message).toLowerCase() : "";
      const errorCode = (error && error.code) ? String(error.code).toLowerCase() : "";

      const isPopupIssue = error && (
        error.code === "auth/popup-closed-by-user" || 
        error.code === "auth/popup-blocked" || 
        errorStr.includes("popup-closed-by-user") || 
        errorStr.includes("popup_closed_by_user") ||
        errorStr.includes("cancelled") ||
        errorStr.includes("closed-by-user") ||
        errorStr.includes("popup-blocked")
      );

      const isRedirectIssue = error && (
        errorStr.includes("redirect_uri_mismatch") || 
        errorStr.includes("uri_mismatch") ||
        errorCode.includes("unauthorized-domain") ||
        errorStr.includes("unauthorized-domain")
      );

      if (isPopupIssue || isRedirectIssue) {
        console.warn('Google login trigger warning (popup issue / redirect mismatch):', error);
        
        let isInsideIframe = false;
        try {
          isInsideIframe = window.self !== window.top;
        } catch (e) {
          isInsideIframe = true;
        }

        const isExplicitConfigIssue = errorCode.includes("unauthorized-domain") || errorStr.includes("unauthorized-domain") || isRedirectIssue;

        if (isExplicitConfigIssue) {
          setLoginError(
            <div className="space-y-2 p-3.5 bg-rose-50/80 border border-rose-250 rounded-xl text-left shadow-xs">
              <p className="font-bold text-rose-800 text-[11px] uppercase tracking-wide flex items-center gap-1">⚠️ Lỗi: Tên miền chưa được cấp phép (Unauthorized Domain)</p>
              <p className="text-[10px] text-slate-600 font-medium leading-relaxed">
                Tên miền hiện tại (<code className="bg-white border border-slate-200 px-1 py-0.5 rounded text-rose-600 font-mono text-[9px] break-all">{window.location.hostname}</code>) chưa được thêm vào danh sách <strong className="text-slate-800">Authorized Domains</strong> trong cấu hình Firebase Authentication.
              </p>
              <p className="text-[9.5px] text-slate-500 leading-relaxed pt-1 border-t border-rose-100">
                <strong>Hướng dẫn khắc phục:</strong> Cán bộ cần truy cập <span className="font-semibold text-slate-700">Firebase Console &gt; Authentication &gt; Settings &gt; Authorized domains</span> và nhấp <span className="font-semibold text-slate-700">"Add domain"</span> để thêm tên miền trên (<code className="font-semibold text-slate-700">{window.location.hostname}</code>) vào hệ thống trước khi đăng nhập Google.
              </p>
            </div>
          );
        } else if (isInsideIframe) {
          setLoginError(
            <div className="space-y-2 text-left">
              <p className="font-bold text-rose-800">Cửa sổ đăng nhập (Google Popup) bị chặn hoặc không thể hiển thị trong khung bảo mật (IFrame) của AI Studio.</p>
              <p className="text-[10px] text-slate-300 font-medium leading-relaxed">
                Vui lòng mở ứng dụng trực tiếp trong tab mới để đăng nhập bằng tài khoản Google thực tế một cách an toàn:
              </p>
              <a 
                href={window.location.href} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="mt-2 block w-full text-center py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-[11px] uppercase shadow-md hover:shadow-lg transition-all animate-pulse"
              >
                Mở trong Tab mới ↗
              </a>
              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-700"></div>
                <span className="flex-shrink mx-2 text-slate-500 text-[9px] uppercase font-bold">Hoặc thử</span>
                <div className="flex-grow border-t border-slate-700"></div>
              </div>
              <button
                type="button"
                onClick={handleGoogleLoginRedirect}
                className="block w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-[10px] uppercase shadow-sm transition-all cursor-pointer text-center"
              >
                Đăng nhập Chuyển hướng (Redirect) 🔄
              </button>
            </div>
          );
        } else {
          setLoginError(
            <div className="space-y-2 p-3.5 bg-amber-50/80 border border-amber-250 rounded-xl text-left shadow-xs">
              <p className="font-bold text-amber-800 text-[11px] uppercase tracking-wide flex items-center gap-1">⚠️ Cửa sổ đăng nhập bị chặn hoặc đóng</p>
              <p className="text-[10px] text-slate-600 font-medium leading-relaxed">
                Cửa sổ đăng nhập Google (Popup) đã bị trình duyệt chặn hiển thị hoặc đã bị cán bộ đóng trước khi hoàn tất đăng nhập.
              </p>
              <button
                type="button"
                onClick={handleGoogleLoginRedirect}
                className="mt-2 block w-full text-center py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-[10px] uppercase shadow-sm transition-all cursor-pointer"
              >
                Đăng nhập bằng Chuyển hướng (Google Redirect) 🔄
              </button>
              <p className="text-[9.5px] text-slate-500 leading-relaxed pt-1 border-t border-amber-200">
                <strong>Cách xử lý khác:</strong> Vui lòng cho phép hiển thị cửa sổ bật lên (popups) cho trang web này trên thanh địa chỉ trình duyệt, hoặc nhấp nút Đăng nhập Chuyển hướng ở trên (không cần mở popup).
              </p>
            </div>
          );
        }
      } else {
        console.error('Google login trigger error:', error);
        setLoginError(`Lỗi Google Auth thực tế: ${error.message || "Vui lòng kiểm tra lại kết nối mạng."}`);
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleLoginRedirect = async () => {
    sessionStorage.removeItem("explicit_logout");
    setGoogleLoading(true);
    setLoginError("");
    try {
      await contextLoginWithRedirect();
      setLoginError("");
    } catch (error: any) {
      console.error('Google login redirect error:', error);
      setLoginError(`Lỗi đăng nhập Google Redirect: ${error.message || "Vui lòng kiểm tra lại kết nối mạng."}`);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleDemoBypass = async () => {
    setLoginError("Đăng nhập mô phỏng đã bị tắt. Vui lòng đăng nhập bằng tài khoản Google được cấp quyền.");
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setRegSuccessMessage("");

    const emailToSubmit = regEmail.trim().toLowerCase();
    const fullNameToSubmit = regFullName.trim();
    const phoneToSubmit = regPhone.trim();

    if (!emailToSubmit || !fullNameToSubmit || !phoneToSubmit) {
      setLoginError("Vui lòng điền đầy đủ các thông tin đăng ký bắt buộc.");
      return;
    }

    if (!phoneToSubmit.match(/^0[0-9]{9}$/)) {
      setLoginError("Số điện thoại không hợp lệ! Vui lòng nhập đúng 10 số (ví dụ: 0912345678).");
      return;
    }

    try {
      const res = await fetch("/api/pending-registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailToSubmit,
          fullName: fullNameToSubmit,
          phone: phoneToSubmit,
          requestedRole: regRole,
          reason: regReason
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Không thể gửi yêu cầu đăng ký.");
      }

      setRegSuccessMessage(`Đăng ký thành công! Yêu cầu của tài khoản ${emailToSubmit} đã được gửi tới Người quản lý để phê duyệt. Vui lòng liên hệ trực tiếp với Người quản lý hoặc đợi cấp quyền trước khi đăng nhập.`);
      
      // Clear fields
      setRegEmail("");
      setRegFullName("");
      setRegPhone("");
      setRegReason("");
    } catch (err: any) {
      setLoginError(err.message || "Có lỗi xảy ra khi đăng ký.");
    }
  };


  const handleSend2FAOTP = async () => {
    if (!user || !user.email) {
      setOtpError("Không tìm thấy thông tin tài khoản Google.");
      return;
    }
    setOtpError("");
    setOtpMessage("");
    setOtpLoading(true);

    const phoneToUse = otpPhoneInput.trim() || "0912345678";
    if (!phoneToUse.match(/^0[0-9]{9}$/)) {
      setOtpError("Số điện thoại không hợp lệ. Vui lòng nhập đúng 10 chữ số (ví dụ: 0912345678).");
      setOtpLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, phone: phoneToUse })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Không thể gửi mã OTP.");
      }
      setGeneratedOtpCode(data.developmentCode || null);
      setOtpMessage(`Mã xác thực 2FA đã được phát sinh thành công cho SĐT ${phoneToUse}. Vui lòng nhập mã 6 số bên dưới!`);
    } catch (err: any) {
      setOtpError(err.message || "Lỗi khi tạo mã OTP 2FA.");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerify2FAOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.email) return;
    setOtpError("");
    setOtpLoading(true);

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, code: otpCodeInput.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Mã OTP không chính xác hoặc đã hết hạn.");
      }

      sessionStorage.setItem("otp_verified_" + user.email.toLowerCase(), "true");
      setRequire2FA(false);
      setOtpError("");
      setOtpCodeInput("");
      setGeneratedOtpCode(null);

      checkUserAccess();
    } catch (err: any) {
      setOtpError(err.message || "Xác thực OTP thất bại.");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleLogout = async () => {
    sessionStorage.setItem("explicit_logout", "true");
    if (user?.email) {
      sessionStorage.removeItem("otp_verified_" + user.email.toLowerCase());
    }
    setRequire2FA(false);

    // Xóa trạng thái đăng nhập
    console.log(">>> CLEAR CURRENT USER (Session revoked)");
    setCurrentUser(null);
    setLoginError("");

    // Xóa dữ liệu lưu trên trình duyệt
    localStorage.removeItem("currentUser");

    // Đăng xuất Google
    if (user) {
      try {
        await contextLogout();
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Helper to build user & role query string for audit logging
  const getUserQueryParams = () => {
    const userStr = currentUser?.fullName || currentUser?.username || "Cán bộ số";
    const roleStr = currentUser?.role || UserRole.COLLABORATOR;
    return `user=${encodeURIComponent(userStr)}&role=${encodeURIComponent(roleStr)}`;
  };

  // CRUD API wrappers with backend updates and immediate local state changes
  const addHousehold = async (newHh: Household) => {
    if (!canUserPerformAction(currentUser, "add")) {
      alert("Tài khoản Cộng tác viên của bạn không có quyền thêm mới dữ liệu.");
      return;
    }
    setHouseholds(prev => {
      const exists = prev.some(h => h.id === newHh.id);
      const updated = exists ? prev.map(h => h.id === newHh.id ? newHh : h) : [newHh, ...prev];
      syncOfflineCache("households", updated);
      return updated;
    });
    try {
      const q = getUserQueryParams();
      const res = await fetch(`/api/households?${q}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newHh)
      });
      if (res.ok) {
        const saved: Household = await res.json();
        setHouseholds(prev => {
          const updated = prev.map(h => h.id === newHh.id || h.id === saved.id ? saved : h);
          syncOfflineCache("households", updated);
          return updated;
        });
        if (offlineQueue.length > 0) triggerSync();
        await fetchData(); // Đồng bộ tự động lập tức toàn bộ hệ thống
      } else {
        throw new Error("Server error");
      }
    } catch (e) {
      console.warn("API write error, queuing offline action:", e);
      enqueueOfflineAction(`/api/households?${getUserQueryParams()}`, "POST", newHh, `Thêm hộ gia đình: ${newHh.ownerName}`);
    }
  };

  const updateHousehold = async (updatedHh: Household, originalId?: string) => {
    const oldId = originalId || updatedHh.id;
    if (!canUserPerformAction(currentUser, "edit")) {
      alert("Tài khoản Cộng tác viên của bạn bị hạn chế quyền chỉnh sửa dữ liệu.");
      return;
    }
    setHouseholds(prev => {
      const updated = prev.map(h => h.id === oldId ? updatedHh : h);
      syncOfflineCache("households", updated);
      return updated;
    });

    if (oldId !== updatedHh.id) {
      setResidents(prev => {
        const updated = prev.map(r => r.householdId === oldId ? { ...r, householdId: updatedHh.id } : r);
        syncOfflineCache("residents", updated);
        return updated;
      });
    }

    // Đồng bộ tọa độ GPS và ảnh hiện trường của hộ gia đình cho tất cả các nhân khẩu thuộc hộ
    setResidents(prev => {
      const updated = prev.map(r => (r.householdId === oldId || r.householdId === updatedHh.id)
        ? {
            ...r,
            gpsLat: updatedHh.gpsLat !== undefined ? updatedHh.gpsLat : r.gpsLat,
            gpsLng: updatedHh.gpsLng !== undefined ? updatedHh.gpsLng : r.gpsLng,
            photoUrl: updatedHh.photoUrl || r.photoUrl
          }
        : r
      );
      syncOfflineCache("residents", updated);
      return updated;
    });

    try {
      const q = getUserQueryParams();
      const res = await fetch(`/api/households/${encodeURIComponent(oldId)}?${q}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedHh)
      });
      if (res.ok) {
        const saved: Household = await res.json();
        setHouseholds(prev => {
          const updated = prev.map(h => (h.id === oldId || h.id === saved.id) ? saved : h);
          syncOfflineCache("households", updated);
          return updated;
        });
        if (offlineQueue.length > 0) triggerSync();
        await fetchData(); // Đồng bộ tự động lập tức toàn bộ hệ thống
      } else {
        throw new Error("Server error");
      }
    } catch (e) {
      console.warn("API update error, queuing offline action:", e);
      enqueueOfflineAction(`/api/households/${encodeURIComponent(oldId)}?${getUserQueryParams()}`, "PUT", updatedHh, `Cập nhật hộ gia đình: ${updatedHh.ownerName}`);
    }
  };

  const deleteHousehold = async (id: string) => {
    if (!canUserPerformAction(currentUser, "delete")) {
      alert("Tài khoản Cộng tác viên của bạn không có quyền xoá dữ liệu.");
      return;
    }
    let deletedName = "";
    setHouseholds(prev => {
      const deleted = prev.find(h => h.id === id);
      if (deleted) deletedName = deleted.ownerName;
      const updated = prev.filter(h => h.id !== id);
      syncOfflineCache("households", updated);
      return updated;
    });
    try {
      const q = getUserQueryParams();
      const res = await fetch(`/api/households/${encodeURIComponent(id)}?${q}`, { method: "DELETE" });
      if (res.ok) {
        if (offlineQueue.length > 0) triggerSync();
        await fetchData(); // Đồng bộ tự động lập tức toàn bộ hệ thống
      } else {
        throw new Error("Server error");
      }
    } catch (e) {
      console.warn("API delete error, queuing offline action:", e);
      enqueueOfflineAction(`/api/households/${encodeURIComponent(id)}?${getUserQueryParams()}`, "DELETE", null, `Xoá hộ gia đình: ${deletedName || id}`);
    }
  };

  const addResident = async (newRes: Resident) => {
    if (!canUserPerformAction(currentUser, "add")) {
      alert("Tài khoản Cộng tác viên của bạn không có quyền thêm mới dữ liệu.");
      return;
    }
    const linkedHh = households.find(h => h.id === newRes.householdId);
    const finalRes: Resident = linkedHh ? {
      ...newRes,
      gpsLat: newRes.gpsLat !== undefined ? newRes.gpsLat : linkedHh.gpsLat,
      gpsLng: newRes.gpsLng !== undefined ? newRes.gpsLng : linkedHh.gpsLng,
      photoUrl: newRes.photoUrl || linkedHh.photoUrl
    } : newRes;

    // Đồng bộ ngược lại cho Hộ Gia Đình nếu nhân khẩu được chọn là Chủ hộ
    if (finalRes.relationToOwner === "Chủ hộ" && finalRes.householdId) {
      setHouseholds(prev => {
        const updated = prev.map(h => h.id === finalRes.householdId ? {
          ...h,
          ownerName: finalRes.fullName,
          ownerId: finalRes.id,
          phone: finalRes.phone || h.phone
        } : h);
        syncOfflineCache("households", updated);
        return updated;
      });
    }

    setResidents(prev => {
      const exists = prev.some(r => r.id === finalRes.id);
      const updated = exists ? prev.map(r => r.id === finalRes.id ? finalRes : r) : [finalRes, ...prev];
      syncOfflineCache("residents", updated);
      return updated;
    });
    try {
      const q = getUserQueryParams();
      const res = await fetch(`/api/residents?${q}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalRes)
      });
      if (res.ok) {
        const saved: Resident = await res.json();
        setResidents(prev => {
          const updated = prev.map(r => r.id === finalRes.id || r.id === saved.id ? saved : r);
          syncOfflineCache("residents", updated);
          return updated;
        });
        if (offlineQueue.length > 0) triggerSync();
        await fetchData(); // Đồng bộ tự động lập tức toàn bộ hệ thống
      } else {
        throw new Error("Server error");
      }
    } catch (e) {
      console.warn("API write error, queuing offline action:", e);
      enqueueOfflineAction(`/api/residents?${getUserQueryParams()}`, "POST", finalRes, `Thêm nhân khẩu: ${finalRes.fullName}`);
    }
  };

  const updateResident = async (updatedRes: Resident, originalId?: string) => {
    const residentId = originalId || updatedRes.id;
    if (!canUserPerformAction(currentUser, "edit")) {
      alert("Tài khoản Cộng tác viên của bạn bị hạn chế quyền chỉnh sửa dữ liệu.");
      return;
    }
    const linkedHh = households.find(h => h.id === updatedRes.householdId);
    const finalRes: Resident = linkedHh ? {
      ...updatedRes,
      gpsLat: updatedRes.gpsLat !== undefined ? updatedRes.gpsLat : linkedHh.gpsLat,
      gpsLng: updatedRes.gpsLng !== undefined ? updatedRes.gpsLng : linkedHh.gpsLng,
      photoUrl: updatedRes.photoUrl || linkedHh.photoUrl
    } : updatedRes;

    // Đồng bộ ngược lại cho Hộ Gia Đình nếu nhân khẩu được cập nhật là Chủ hộ
    if (finalRes.relationToOwner === "Chủ hộ" && finalRes.householdId) {
      setHouseholds(prev => {
        const updated = prev.map(h => h.id === finalRes.householdId ? {
          ...h,
          ownerName: finalRes.fullName,
          ownerId: finalRes.id,
          phone: finalRes.phone || h.phone
        } : h);
        syncOfflineCache("households", updated);
        return updated;
      });
    }

    setResidents(prev => {
      const updated = prev.map(r => r.id === residentId ? finalRes : r);
      syncOfflineCache("residents", updated);
      return updated;
    });
    try {
      const q = getUserQueryParams();
      const res = await fetch(`/api/residents/${encodeURIComponent(residentId)}?${q}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalRes)
      });
      if (res.ok) {
        const saved: Resident = await res.json();
        setResidents(prev => {
          const updated = prev.map(r => (r.id === residentId || r.id === saved.id) ? saved : r);
          syncOfflineCache("residents", updated);
          return updated;
        });
        if (offlineQueue.length > 0) triggerSync();
        await fetchData(); // Đồng bộ tự động lập tức toàn bộ hệ thống
      } else {
        throw new Error("Server error");
      }
    } catch (e) {
      console.warn("API update error, queuing offline action:", e);
      enqueueOfflineAction(`/api/residents/${encodeURIComponent(residentId)}?${getUserQueryParams()}`, "PUT", finalRes, `Cập nhật nhân khẩu: ${finalRes.fullName}`);
    }
  };

  const deleteResident = async (id: string) => {
    if (!canUserPerformAction(currentUser, "delete")) {
      alert("Tài khoản Cộng tác viên của bạn không có quyền xoá dữ liệu.");
      return;
    }
    let deletedName = "";
    setResidents(prev => {
      const deleted = prev.find(r => r.id === id);
      if (deleted) deletedName = deleted.fullName;
      const updated = prev.filter(r => r.id !== id);
      syncOfflineCache("residents", updated);
      return updated;
    });
    try {
      const q = getUserQueryParams();
      const res = await fetch(`/api/residents/${encodeURIComponent(id)}?${q}`, { method: "DELETE" });
      if (res.ok) {
        if (offlineQueue.length > 0) triggerSync();
        await fetchData(); // Đồng bộ tự động lập tức toàn bộ hệ thống
      } else {
        throw new Error("Server error");
      }
    } catch (e) {
      console.warn("API delete error, queuing offline action:", e);
      enqueueOfflineAction(`/api/residents/${encodeURIComponent(id)}?${getUserQueryParams()}`, "DELETE", null, `Xoá nhân khẩu: ${deletedName || id}`);
    }
  };

  const addDemographicsChange = async (newChange: Omit<DemographicsChange, "id">) => {
    const changeWithId: DemographicsChange = {
      ...newChange,
      id: `CHG-${Date.now()}`
    };

    setChanges(prev => {
      const updated = [changeWithId, ...prev];
      syncOfflineCache("changes", updated);
      return updated;
    });

    // If change is death, automatically update resident status in state and backend
    if (newChange.type === DemographicsChangeType.DEATH) {
      const targetResident = residents.find(r => r.id === newChange.residentId);
      if (targetResident) {
        const updated = { ...targetResident, occupation: "Đã qua đời" };
        updateResident(updated);
      }
    }

    try {
      const res = await fetch("/api/changes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changeWithId)
      });
      if (!res.ok) throw new Error("Server error");
    } catch (e) {
      console.warn("API write error, queuing offline action:", e);
      enqueueOfflineAction("/api/changes", "POST", changeWithId, `Ghi nhận biến động: ${newChange.residentName} (${newChange.type})`);
    }
  };

  const addBusiness = async (newBus: BusinessHousehold) => {
    setBusinesses(prev => {
      const updated = [newBus, ...prev];
      syncOfflineCache("businesses", updated);
      return updated;
    });
    try {
      const res = await fetch("/api/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newBus)
      });
      if (!res.ok) throw new Error("Server error");
      await fetchData(); // Synchronize all system data
    } catch (e) {
      console.warn("API write error, queuing offline action:", e);
      enqueueOfflineAction("/api/businesses", "POST", newBus, `Thêm hộ kinh doanh: ${newBus.name}`);
    }
  };

  const updateBusiness = async (updatedBus: BusinessHousehold) => {
    if (!canUserPerformAction(currentUser, "edit")) {
      alert("Tài khoản Cộng tác viên của bạn bị hạn chế quyền chỉnh sửa dữ liệu.");
      return;
    }
    setBusinesses(prev => {
      const updated = prev.map(b => b.id === updatedBus.id ? updatedBus : b);
      syncOfflineCache("businesses", updated);
      return updated;
    });
    try {
      const res = await fetch(`/api/businesses/${updatedBus.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedBus)
      });
      if (!res.ok) throw new Error("Server error");
      await fetchData(); // Synchronize all system data
    } catch (e) {
      console.warn("API update error, queuing offline action:", e);
      enqueueOfflineAction(`/api/businesses/${updatedBus.id}`, "PUT", updatedBus, `Cập nhật hộ kinh doanh: ${updatedBus.name}`);
    }
  };

  const deleteBusiness = async (id: string) => {
    if (!canUserPerformAction(currentUser, "delete")) {
      alert("Tài khoản Cộng tác viên của bạn không có quyền xoá dữ liệu.");
      return;
    }
    let deletedName = "";
    setBusinesses(prev => {
      const deleted = prev.find(b => b.id === id);
      if (deleted) deletedName = deleted.name;
      const updated = prev.filter(b => b.id !== id);
      syncOfflineCache("businesses", updated);
      return updated;
    });
    try {
      const res = await fetch(`/api/businesses/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Server error");
      await fetchData(); // Synchronize all system data
    } catch (e) {
      console.warn("API delete error, queuing offline action:", e);
      enqueueOfflineAction(`/api/businesses/${id}`, "DELETE", null, `Xoá hộ kinh doanh: ${deletedName || id}`);
    }
  };

  const updateCriteria = async (updated: RuralCriteria) => {
    setCriteria(prev => {
      let updatedList = [];
      if (prev.some(c => c.id === updated.id)) {
        updatedList = prev.map(c => c.id === updated.id ? updated : c);
      } else {
        updatedList = [updated, ...prev];
      }
      syncOfflineCache("criteria", updatedList);
      return updatedList;
    });

    try {
      const res = await fetch(`/api/criteria/${updated.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated)
      });
      if (!res.ok) throw new Error("Server error");
    } catch (e) {
      console.warn("API update error, queuing offline action:", e);
      enqueueOfflineAction(`/api/criteria/${updated.id}`, "PUT", updated, `Cập nhật tiêu chí: ${updated.name}`);
    }
  };

  const handleGenerateMockData = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/data/generate-mock", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (response.ok) {
        const result = await response.json();
        await fetchData(); // Refresh state from backend
        setAppAlert({
          isOpen: true,
          title: "Khởi tạo thành công",
          message: `Đã tự động sinh 25 Hộ gia đình mẫu với ${result.residentsCount} Nhân khẩu chi tiết! Dữ liệu đã đồng bộ và sẵn sàng phục vụ thống kê, xuất báo cáo.`,
          type: "success"
        });
      } else {
        const err = await response.text();
        setAppAlert({
          isOpen: true,
          title: "Lỗi khởi tạo",
          message: `Không thể tạo dữ liệu mẫu: ${err}`,
          type: "error"
        });
      }
    } catch (err: any) {
      console.error("Lỗi khi kết nối máy chủ:", err);
      setAppAlert({
        isOpen: true,
        title: "Lỗi kết nối",
        message: err.message,
        type: "error"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClearAllData = async (bypassConfirm = false) => {
    if (!bypassConfirm && !window.confirm("CẢNH BÁO: Hành động này sẽ xoá TOÀN BỘ dữ liệu hộ dân, nhân khẩu, hộ kinh doanh hiện có trong hệ thống để chuẩn bị nhập dữ liệu thực tế. Bạn có chắc chắn muốn tiếp tục?")) {
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/data/clear-all?user=${encodeURIComponent(currentUser?.fullName || "Hệ thống")}&role=${encodeURIComponent(currentUser?.role || "")}`, {
        method: "POST"
      });
      if (response.ok) {
        // Clear offline local storage cache keys immediately
        localStorage.setItem("off_households", "[]");
        localStorage.setItem("off_residents", "[]");
        localStorage.setItem("off_businesses", "[]");
        localStorage.setItem("off_changes", "[]");
        
        await fetchData(); // Refresh state from backend
        setAppAlert({
          isOpen: true,
          title: "Xoá sạch dữ liệu thành công",
          message: "Toàn bộ dữ liệu mẫu đã được xoá sạch khỏi hệ thống. Bây giờ bạn có thể tiến hành nhập dữ liệu thực tế.",
          type: "success"
        });
      } else {
        const err = await response.text();
        setAppAlert({
          isOpen: true,
          title: "Lỗi xoá dữ liệu",
          message: err,
          type: "error"
        });
      }
    } catch (err: any) {
      console.error("Lỗi khi kết nối máy chủ để xoá dữ liệu:", err);
      setAppAlert({
        isOpen: true,
        title: "Lỗi kết nối",
        message: err.message,
        type: "error"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExportFullBackup = async () => {
    if (currentUser?.role === UserRole.COLLABORATOR) {
      alert("Cộng tác viên không được quyền tải xuống dữ liệu đã có sẵn trước đó.");
      return;
    }
    try {
      // Fetch documents first so we can include them in the Excel workbook
      const docRes = await safeFetchJson("/api/documents");
      const documents = Array.isArray(docRes.data) ? docRes.data : [];

      // 1. Households sheet
      let maxHhPhotoChunks = 1;
      const maxChunkSize = 30000;
      households.forEach((h: any) => {
        const url = h.photoUrl || "";
        const chunksCount = Math.max(1, Math.ceil(url.length / maxChunkSize));
        if (chunksCount > maxHhPhotoChunks) {
          maxHhPhotoChunks = chunksCount;
        }
      });

      const hhHeaders = [
        "STT", "Mã Hộ Gia Đình", "Mã CCCD Chủ Hộ", "Họ Tên Chủ Hộ", "Số ĐT Chủ Hộ", "Địa Chỉ Thường Trú", 
        "Tổ Dân Phố", "Khu Phố", "Ngày Lập Hộ", "Phân Loại Hộ", "Gia Đình Văn Hoá",
        "Gia Đình Chính Sách", "Gia Đình Có Công", "Nước Sạch", "Thu Gom Rác", "Thuế Phi Nông Nghiệp (PNN)", "Hộ Nông Nghiệp", "Định Danh VNeID", "Vĩ Độ (Lat)", "Kinh Độ (Lng)"
      ];
      hhHeaders.push("Đường Dẫn Ảnh");
      for (let i = 2; i <= maxHhPhotoChunks; i++) {
        hhHeaders.push(`Đường Dẫn Ảnh Phần ${i}`);
      }
      hhHeaders.push("Ghi Chú");

      const hhRows = households.map((h, idx) => {
        const ownerResident = residents.find(r => r.id === h.ownerId);
        const ownerPhone = ownerResident?.phone || "";

        const photoStr = h.photoUrl || "";
        const chunks: string[] = [];
        for (let i = 0; i < photoStr.length; i += maxChunkSize) {
          chunks.push(photoStr.substring(i, i + maxChunkSize));
        }
        while (chunks.length < maxHhPhotoChunks) {
          chunks.push("");
        }

        const rowData = [
          idx + 1,
          h.id,
          `'${h.ownerId}`,
          h.ownerName,
          ownerPhone,
          h.address,
          h.wardId,
          h.quarterId || "",
          h.createdAt,
          h.status,
          h.isCulturalFamily ? "Có" : "Không",
          h.isPolicyFamily ? "Có" : "Không",
          h.isMeritoriousFamily ? "Có" : "Không",
          h.waterSource || "Chưa cập nhật",
          h.wasteCollectionStatus || (h.isWasteFeePaid ? "Đã đăng ký" : "Chưa đăng ký"),
          h.nonAgriTax || "Chưa nộp",
          h.housingType || "Không",
          h.vneidStatus || "Chưa đăng ký",
          h.gpsLat || "",
          h.gpsLng || ""
        ];

        rowData.push(...chunks);
        rowData.push(h.notes || "");
        return rowData;
      });

      // 2. Residents sheet
      let maxResPhotoChunks = 1;
      residents.forEach((r: any) => {
        const url = r.photoUrl || "";
        const chunksCount = Math.max(1, Math.ceil(url.length / maxChunkSize));
        if (chunksCount > maxResPhotoChunks) {
          maxResPhotoChunks = chunksCount;
        }
      });

      const resHeaders = [
        "STT", "Mã Hộ Gia Đình", "Họ và Tên", "Quan Hệ Chủ Hộ", "Giới Tính", 
        "Ngày Sinh", "Số CCCD", "Trạng Thái Cư Trú", "Định Danh VNeID", "Dân Tộc", "Tôn Giáo", 
        "Trình Độ Học Vấn", "Nghề Nghiệp", "Nơi Làm Việc", "Số Điện Thoại", "Mã Số BHYT",
        "Người Cao Tuổi", "Khuyết Tật", "Mang Thai", "Học Sĩ/Sinh Viên", "Loại Học Sinh",
        "Có Việc Làm", "Lĩnh Vực Lao Động", "Trợ Cấp", "Ghi Chú thực địa", "Vĩ Độ GPS", "Kinh Độ GPS"
      ];
      resHeaders.push("Ảnh Thẻ / Thực Địa");
      for (let i = 2; i <= maxResPhotoChunks; i++) {
        resHeaders.push(`Ảnh Thẻ / Thực Địa Phần ${i}`);
      }

      const resRows = residents.map((r, idx) => {
        const photoStr = r.photoUrl || "";
        const chunks: string[] = [];
        for (let i = 0; i < photoStr.length; i += maxChunkSize) {
          chunks.push(photoStr.substring(i, i + maxChunkSize));
        }
        while (chunks.length < maxResPhotoChunks) {
          chunks.push("");
        }

        const rowData = [
          idx + 1,
          r.householdId,
          r.fullName,
          r.relationToOwner,
          r.gender,
          r.birthDate,
          `'${r.id}`,
          r.status,
          r.vneidStatus || "Chưa đăng ký",
          r.ethnicity,
          r.religion,
          r.education,
          r.occupation || "N/A",
          r.workplace || "N/A",
          r.phone || "",
          r.insuranceId || "",
          r.isElderly ? "Có" : "Không",
          r.isDisabled ? "Có" : "Không",
          r.isPregnant ? "Có" : "Không",
          r.isStudent ? "Có" : "Không",
          r.studentType || "",
          r.isEmployed ? "Có" : "Không",
          r.laborSector,
          r.subsidyType || "Không",
          r.notes || "",
          r.gpsLat || "",
          r.gpsLng || ""
        ];

        rowData.push(...chunks);
        return rowData;
      });

      // 3. Businesses sheet
      const busHeaders = [
        "STT", "Mã Hộ Kinh Doanh", "Tên Hộ Kinh Doanh", "Họ Tên Chủ Hộ", "CCCD Chủ Hộ", 
        "Ngành Nghề Kinh Doanh", "Mã Số Thuế", "Số Giấy Phép", "Địa Chỉ Kinh Doanh"
      ];
      const busRows = businesses.map((b, idx) => [
        idx + 1,
        b.id,
        b.name,
        b.ownerName,
        `'${b.ownerId}`,
        b.sector,
        b.taxCode,
        b.licenseNumber,
        b.address
      ]);

      // 4. Changes sheet
      const changeHeaders = [
        "STT", "Mã Biến Động", "Mã Nhân Khẩu", "Họ và Tên", "Loại Biến Động", "Ngày Ghi Nhận", "Chi Tiết Biến Động", "Cán Bộ Thực Hiện"
      ];
      const changeRows = changes.map((c, idx) => [
        idx + 1,
        c.id,
        `'${c.residentId}`,
        c.residentName,
        c.type,
        c.date,
        c.details,
        c.recordedBy
      ]);

      // 5. Criteria sheet
      const critHeaders = [
        "STT", "Mã Tiêu Chí", "Tên Tiêu Chí", "Phân Nhóm", "Mục Tiêu", "Hiện Trạng", "Trạng Thái Đạt", "Cập Nhật Cuối"
      ];
      const critRows = criteria.map((cr, idx) => [
        idx + 1,
        cr.id,
        cr.name,
        cr.category,
        cr.targetValue,
        cr.value,
        cr.status,
        cr.lastUpdated
      ]);

      // 6. Documents sheet
      let maxChunks = 1;
      documents.forEach((doc: any) => {
        const attStr = doc.attachments ? JSON.stringify(doc.attachments) : "";
        const chunksCount = Math.max(1, Math.ceil(attStr.length / maxChunkSize));
        if (chunksCount > maxChunks) {
          maxChunks = chunksCount;
        }
      });

      const docHeaders = [
        "STT", "Mã Tài Liệu", "Tiêu Đề", "Số Kí Hiệu", "Ngày Ban Hành", "Nơi Ban Hành", "Chuyên Mục", "Mô Tả", "Dung Lượng", "Định Dạng"
      ];
      docHeaders.push("Tài Liệu Đính Kèm");
      for (let i = 2; i <= maxChunks; i++) {
        docHeaders.push(`Tài Liệu Đính Kèm Phần ${i}`);
      }
      docHeaders.push("Ngày Tạo");

      const docRows = documents.map((doc: any, idx: number) => {
        const attStr = doc.attachments ? JSON.stringify(doc.attachments) : "";
        const rowData = [
          idx + 1,
          doc.id,
          doc.title,
          doc.docNumber || "",
          doc.issueDate,
          doc.issuer,
          doc.category,
          doc.description || "",
          doc.fileSize || "0.0 KB",
          doc.fileType || "Tài liệu đính kèm"
        ];

        // Chunk attachment string into max 30,000 characters per cell
        const chunks: string[] = [];
        for (let i = 0; i < attStr.length; i += maxChunkSize) {
          chunks.push(attStr.substring(i, i + maxChunkSize));
        }
        while (chunks.length < maxChunks) {
          chunks.push("");
        }

        rowData.push(...chunks);
        rowData.push(doc.createdAt || "");
        return rowData;
      });

      // Construct workbook
      const workbook = XLSX.utils.book_new();

      const addSheet = (headersArr: string[], dataRows: any[][], sheetName: string) => {
        const fullData = [headersArr, ...dataRows];
        const ws = XLSX.utils.aoa_to_sheet(fullData);
        // Auto-fit
        ws["!cols"] = headersArr.map((_, colIdx) => {
          let maxLen = 10;
          fullData.forEach(row => {
            const val = row[colIdx];
            if (val !== undefined && val !== null) {
              const strVal = String(val);
              if (strVal.length > maxLen) maxLen = strVal.length;
            }
          });
          return { wch: Math.min(maxLen + 3, 40) };
        });
        XLSX.utils.book_append_sheet(workbook, ws, sheetName);
      };

      addSheet(hhHeaders, hhRows, "Ho_Gia_Dinh");
      addSheet(resHeaders, resRows, "Nhan_Khau");
      addSheet(busHeaders, busRows, "Ho_Kinh_Doanh");
      addSheet(changeHeaders, changeRows, "Bien_Dong_Cu_Tru");
      addSheet(critHeaders, critRows, "Tieu_Chi_NTM");
      addSheet(docHeaders, docRows, "Tai_Lieu_Luu_Tru");

      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8" });
      
      const now = new Date();
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      const filename = `Sao_Luu_Toan_Bo_DB_Dan_Cu_${dateStr}.xlsx`;
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Record backup date in localStorage
      localStorage.setItem("last_backup_date", now.toISOString());
      setLastBackupDate(now.toISOString());
      setShowBackupReminder(false);
      
      alert(`[SAO LƯU THÀNH CÔNG] Toàn bộ cơ sở dữ liệu (bao gồm cả kho tài liệu số hóa kèm tệp đính kèm) đã được sao lưu và kết xuất ra tập tin Excel: "${filename}".`);
    } catch (error: any) {
      console.error("Backup error:", error);
      alert(`[LỖI SAO LƯU] Không thể tạo file sao lưu: ${error.message}`);
    }
  };

  const handleExportJSONBackup = async () => {
    if (currentUser?.role === UserRole.COLLABORATOR) {
      alert("Cộng tác viên không được quyền tải xuống dữ liệu đã có sẵn trước đó.");
      return;
    }
    try {
      const docRes = await safeFetchJson("/api/documents");
      const documents = Array.isArray(docRes.data) ? docRes.data : [];
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(
        JSON.stringify({ households, residents, businesses, changes, criteria, documents }, null, 2)
      );
      const downloadAnchor = document.createElement("a");
      const now = new Date();
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      const filename = `Sao_Luu_Toan_Bo_DB_Dan_Cu_${dateStr}.json`;
      
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", filename);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);

      localStorage.setItem("last_backup_date", now.toISOString());
      setLastBackupDate(now.toISOString());
      setShowBackupReminder(false);

      alert(`[SAO LƯU THÀNH CÔNG] Toàn bộ cơ sở dữ liệu dạng cấu trúc JSON đã được kết xuất thành công ra tệp tin: "${filename}".`);
    } catch (error: any) {
      console.error("JSON Backup error:", error);
      alert(`[LỖI SAO LƯU JSON] Không thể tạo file sao lưu JSON: ${error.message}`);
    }
  };

  const parseXLSXBackup = (workbook: XLSX.WorkBook) => {
    const importedData: any = {};

    const parseSheet = (sheetName: string, mapper: (row: any) => any) => {
      const ws = workbook.Sheets[sheetName];
      if (!ws) return [];
      const rows = XLSX.utils.sheet_to_json(ws);
      return rows.map(mapper);
    };

    const cleanVal = (val: any) => {
      if (val === undefined || val === null) return "";
      const str = String(val).trim();
      if (str.startsWith("'")) return str.substring(1);
      return str;
    };

    const parseBool = (val: any) => {
      if (!val) return false;
      const str = String(val).trim().toLowerCase();
      return str === "có" || str === "yes" || str === "true";
    };

    const parseFloatVal = (val: any) => {
      if (val === undefined || val === null || val === "") return undefined;
      const num = parseFloat(val);
      return isNaN(num) ? undefined : num;
    };

    // Households
    importedData.households = parseSheet("Ho_Gia_Dinh", (row: any) => {
      let photoUrl = "";
      if (row) {
        if (row["Đường Dẫn Ảnh"]) {
          photoUrl += cleanVal(row["Đường Dẫn Ảnh"]);
        }
        const otherPartsKeys = Object.keys(row).filter(k => k.startsWith("Đường Dẫn Ảnh Phần"));
        otherPartsKeys.sort((a, b) => {
          const numA = parseInt(a.replace(/\D/g, ""), 10) || 0;
          const numB = parseInt(b.replace(/\D/g, ""), 10) || 0;
          return numA - numB;
        });
        otherPartsKeys.forEach(k => {
          photoUrl += cleanVal(row[k]);
        });
      }

      return {
        id: cleanVal(row["Mã Hộ Gia Đình"]),
        ownerId: cleanVal(row["Mã CCCD Chủ Hộ"]),
        ownerName: cleanVal(row["Họ Tên Chủ Hộ"]),
        address: cleanVal(row["Địa Chỉ Thường Trú"]),
        wardId: cleanVal(row["Tổ Dân Phố"]),
        quarterId: cleanVal(row["Khu Phố"]),
        createdAt: cleanVal(row["Ngày Lập Hộ"]),
        status: cleanVal(row["Phân Loại Hộ"]),
        isCulturalFamily: parseBool(row["Gia Đình Văn Hoá"]),
        isPolicyFamily: parseBool(row["Gia Đình Chính Sách"]),
        isMeritoriousFamily: parseBool(row["Gia Đình Có Công"]),
        waterSource: cleanVal(row["Nước Sạch"]),
        wasteCollectionStatus: cleanVal(row["Thu Gom Rác"]),
        nonAgriTax: cleanVal(row["Thuế Phi Nông Nghiệp (PNN)"]) || "Chưa nộp",
        housingType: cleanVal(row["Hộ Nông Nghiệp"]) || cleanVal(row["Loại Nhà Ở"]) || "Không",
        vneidStatus: cleanVal(row["Định Danh VNeID"]) || cleanVal(row["Mức VNeID"]) || cleanVal(row["VNeID"]) || "Chưa đăng ký",
        gpsLat: parseFloatVal(row["Vĩ Độ (Lat)"]),
        gpsLng: parseFloatVal(row["Kinh Độ (Lng)"]),
        photoUrl,
        notes: cleanVal(row["Ghi Chú"])
      };
    }).filter(h => h.id);

    // Residents
    importedData.residents = parseSheet("Nhan_Khau", (row: any) => {
      let photoUrl = "";
      if (row) {
        if (row["Ảnh Thẻ / Thực Địa"]) {
          photoUrl += cleanVal(row["Ảnh Thẻ / Thực Địa"]);
        }
        const otherPartsKeys = Object.keys(row).filter(k => k.startsWith("Ảnh Thẻ / Thực Địa Phần"));
        otherPartsKeys.sort((a, b) => {
          const numA = parseInt(a.replace(/\D/g, ""), 10) || 0;
          const numB = parseInt(b.replace(/\D/g, ""), 10) || 0;
          return numA - numB;
        });
        otherPartsKeys.forEach(k => {
          photoUrl += cleanVal(row[k]);
        });
      }

      return {
        householdId: cleanVal(row["Mã Hộ Gia Đình"]),
        fullName: cleanVal(row["Họ và Tên"]),
        relationToOwner: cleanVal(row["Quan Hệ Chủ Hộ"]),
        gender: cleanVal(row["Giới Tính"]),
        birthDate: cleanVal(row["Ngày Sinh"]),
        id: cleanVal(row["Số CCCD"]),
        status: cleanVal(row["Trạng Thái Cư Trú"]),
        vneidStatus: cleanVal(row["Định Danh VNeID"]) || cleanVal(row["Mức VNeID"]) || cleanVal(row["VNeID"]) || "Chưa đăng ký",
        ethnicity: cleanVal(row["Dân Tộc"]),
        religion: cleanVal(row["Tôn Giáo"]),
        education: cleanVal(row["Trình Độ Học Vấn"]),
        occupation: cleanVal(row["Nghề Nghiệp"]),
        workplace: cleanVal(row["Nơi Làm Việc"]),
        phone: cleanVal(row["Số Điện Thoại"]),
        insuranceId: cleanVal(row["Mã Số BHYT"]),
        isElderly: parseBool(row["Người Cao Tuổi"]),
        isDisabled: parseBool(row["Khuyết Tật"]),
        isPregnant: parseBool(row["Mang Thai"]),
        isStudent: parseBool(row["Học Sĩ/Sinh Viên"] || row["Học sinh/Sinh viên"]),
        studentType: cleanVal(row["Loại Học Sinh"]),
        isEmployed: parseBool(row["Có Việc Làm"]),
        laborSector: cleanVal(row["Lĩnh Vực Lao Động"]),
        subsidyType: cleanVal(row["Trợ Cấp"]),
        notes: cleanVal(row["Ghi Chú thực địa"]),
        gpsLat: parseFloatVal(row["Vĩ Độ GPS"]),
        gpsLng: parseFloatVal(row["Kinh Độ GPS"]),
        photoUrl
      };
    }).filter(r => r.fullName);

    // Businesses
    importedData.businesses = parseSheet("Ho_Kinh_Doanh", (row: any) => ({
      id: cleanVal(row["Mã Hộ Kinh Doanh"]),
      name: cleanVal(row["Tên Hộ Kinh Doanh"]),
      ownerName: cleanVal(row["Họ Tên Chủ Hộ"]),
      ownerId: cleanVal(row["CCCD Chủ Hộ"]),
      sector: cleanVal(row["Ngành Nghề Kinh Doanh"]),
      taxCode: cleanVal(row["Mã Số Thuế"]),
      licenseNumber: cleanVal(row["Số Giấy Phép"]),
      address: cleanVal(row["Địa Chỉ Kinh Doanh"])
    })).filter(b => b.id);

    // Changes
    importedData.changes = parseSheet("Bien_Dong_Cu_Tru", (row: any) => ({
      id: cleanVal(row["Mã Biến Động"]),
      residentId: cleanVal(row["Mã Nhân Khẩu"]),
      residentName: cleanVal(row["Họ và Tên"]),
      type: cleanVal(row["Loại Biến Động"]),
      date: cleanVal(row["Ngày Ghi Nhận"]),
      details: cleanVal(row["Chi Tiết Biến Động"]),
      recordedBy: cleanVal(row["Cán Bộ Thực Hiện"])
    })).filter(c => c.id);

    // Criteria
    importedData.criteria = parseSheet("Tieu_Chi_NTM", (row: any) => ({
      id: cleanVal(row["Mã Tiêu Chí"]),
      name: cleanVal(row["Tên Tiêu Chí"]),
      category: cleanVal(row["Phân Nhóm"]),
      targetValue: parseFloatVal(row["Mục Tiêu"]) || 0,
      value: parseFloatVal(row["Hiện Trạng"]) || 0,
      status: cleanVal(row["Trạng Thái Đạt"]),
      lastUpdated: cleanVal(row["Cập Nhật Cuối"])
    })).filter(cr => cr.id);

    // Documents
    importedData.documents = parseSheet("Tai_Lieu_Luu_Tru", (row: any) => {
      let attachments: any[] = [];
      let attStr = "";
      if (row) {
        if (row["Tài Liệu Đính Kèm"]) {
          attStr += cleanVal(row["Tài Liệu Đính Kèm"]);
        }
        // Grab any keys like "Tài Liệu Đính Kèm Phần 2", "Tài Liệu Đính Kèm Phần 3", etc.
        const otherPartsKeys = Object.keys(row).filter(k => k.startsWith("Tài Liệu Đính Kèm Phần"));
        otherPartsKeys.sort((a, b) => {
          const numA = parseInt(a.replace(/\D/g, ""), 10) || 0;
          const numB = parseInt(b.replace(/\D/g, ""), 10) || 0;
          return numA - numB;
        });
        otherPartsKeys.forEach(k => {
          attStr += cleanVal(row[k]);
        });
      }
      if (attStr) {
        try {
          attachments = JSON.parse(attStr);
        } catch {
          // Fallback if not a valid JSON
        }
      }
      return {
        id: cleanVal(row["Mã Tài Liệu"]),
        title: cleanVal(row["Tiêu Đề"]),
        docNumber: cleanVal(row["Số Kí Hiệu"]) || undefined,
        issueDate: cleanVal(row["Ngày Ban Hành"]),
        issuer: cleanVal(row["Nơi Ban Hành"]),
        category: cleanVal(row["Chuyên Mục"]) as any,
        description: cleanVal(row["Mô Tả"]) || undefined,
        fileSize: cleanVal(row["Dung Lượng"]) || "0.0 KB",
        fileType: cleanVal(row["Định Dạng"]) || "Tài liệu đính kèm",
        attachments,
        createdAt: cleanVal(row["Ngày Tạo"]) || new Date().toISOString().split("T")[0]
      };
    }).filter(doc => doc.id && doc.title);

    return importedData;
  };

  const sendRestorePayload = async (payload: any) => {
    try {
      const response = await fetch(`/api/data/restore?user=${encodeURIComponent(currentUser?.fullName || "Hệ thống")}&role=${encodeURIComponent(currentUser?.role || "")}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const result = await response.json();
        await fetchData();
        setAppAlert({
          isOpen: true,
          title: "Khôi phục thành công",
          message: `Toàn bộ dữ liệu đã được khôi phục thành công lên hệ thống:\n- Hộ dân: ${result.householdsCount}\n- Nhân khẩu: ${result.residentsCount}\n- Hộ kinh doanh: ${result.businessesCount}\n- Biến động: ${result.changesCount}\n- Tiêu chí: ${result.criteriaCount}${result.documentsCount !== undefined ? `\n- Tài liệu lưu trữ: ${result.documentsCount}` : ""}`,
          type: "success"
        });
      } else {
        const err = await response.text();
        setAppAlert({
          isOpen: true,
          title: "Lỗi khôi phục",
          message: `Không thể khôi phục dữ liệu: ${err}`,
          type: "error"
        });
        throw new Error(err);
      }
    } catch (err: any) {
      setAppAlert({
        isOpen: true,
        title: "Lỗi kết nối",
        message: err.message,
        type: "error"
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreBackup = (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      setLoading(true);
      try {
        const isJson = file.name.endsWith(".json");
        const isXlsx = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");

        if (!isJson && !isXlsx) {
          const errMsg = "Chỉ chấp nhận tập tin sao lưu dạng .json hoặc .xlsx";
          setAppAlert({
            isOpen: true,
            title: "Lỗi định dạng",
            message: errMsg,
            type: "error"
          });
          setLoading(false);
          reject(new Error(errMsg));
          return;
        }

        if (isJson) {
          const reader = new FileReader();
          reader.onload = async (e) => {
            try {
              const content = e.target?.result as string;
              const backupData = JSON.parse(content);
              await sendRestorePayload(backupData);
              resolve();
            } catch (err: any) {
              const errMsg = `Không thể đọc nội dung file sao lưu: ${err.message}`;
              setAppAlert({
                isOpen: true,
                title: "Lỗi giải mã JSON",
                message: errMsg,
                type: "error"
              });
              setLoading(false);
              reject(err);
            }
          };
          reader.readAsText(file);
        } else {
          const reader = new FileReader();
          reader.onload = async (e) => {
            try {
              const data = new Uint8Array(e.target?.result as ArrayBuffer);
              const workbook = XLSX.read(data, { type: "array" });
              const backupData = parseXLSXBackup(workbook);
              await sendRestorePayload(backupData);
              resolve();
            } catch (err: any) {
              const errMsg = `Không thể đọc file Excel sao lưu: ${err.message}`;
              setAppAlert({
                isOpen: true,
                title: "Lỗi giải mã Excel",
                message: errMsg,
                type: "error"
              });
              setLoading(false);
              reject(err);
            }
          };
          reader.readAsArrayBuffer(file);
        }
      } catch (err: any) {
        setAppAlert({
          isOpen: true,
          title: "Lỗi phục hồi",
          message: `Có lỗi xảy ra trong quá trình xử lý tệp tin: ${err.message}`,
          type: "error"
        });
        setLoading(false);
        reject(err);
      }
    });
  };

  const executePdfExport = (
    reportTitle: string,
    unitName: string,
    rawHeaders: string[],
    rawRows: any[][],
    selectedIndices?: number[],
    orientation: "landscape" | "portrait" = "landscape"
  ) => {
    // Filter headers and rows if specific column indices were selected
    let headers = rawHeaders;
    let rows = rawRows;
    if (selectedIndices && selectedIndices.length > 0) {
      headers = selectedIndices.map(idx => rawHeaders[idx]);
      rows = rawRows.map(row => selectedIndices.map(idx => row[idx]));
    }

    // 1. Calculate dynamic column weights and font sizing to fit 100% within margins
    const totalCols = headers.length;
    const isPortrait = orientation === "portrait";

    let fontSize = isPortrait ? "8.5px" : "9px";
    let headerFontSize = isPortrait ? "9px" : "9.5px";
    let cellPadding = isPortrait ? "4px 3px" : "5px 4px";

    if (totalCols > 20) {
      fontSize = isPortrait ? "5.5px" : "6.5px";
      headerFontSize = isPortrait ? "6px" : "7px";
      cellPadding = "2.5px 1px";
    } else if (totalCols > 14) {
      fontSize = isPortrait ? "6.5px" : "7.5px";
      headerFontSize = isPortrait ? "7px" : "8px";
      cellPadding = "3px 1.5px";
    } else if (totalCols > 9) {
      fontSize = isPortrait ? "7.5px" : "8.5px";
      headerFontSize = isPortrait ? "8px" : "9px";
      cellPadding = "3.5px 2px";
    }

    // Column widths calculation
    const getColWidthPercent = (headerName: string) => {
      const h = headerName.toLowerCase();
      if (h === "stt" || h === "tổ" || h === "tổ dân phố" || h === "giới tính") return 3.5;
      if (h.includes("cccd") || h.includes("cmnd") || h.includes("mã hộ") || h.includes("sđt") || h.includes("ngày sinh") || h.includes("tuổi")) return 5.5;
      if (h.includes("họ") || h.includes("tên") || h.includes("chủ hộ")) return 8.5;
      if (h.includes("địa chỉ") || h.includes("ghi chú") || h.includes("nơi làm")) return 11.0;
      return 100 / totalCols;
    };

    const rawWidths = headers.map(h => getColWidthPercent(h));
    const sumRaw = rawWidths.reduce((a, b) => a + b, 0);
    const colWidths = rawWidths.map(w => ((w / sumRaw) * 100).toFixed(2));

    // 2. Paginate rows into page chunks so rows NEVER cut across pages!
    const getRowWeight = (row: any[]) => {
      let maxLines = 1;
      row.forEach(cell => {
        if (cell !== null && cell !== undefined) {
          const str = String(cell);
          if (str.length > 80) maxLines = Math.max(maxLines, 2.5);
          else if (str.length > 40) maxLines = Math.max(maxLines, 1.8);
        }
      });
      return maxLines;
    };

    const pagesRows: any[][][] = [];
    const maxSinglePageRows = isPortrait ? 22 : 15;

    // If total rows <= threshold, force ALL rows onto a single page to prevent splitting
    if (rows.length <= maxSinglePageRows) {
      pagesRows.push(rows);
    } else {
      let currentChunk: any[][] = [];
      let currentWeight = 0;

      // Higher weight allowances per page
      const maxWeightPage1 = isPortrait ? (totalCols > 12 ? 26 : 30) : (totalCols > 15 ? 18 : 22);
      const maxWeightMiddle = isPortrait ? (totalCols > 12 ? 32 : 36) : (totalCols > 15 ? 22 : 26);

      rows.forEach((row) => {
        const w = getRowWeight(row);
        const isFirstPage = pagesRows.length === 0;
        const maxAllowed = isFirstPage ? maxWeightPage1 : maxWeightMiddle;

        if (currentWeight + w > maxAllowed && currentChunk.length > 0) {
          pagesRows.push(currentChunk);
          currentChunk = [];
          currentWeight = 0;
        }
        currentChunk.push(row);
        currentWeight += w;
      });

      if (currentChunk.length > 0) {
        pagesRows.push(currentChunk);
      }
    }

    const totalPages = pagesRows.length || 1;

    // 3. Render HTML page containers
    const outerWrapper = document.createElement("div");
    outerWrapper.style.position = "absolute";
    outerWrapper.style.left = "-9999px";
    outerWrapper.style.top = "0";
    outerWrapper.style.display = "flex";
    outerWrapper.style.flexDirection = "column";
    outerWrapper.style.gap = "40px";

    pagesRows.forEach((pageRows, pageIdx) => {
      const pageNum = pageIdx + 1;
      const isLastPage = pageNum === totalPages;

      const pageDiv = document.createElement("div");
      pageDiv.className = "pdf-page-container";
      pageDiv.style.width = isPortrait ? "990px" : "1400px";
      pageDiv.style.minHeight = isPortrait ? "1400px" : "990px";
      pageDiv.style.maxHeight = isPortrait ? "1400px" : "990px";
      pageDiv.style.backgroundColor = "white";
      pageDiv.style.color = "#000000";
      // Nghị định 30: Top 20-25mm, Right 15-20mm, Bottom 20-25mm, Left 30-35mm
      pageDiv.style.padding = isPortrait ? "95px 65px 85px 95px" : "95px 85px 85px 140px";
      pageDiv.style.fontFamily = "'Times New Roman', Times, serif";
      pageDiv.style.boxSizing = "border-box";
      pageDiv.style.display = "flex";
      pageDiv.style.flexDirection = "column";
      pageDiv.style.justifyContent = "flex-start";

      let pageHtml = `
        <div style="width: 100%;">
          ${pageNum === 1 ? `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; font-size: 13px; font-family: 'Times New Roman', Times, serif; color: #000000;">
              <div style="text-align: center; width: 48%; line-height: 1.35;">
                <div style="font-size: 12px; font-weight: bold; text-transform: uppercase; color: #000000;">ỦY BAN NHÂN DÂN PHƯỜNG BÌNH MINH</div>
                <div style="font-size: 12px; font-weight: bold; text-transform: uppercase; color: #000000; margin-top: 1px;">${unitName || "KHU PHỐ NINH PHÚ"}</div>
                <div style="width: 100px; height: 1.2px; background-color: #000000; margin: 5px auto 3px auto;"></div>
                <div style="font-size: 10.5px; font-style: italic; color: #000000;">(Kèm theo Báo cáo / Quyết định UBND)</div>
              </div>
              <div style="text-align: center; width: 48%; line-height: 1.35;">
                <div style="font-size: 12.5px; font-weight: bold; text-transform: uppercase; color: #000000;">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                <div style="font-size: 13px; font-weight: bold; color: #000000; margin-top: 1px;">Độc lập - Tự do - Hạnh phúc</div>
                <div style="width: 165px; height: 1.2px; background-color: #000000; margin: 5px auto 3px auto;"></div>
                <div style="font-size: 11px; font-style: italic; color: #000000;">
                  Bình Minh, ngày ${new Date().getDate()} tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()}
                </div>
              </div>
            </div>

            <div style="text-align: center; margin-bottom: 20px; line-height: 1.45; font-family: 'Times New Roman', Times, serif;">
              <div style="font-size: 16.5px; font-weight: bold; text-transform: uppercase; color: #000000; margin-bottom: 3px;">PHỤ LỤC BÁO CÁO DÂN CƯ VÀ CHỈ TIÊU KINH TẾ - XÃ HỘI NĂM ${new Date().getFullYear()}</div>
              <div style="font-size: 13px; font-weight: bold; color: #000000;">${reportTitle}</div>
              <div style="width: 140px; height: 1.2px; background-color: #000000; margin: 5px auto 6px auto;"></div>
              <div style="font-size: 10px; font-style: italic; color: #334155; margin-top: 4px;">
                Thời gian kết xuất: ${new Date().toLocaleDateString("vi-VN")} lúc ${new Date().toLocaleTimeString("vi-VN")} | Trang ${pageNum}/${totalPages}
              </div>
            </div>
          ` : `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; font-size: 11px; color: #475569; font-family: 'Times New Roman', Times, serif;">
              <div style="font-weight: bold; text-transform: uppercase;">${reportTitle} (Tiếp theo)</div>
              <div style="font-style: italic;">Trang ${pageNum} / ${totalPages}</div>
            </div>
          `}

          <table style="width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 5px;">
            <colgroup>
              ${colWidths.map(w => `<col style="width: ${w}%;" />`).join("")}
            </colgroup>
            <thead>
              <tr style="background-color: #f1f5f9;">
                ${headers.map(h => `<th style="border: 1px solid #334155; padding: 5px 3px; font-weight: bold; text-align: center; text-transform: uppercase; font-size: ${headerFontSize}; white-space: normal; word-break: break-word; color: #0f172a;">${h}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${pageRows.map((row, rIdx) => `
                <tr style="background-color: ${rIdx % 2 === 1 ? '#f8fafc' : '#ffffff'};">
                  ${row.map((cell, cIdx) => `
                    <td style="border: 1px solid #334155; padding: ${cellPadding}; text-align: ${cIdx === 0 ? 'center' : 'left'}; font-size: ${fontSize}; word-break: break-word; overflow-wrap: break-word; white-space: normal; line-height: 1.25; color: #0f172a;">
                      ${cell !== null && cell !== undefined ? cell : ""}
                    </td>
                  `).join("")}
                </tr>
              `).join("")}
            </tbody>
          </table>

          ${isLastPage ? `
            <div style="margin-top: 25px; display: flex; justify-content: space-between; font-size: 12px; align-items: flex-end; page-break-inside: avoid;">
              <div style="line-height: 1.6;">
                <strong>Tổng số bản ghi:</strong> ${rows.length}<br />
                <strong>Người thực hiện:</strong> ${currentUser?.fullName || currentUser?.username || "Cán bộ Quản lý"}<br />
                <strong>Trạng thái:</strong> Hệ thống dữ liệu dân cư khu phố chuẩn hóa
              </div>
              <div style="text-align: center; width: 280px; line-height: 1.5;">
                <div style="font-style: italic; font-size: 11px; margin-bottom: 4px;">Bình Minh, ngày ${new Date().getDate()} tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()}</div>
                <div style="font-weight: bold; text-transform: uppercase; margin-bottom: 35px;">XÁC NHẬN CỦA BAN ĐIỀU HÀNH</div>
                <div style="font-style: italic; font-size: 10px; margin-bottom: 30px;">(Ký tên và đóng dấu)</div>
                <div style="font-weight: bold; font-size: 13px;">Nguyễn Tấn Bình</div>
              </div>
            </div>
          ` : ""}
        </div>
      `;

      pageDiv.innerHTML = pageHtml;
      outerWrapper.appendChild(pageDiv);
    });

    document.body.appendChild(outerWrapper);

    // Add loading toast feedback
    const loadingToast = document.createElement("div");
    loadingToast.style.position = "fixed";
    loadingToast.style.bottom = "24px";
    loadingToast.style.right = "24px";
    loadingToast.style.backgroundColor = "#0f172a";
    loadingToast.style.color = "white";
    loadingToast.style.padding = "10px 20px";
    loadingToast.style.borderRadius = "8px";
    loadingToast.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
    loadingToast.style.zIndex = "99999";
    loadingToast.style.fontSize = "13px";
    loadingToast.style.fontWeight = "bold";
    loadingToast.innerText = `Đang canh lề và xuất báo cáo PDF chuẩn ${totalPages} trang...`;
    document.body.appendChild(loadingToast);

    const pageNodes = Array.from(outerWrapper.querySelectorAll(".pdf-page-container")) as HTMLElement[];
    const pdf = new jsPDF(isPortrait ? "p" : "l", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    const renderPagesSequentially = async () => {
      for (let i = 0; i < pageNodes.length; i++) {
        const node = pageNodes[i];
        const canvas = await html2canvas(node, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false
        });

        const imgData = canvas.toDataURL("image/jpeg", 0.98);
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
      }

      const downloadName = `${reportTitle.replace(/\s+/g, "_")}_A4_${isPortrait ? "Portrait" : "Landscape"}.pdf`;
      pdf.save(downloadName);

      if (outerWrapper.parentNode) document.body.removeChild(outerWrapper);
      if (loadingToast.parentNode) document.body.removeChild(loadingToast);
    };

    renderPagesSequentially().catch((err) => {
      console.error("PDF generation error:", err);
      if (outerWrapper.parentNode) document.body.removeChild(outerWrapper);
      if (loadingToast.parentNode) document.body.removeChild(loadingToast);
      alert("Có lỗi xảy ra trong quá trình xuất PDF. Vui lòng thử lại.");
    });
  };

  const handleExportSim = (
    type: "xlsx" | "pdf" | "docx",
    titleOrEntity: string,
    passedHeaders?: string[],
    passedRows?: any[][]
  ) => {
    const BOM = "\uFEFF";
    let csvContent = "";
    let filename = "";
    let headers: string[] = passedHeaders || [];
    let rows: any[][] = passedRows || [];
    let reportTitle = titleOrEntity;

    if (!passedHeaders || !passedRows) {
      // Fallback for older calls from Dashboard
      if (titleOrEntity === "residents") {
        reportTitle = "Danh sách Nhân khẩu Chi tiết KDC";
        headers = [
          "STT", "Mã Hộ Gia Đình", "Họ và Tên", "Quan Hệ Chủ Hộ", "Giới Tính", 
          "Ngày Sinh", "Số CCCD", "Định Danh VNeID", "Số CMND cũ", "Trạng Thái Cư Trú", "Dân Tộc", "Tôn Giáo",
          "Trình Độ Học Vấn", "Nghề Nghiệp", "Nơi Làm Việc", "Số Điện Thoại", "Mã Số BHYT",
          "Người Cao Tuổi", "Khuyết Tật", "Mang Thai", "Học Sinh/Sinh Viên", "Loại Học Sinh",
          "Có Việc Làm", "Lĩnh Vực Lao Động", "Trợ Cấp"
        ];
        
        rows = residents.filter(r => r.occupation !== "Đã qua đời").map((r, idx) => [
          idx + 1,
          r.householdId,
          r.fullName,
          r.relationToOwner,
          r.gender,
          r.birthDate,
          `'${r.id}`,
          r.vneidStatus || "Chưa đăng ký",
          r.oldCmnd || "",
          r.status,
          r.ethnicity,
          r.religion,
          r.education,
          r.occupation || "N/A",
          r.workplace || "N/A",
          r.phone || "",
          r.insuranceId || "",
          r.isElderly ? "Có" : "Không",
          r.isDisabled ? "Có" : "Không",
          r.isPregnant ? "Có" : "Không",
          r.isStudent ? "Có" : "Không",
          r.studentType || "",
          r.isEmployed ? "Có" : "Không",
          r.laborSector,
          r.subsidyType || "Không"
        ]);
      } else if (titleOrEntity === "households") {
        reportTitle = "Danh sách Hộ gia đình Chi tiết";
        headers = [
          "STT", "Mã Hộ Gia Đình", "Mã CCCD Chủ Hộ", "Định Danh VNeID", "Số CMND cũ Chủ Hộ", "Họ Tên Chủ Hộ", "Số ĐT Chủ Hộ", "Địa Chỉ",
          "Tổ Dân Phố", "Khu Phố", "Ngày Lập Hộ", "Phân Loại Hộ", "Gia Đình Văn Hoá",
          "Gia Đình Chính Sách", "Gia Đình Có Công", "Nước Sạch", "Thu Gom Rác", "Hộ Nông Nghiệp", "Vĩ Độ (Lat)", "Kinh Độ (Lng)",
          "Ghi Chú"
        ];
        
        rows = households.map((h, idx) => {
          const ownerResident = residents.find(r => r.id === h.ownerId);
          const ownerPhone = ownerResident?.phone || "";
          return [
            idx + 1,
            h.id,
            `'${h.ownerId}`,
            h.vneidStatus || ownerResident?.vneidStatus || "Chưa đăng ký",
            h.ownerOldCmnd || ownerResident?.oldCmnd || "",
            h.ownerName,
            ownerPhone,
            h.address,
            h.wardId,
            h.quarterId || "",
            h.createdAt,
            h.status,
            h.isCulturalFamily ? "Có" : "Không",
            h.isPolicyFamily ? "Có" : "Không",
            h.isMeritoriousFamily ? "Có" : "Không",
            h.waterSource || "Chưa cập nhật",
            h.wasteCollectionStatus || (h.isWasteFeePaid ? "Đã đăng ký" : "Chưa đăng ký"),
            h.housingType,
            h.gpsLat || "",
            h.gpsLng || "",
            h.notes || ""
          ];
        });
      }
    }

    if (currentUser?.role === UserRole.COLLABORATOR) {
      const hasExisting = rows.some(row => {
        return row.some(cell => {
          if (typeof cell === "string") {
            const cleanCell = cell.replace(/^'/, "");
            return existingEntityIds.has(cleanCell) || existingEntityIds.has(cell);
          }
          return false;
        });
      });

      if (hasExisting) {
        alert("Cộng tác viên không được quyền tải xuống dữ liệu đã có sẵn trước đó.");
        return;
      }
    }

    // Extract unit/group name dynamically based on report title/filter label
    let unitName = "BAN ĐIỀU HÀNH";
    const groupMatch = reportTitle.match(/tổ\s+(\d+)/i);
    if (groupMatch) {
      unitName = `BAN ĐIỀU HÀNH TỔ DÂN PHỐ ${groupMatch[1]}`;
    }

    if (type === "xlsx") {
      // Create a beautifully formatted Vietnamese public official report header at the top of the Excel worksheet
      const now = new Date();
      const dateStr = `Ngày ${now.getDate()} tháng ${now.getMonth() + 1} năm ${now.getFullYear()}`;
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      
      const totalCols = Math.max(headers.length, 6);
      const leftEndCol = Math.min(4, Math.floor(totalCols * 0.35));
      const rightStartCol = Math.max(leftEndCol + 1, totalCols - Math.max(4, Math.floor(totalCols * 0.45)));

      const row0 = new Array(totalCols).fill("");
      row0[0] = "ỦY BAN NHÂN DÂN PHƯỜNG BÌNH MINH";
      row0[rightStartCol] = "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM";

      const row1 = new Array(totalCols).fill("");
      row1[0] = unitName;
      row1[rightStartCol] = "Độc lập - Tự do - Hạnh phúc";

      const row2 = new Array(totalCols).fill("");
      row2[0] = "Số: ...... /BC-UBND";
      row2[rightStartCol] = `Ninh Phú, ${dateStr}`;

      const row3 = new Array(totalCols).fill("");

      const row4 = new Array(totalCols).fill("");
      row4[0] = "BÁO CÁO THỐNG KÊ CHI TIẾT DÂN CƯ";

      const row5 = new Array(totalCols).fill("");
      row5[0] = `Danh mục báo cáo: ${reportTitle}`;

      const row6 = new Array(totalCols).fill("");
      row6[0] = `Thời gian kết xuất: ${dateStr} lúc ${timeStr}`;

      const row7 = new Array(totalCols).fill("");

      const headerRows = [row0, row1, row2, row3, row4, row5, row6, row7];

      // Merge headers & rows
      const worksheetData = [...headerRows, headers, ...rows];
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      
      // Define cell merges for title headers (Rows 0, 1, 2, 4, 5, 6) so text spans cleanly across columns
      worksheet["!merges"] = [
        // Row 0: Left header & Right header
        { s: { r: 0, c: 0 }, e: { r: 0, c: leftEndCol } },
        { s: { r: 0, c: rightStartCol }, e: { r: 0, c: totalCols - 1 } },
        // Row 1: Left unit name & Right motto
        { s: { r: 1, c: 0 }, e: { r: 1, c: leftEndCol } },
        { s: { r: 1, c: rightStartCol }, e: { r: 1, c: totalCols - 1 } },
        // Row 2: Reference Number & Location/Date
        { s: { r: 2, c: 0 }, e: { r: 2, c: leftEndCol } },
        { s: { r: 2, c: rightStartCol }, e: { r: 2, c: totalCols - 1 } },
        // Row 4: BÁO CÁO THỐNG KÊ CHI TIẾT DÂN CƯ (Full width)
        { s: { r: 4, c: 0 }, e: { r: 4, c: totalCols - 1 } },
        // Row 5: Danh mục báo cáo (Full width)
        { s: { r: 5, c: 0 }, e: { r: 5, c: totalCols - 1 } },
        // Row 6: Thời gian kết xuất (Full width)
        { s: { r: 6, c: 0 }, e: { r: 6, c: totalCols - 1 } },
      ];

      // Helper to apply styling to worksheet cells
      const setCellStyle = (r: number, c: number, style: any) => {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        if (!worksheet[cellRef]) {
          worksheet[cellRef] = { t: "s", v: "" };
        }
        worksheet[cellRef].s = {
          ...(worksheet[cellRef].s || {}),
          ...style,
        };
      };

      // 1. Center & style Top Left & Right Headers (Rows 0, 1 & 2)
      for (let c = 0; c <= leftEndCol; c++) {
        setCellStyle(0, c, {
          font: { bold: true, sz: 11, name: "Times New Roman", color: { rgb: "000000" } },
          alignment: { horizontal: "center", vertical: "center" }
        });
        setCellStyle(1, c, {
          font: { bold: true, sz: 11, name: "Times New Roman", color: { rgb: "000000" } },
          alignment: { horizontal: "center", vertical: "center" }
        });
        setCellStyle(2, c, {
          font: { italic: true, sz: 10, name: "Times New Roman", color: { rgb: "333333" } },
          alignment: { horizontal: "center", vertical: "center" }
        });
      }
      for (let c = rightStartCol; c < totalCols; c++) {
        setCellStyle(0, c, {
          font: { bold: true, sz: 11, name: "Times New Roman", color: { rgb: "000000" } },
          alignment: { horizontal: "center", vertical: "center" }
        });
        setCellStyle(1, c, {
          font: { bold: true, sz: 12, name: "Times New Roman", color: { rgb: "000000" } },
          alignment: { horizontal: "center", vertical: "center" }
        });
        setCellStyle(2, c, {
          font: { italic: true, sz: 10, name: "Times New Roman", color: { rgb: "333333" } },
          alignment: { horizontal: "center", vertical: "center" }
        });
      }

      // 2. Center & style Main Report Titles across full table width (Rows 4, 5, 6)
      for (let c = 0; c < totalCols; c++) {
        // Row 4: BÁO CÁO THỐNG KÊ CHI TIẾT DÂN CƯ (Bold, size 15, centered)
        setCellStyle(4, c, {
          font: { bold: true, sz: 15, name: "Times New Roman", color: { rgb: "000000" } },
          alignment: { horizontal: "center", vertical: "center" }
        });
        // Row 5: Danh mục báo cáo (Bold, size 12, centered)
        setCellStyle(5, c, {
          font: { bold: true, sz: 12, name: "Times New Roman", color: { rgb: "000000" } },
          alignment: { horizontal: "center", vertical: "center" }
        });
        // Row 6: Thời gian kết xuất (Italic, size 10, centered)
        setCellStyle(6, c, {
          font: { italic: true, sz: 10, name: "Times New Roman", color: { rgb: "475569" } },
          alignment: { horizontal: "center", vertical: "center" }
        });
      }

      // 3. Style Table Headers (Row index 8)
      const tableHeaderRowIdx = 8;
      for (let c = 0; c < headers.length; c++) {
        setCellStyle(tableHeaderRowIdx, c, {
          font: { bold: true, sz: 11, name: "Times New Roman", color: { rgb: "FFFFFF" } },
          fill: { fgColor: { rgb: "059669" } }, // Emerald 600 header
          alignment: { horizontal: "center", vertical: "center", wrapText: true },
          border: {
            top: { style: "thin", color: { rgb: "047857" } },
            bottom: { style: "thin", color: { rgb: "047857" } },
            left: { style: "thin", color: { rgb: "047857" } },
            right: { style: "thin", color: { rgb: "047857" } },
          }
        });
      }

      // 4. Style Data Rows (Rows 9+)
      for (let r = 0; r < rows.length; r++) {
        const rowIdx = 9 + r;
        const isOdd = r % 2 === 1;
        const bgColor = isOdd ? "F8FAFC" : "FFFFFF";
        for (let c = 0; c < headers.length; c++) {
          const isCenterCol = c === 0 || c === 1 || c === 3 || c === 4 || c === 5; // STT, Code, CCCD, Phone, Age
          setCellStyle(rowIdx, c, {
            font: { sz: 10, name: "Times New Roman", color: { rgb: "000000" } },
            fill: { fgColor: { rgb: bgColor } },
            alignment: {
              horizontal: isCenterCol ? "center" : "left",
              vertical: "center"
            },
            border: {
              top: { style: "thin", color: { rgb: "E2E8F0" } },
              bottom: { style: "thin", color: { rgb: "E2E8F0" } },
              left: { style: "thin", color: { rgb: "E2E8F0" } },
              right: { style: "thin", color: { rgb: "E2E8F0" } },
            }
          });
        }
      }

      // Auto-fit column widths based on data headers and rows only to keep the design clean
      const colWidths = headers.map((_, colIdx) => {
        let maxLen = headers[colIdx].length;
        rows.forEach(row => {
          const val = row[colIdx];
          if (val !== undefined && val !== null) {
            const strVal = String(val);
            if (strVal.length > maxLen) {
              maxLen = strVal.length;
            }
          }
        });
        return { wch: Math.max(Math.min(maxLen + 3, 45), 12) };
      });
      worksheet["!cols"] = colWidths;

      // Create workbook and append sheet
      const workbook = XLSX.utils.book_new();
      // Sheet name cannot exceed 31 chars and must not contain special chars
      const safeSheetName = reportTitle.replace(/[\\/?*\[\]]/g, "").slice(0, 31) || "Data";
      XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName);

      // Write array buffer
      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8" });
      
      filename = `${reportTitle.replace(/\s+/g, "_")}_2026.xlsx`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (type === "pdf") {
      setExportPdfModalConfig({
        isOpen: true,
        reportTitle,
        unitName,
        headers,
        rows
      });
      return;
    }
  };

  return (
    <>
    <DeviceSimulator>
      {(isMobile, deviceType) => {
        // Chờ Firebase và kiểm tra quyền truy cập hoàn tất trước khi quyết định hiển thị Login hay Dashboard
if (authLoading || checkingAccess) {
  return (
    <div className="h-full w-full flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-600 mx-auto" />
        <p className="mt-3 text-sm font-semibold text-slate-600">
          Đang xác thực phiên đăng nhập...
        </p>
      </div>
    </div>
  );
}
        // Gated Login View
        if (!currentUser) {
          // Sub-view 1: Two-Factor Authentication (2FA) Code Verification
          
          
          if (showRegisterForm) {
            return (
              <div 
                id="auth-gate-container" 
                className="h-full w-full bg-slate-50 flex flex-col items-center justify-start p-4 py-8 overflow-y-auto relative"
              >
                <div className="flex-1" />
                <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-sm overflow-hidden shadow-xl shrink-0 max-[400px]:rounded-2xl">
                  {/* Banner */}
                  <div className="bg-gradient-to-r from-emerald-800 to-teal-800 p-5 max-[400px]:p-4 text-center text-white space-y-2 flex flex-col items-center">
                    <div className="w-12 h-12 max-[400px]:w-10 max-[400px]:h-10 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20 shadow">
                      <Users className="w-6 h-6 max-[400px]:w-5 max-[400px]:h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm tracking-tight uppercase max-[400px]:text-xs">ĐĂNG KÝ TÀI KHOẢN CÁN BỘ</h3>
                      <p className="text-[10px] text-emerald-100 max-[400px]:text-[9px]">Cổng đăng ký thông tin chờ duyệt nâng cao</p>
                    </div>
                  </div>

                  <div className="p-5 max-[400px]:p-4 space-y-4 max-[400px]:space-y-3">
                    {loginError && (
                      <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-[11px] text-rose-800 leading-relaxed font-semibold">
                        <p>{loginError}</p>
                      </div>
                    )}

                    {regSuccessMessage && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-[11px] text-emerald-800 leading-relaxed font-semibold space-y-3">
                        <p>{regSuccessMessage}</p>
                        <button
                          type="button"
                          onClick={() => {
                            setRegSuccessMessage("");
                            setShowRegisterForm(false);
                            setLoginError("");
                          }}
                          className="w-full py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-lg shadow transition-colors cursor-pointer"
                        >
                          Quay lại Đăng nhập
                        </button>
                      </div>
                    )}

                    {!regSuccessMessage && (
                      <form onSubmit={handleRegisterSubmit} className="space-y-3.5 max-[400px]:space-y-2.5">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Họ và tên cán bộ:</label>
                          <input
                            type="text"
                            required
                            placeholder="Nguyễn Văn A"
                            value={regFullName}
                            onChange={(e) => setRegFullName(e.target.value)}
                            className="w-full px-3 py-2 max-[400px]:py-1.5 border border-slate-200 rounded-xl text-xs text-slate-800 bg-slate-50 focus:outline-emerald-600 font-semibold"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Địa chỉ Gmail chính thức:</label>
                          <input
                            type="email"
                            required
                            placeholder="canbo.nhaplieu@gmail.com"
                            value={regEmail}
                            onChange={(e) => setRegEmail(e.target.value)}
                            className="w-full px-3 py-2 max-[400px]:py-1.5 border border-slate-200 rounded-xl text-xs text-slate-800 bg-slate-50 focus:outline-emerald-600 font-semibold"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Số điện thoại liên hệ:</label>
                          <input
                            type="tel"
                            required
                            placeholder="0912345678"
                            value={regPhone}
                            onChange={(e) => setRegPhone(e.target.value)}
                            className="w-full px-3 py-2 max-[400px]:py-1.5 border border-slate-200 rounded-xl text-xs text-slate-800 bg-slate-50 focus:outline-emerald-600 font-semibold"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Vai trò đề xuất:</label>
                          <select
                            value={regRole}
                            onChange={(e) => setRegRole(e.target.value as UserRole)}
                            className="w-full px-3 py-2 max-[400px]:py-1.5 border border-slate-200 rounded-xl text-xs text-slate-800 bg-slate-50 focus:outline-emerald-600 font-semibold"
                          >
                            <option value={UserRole.WARD_LEADER}>Trưởng Khu phố / Tổ trưởng</option>
                            <option value={UserRole.COLLABORATOR}>Cộng tác viên nhập liệu</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Lý do đăng ký / Đơn vị:</label>
                          <textarea
                            placeholder="Nhập lý do hoặc đơn vị công tác (ví dụ: Tổ dân phố số 3)..."
                            value={regReason}
                            onChange={(e) => setRegReason(e.target.value)}
                            className="w-full px-3 py-2 max-[400px]:py-1.5 border border-slate-200 rounded-xl text-xs text-slate-800 bg-slate-50 focus:outline-emerald-600 font-semibold h-16 max-[400px]:h-12 resize-none"
                          />
                        </div>

                        <button
                          type="submit"
                          className="w-full py-2.5 bg-emerald-750 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-md transition-colors uppercase tracking-wider cursor-pointer"
                        >
                          Gửi yêu cầu đăng ký
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setShowRegisterForm(false);
                            setLoginError("");
                          }}
                          className="w-full py-2.5 bg-transparent border border-slate-200 hover:border-slate-300 text-slate-500 hover:text-slate-700 font-bold text-[11px] rounded-xl transition-all cursor-pointer"
                        >
                          Quay lại Đăng nhập
                        </button>
                      </form>
                    )}
                  </div>
                </div>
                <div className="flex-1" />
              </div>
            );
          }

          // Sub-view 2: Admin Portal Gate vs Regular Staff Gate
          if (isAdminPath) {
            return (
              <div 
                id="auth-gate-container" 
                className="h-full w-full bg-slate-900 flex flex-col items-center justify-start p-4 py-8 overflow-y-auto relative"
              >
                <div className="flex-1" />
                <div className="bg-slate-950 border border-slate-800 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl shrink-0 max-[400px]:rounded-2xl">
                  {/* Admin Visual Banner */}
                  <div className="bg-gradient-to-b from-indigo-950 to-slate-950 p-6 max-[400px]:p-4 text-center text-white border-b border-slate-800 flex flex-col items-center space-y-3 max-[400px]:space-y-2">
                    <div className="w-16 h-16 max-[400px]:w-11 max-[400px]:h-11 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center p-0.5 shadow-lg">
                      <ShieldCheck className="w-9 h-9 max-[400px]:w-6 max-[400px]:h-6" />
                    </div>
                    <div>
                      <h3 className="font-black text-sm tracking-wide uppercase text-white max-[400px]:text-xs">CỔNG TRUY CẬP QUẢN TRỊ VIÊN</h3>
                      <p className="text-[10px] text-slate-400 max-[400px]:text-[9px]">Yêu cầu xác thực bảo mật 2 lớp tối cao (/admin)</p>
                    </div>
                  </div>

                  <div className="p-5 max-[400px]:p-4 space-y-4 max-[400px]:space-y-3">
                    {loginError && (
                      <div className="bg-rose-950/50 border border-rose-500/20 rounded-xl p-3 text-[11px] text-rose-300 font-semibold leading-relaxed">
                        <div>{loginError}</div>
                      </div>
                    )}

                    <div className="space-y-4">
                      <div className="space-y-3">
                        {/* Selected admin role default */}
                        <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 space-y-1.5">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Vai trò truy cập:</p>
                          <span className="px-2.5 py-0.5 bg-indigo-500/10 text-indigo-400 rounded text-[10px] font-bold border border-indigo-500/20">
                            SUPER_ADMIN (Quản trị viên cấp cao)
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setLoginRole(UserRole.SUPER_ADMIN);
                            handleGoogleLogin();
                          }}
                          disabled={googleLoading}
                          className="w-full py-3.5 px-4 bg-white hover:bg-slate-50 text-slate-800 font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer duration-200 active:scale-[0.98] text-xs"
                        >
                          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                          </svg>
                          <span>{googleLoading ? "Đang kết nối..." : "Google Admin Sign-in"}</span>
                        </button>
                      </div>

                      <div className="pt-2 text-center border-t border-slate-900 flex flex-col items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setLoginError("");
                            setShowRegisterForm(true);
                          }}
                          className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer inline-flex items-center gap-1"
                        >
                          📝 Đăng ký tài khoản mới (Chờ duyệt)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setLoginError("");
                            navigateTo("/");
                          }}
                          className="text-[10px] font-bold text-slate-400 hover:text-white transition-colors cursor-pointer inline-flex items-center gap-1"
                        >
                          🏠 Quay lại Cổng thông tin Cán bộ
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex-1" />
              </div>
            );
          }

          // 2FA Mandatory Phone OTP Gate removed - Google Authentication used directly
          if (false) {
            return (
              <div id="auth-gate-container" className="h-full w-full bg-slate-50 flex flex-col items-center justify-center p-4 py-8 overflow-y-auto relative">
                <div className="flex-1" />
                <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl shrink-0">
                  <div className="bg-emerald-800 p-5 text-center text-white space-y-2 flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-transparent border-transparent p-1 flex items-center justify-center shadow-md shrink-0">
                      <img src={officialLogo} alt="Logo" className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm tracking-tight uppercase">XÁC THỰC BẢO MẬT 2FA</h3>
                      <p className="text-[11px] text-emerald-200">Khu phố Ninh Phú - Quản lý Dân cư</p>
                    </div>
                  </div>

                  <div className="p-5 space-y-4">
                    <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3 text-[11px] text-amber-900 leading-relaxed font-medium space-y-1">
                      <div className="font-bold flex items-center gap-1.5 text-amber-950">
                        <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                        <span>Bắt buộc xác thực số điện thoại</span>
                      </div>
                      <p className="text-[10px] text-amber-800">
                        Mỗi lần đăng nhập, hệ thống bắt buộc xác thực mã OTP gửi đến số điện thoại cán bộ để ngăn chặn hack và bảo vệ an toàn dữ liệu.
                      </p>
                    </div>

                    {user?.email && (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-[11px] font-semibold text-slate-700 flex items-center justify-between">
                        <span className="text-[10px] text-slate-500 uppercase">Tài khoản Google:</span>
                        <span className="font-bold text-emerald-800">{user.email}</span>
                      </div>
                    )}

                    {otpError && (
                      <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs font-medium">
                        {otpError}
                      </div>
                    )}

                    {otpMessage && (
                      <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-xs font-semibold leading-relaxed space-y-1">
                        <div>{otpMessage}</div>
                      </div>
                    )}

                    {generatedOtpCode && (
                      <div className="bg-emerald-800 text-white p-4 rounded-2xl text-center space-y-1 shadow-inner border border-emerald-600">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-200">Mã xác thực OTP bảo mật của bạn:</div>
                        <div className="text-3xl font-black tracking-widest text-yellow-300 font-mono py-1">{generatedOtpCode}</div>
                        <div className="text-[9px] text-emerald-200">Có hiệu lực trong 5 phút. Vui lòng nhập 6 số này bên dưới.</div>
                      </div>
                    )}

                    <form onSubmit={handleVerify2FAOTP} className="space-y-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                          Số điện thoại cán bộ nhận OTP:
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="tel"
                            value={otpPhoneInput}
                            onChange={(e) => setOtpPhoneInput(e.target.value)}
                            placeholder="0912345678"
                            className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600"
                          />
                          <button
                            type="button"
                            onClick={handleSend2FAOTP}
                            disabled={otpLoading}
                            className="px-3 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer disabled:opacity-50"
                          >
                            {otpLoading ? "Đang tạo..." : "Gửi OTP"}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                          Nhập mã OTP 6 chữ số:
                        </label>
                        <input
                          type="text"
                          maxLength={6}
                          value={otpCodeInput}
                          onChange={(e) => setOtpCodeInput(e.target.value)}
                          placeholder="Nhập 6 số mã OTP"
                          className="w-full text-center px-3 py-2.5 border border-slate-300 rounded-xl text-lg font-black text-slate-900 tracking-widest focus:outline-none focus:border-emerald-600 font-mono"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={otpLoading || !otpCodeInput.trim()}
                        className="w-full py-3 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
                      >
                        {otpLoading ? "Đang xác thực..." : "✅ Xác nhận OTP & Đăng nhập vào Hệ thống"}
                      </button>
                    </form>

                    <div className="pt-2 text-center border-t border-slate-100">
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="text-[10px] font-bold text-rose-600 hover:text-rose-700 transition-colors cursor-pointer"
                      >
                        🚪 Đăng xuất / Dùng tài khoản khác
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex-1" />
              </div>
            );
          }

          // Regular Gated Portal (Case C)
          return (
            <div 
              id="auth-gate-container" 
              className="h-full w-full bg-white flex flex-col items-center justify-start p-4 py-8 overflow-y-auto relative"
            >
              <div className="flex-1" />
              <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-sm overflow-hidden shadow-xl shrink-0 max-[400px]:rounded-2xl">
                {/* Visual Banner */}
                <div className="bg-emerald-800 p-5 max-[400px]:p-4 text-center text-white space-y-2 flex flex-col items-center">
                  <div className="w-18 h-18 max-[400px]:w-14 max-[400px]:h-14 rounded-full bg-transparent border-transparent shadow-lg overflow-hidden flex items-center justify-center p-0 shrink-0">
                    <img src={officialLogo} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.src = officialLogo; }} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm tracking-tight uppercase max-[400px]:text-xs">CỔNG XÁC THỰC CÁN BỘ SỐ</h3>
                    <p className="text-[10px] text-emerald-200 max-[400px]:text-[9px]">Khu phố Ninh Phú - Hệ thống Quản lý dân cư</p>
                  </div>
                </div>

                <div className="p-5 max-[400px]:p-4 space-y-4 max-[400px]:space-y-3">
                  {loginError && (
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-[11px] text-rose-800 leading-relaxed font-semibold space-y-1.5">
                      <div>{loginError}</div>
                    </div>
                  )}

                  <div className="space-y-4">
                    {/* Role Selection Group with Missions */}
                    <div className="space-y-2.5 max-[400px]:space-y-1.5 bg-slate-50 p-3.5 max-[400px]:p-2.5 rounded-2xl border border-slate-100 text-left">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                        Chọn vai trò đăng nhập của cán bộ:
                      </label>
                      <div className="grid grid-cols-1 min-[400px]:grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSelectRole(UserRole.SUPER_ADMIN)}
                          className={`py-2 px-3 min-[400px]:px-1 text-center rounded-xl border text-[10px] font-bold transition-all flex flex-row min-[400px]:flex-col items-center justify-center gap-2 min-[400px]:gap-0.5 cursor-pointer ${
                            loginRole === UserRole.SUPER_ADMIN
                              ? "bg-emerald-800 border-emerald-800 text-white shadow-xs"
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Admin</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectRole(UserRole.WARD_LEADER)}
                          className={`py-2 px-3 min-[400px]:px-1 text-center rounded-xl border text-[10px] font-bold transition-all flex flex-row min-[400px]:flex-col items-center justify-center gap-2 min-[400px]:gap-0.5 cursor-pointer ${
                            loginRole === UserRole.WARD_LEADER
                              ? "bg-emerald-800 border-emerald-800 text-white shadow-xs"
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          <Home className="w-3.5 h-3.5" />
                          <span>Trưởng KP</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectRole(UserRole.COLLABORATOR)}
                          className={`py-2 px-3 min-[400px]:px-1 text-center rounded-xl border text-[10px] font-bold transition-all flex flex-row min-[400px]:flex-col items-center justify-center gap-2 min-[400px]:gap-0.5 cursor-pointer ${
                            loginRole === UserRole.COLLABORATOR
                              ? "bg-emerald-800 border-emerald-800 text-white shadow-xs"
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span>CTV</span>
                        </button>
                      </div>

                      {/* Corresponding Duties / Mission box */}
                      <div className="bg-white border border-slate-200/60 rounded-xl p-2.5 max-[400px]:p-2 text-[10px] leading-relaxed text-slate-600">
                        <p className="font-bold text-slate-800 uppercase text-[9px] tracking-wide mb-1 border-b border-slate-100 pb-1 flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span>Nhiệm vụ {loginRole === UserRole.SUPER_ADMIN ? "Quản trị viên" : loginRole === UserRole.WARD_LEADER ? "Trưởng Khu phố" : "Cộng tác viên"}:</span>
                        </p>
                        {loginRole === UserRole.SUPER_ADMIN && (
                          <span className="font-medium">
                            Toàn quyền quản trị hệ thống, phê duyệt cấp quyền tài khoản cán bộ mới, cấu hình bộ tiêu chí đô thị văn minh, sao lưu dự phòng toàn hệ thống dữ liệu.
                          </span>
                        )}
                        {loginRole === UserRole.WARD_LEADER && (
                          <span className="font-medium">
                            Quản lý danh sách hộ gia đình & cư dân, cập nhật thông tin nhân khẩu, theo dõi biến động cư dân (tạm trú, tạm vắng, chuyển đi/đến), tự động tổng hợp chất lượng sống.
                          </span>
                        )}
                        {loginRole === UserRole.COLLABORATOR && (
                          <span className="font-medium">
                            Tham gia hỗ trợ điều tra cơ sở, cập nhật trạng thái các chỉ số an sinh xã hội, khảo sát dịch vụ y tế, thẻ bảo hiểm y tế và tình hình giáo dục, việc làm tại khu phố.
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={handleGoogleLogin}
                        disabled={googleLoading}
                        className="w-full py-3.5 px-4 max-[400px]:py-2.5 max-[400px]:px-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold rounded-xl shadow-xs transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer duration-200 active:scale-[0.98] border-solid text-center"
                      >
                        <div className="flex items-center gap-2 text-xs justify-center">
                          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1c-4.3 0-8.01 2.47-9.82 6.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                          </svg>
                          <span>{googleLoading ? "Đang kết nối Google..." : "Xác thực bằng Google Gmail"}</span>
                        </div>
                      </button>
                    </div>

                    <div className="pt-3 text-center border-t border-slate-100 flex flex-col items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setLoginError("");
                          setShowRegisterForm(true);
                        }}
                        className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors cursor-pointer inline-flex items-center gap-1"
                      >
                        📝 Đăng ký tài khoản mới (Chờ duyệt)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLoginError("");
                          navigateTo("/admin");
                        }}
                        className="text-[10px] font-bold text-slate-500 hover:text-emerald-700 transition-colors cursor-pointer inline-flex items-center gap-1"
                      >
                        🔑 Cổng thông tin Quản trị hệ thống (/admin)
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex-1" />
            </div>
          );
        }

        // Authenticated Dashboard Layout
        if (isAdminPath) {
          if (currentUser.role !== UserRole.SUPER_ADMIN) {
            return (
              <div className="flex-1 bg-slate-950 flex flex-col items-center justify-center p-6 text-center select-none">
                <div className="max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
                  <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto shadow-lg">
                    <AlertTriangle className="w-8 h-8" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-lg font-black tracking-tight text-white uppercase">TRUY CẬP BỊ TỪ CHỐI</h2>
                    <p className="text-xs text-rose-400 font-bold uppercase tracking-wider font-mono">Lỗi: Quyền hạn không đủ (SUPER_ADMIN Clearance Required)</p>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed font-medium">
                    Tài khoản <strong className="text-white">{currentUser.fullName}</strong> ({currentUser.username}) không có quyền truy cập vào Cổng điều hành trung ương. Vui lòng quay trở lại cổng cư trú cơ bản hoặc đăng nhập bằng tài khoản Quản trị cấp cao.
                  </p>
                  <div className="pt-4 flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => navigateTo("/")}
                      className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer"
                    >
                      Quay lại Bảng cư dân
                    </button>
                    <button
                      onClick={handleLogout}
                      className="flex-1 py-3 bg-transparent hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
                    >
                      Đăng xuất tài khoản
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div 
              className="flex-1 flex flex-col overflow-hidden h-full bg-slate-950 font-sans text-slate-250"
              style={{ zoom: `${zoomScale}%` }}
            >
              {/* Specialized Admin top control header */}
              <header className="h-16 bg-slate-900 border-b border-slate-850 flex items-center justify-between px-6 shrink-0 select-none">
                <div className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                  <span className="text-xs font-black tracking-wide uppercase text-white">TRANG TRẠM QUẢN TRỊ TRUNG ƯƠNG</span>
                </div>
                
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => navigateTo("/")}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700/50 hover:border-slate-600 text-slate-300 text-[11px] font-black uppercase tracking-wider rounded-xl transition-all active:scale-95 cursor-pointer"
                  >
                    <Home className="w-3.5 h-3.5" />
                    <span>Quay lại Bảng cư dân</span>
                  </button>
                  
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 hover:text-rose-400 border border-rose-500/20 text-rose-300 text-[11px] font-black uppercase tracking-wider rounded-xl transition-all active:scale-95 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Đăng xuất</span>
                  </button>
                </div>
              </header>

              {/* Rendering the modular Admin Panel component */}
              <div className="flex-1 flex overflow-hidden bg-slate-900/40">
                <AdminPanel 
                  currentUser={currentUser}
                  onRefreshData={fetchData}
                  onGenerateMockData={handleGenerateMockData}
                  onClearMockData={handleClearAllData}
                  onRestoreBackup={handleRestoreBackup}
                  onExportBackup={handleExportJSONBackup}
                  isMobile={isMobile}
                />
              </div>
            </div>
          );
        }

        // Authenticated Dashboard Layout
        return (
          <div 
            className={`flex-1 flex flex-col overflow-hidden h-full bg-white font-sans text-[#1E293B] transition-colors duration-200 ${theme === "dark" ? "dark-theme-custom" : ""}`}
            style={{ zoom: `${zoomScale}%` }}
          >
            <div className="flex-1 flex overflow-hidden relative">
            
            {/* Backdrop overlay for mobile drawer has been removed per user request to prevent dimming and blocking page actions */}

            {/* Sidebar navigation (collapsible layout for desktop, drawer overlay for mobile) */}
            <aside className={`${
              isMobile
                ? `${isSidebarHidden ? "-translate-x-full w-0 border-r-0" : "translate-x-0 w-72"} absolute inset-y-0 left-0 z-45 shadow-2xl`
                : `${isSidebarHidden ? "w-20" : "w-72"}`
            } bg-[#0F172A] relative flex flex-col justify-between shrink-0 border-r border-slate-850 h-full transition-all duration-300 select-none z-35`}>
              {/* Collapsible/Expandable arrow button positioned directly on the sidebar border edge */}
              <button
                onClick={() => setIsSidebarHidden(!isSidebarHidden)}
                className="absolute top-20 -right-3.5 w-7 h-7 bg-[#0F172A] border border-slate-700 hover:border-emerald-400 rounded-full flex items-center justify-center text-slate-300 hover:text-emerald-400 transition-all z-50 cursor-pointer shadow-lg hover:scale-110 active:scale-95"
                title={isSidebarHidden ? "Mở rộng Menu" : "Thu gọn Menu"}
              >
                {isSidebarHidden ? (
                  <ChevronRight className="w-4 h-4 text-emerald-400" />
                ) : (
                  <ChevronLeft className="w-4 h-4 text-emerald-400" />
                )}
              </button>
              <div className="flex flex-col justify-between h-full w-full overflow-hidden">
                 {/* Brand Header (Fixed Top) */}
                <div className={`p-4 ${isSidebarHidden ? "pb-3" : "pb-4 sm:p-6"} border-b border-slate-800/60 shrink-0 flex flex-col items-center text-center gap-2 relative`}>
                  <div className="w-14 h-14 rounded-full bg-transparent border-transparent overflow-hidden flex items-center justify-center p-0 shadow-lg shrink-0">
                    <img src={officialLogo} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.src = officialLogo; }} />
                  </div>
                  {!isSidebarHidden && (
                    <div className="text-center mt-1">
                      <h1 className="text-white font-extrabold text-xs uppercase tracking-wide leading-tight">QUẢN LÝ DÂN CƯ</h1>
                      <span className="text-blue-400 font-black text-[10px] uppercase tracking-widest block mt-0.5">KHU PHỐ NINH PHÚ</span>
                    </div>
                  )}
                  {/* Persistent logout in sidebar header for quick access */}
                  {!isSidebarHidden && (
                    <button
                      onClick={handleLogout}
                      title="Đăng xuất"
                      className="absolute top-3 right-3 w-8 h-8 rounded-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 flex items-center justify-center transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Main Sidebar Contents (Scrollable Container) */}
                <div className={`flex-1 overflow-y-auto ${isSidebarHidden ? "p-2 space-y-4" : "p-4 sm:p-6 space-y-6"} scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent`}>

                  {/* Logged in Official details card */}
                  <div className={`bg-[#1E293B]/50 ${isSidebarHidden ? "p-1.5 py-2.5 justify-center" : "p-3 mx-1"} rounded-2xl border border-slate-800/80 flex items-center gap-3.5`}>
                    <div className="w-11 h-11 rounded-full bg-blue-600 text-white border border-blue-500/50 flex items-center justify-center font-extrabold text-sm shrink-0 shadow-lg overflow-hidden" title={currentUser.fullName}>
                      {currentUser.avatarUrl ? (
                        <img src={currentUser.avatarUrl} alt={currentUser.fullName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        getUserInitials(currentUser.fullName)
                      )}
                    </div>
                    {!isSidebarHidden && (
                      <div className="overflow-hidden flex flex-col text-left">
                        <h4 className="font-bold text-white text-xs truncate uppercase tracking-wide leading-tight" title={currentUser.fullName}>
                          {currentUser.fullName}
                        </h4>
                        <p className="text-[10px] text-cyan-400 font-extrabold uppercase tracking-wider mt-0.5">
                          {currentUser.role === UserRole.SUPER_ADMIN ? "QUẢN TRỊ VIÊN" : currentUser.role === UserRole.WARD_LEADER ? "TRƯỞNG KHU PHỐ" : "CTV / ĐIỀU TRA VIÊN"}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Sidebar Tabs List */}
                  <nav className="space-y-1 mt-4">
                    {[
                      { id: "dashboard", label: "Báo cáo Thống kê", icon: <Activity className="w-4 h-4" /> },
                      { id: "households", label: "Quản lý Hộ dân", icon: <Home className="w-4 h-4" /> },
                      { id: "residents", label: "Quản lý Nhân khẩu", icon: <Users className="w-4 h-4" /> },
                      { id: "changes", label: "Biến động cư trú", icon: <Calendar className="w-4 h-4" /> },
                      { id: "security", label: "An sinh & Y tế", icon: <Award className="w-4 h-4" /> },
                      { id: "businesses", label: "Hộ kinh doanh", icon: <Building className="w-4 h-4" /> },
                      { id: "rural", label: "Nông thôn mới & GIS", icon: <Sparkles className="w-4 h-4" /> },
                      { id: "documents", label: "Lưu tài liệu KP", icon: <FileText className="w-4 h-4 text-emerald-400" /> },
                      { id: "ai", label: "Gemini AI Copilot", icon: <Sparkles className="w-4 h-4 text-blue-400 animate-pulse" /> },
                      ...(currentUser.role === UserRole.SUPER_ADMIN
                        ? [{ id: "permissions", label: "Cấp quyền truy cập", icon: <ShieldCheck className="w-4 h-4 text-emerald-400" /> }]
                        : [])
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => {
                          setActiveTab(tab.id);
                          if (isMobile) setIsSidebarHidden(true); // Auto close sidebar on mobile tap
                        }}
                        title={tab.label}
                        className={`w-full flex ${isSidebarHidden ? "justify-center p-3" : "items-center gap-3.5 px-4 py-3"} rounded-xl text-xs font-bold tracking-wider uppercase transition-all duration-200 cursor-pointer ${
                          activeTab === tab.id
                            ? "bg-[#1E293B]/95 text-blue-400 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.15)]"
                            : "text-[#94A3B8] hover:text-white hover:bg-slate-850/30"
                        }`}
                      >
                        <span className={`${activeTab === tab.id ? "text-blue-400" : "text-slate-400"} shrink-0`}>
                          {tab.icon}
                        </span>
                        {!isSidebarHidden && <span className="whitespace-nowrap truncate">{tab.label}</span>}
                      </button>
                    ))}
                  </nav>
                </div>
              </div>
            </aside>

            {/* Main view container block */}
            <div className="flex-1 flex flex-col overflow-hidden">
              
              {/* Web Top Header Bar */}
              {!isMobile && (
                <header className="bg-white border-b border-slate-200 h-16 shrink-0 flex items-center justify-between px-6 shadow-xs select-none">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setIsSidebarHidden(!isSidebarHidden)}
                      className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-all cursor-pointer mr-1 flex items-center justify-center border border-slate-200"
                      title={isSidebarHidden ? "Mở rộng Menu" : "Thu gọn Menu"}
                    >
                      {isSidebarHidden ? (
                        <ChevronRight className="w-5 h-5 text-slate-700" />
                      ) : (
                        <ChevronLeft className="w-5 h-5 text-slate-700" />
                      )}
                    </button>
                    <span className="text-slate-400 text-xs font-bold tracking-wider uppercase">Chuyên mục:</span>
                    <span className="bg-emerald-50 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full border border-emerald-200/60 uppercase tracking-wide">
                      {activeTab === "dashboard" && "Báo cáo Thống kê"}
                      {activeTab === "households" && "Quản lý Hộ dân"}
                      {activeTab === "residents" && "Quản lý Nhân khẩu"}
                      {activeTab === "changes" && "Biến động cư trú"}
                      {activeTab === "security" && "An sinh & Y tế"}
                      {activeTab === "businesses" && "Hộ kinh doanh"}
                      {activeTab === "rural" && "Nông thôn mới & GIS"}
                      {activeTab === "documents" && "Tài liệu lưu trữ"}
                      {activeTab === "ai" && "Trợ lý Trí tuệ Nhân tạo Gemini AI"}
                      {activeTab === "permissions" && "Quản lý Cấp quyền Truy cập"}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Real-time Clock Widget - Always displayed in Desktop Header */}
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-2xs shrink-0">
                      <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="font-bold text-[11px] text-slate-800 dark:text-slate-100 whitespace-nowrap">{formatVietnameseDateTime(currentTime).dateStr}</span>
                      <span className="text-slate-300 dark:text-slate-600 font-normal">|</span>
                      <span className="font-mono font-extrabold text-[12px] text-emerald-600 dark:text-emerald-400 tracking-wider whitespace-nowrap">{formatVietnameseDateTime(currentTime).timeStr}</span>
                    </div>

                    {/* Zoom / View Scale Widget (Sửa lỗi màn hình nhỏ bị cắt góc) */}
                    <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl p-1 shadow-xs">
                      <button
                        type="button"
                        onClick={handleZoomOut}
                        className="p-1 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                        title="Thu nhỏ giao diện (-10%)"
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={handleZoomReset}
                        className="px-2 py-0.5 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-lg text-[10px] font-black transition-colors cursor-pointer font-mono"
                        title="Đặt lại tỉ lệ 100%"
                      >
                        {zoomScale}%
                      </button>
                      <button
                        type="button"
                        onClick={handleZoomIn}
                        className="p-1 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                        title="Phóng to giao diện (+10%)"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Compact mobile-style quick menu replacing the two large buttons */}
                    <select
                      aria-label="Chức năng nhanh"
                      className="min-w-[160px] max-w-[210px] px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl text-slate-700 shadow-xs outline-none cursor-pointer transition-all"
                      defaultValue=""
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === "theme") {
                          toggleTheme();
                        } else if (value === "ai") {
                          handleToggleAIChatbox();
                        }
                        e.currentTarget.value = "";
                      }}
                    >
                      <option value="" disabled hidden>
                        Chọn menu
                      </option>
                      <option value="theme">
                        {theme === "light" ? "Giao diện Đêm" : "Giao diện Ngày"}
                      </option>
                      <option value="ai">
                        {showAIChatbox ? "Tắt Trợ lý AI" : "Bật Trợ lý AI"}
                      </option>
                    </select>

                    {/* Logout Button in appropriate place (Top Header Bar) */}
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2 px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 border border-rose-100 hover:border-rose-200 rounded-xl text-xs font-bold transition-all duration-150 active:scale-95 cursor-pointer shadow-xs"
                      title="Đăng xuất khỏi hệ thống"
                    >
                      <LogOut className="w-4 h-4 shrink-0" />
                      Đăng xuất
                    </button>
                  </div>
                </header>
              )}
              
              {/* Simulated Mobile Quick Navigation drawer block */}
              {isMobile && (
                <div className="bg-[#0F172A] text-slate-200 px-3 py-2 shrink-0 border-b border-slate-800 select-none">
                  {isMobileNavCollapsed ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <button
                          onClick={() => setIsSidebarHidden(!isSidebarHidden)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-all cursor-pointer flex items-center justify-center shrink-0 border border-slate-700"
                          title={isSidebarHidden ? "Mở Menu" : "Đóng Menu"}
                        >
                          <Menu className="w-4 h-4" />
                        </button>
                        <span className="text-xs font-bold text-blue-400 truncate">
                          {activeTab === "dashboard" && "Báo cáo Thống kê"}
                          {activeTab === "households" && "Quản lý Hộ dân"}
                          {activeTab === "residents" && "Quản lý Nhân khẩu"}
                          {activeTab === "changes" && "Biến động cư trú"}
                          {activeTab === "security" && "An sinh & Y tế"}
                          {activeTab === "businesses" && "Hộ kinh doanh"}
                          {activeTab === "rural" && "Nông thôn mới & GIS"}
                          {activeTab === "ai" && "Gemini AI Copilot"}
                          {activeTab === "permissions" && "Cấp quyền truy cập"}
                        </span>
                      </div>
                      <button
                        onClick={() => setIsMobileNavCollapsed(false)}
                        className="flex items-center gap-1 text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-emerald-400 px-2.5 py-1 rounded-lg border border-slate-700 transition-all cursor-pointer shrink-0 ml-2"
                        title="Hiện thanh điều hướng"
                      >
                        <ChevronDown className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Hiện Menu</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <button
                          onClick={() => setIsSidebarHidden(!isSidebarHidden)}
                          className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-all cursor-pointer flex items-center justify-center shrink-0 border border-slate-700"
                          title={isSidebarHidden ? "Mở Menu" : "Đóng Menu"}
                        >
                          <Menu className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <select
                          value={activeTab}
                          onChange={(e) => setActiveTab(e.target.value)}
                          className="px-1.5 py-1 bg-slate-900 border border-slate-800 rounded text-[9px] text-blue-400 font-bold text-center"
                        >
                          <option value="dashboard" className="text-center">Báo cáo Thống kê</option>
                          <option value="households" className="text-center">Quản lý Hộ dân</option>
                          <option value="residents" className="text-center">Quản lý Nhân khẩu</option>
                          <option value="changes" className="text-center">Biến động cư trú</option>
                          <option value="security" className="text-center">An sinh & Y tế</option>
                          <option value="businesses" className="text-center">Hộ kinh doanh</option>
                          <option value="rural" className="text-center">Nông thôn mới & GIS</option>
                          <option value="ai" className="text-center">Gemini AI Copilot</option>
                          {currentUser.role === UserRole.SUPER_ADMIN && (
                            <option value="permissions" className="text-center">Cấp quyền truy cập</option>
                          )}
                        </select>

                        {/* Theme Toggle Button for mobile */}
                        <button
                          type="button"
                          onClick={toggleTheme}
                          className="p-1.5 bg-slate-800 border border-slate-700 hover:bg-slate-750 rounded-lg text-slate-300 hover:text-white transition-all cursor-pointer flex items-center justify-center shrink-0"
                          title={theme === "light" ? "Chuyển sang giao diện Đêm" : "Chuyển sang giao diện Ngày"}
                        >
                          {theme === "light" ? (
                            <Moon className="w-3.5 h-3.5 text-slate-300" />
                          ) : (
                            <Sun className="w-3.5 h-3.5 text-amber-400" />
                          )}
                        </button>

                        {/* Toggle AI Button for mobile */}
                        <button
                          onClick={handleToggleAIChatbox}
                          className={`flex items-center gap-1 px-2 py-1 border rounded-lg cursor-pointer transition-all active:scale-95 shrink-0 ${
                            showAIChatbox
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                              : "bg-slate-800 text-slate-400 border-slate-750 hover:text-slate-200"
                          }`}
                          title={showAIChatbox ? "Tắt Trợ lý AI" : "Bật Trợ lý AI"}
                        >
                          <Bot className={`w-3 h-3 ${showAIChatbox ? "animate-pulse text-emerald-400" : "text-slate-400"}`} />
                          <span className="text-[9px] font-extrabold uppercase">AI</span>
                        </button>

                        <button 
                          onClick={handleLogout} 
                          className="flex items-center gap-1 px-2 py-1 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 rounded-lg text-[9px] font-extrabold text-rose-400 cursor-pointer shrink-0 transition-all active:scale-95"
                          title="Đăng xuất"
                        >
                          <LogOut className="w-3 h-3" />
                          <span>Đăng xuất</span>
                        </button>

                        {/* Arrow collapse button */}
                        <button
                          onClick={() => setIsMobileNavCollapsed(true)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-all cursor-pointer flex items-center justify-center shrink-0 border border-slate-700"
                          title="Thu gọn Menu"
                        >
                          <ChevronUp className="w-3.5 h-3.5 text-emerald-400" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Rendering selected sub view */}
              {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
                  <p className="text-xs font-semibold">Đang liên kết cơ sở dữ liệu dân cư khu phố...</p>
                </div>
              ) : (
                <>
                  {showBackupReminder && (
                    <div className="bg-amber-50 border-b border-amber-250 px-4 py-3 shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs">
                      <div className="flex items-start gap-3">
                        <div className="bg-amber-100 p-2 rounded-xl text-amber-800 shrink-0">
                          <AlertTriangle className="w-5 h-5 text-amber-600 animate-pulse" />
                        </div>
                        <div>
                          <h4 className="font-bold text-amber-900 text-xs uppercase tracking-wider">
                            Nhắc nhở sao lưu định kỳ hàng tuần
                          </h4>
                          <p className="text-amber-700 text-xs mt-0.5 leading-relaxed font-medium">
                            {lastBackupDate ? (
                              `Hệ thống ghi nhận lần sao lưu gần nhất: ${new Date(lastBackupDate).toLocaleDateString("vi-VN")} lúc ${new Date(lastBackupDate).toLocaleTimeString("vi-VN")}. Hãy xuất và lưu trữ dữ liệu sang Excel định kỳ để tránh sự cố mất dữ liệu.`
                            ) : (
                              "Bạn chưa thực hiện sao lưu dữ liệu lần nào. Vui lòng xuất dữ liệu hệ thống ra tập tin Excel (XLSX) để đảm bảo an toàn."
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <button
                          onClick={() => setShowBackupReminder(false)}
                          className="px-3 py-1.5 hover:bg-amber-150 text-amber-850 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                        >
                          Để sau
                        </button>
                        <button
                          onClick={handleExportFullBackup}
                          className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow transition-colors cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Sao lưu ngay
                        </button>
                      </div>
                    </div>
                  )}

                  {currentUser?.role === UserRole.SUPER_ADMIN && latestSecurityAlert && (
                    <div className="bg-rose-50 border-b border-rose-200 px-4 py-3 shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs animate-pulse-subtle">
                      <div className="flex items-start gap-3">
                        <div className="bg-rose-100 p-2 rounded-xl text-rose-800 shrink-0 border border-rose-200">
                          <AlertTriangle className="w-5 h-5 text-rose-600 animate-bounce" />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-rose-900 text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                            🚨 CẢNH BÁO BẢO MẬT HỆ THỐNG
                          </h4>
                          <p className="text-rose-700 text-xs mt-0.5 leading-relaxed font-semibold">
                            {latestSecurityAlert.details} (Thời gian: {new Date(latestSecurityAlert.timestamp).toLocaleString("vi-VN")})
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <button
                          onClick={() => {
                            const alertKey = latestSecurityAlert.id || latestSecurityAlert.timestamp?.toString() || latestSecurityAlert.details;
                            handleDismissSecurityAlert(alertKey);
                          }}
                          className="px-3 py-1.5 hover:bg-rose-100 text-rose-800 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                        >
                          Bỏ qua
                        </button>
                        <button
                          onClick={() => {
                            const alertKey = latestSecurityAlert.id || latestSecurityAlert.timestamp?.toString() || latestSecurityAlert.details;
                            handleDismissSecurityAlert(alertKey);
                            setActiveTab("permissions");
                          }}
                          className="flex items-center gap-1.5 px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow transition-colors cursor-pointer uppercase tracking-wider"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Đồng ý quyền
                        </button>
                      </div>
                    </div>
                  )}

                  {activeTab === "dashboard" && (
                    <DashboardView 
                      households={households} 
                      residents={residents} 
                      businesses={businesses} 
                      changes={changes}
                      onExport={handleExportSim} 
                      isMobile={isMobile} 
                      userRole={currentUser?.role}
                      onGenerateMockData={handleGenerateMockData}
                      onClearAllData={handleClearAllData}
                      onExportFullBackup={handleExportFullBackup}
                      onExportJSONBackup={handleExportJSONBackup}
                      onRestoreBackup={handleRestoreBackup}
                    />
                  )}
                  {activeTab === "households" && (
                    <HouseholdView 
                      households={households} 
                      residents={residents} 
                      changes={changes}
                      currentUser={currentUser} 
                      onAddHousehold={addHousehold} 
                      onUpdateHousehold={updateHousehold} 
                      onDeleteHousehold={deleteHousehold} 
                      onExport={handleExportSim}
                      isMobile={isMobile}
                      onSync={triggerSync}
                      offlineQueueCount={offlineQueue.length}
                      isSyncing={isSyncing}
                      isOnline={isOnline}
                      onAddResident={addResident}
                      onUpdateResident={updateResident}
                      existingEntityIds={existingEntityIds}
                    />
                  )}
                  {activeTab === "residents" && (
                    <ResidentView 
                      residents={residents} 
                      households={households} 
                      changes={changes}
                      currentUser={currentUser} 
                      onAddResident={addResident} 
                      onUpdateResident={updateResident} 
                      onDeleteResident={deleteResident} 
                      onExport={handleExportSim}
                      isMobile={isMobile}
                      existingEntityIds={existingEntityIds}
                    />
                  )}
                  {activeTab === "changes" && (
                    <DemographicsChangeView 
                      changes={changes} 
                      residents={residents} 
                      households={households}
                      currentUser={currentUser} 
                      onAddChange={addDemographicsChange} 
                      onAddResident={addResident}
                      onUpdateResident={updateResident}
                      onUpdateHousehold={updateHousehold}
                      onExport={handleExportSim}
                    />
                  )}
                  {activeTab === "security" && (
                    <SocialSecurityView 
                      residents={residents} 
                      households={households} 
                      changes={changes}
                      onExport={handleExportSim}
                    />
                  )}
                  {activeTab === "businesses" && (
                    <BusinessView 
                      businesses={businesses} 
                      residents={residents} 
                      households={households} 
                      currentUser={currentUser} 
                      onAddBusiness={addBusiness} 
                      onUpdateBusiness={updateBusiness} 
                      onDeleteBusiness={deleteBusiness} 
                      onExport={handleExportSim}
                      existingEntityIds={existingEntityIds}
                    />
                  )}
                  {activeTab === "rural" && (
                    <NewRuralView 
                      criteria={criteria} 
                      households={households} 
                      residents={residents}
                      currentUser={currentUser} 
                      onUpdateCriteria={updateCriteria} 
                      onExport={handleExportSim}
                    />
                  )}
                  {activeTab === "documents" && (
                    <QuarterDocumentsView currentUser={currentUser} />
                  )}
                  {activeTab === "ai" && (
                    <AICopilotView isMobile={isMobile} />
                  )}
                  {activeTab === "permissions" && (
                    <AllowedEmailsView />
                  )}
                </>
              )}
              <footer className="py-4 text-center text-xs text-slate-500 font-medium border-t border-slate-200/80 mt-auto bg-slate-50/50">
                © Bản quyền thuộc về {currentUser?.fullName ? currentUser.fullName : "Ủy ban Nhân dân Khu phố Ninh Phú"}
              </footer>
            </div>

            </div>


            <MovableChatbox />
          </div>
        );
      }}
    </DeviceSimulator>
    
    {exportPdfModalConfig && exportPdfModalConfig.isOpen && (
      <ExportColumnModal
        isOpen={exportPdfModalConfig.isOpen}
        reportTitle={exportPdfModalConfig.reportTitle}
        unitName={exportPdfModalConfig.unitName}
        headers={exportPdfModalConfig.headers}
        rows={exportPdfModalConfig.rows}
        onClose={() => setExportPdfModalConfig(null)}
        onConfirmExport={(filteredHeaders, filteredRows, orientation) => {
          const reportTitle = exportPdfModalConfig.reportTitle;
          const unitName = exportPdfModalConfig.unitName;
          setExportPdfModalConfig(null);
          executePdfExport(
            reportTitle,
            unitName,
            filteredHeaders,
            filteredRows,
            undefined,
            orientation
          );
        }}
      />
    )}

    {appAlert && appAlert.isOpen && (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4 z-[99999]">
        <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-150 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center gap-3">
            {appAlert.type === "success" && (
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
                <Check className="w-5 h-5" />
              </div>
            )}
            {appAlert.type === "error" && (
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
            )}
            {appAlert.type === "info" && (
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
                <HelpCircle className="w-5 h-5" />
              </div>
            )}
            <h3 className="text-base font-black text-slate-800 uppercase tracking-wide">{appAlert.title}</h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed font-medium whitespace-pre-line">{appAlert.message}</p>
          <div className="flex justify-end pt-2">
            <button
              onClick={() => setAppAlert(null)}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
            >
              Đồng ý
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Popup Chào Mừng Cán Bộ Đăng Nhập Thành Công */}
    {welcomeModal && welcomeModal.isOpen && (
      <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-md flex justify-center items-center p-4 z-[999999] animate-in fade-in duration-200 select-none">
        <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-emerald-500/30 p-6 space-y-5 text-center relative">
          <div className="mx-auto w-20 h-20 rounded-full bg-transparent p-0 border-transparent shadow-lg flex items-center justify-center animate-bounce shrink-0">
            <img src={officialLogo} alt="Logo" className="w-full h-full object-cover" />
          </div>

          <div className="space-y-2">
            <span className="inline-block px-3 py-1 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-bold text-[10px] uppercase rounded-full tracking-wider shadow-2xs">
              {welcomeModal.role}
            </span>
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              Xin chào Cán bộ <span className="text-emerald-600 dark:text-emerald-400">{welcomeModal.fullName}</span>!
            </h2>
          </div>

          {/* Lời chúc năng động tươi mới hàng ngày */}
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 dark:from-emerald-950/50 dark:via-teal-950/50 dark:to-sky-950/50 rounded-2xl p-4 border border-emerald-200 dark:border-emerald-800/80 text-left space-y-2 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-spin-slow shrink-0" />
                Thông điệp năng động ngày mới
              </span>
            </div>
            <p className="text-xs text-slate-800 dark:text-slate-100 font-bold leading-relaxed">
              {getDailyWish(currentTime)}
            </p>
          </div>

          {/* Hiển thị ngày giờ thực tế thời gian thực */}
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-3.5 border border-slate-200/80 dark:border-slate-700/60 text-[11px] text-slate-600 dark:text-slate-300 space-y-2 text-left">
            <div className="flex justify-between items-center">
              <span>Đơn vị công tác:</span>
              <strong className="text-slate-800 dark:text-slate-100 font-bold">UBND Phường Bình Minh</strong>
            </div>
            <div className="flex justify-between items-center border-t border-slate-200/60 dark:border-slate-700/50 pt-1.5">
              <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Thời gian hệ thống:
              </span>
              <span className="text-emerald-700 dark:text-emerald-300 font-bold font-mono text-[11px]">
                {formatVietnameseDateTime(currentTime).fullStr}
              </span>
            </div>
            <div className="flex justify-between items-center border-t border-slate-200/60 dark:border-slate-700/50 pt-1.5">
              <span>Trạng thái kết nối:</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                Trực tuyến & Sẵn sàng
              </span>
            </div>
          </div>

          <button
            onClick={() => setWelcomeModal(null)}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black text-xs rounded-2xl shadow-lg hover:shadow-emerald-500/25 transition-all cursor-pointer uppercase tracking-wider flex items-center justify-center gap-2"
          >
            <span>Đóng & Bắt đầu làm việc</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    )}
  </>
  );
}
