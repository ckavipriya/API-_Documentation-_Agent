import { useState, useEffect } from "react";
import { 
  BarChart, 
  Bar, 
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from "recharts";
import { 
  Activity, 
  Shield, 
  Cpu, 
  Zap, 
  Layers, 
  Globe, 
  Lock, 
  Clock, 
  BarChart3, 
  TrendingUp,
  AlertCircle
} from "lucide-react";
import { Endpoint } from "../types";

interface ApiDashboardProps {
  endpointsCount: number;
  chunksCount: number;
  projectName: string;
  frameworkName: string;
  versionString: string;
  onTabChange: (tab: "endpoints" | "code" | "spec" | "versions") => void;
  activeRole: string;
  showToast: (text: string, type?: "success" | "error") => void;
  endpoints: Endpoint[];
}

interface AutomationRule {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
  type: "energy" | "water" | "system";
}

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  type: "info" | "success" | "warning";
  read: boolean;
}

export default function ApiDashboard({
  endpointsCount,
  chunksCount,
  projectName,
  frameworkName,
  versionString,
  onTabChange,
  activeRole,
  showToast,
  endpoints
}: ApiDashboardProps) {
  // Navigation tabs state matching bottom nav bar
  const [activeSubTab, setActiveSubTab] = useState<"dashboard" | "usage" | "automations" | "settings">("dashboard");

  // Appliance states
  const [hvacEnabled, setHvacEnabled] = useState(true);
  const [evChargerEnabled, setEvChargerEnabled] = useState(true);
  const [sprinklerEnabled, setSprinklerEnabled] = useState(false);

  // Peak saving window state
  const [isScheduled, setIsScheduled] = useState(false);

  // Notification drawer state
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    { id: "1", title: "EV Charging Active", message: "EV Charger drawing 7.4 kW at low tariff.", time: "10m ago", type: "info", read: false },
    { id: "2", title: "HVAC Optimizing", message: "Climate control set to energy efficiency mode.", time: "45m ago", type: "success", read: false },
    { id: "3", title: "Rain Predicted", message: "Scheduled sprinkler flow adjusted to preserve water.", time: "4h ago", type: "warning", read: true },
    { id: "4", title: "System Initialized", message: "EcoSync Smart Hub synced with hardware sensors.", time: "Yesterday", type: "success", read: true }
  ]);

  // Automations rules list state
  const [automations, setAutomations] = useState<AutomationRule[]>([
    { id: "1", title: "Peak-Rate EV Charger", description: "Delay high-draw vehicle charging until off-peak rates apply (11 PM - 5 AM).", enabled: true, type: "energy" },
    { id: "2", title: "Smart Climate Setback", description: "Slightly raise HVAC temperature target when nobody is home to save energy.", enabled: true, type: "energy" },
    { id: "3", title: "Rain Skipping Sequence", description: "Skip automated watering runs when precipitation probability exceeds 60%.", enabled: false, type: "water" },
    { id: "4", title: "Symmetrical Load Limit", description: "Cap maximum concurrent power draw of all appliances to 8.5 kW.", enabled: false, type: "system" }
  ]);

  // State for automation creator modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newRuleTitle, setNewRuleTitle] = useState("");
  const [newRuleDesc, setNewRuleDesc] = useState("");
  const [newRuleType, setNewRuleType] = useState<"energy" | "water" | "system">("energy");

  // Settings states
  const [tariffPlan, setTariffPlan] = useState("time-of-use");
  const [ecoTarget, setEcoTarget] = useState(85);
  const [sprinklerDuration, setSprinklerDuration] = useState(15);
  const [leakAlertsEnabled, setLeakAlertsEnabled] = useState(true);
  const [peakAlertsEnabled, setPeakAlertsEnabled] = useState(true);

  // Computed live metrics based on states
  const basePowerLoad = 3.8; // Base home consumption
  const currentPowerDraw = basePowerLoad + (hvacEnabled ? 1.2 : 0) + (evChargerEnabled ? 7.4 : 0);
  const currentWaterFlow = sprinklerEnabled ? 18.0 : 0.0;
  
  // Simulated cumulative counts
  const totalKwhToday = 12.4 + (hvacEnabled ? 1.8 : 0) + (evChargerEnabled ? 4.2 : 0);
  const totalLitersToday = 240 + (sprinklerEnabled ? 120 : 0);
  const calculatedEfficiency = Math.round(80 + (isScheduled ? 5 : 0) + (!hvacEnabled ? 5 : 0) + (tariffPlan === "time-of-use" ? 3 : 0));

  // Count unread notifications
  const unreadCount = notifications.filter(n => !n.read).length;

  const handleToggleNotification = () => {
    setIsNotificationOpen(!isNotificationOpen);
    if (!isNotificationOpen) {
      // Mark all as read when opening
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }
  };

  const handleClearNotifications = () => {
    setNotifications([]);
    showToast("Notifications cleared successfully", "success");
  };

  const handleToggleAppliance = (appliance: "hvac" | "ev" | "sprinkler") => {
    if (appliance === "hvac") {
      const next = !hvacEnabled;
      setHvacEnabled(next);
      showToast(`HVAC System: ${next ? "cooling active" : "standby mode"}`, "success");
    } else if (appliance === "ev") {
      const next = !evChargerEnabled;
      setEvChargerEnabled(next);
      showToast(`EV Charger: ${next ? "charging initiated" : "suspended"}`, "success");
    } else if (appliance === "sprinkler") {
      const next = !sprinklerEnabled;
      setSprinklerEnabled(next);
      showToast(`Smart Sprinkler: ${next ? "irrigation sequence started" : "shut off"}`, "success");
    }
  };

  const handleScheduleNow = () => {
    if (isScheduled) {
      setIsScheduled(false);
      showToast("Peak charging schedule cancelled", "success");
    } else {
      setIsScheduled(true);
      showToast("EV off-peak schedule configured successfully!", "success");
    }
  };

  const handleToggleRule = (id: string) => {
    setAutomations(prev => prev.map(rule => {
      if (rule.id === id) {
        const nextEnabled = !rule.enabled;
        showToast(`Rule "${rule.title}" has been ${nextEnabled ? "enabled" : "disabled"}`, "success");
        return { ...rule, enabled: nextEnabled };
      }
      return rule;
    }));
  };

  const handleCreateAutomation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleTitle.trim() || !newRuleDesc.trim()) {
      showToast("Please fill in all automation fields", "error");
      return;
    }

    const newRule: AutomationRule = {
      id: `rule-${Date.now()}`,
      title: newRuleTitle,
      description: newRuleDesc,
      enabled: true,
      type: newRuleType
    };

    setAutomations(prev => [...prev, newRule]);
    setIsModalOpen(false);
    setNewRuleTitle("");
    setNewRuleDesc("");
    showToast(`Automation "${newRule.title}" created successfully!`, "success");
  };

  const handleSaveSettings = () => {
    showToast("Project configuration saved successfully!", "success");
  };

  // Charts Mock Data
  const healthHistory = [
    { time: "10:30 AM", score: 98, status: "Healthy" },
    { time: "10:15 AM", score: 97, status: "Healthy" },
    { time: "10:00 AM", score: 99, status: "Healthy" },
    { time: "09:45 AM", score: 96, status: "Healthy" },
    { time: "09:30 AM", score: 98, status: "Healthy" },
  ];

  const activityData = [
    { day: "Mon", calls: 1200, latency: 45 },
    { day: "Tue", calls: 1900, latency: 52 },
    { day: "Wed", calls: 1500, latency: 48 },
    { day: "Thu", calls: 2100, latency: 61 },
    { day: "Fri", calls: 2400, latency: 55 },
    { day: "Sat", calls: 1800, latency: 42 },
    { day: "Sun", calls: 2200, latency: 50 },
  ];

  // 7x4 Heatmap Grid Data (intensity 0-4)
  const heatmapData = [
    [1, 2, 4, 3, 2, 1, 0], // Segment 1
    [2, 3, 4, 4, 3, 2, 1], // Segment 2
    [3, 4, 3, 2, 4, 3, 2], // Segment 3
    [1, 2, 3, 2, 1, 0, 1], // Segment 4
  ];

  const getIntensityColor = (intensity: number) => {
    switch (intensity) {
      case 0: return "bg-slate-100";
      case 1: return "bg-indigo-100";
      case 2: return "bg-indigo-300";
      case 3: return "bg-indigo-500";
      case 4: return "bg-indigo-700";
      default: return "bg-slate-100";
    }
  };

  const electricityChartData = [
    { name: "Mon", value: 14.2 },
    { name: "Tue", value: 15.6 },
    { name: "Wed", value: 11.2 },
    { name: "Thu", value: 13.8 },
    { name: "Fri", value: totalKwhToday },
    { name: "Sat", value: 8.5 },
    { name: "Sun", value: 9.1 },
  ];

  const waterChartData = [
    { name: "06:00", flow: 0 },
    { name: "08:00", flow: sprinklerEnabled ? 18 : 12 },
    { name: "10:00", flow: 0 },
    { name: "12:00", flow: 0 },
    { name: "14:00", flow: 0 },
    { name: "16:00", flow: 8 },
    { name: "18:00", flow: sprinklerEnabled ? 18 : 0 },
    { name: "20:00", flow: 0 },
  ];

  return (
    <div className="flex-1 bg-background text-on-background min-h-screen relative flex flex-col font-body pb-24" id="ecosync-app-root">
      
      {/* TopAppBar */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-6 py-4 bg-surface/80 backdrop-blur-md border-b border-outline-variant/10" id="ecosync-header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center overflow-hidden border border-outline-variant/20">
            <img 
              alt="User Profile" 
              className="w-full h-full object-cover" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBjxMOnCACfRz2yL9-MeupUG2jc3soaE1lMMF0X1j54ZanW6JW8cLcHhOkSV5VKMrKgIN89XvBG1mbIAVyEHKl5Wzc1lZeXPWa9ddm3Chlk7EjZk176UR8AMqBqeS47TWRODGtA3rKIKL8j0_lCIS7I3pZb19a0A74fZ19qfRdj6nfY3Ho04BaPY7xxMz1SQzqqhgfPhIEPYn_UKl20kCOGv5iOOoJ11OpRmYeJHywfmWBO8lsRpo1XoVE9dM6S8E3BIsH520HkDOmH"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="flex flex-col">
            <span className="font-headline font-black text-xl tracking-tight text-on-surface">EcoSync</span>
            <span className="text-[9px] font-bold uppercase tracking-widest text-primary font-sans">Hardware Hub</span>
          </div>
        </div>

        <button 
          onClick={handleToggleNotification}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container transition-all relative border border-outline-variant/10 text-on-surface"
          id="btn-notification"
        >
          <span className="material-symbols-outlined">notifications</span>
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-4.5 h-4.5 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-surface animate-bounce">
              {unreadCount}
            </span>
          )}
        </button>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-6 pt-8 w-full flex-1">
        
        {/* ==================== SUB-TAB 1: DASHBOARD VIEW ==================== */}
        {activeSubTab === "dashboard" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fadeIn" id="subtab-dashboard">
            
            {/* 1. Project Health Gauge (Circular Progress) */}
            <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center space-y-4">
              <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Resource Health</div>
              <div className="relative w-40 h-40">
                <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                  <circle 
                    className="text-slate-100" 
                    cx="50" 
                    cy="50" 
                    fill="transparent" 
                    r="40" 
                    stroke="currentColor" 
                    strokeWidth="8"
                  />
                  <circle 
                    className="text-primary-container transition-all duration-1000 ease-out" 
                    cx="50" 
                    cy="50" 
                    fill="transparent" 
                    r="40" 
                    stroke="currentColor" 
                    strokeWidth="8"
                    strokeDasharray="251.2" 
                    strokeDashoffset={251.2 - (251.2 * calculatedEfficiency) / 100}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-black text-slate-900">{calculatedEfficiency}%</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Score</span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                <TrendingUp className="w-3 h-3" />
                Optimal Status
              </div>

              <div className="w-full pt-4 space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Health History</h4>
                  <span className="text-[9px] font-bold text-primary">Last 5 Checks</span>
                </div>
                <div className="space-y-1.5">
                  {healthHistory.map((entry, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-slate-50/50 border border-slate-100/50 hover:bg-slate-50 transition-colors group/row">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-1.5 h-1.5 rounded-full ring-4 ring-white shadow-xs ${entry.score > 95 ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                        <span className="text-[11px] font-bold text-slate-600">{entry.time}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-black text-slate-900">{entry.score}%</span>
                        <span className={`text-[8px] font-extrabold uppercase tracking-tight px-1.5 py-0.5 rounded-md ${
                          entry.status === 'Healthy' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {entry.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 2. API Activity Trends (Line Chart) - Span 2 Columns */}
            <div className="md:col-span-2 p-6 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">API Activity Trends</h3>
                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Last 7 Days Throughput</p>
                </div>
                <Activity className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={activityData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="day" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }} 
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff' }}
                      itemStyle={{ color: 'var(--color-primary)' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="calls" 
                      stroke="var(--color-primary)" 
                      strokeWidth={3} 
                      dot={{ r: 4, fill: 'var(--color-primary)', strokeWidth: 2, stroke: '#fff' }}
                      activeDot={{ r: 6, fill: 'var(--color-primary)', strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Heatmap Grid Row */}
            <div className="md:col-span-3 p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Activity Intensity Matrix</h3>
                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">7-Day Hourly Throughput Heatmap</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm bg-slate-100"></div>
                    <span className="text-[8px] font-bold text-slate-400 uppercase">Low</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm bg-indigo-700"></div>
                    <span className="text-[8px] font-bold text-slate-400 uppercase">High</span>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-7 gap-3">
                {activityData.map((day, dayIdx) => (
                  <div key={day.day} className="flex flex-col gap-2">
                    <span className="text-[10px] font-black text-slate-400 text-center uppercase mb-1">{day.day}</span>
                    <div className="flex flex-col gap-2">
                      {heatmapData.map((row, rowIdx) => (
                        <div 
                          key={`${dayIdx}-${rowIdx}`}
                          className={`h-12 rounded-lg ${getIntensityColor(row[dayIdx])} transition-all duration-500 hover:scale-105 cursor-pointer relative group`}
                        >
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-[9px] font-black text-white bg-slate-900/50 px-1.5 py-0.5 rounded backdrop-blur-xs">
                              {row[dayIdx] * 25}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Endpoint Statistics Card */}
            <div className="p-6 bg-slate-900 rounded-2xl shadow-xl flex flex-col justify-between text-white overflow-hidden relative group">
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-white/10 rounded-lg">
                    <Globe className="w-4 h-4 text-sky-400" />
                  </div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Endpoint Summary</span>
                </div>
                <div className="space-y-4">
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-4xl font-black">{endpointsCount}</div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Total Routes</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-emerald-400">{endpoints.filter(e => !e.authRequired).length}</div>
                      <div className="text-[9px] font-bold text-slate-500 uppercase">Public</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute right-0 bottom-0 translate-x-1/4 translate-y-1/4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                <Globe className="w-32 h-32" />
              </div>
            </div>

            {/* 4. Code Chunks Card */}
            <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between group overflow-hidden relative">
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-indigo-50 rounded-lg">
                    <Layers className="w-4 h-4 text-indigo-600" />
                  </div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">ChromaDB Vector Index</span>
                </div>
                <div className="text-4xl font-black text-slate-900">{chunksCount}</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase mt-1">Processed Code Chunks</div>
              </div>
              <div className="mt-6 flex items-center gap-1.5 text-xs font-bold text-indigo-600">
                <Zap className="w-3.5 h-3.5 animate-pulse" />
                AST Extraction Active
              </div>
              <div className="absolute right-0 bottom-0 translate-x-1/4 translate-y-1/4 opacity-5 group-hover:scale-110 transition-transform duration-500">
                <Layers className="w-32 h-32" />
              </div>
            </div>

            {/* 5. Project Specs Card */}
            <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-amber-50 rounded-lg">
                    <Shield className="w-4 h-4 text-amber-600" />
                  </div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Compliance & Security</span>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-slate-50">
                    <span className="text-xs text-slate-500">Framework</span>
                    <span className="text-xs font-bold text-slate-800">{frameworkName}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-slate-50">
                    <span className="text-xs text-slate-500">Version</span>
                    <span className="text-xs font-bold text-slate-800">{versionString}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-xs text-slate-500">Auth Tier</span>
                    <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase">Bearer JWT</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 6. Quick Actions / Automation Status - Span 3 Columns */}
            <div className="md:col-span-3 p-8 rounded-3xl bg-indigo-600 text-white shadow-xl relative overflow-hidden group">
              <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="max-w-md">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-[10px] font-black uppercase tracking-widest mb-4">
                    <Cpu className="w-3 h-3" />
                    AI Reasoning Pipeline
                  </div>
                  <h4 className="text-2xl font-black tracking-tight">Active Project: {projectName}</h4>
                  <p className="text-sm opacity-80 mt-2 leading-relaxed">
                    Our RAG pipeline is currently indexing {chunksCount} chunks. You can now use the AI Chat Assistant to ask complex questions about your API architecture or generate client SDKs.
                  </p>
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={() => onTabChange("code")}
                    className="px-6 py-3 bg-white text-indigo-600 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg hover:scale-105 transition-transform"
                  >
                    View Source Code
                  </button>
                  <button 
                    onClick={() => onTabChange("spec")}
                    className="px-6 py-3 bg-indigo-500/50 text-white border border-white/20 font-black text-xs uppercase tracking-wider rounded-xl hover:bg-indigo-500/80 transition-all"
                  >
                    Export Spec
                  </button>
                </div>
              </div>
              <div className="absolute right-0 top-0 -translate-y-1/4 translate-x-1/4 opacity-10 group-hover:scale-110 transition-transform duration-700">
                <Zap className="w-96 h-96" />
              </div>
            </div>
          </div>
        )}

        {/* ==================== SUB-TAB 2: USAGE CHARTS VIEW ==================== */}
        {activeSubTab === "usage" && (
          <div className="space-y-8 animate-fadeIn" id="subtab-usage">
            <div className="flex flex-col gap-2">
              <h2 className="font-headline text-2xl font-black text-on-surface">API Analytics</h2>
              <p className="text-xs text-outline">Interactive reports of API throughput and system performance parameters.</p>
            </div>

            {/* Metric highlight bento block */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-outline-variant/15 shadow-3xs">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-outline">Weekly Success Rate</span>
                <span className="block font-headline text-2xl font-black text-primary mt-1">99.98%</span>
                <span className="text-[10px] font-medium text-primary block mt-1">Tier 1 availability met</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-outline-variant/15 shadow-3xs">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-outline">Avg Response Time</span>
                <span className="block font-headline text-2xl font-black text-on-surface mt-1">48ms / req</span>
                <span className="text-[10px] font-medium text-primary block mt-1">-12% latency reduction</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-outline-variant/15 shadow-3xs">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-outline">Total API Calls</span>
                <span className="block font-headline text-2xl font-black text-secondary mt-1">12.4k</span>
                <span className="text-[10px] font-medium text-secondary block mt-1">Standard load threshold</span>
              </div>
            </div>

            {/* Recharts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* API Activity Trend LineChart */}
              <div className="bg-white p-6 rounded-2xl border border-outline-variant/15 shadow-xs flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-on-surface">API Activity Trends</h3>
                    <p className="text-[11px] text-outline">Daily request volume over last 7 days</p>
                  </div>
                  <Activity className="w-4 h-4 text-primary" />
                </div>

                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={activityData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 10, fontWeight: "bold" }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 10, fontWeight: "bold" }} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-slate-900 text-white px-2.5 py-1.5 rounded-xl border border-slate-800 shadow-xl text-xs flex flex-col font-sans">
                                <span className="font-bold text-slate-400 text-[9px] uppercase">{payload[0].payload.day}</span>
                                <span className="font-black text-emerald-400 mt-0.5">{payload[0].value} calls</span>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="calls" 
                        stroke="var(--color-primary)" 
                        strokeWidth={3} 
                        dot={{ r: 4, fill: "var(--color-primary)", strokeWidth: 2, stroke: "#fff" }}
                        activeDot={{ r: 6, fill: "var(--color-primary)", strokeWidth: 0 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* API Latency AreaChart */}
              <div className="bg-white p-6 rounded-2xl border border-outline-variant/15 shadow-xs flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-on-surface">Response Latency Trends</h3>
                    <p className="text-[11px] text-outline">Average processing time in milliseconds</p>
                  </div>
                  <Clock className="w-4 h-4 text-secondary" />
                </div>

                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={activityData} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorLatencyUsage" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-secondary)" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="var(--color-secondary)" stopOpacity={0.0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 10, fontWeight: "bold" }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 10, fontWeight: "bold" }} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-slate-900 text-white px-2.5 py-1.5 rounded-xl border border-slate-800 shadow-xl text-xs flex flex-col font-sans">
                                <span className="font-bold text-slate-400 text-[9px] uppercase">{payload[0].payload.day}</span>
                                <span className="font-black text-sky-400 mt-0.5">{payload[0].value} ms</span>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="latency" 
                        stroke="var(--color-secondary)" 
                        strokeWidth={2.5}
                        fillOpacity={1} 
                        fill="url(#colorLatencyUsage)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ==================== SUB-TAB 3: AUTOMATIONS VIEW ==================== */}
        {activeSubTab === "automations" && (
          <div className="space-y-8 animate-fadeIn" id="subtab-automations">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="font-headline text-2xl font-black text-on-surface">API Automations</h2>
                <p className="text-xs text-outline">Configure responsive triggers and limits to optimize service load.</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="px-4 py-2.5 bg-primary text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:opacity-95 transition-all shadow-sm flex items-center gap-1"
                id="btn-add-automation"
              >
                <span className="material-symbols-outlined text-sm font-black">add</span>
                Create Rule
              </button>
            </div>

            {/* Automations list */}
            <div className="grid grid-cols-1 gap-4" id="automations-list">
              {automations.map(rule => (
                <div key={rule.id} className="bg-white p-5 rounded-2xl border border-outline-variant/15 shadow-3xs flex items-center justify-between gap-6 hover:shadow-2xs transition-all">
                  <div className="flex gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center border shrink-0 ${
                      rule.type === "energy" 
                        ? "bg-amber-50 text-amber-600 border-amber-100" 
                        : rule.type === "water"
                        ? "bg-indigo-50 text-indigo-600 border-indigo-100"
                        : "bg-emerald-50 text-emerald-600 border-emerald-100"
                    }`}>
                      <span className="material-symbols-outlined">
                        {rule.type === "energy" ? "bolt" : rule.type === "water" ? "water_drop" : "settings_input_component"}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-on-surface">{rule.title}</h4>
                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${
                          rule.type === "energy" 
                            ? "bg-amber-50 text-amber-700 border border-amber-100" 
                            : rule.type === "water"
                            ? "bg-indigo-50 text-indigo-700 border border-indigo-100"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                        }`}>
                          {rule.type}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">{rule.description}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleRule(rule.id)}
                    className={`w-12 h-6.5 rounded-full p-0.5 transition-all focus:outline-none relative shrink-0 ${
                      rule.enabled ? 'bg-primary' : 'bg-slate-300'
                    }`}
                  >
                    <div className={`bg-white w-5.5 h-5.5 rounded-full shadow-sm transform transition-transform ${
                      rule.enabled ? 'translate-x-5.5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==================== SUB-TAB 4: SETTINGS VIEW ==================== */}
        {activeSubTab === "settings" && (
          <div className="space-y-8 animate-fadeIn" id="subtab-settings">
            <div className="flex flex-col gap-1">
              <h2 className="font-headline text-2xl font-black text-on-surface">Configuration Panel</h2>
              <p className="text-xs text-outline">Manage billing preferences, usage thresholds, and service connections.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Form Config Fields */}
              <div className="bg-white p-6 rounded-2xl border border-outline-variant/15 shadow-xs md:col-span-2 space-y-6">
                <h3 className="font-headline text-sm font-bold text-on-surface border-b border-slate-100 pb-3 uppercase tracking-wider text-outline">API Workspace Rules</h3>
                
                {/* Billing Plan Selector */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-outline block">API Subscription Plan</label>
                  <select 
                    value={tariffPlan}
                    onChange={(e) => {
                      setTariffPlan(e.target.value);
                      showToast(`Subscription Tier set to ${e.target.value}`, "success");
                    }}
                    className="w-full text-xs p-3 border border-outline-variant/20 rounded-xl bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-slate-800 font-medium"
                  >
                    <option value="time-of-use">Developer Free Tier (Standard)</option>
                    <option value="flat">Professional Monthly (Fixed Rate)</option>
                    <option value="wholesale">Enterprise Pay-as-you-go (Metered)</option>
                  </select>
                </div>

                {/* Eco Target Range Slider */}
                <div className="space-y-3">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-[10px] font-black uppercase tracking-widest text-outline">Request Optimization Target</span>
                    <span className="text-primary font-headline text-sm">{ecoTarget}% Efficiency</span>
                  </div>
                  <input 
                    type="range" 
                    min="60" 
                    max="95" 
                    value={ecoTarget} 
                    onChange={(e) => setEcoTarget(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <span className="text-[10px] text-slate-400 block font-medium leading-normal">Optimizes endpoint caching and delays low-priority batch jobs based on load.</span>
                </div>

                {/* Sprinkler Run Duration Slider */}
                <div className="space-y-3">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-[10px] font-black uppercase tracking-widest text-outline">Cache TTL Settings</span>
                    <span className="text-secondary font-headline text-sm">{sprinklerDuration} mins / cycle</span>
                  </div>
                  <input 
                    type="range" 
                    min="5" 
                    max="30" 
                    value={sprinklerDuration} 
                    onChange={(e) => setSprinklerDuration(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-secondary"
                  />
                </div>

                {/* Notifications setup */}
                <div className="space-y-4 pt-3 border-t border-slate-100">
                  <span className="text-[10px] font-black uppercase tracking-widest text-outline block">Alert Notifications</span>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-on-surface block">Security Breach Alerts</span>
                      <span className="text-[10px] text-slate-400 font-medium">Alert immediately upon detection of persistent unauthorized access attempts.</span>
                    </div>
                    <button
                      onClick={() => {
                        setLeakAlertsEnabled(!leakAlertsEnabled);
                        showToast(`Security alerts ${!leakAlertsEnabled ? 'enabled' : 'disabled'}`, "success");
                      }}
                      className={`w-9 h-5 rounded-full p-0.5 transition-all focus:outline-none relative ${
                        leakAlertsEnabled ? 'bg-primary' : 'bg-slate-300'
                      }`}
                    >
                      <div className={`bg-white w-4 h-4 rounded-full shadow-xs transform transition-transform ${
                        leakAlertsEnabled ? 'translate-x-4' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-on-surface block">High Latency Alerts</span>
                      <span className="text-[10px] text-slate-400 font-medium">Ping when response times exceed 150ms thresholds.</span>
                    </div>
                    <button
                      onClick={() => {
                        setPeakAlertsEnabled(!peakAlertsEnabled);
                        showToast(`Latency alerts ${!peakAlertsEnabled ? 'enabled' : 'disabled'}`, "success");
                      }}
                      className={`w-9 h-5 rounded-full p-0.5 transition-all focus:outline-none relative ${
                        peakAlertsEnabled ? 'bg-primary' : 'bg-slate-300'
                      }`}
                    >
                      <div className={`bg-white w-4 h-4 rounded-full shadow-xs transform transition-transform ${
                        peakAlertsEnabled ? 'translate-x-4' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>
                </div>

                <button 
                  onClick={handleSaveSettings}
                  className="w-full py-3 bg-slate-900 text-white font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-slate-800 transition shadow-sm"
                >
                  Save Workspace Configurations
                </button>
              </div>

              {/* Sidebar Info Panels */}
              <div className="space-y-6">
                
                {/* Hardware Sync Info */}
                <div className="bg-white p-6 rounded-2xl border border-outline-variant/15 shadow-xs space-y-4">
                  <h3 className="font-headline text-xs font-bold text-on-surface uppercase tracking-wider text-outline">Service Health</h3>
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Authentication Service</span>
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-md">Online</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Database Cluster</span>
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-md">Synced</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">RAG Pipeline</span>
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-md">Connected</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Vector Index</span>
                      <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-md">Indexing</span>
                    </div>
                  </div>
                </div>

                {/* Parent App Sync (Codebase Sync) */}
                <div className="bg-indigo-950 p-6 rounded-2xl text-white space-y-3 relative overflow-hidden shadow-sm">
                  <h3 className="font-headline text-xs font-bold uppercase tracking-wider text-indigo-300">Codebase Telemetry</h3>
                  <p className="text-[11px] text-indigo-100/90 leading-relaxed">
                    API workspace is synced with parent developer environment: <b>{projectName || "API Workspace"}</b>.
                  </p>
                  <div className="pt-2 border-t border-white/10 space-y-1 text-[11px] font-mono text-indigo-200">
                    <div>Endpoints tracked: {endpointsCount || 12}</div>
                    <div>Source Chunks: {chunksCount || 120}</div>
                    <div>Schema Version: {versionString || "v1.1.0"}</div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

      </main>

      {/* BOTTOM NAVIGATION BAR */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-surface/90 backdrop-blur-xl px-6 py-3 border-t border-outline-variant/15" id="api-bottom-nav">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <button 
            onClick={() => setActiveSubTab("dashboard")}
            className={`flex flex-col items-center gap-1 transition-all focus:outline-none ${
              activeSubTab === "dashboard" ? "text-primary scale-105" : "text-outline hover:text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: `'FILL' ${activeSubTab === "dashboard" ? 1 : 0}` }}>
              dashboard
            </span>
            <span className="text-[9px] font-black uppercase tracking-widest">Dashboard</span>
          </button>

          <button 
            onClick={() => setActiveSubTab("usage")}
            className={`flex flex-col items-center gap-1 transition-all focus:outline-none ${
              activeSubTab === "usage" ? "text-primary scale-105" : "text-outline hover:text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: `'FILL' ${activeSubTab === "usage" ? 1 : 0}` }}>
              bar_chart
            </span>
            <span className="text-[9px] font-black uppercase tracking-widest">Usage</span>
          </button>

          <button 
            onClick={() => setActiveSubTab("automations")}
            className={`flex flex-col items-center gap-1 transition-all focus:outline-none ${
              activeSubTab === "automations" ? "text-primary scale-105" : "text-outline hover:text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: `'FILL' ${activeSubTab === "automations" ? 1 : 0}` }}>
              settings_input_component
            </span>
            <span className="text-[9px] font-black uppercase tracking-widest">Automations</span>
          </button>

          <button 
            onClick={() => setActiveSubTab("settings")}
            className={`flex flex-col items-center gap-1 transition-all focus:outline-none ${
              activeSubTab === "settings" ? "text-primary scale-105" : "text-outline hover:text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: `'FILL' ${activeSubTab === "settings" ? 1 : 0}` }}>
              settings
            </span>
            <span className="text-[9px] font-black uppercase tracking-widest">Settings</span>
          </button>
        </div>
      </nav>

      {/* NOTIFICATION SLIDE DRAWER */}
      {isNotificationOpen && (
        <div className="fixed inset-0 z-50 flex justify-end" id="drawer-notifications">
          {/* Backdrop overlay */}
          <div 
            className="absolute inset-0 bg-black/45 backdrop-blur-xs transition-opacity"
            onClick={() => setIsNotificationOpen(false)}
          />
          
          {/* Drawer Panel */}
          <div className="relative w-full max-w-sm bg-white h-full shadow-2xl flex flex-col z-10 border-l border-outline-variant/10 animate-slideLeft">
            <div className="p-4 border-b border-outline-variant/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">notifications</span>
                <span className="font-headline font-black text-base text-on-surface">Event Logs & Alerts</span>
              </div>
              <div className="flex items-center gap-2">
                {notifications.length > 0 && (
                  <button 
                    onClick={handleClearNotifications}
                    className="text-[10px] font-extrabold uppercase text-red-500 hover:underline px-2 py-1"
                  >
                    Clear Logs
                  </button>
                )}
                <button 
                  onClick={() => setIsNotificationOpen(false)}
                  className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-outline"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 no-scrollbar">
              {notifications.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 p-6 space-y-3">
                  <span className="material-symbols-outlined text-4xl opacity-35">notifications_off</span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 uppercase">Logs Empty</h4>
                    <p className="text-[10px] text-slate-400 mt-1">Active alerts and routine device events are empty.</p>
                  </div>
                </div>
              ) : (
                notifications.map(item => (
                  <div key={item.id} className="p-3.5 rounded-xl border border-outline-variant/15 bg-slate-50/50 flex gap-3 hover:bg-slate-50 transition-colors">
                    <div className={`w-8.5 h-8.5 rounded-lg border flex items-center justify-center shrink-0 ${
                      item.type === "success" 
                        ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
                        : item.type === "warning"
                        ? "bg-amber-50 text-amber-600 border-amber-100"
                        : "bg-blue-50 text-blue-600 border-blue-100"
                    }`}>
                      <span className="material-symbols-outlined text-lg">
                        {item.type === "success" ? "check_circle" : item.type === "warning" ? "warning" : "info"}
                      </span>
                    </div>
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex justify-between items-baseline gap-1.5">
                        <h4 className="text-xs font-bold text-on-surface truncate">{item.title}</h4>
                        <span className="text-[8px] text-slate-400 font-mono shrink-0">{item.time}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-normal">{item.message}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* AUTOMATION CREATOR MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs" id="modal-automation">
          <div className="bg-white rounded-3xl max-w-md w-full border border-outline-variant/10 shadow-2xl overflow-hidden animate-zoomIn">
            <div className="p-5 border-b border-outline-variant/10 flex items-center justify-between bg-slate-50">
              <span className="font-headline font-black text-base text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">settings_input_component</span>
                Create Smart Rule
              </span>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center text-outline"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateAutomation} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-outline block">Rule Heading</label>
                <input 
                  type="text" 
                  value={newRuleTitle}
                  onChange={(e) => setNewRuleTitle(e.target.value)}
                  placeholder="e.g. High latency trigger"
                  className="w-full text-xs p-3 border border-outline-variant/20 rounded-xl bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-slate-800 font-medium"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-outline block">Description & Logic</label>
                <textarea 
                  value={newRuleDesc}
                  onChange={(e) => setNewRuleDesc(e.target.value)}
                  placeholder="Describe the service sequence trigger and parameters..."
                  rows={3}
                  className="w-full text-xs p-3 border border-outline-variant/20 rounded-xl bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-slate-800 font-medium"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-outline block">Trigger Classification</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewRuleType("energy")}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1 transition ${
                      newRuleType === "energy" 
                        ? "bg-amber-50 text-amber-700 border-amber-300"
                        : "bg-slate-50 text-slate-500 border-outline-variant/10 hover:bg-slate-100"
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">bolt</span>
                    <span>Load</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewRuleType("water")}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1 transition ${
                      newRuleType === "water" 
                        ? "bg-indigo-50 text-indigo-700 border-indigo-300"
                        : "bg-slate-50 text-slate-500 border-outline-variant/10 hover:bg-slate-100"
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">speed</span>
                    <span>Latency</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewRuleType("system")}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1 transition ${
                      newRuleType === "system" 
                        ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                        : "bg-slate-50 text-slate-500 border-outline-variant/10 hover:bg-slate-100"
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">security</span>
                    <span>Security</span>
                  </button>
                </div>
              </div>

              <div className="pt-4 flex gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 border border-outline-variant/20 rounded-xl text-xs font-bold uppercase tracking-wider text-outline hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-primary text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:opacity-95 transition shadow-sm"
                >
                  Create Automation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
