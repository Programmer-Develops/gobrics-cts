"use client";

import React, { useState, useEffect } from "react";
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  signInWithCustomToken,
} from "firebase/auth";
import {
  LayoutDashboard,
  KanbanSquare,
  Trophy,
  CalendarDays,
  LineChart,
  Settings,
  Plus,
  Search,
  ShieldCheck,
  Users,
  ChevronRight,
  Lock,
  Cloud,
  Loader2,
  X,
  Trash2,
} from "lucide-react";

// --- Firebase Initialization ---
let app, auth, db, appId;
try {
  const configStr =
    typeof __firebase_config !== "undefined" ? __firebase_config : null;
  const firebaseConfig = configStr ? JSON.parse(configStr) : null;
  if (firebaseConfig && firebaseConfig.apiKey) {
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app);
  }
  appId = typeof __app_id !== "undefined" ? __app_id : "gobrics-default-app";
} catch (e) {
  console.error("Firebase init error", e);
}

// Authorized Admins for Role-Based Access
const ADMIN_IDS = ["@xylanxd", "@abhinandan11_sharma", "@Jk_laer", "@gojo_sen_sei", "@IamSumit45", "@Ak47ocean", "@shantanupandya"];

export default function UnifiedWorkspace() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("tasks");
  const [isLoaded, setIsLoaded] = useState(false);
  const [role, setRole] = useState("guest"); // 'guest', 'team', 'admin'
  const [authId, setAuthId] = useState("");

  // Data States
  const [tasks, setTasks] = useState([]);
  const [leads, setLeads] = useState([]);
  const [content, setContent] = useState([]);
  const [gbpStats, setGbpStats] = useState([]);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState("");
  const [modalContext, setModalContext] = useState("");
  const [formData, setFormData] = useState({});

  // Toast
  const [toast, setToast] = useState(null);
  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // --- Auth & Data Fetching ---
  useEffect(() => {
    if (!auth || !db) {
      setTimeout(() => setIsLoaded(true), 0);
      return;
    }

    let unsubscribeSnapshot = null;

    const setupAuthAndData = async () => {
      try {
        if (typeof __initial_auth_token !== "undefined" && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth error:", err);
      }
    };
    setupAuthAndData();

    const authUnsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // FIXED DATABASE PATH: Safely follows the strictly required /public/data/ format
        const dataRef = doc(db, "artifacts", appId, "public", "data", "unified_workspace", "main");
        
        unsubscribeSnapshot = onSnapshot(dataRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            setTasks(data.tasks || []);
            setLeads(data.leads || []);
            setContent(data.content || []);
            setGbpStats(data.gbpStats || []);
          } else {
            // Seed initial data if the database is completely empty
            const defaultData = {
              tasks: [
                { id: 1, title: "Task O12 Handover", status: "In Progress", team: "01_Team", assignee: "@shantanu" },
                { id: 2, title: "Task S02 Scripts", status: "Done", team: "03_Team", assignee: "@priya" },
              ],
              leads: [
                { id: 1, name: "Prana Studios", stage: "Negotiating", product: "Kavach Shield OM", value: 800 },
                { id: 2, name: "Wellness Inc", stage: "New", product: "Vastu Pyramids", value: 2200 },
              ],
              content: [
                { id: 1, title: "Shungite SEO Post", platform: "LinkedIn", date: "2026-06-10", status: "Scheduled" },
                { id: 2, title: "B2B Promo Video", platform: "Instagram", date: "2026-06-12", status: "Drafting" },
              ],
              gbpStats: [
                { team: "01_Team", tasks: 15, gbp: 1250 },
                { team: "02_Team", tasks: 8, gbp: 800 },
              ],
            };
            setDoc(dataRef, defaultData).catch(err => console.error("Error seeding DB:", err));
          }
          setIsLoaded(true);
        }, (err) => {
          console.error("Snapshot error (Check DB Paths):", err);
          setIsLoaded(true);
        });
      }
    });

    return () => {
      authUnsubscribe();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    const id = authId.trim().toLowerCase();
    if (ADMIN_IDS.includes(id)) {
      setRole("admin");
      showToast("Logged in as Workspace Admin");
    } else if (id.startsWith("@")) {
      setRole("team");
      showToast("Logged in as Team Member");
    } else {
      showToast("Invalid ID format. Use @username");
    }
  };

  const saveData = async (key, newData) => {
    // SECURITY GATE: Teams cannot edit GBP. Only Admins.
    if (role === "guest") {
      showToast("Permission Denied");
      return;
    }
    if (role === "team" && key === "gbpStats") {
      showToast("Permission Denied: Admins Only");
      return;
    }
    if (!user) {
      showToast("Cloud connection error. Refresh page.");
      return;
    }

    try {
      // FIXED DATABASE PATH
      const dataRef = doc(db, "artifacts", appId, "public", "data", "unified_workspace", "main");
      await setDoc(
        dataRef,
        {
          tasks,
          leads,
          content,
          gbpStats,
          [key]: newData,
          lastUpdated: serverTimestamp(),
        },
        { merge: true },
      );
      showToast("Saved to Cloud.");
    } catch (e) {
      console.error(e);
      showToast("Error saving data.");
    }
  };

  // --- Collaborative Update Handlers ---
  const handleUpdateStatus = (type, id, field, newValue) => {
    if (type === "tasks") {
      const updated = tasks.map((t) => t.id === id ? { ...t, [field]: newValue } : t);
      setTasks(updated);
      saveData("tasks", updated);
    } else if (type === "leads") {
      const updated = leads.map((l) => l.id === id ? { ...l, [field]: newValue } : l);
      setLeads(updated);
      saveData("leads", updated);
    } else if (type === "content") {
      const updated = content.map((c) => c.id === id ? { ...c, [field]: newValue } : c);
      setContent(updated);
      saveData("content", updated);
    }
  };

  const handleDelete = (type, id) => {
    if (role !== "admin") {
      showToast("Only Admins can delete records.");
      return;
    }
    if (type === "tasks") {
      const updated = tasks.filter((t) => t.id !== id);
      setTasks(updated);
      saveData("tasks", updated);
    } else if (type === "leads") {
      const updated = leads.filter((l) => l.id !== id);
      setLeads(updated);
      saveData("leads", updated);
    } else if (type === "content") {
      const updated = content.filter((c) => c.id !== id);
      setContent(updated);
      saveData("content", updated);
    }
  };

  const handleModalSubmit = (e) => {
    e.preventDefault();
    if (modalType === "task") {
      const updatedData = [
        ...tasks,
        {
          id: Date.now(),
          title: formData.title || "Untitled",
          status: modalContext,
          team: formData.team || authId,
          assignee: formData.assignee || authId,
        },
      ];
      setTasks(updatedData);
      saveData("tasks", updatedData);
    } else if (modalType === "lead") {
      const updatedData = [
        ...leads,
        {
          id: Date.now(),
          name: formData.name || "Unknown",
          stage: modalContext,
          product: formData.product || "TBD",
          value: Number(formData.value) || 0,
        },
      ];
      setLeads(updatedData);
      saveData("leads", updatedData);
    } else if (modalType === "content") {
      const updatedData = [
        ...content,
        {
          id: Date.now(),
          title: formData.title || "Untitled",
          platform: formData.platform || "General",
          date: formData.date || "TBD",
          status: formData.status || "Drafting",
        },
      ];
      setContent(updatedData);
      saveData("content", updatedData);
    } else if (modalType === "gbp") {
      const updatedData = [
        ...gbpStats,
        {
          team: formData.team || "New Team",
          tasks: Number(formData.tasks) || 0,
          gbp: Number(formData.gbp) || 0,
        },
      ];
      setGbpStats(updatedData);
      saveData("gbpStats", updatedData);
    }
    setIsModalOpen(false);
  };

  // --- UI Render Functions ---
  const renderSidebar = () => (
    <div className="w-64 bg-slate-900 text-slate-300 flex flex-col h-screen shrink-0 border-r border-slate-800">
      <div className="p-6 border-b border-slate-800 flex items-center gap-3">
        <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.3)]">
          <LayoutDashboard className="w-5 h-5 text-black" />
        </div>
        <h1 className="text-white font-bold tracking-wide">Unified Ops</h1>
      </div>

      <div className="p-4 space-y-1 flex-1">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 px-3">
          Cross-Team Hub
        </p>
        {[
          { id: "tasks", icon: KanbanSquare, label: "Task Tracking" },
          { id: "gbp", icon: Trophy, label: "GBP Recording" },
          { id: "content", icon: CalendarDays, label: "Content Schedule" },
          { id: "sales", icon: LineChart, label: "Sales Pipeline" },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
              activeTab === item.id
                ? "bg-blue-600 text-white shadow-md"
                : "hover:bg-slate-800 hover:text-white"
            }`}
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium text-sm">{item.label}</span>
          </button>
        ))}
      </div>

      <div className="p-6 border-t border-slate-800 bg-slate-900/50">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
            {role === "admin" ? (
              <ShieldCheck className="w-5 h-5 text-amber-500" />
            ) : (
              <Users className="w-5 h-5 text-slate-400" />
            )}
          </div>
          <div>
            <p className="text-sm font-bold text-white">
              {authId || "Not Logged In"}
            </p>
            <p className="text-xs text-slate-500 capitalize">{role} Access</p>
          </div>
        </div>
        {role !== "guest" && (
          <button
            onClick={() => {
              setRole("guest");
              setAuthId("");
            }}
            className="text-xs text-slate-400 hover:text-white w-full text-left px-1"
          >
            Sign out
          </button>
        )}
      </div>
    </div>
  );

  const renderTopbar = () => (
    <div className="h-20 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-10">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 capitalize">
          {activeTab.replace("_", " ")}
        </h2>
        <p className="text-sm text-slate-500 flex items-center gap-2">
          Task O12 Integration <ChevronRight className="w-3 h-3" />{" "}
          <span className="text-emerald-600 flex items-center gap-1">
            <Cloud className="w-3 h-3" /> Live Sync
          </span>
        </p>
      </div>
      {role === "admin" ? (
        <div className="bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 border border-amber-200">
          <Settings className="w-4 h-4" /> Admin Mode
        </div>
      ) : (
        <div className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 border border-blue-200">
          <Users className="w-4 h-4" /> Team Mode
        </div>
      )}
    </div>
  );

  // --- Collaborative Views ---
  const renderTaskTrackingView = () => (
    <div className="p-8">
      <div className="flex gap-6 overflow-x-auto pb-4 h-[calc(100vh-140px)]">
        {["To Do", "In Progress", "Review", "Done"].map((status) => (
          <div
            key={status}
            className="w-80 shrink-0 bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col h-full"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-700">{status}</h3>
              <span className="bg-slate-200 text-slate-600 text-xs px-2 py-1 rounded-full font-semibold">
                {tasks.filter((t) => t.status === status).length}
              </span>
            </div>
            <div className="space-y-3 flex-1 overflow-y-auto">
              {tasks
                .filter((t) => t.status === status)
                .map((task) => (
                  <div
                    key={task.id}
                    className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 group relative"
                  >
                    {role === "admin" && (
                      <button
                        onClick={() => handleDelete("tasks", task.id)}
                        className="absolute top-3 right-3 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <h4 className="font-semibold text-slate-800 mb-3 pr-6">
                      {task.title}
                    </h4>
                    <div className="flex justify-between items-center text-xs text-slate-500 mb-3">
                      <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-md">
                        {task.team}
                      </span>
                      <span>{task.assignee}</span>
                    </div>
                    {/* COLLABORATIVE STATUS DROPDOWN */}
                    <select
                      value={task.status}
                      onChange={(e) =>
                        handleUpdateStatus("tasks", task.id, "status", e.target.value)
                      }
                      className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-700 font-bold px-2 py-2 rounded-lg outline-none cursor-pointer hover:bg-slate-100"
                    >
                      <option value="To Do">Move to: To Do</option>
                      <option value="In Progress">Move to: In Progress</option>
                      <option value="Review">Move to: Review</option>
                      <option value="Done">Move to: Done</option>
                    </select>
                  </div>
                ))}
            </div>
            {/* ANYONE CAN ADD A TASK */}
            <button
              onClick={() => {
                setModalType("task");
                setModalContext(status);
                setIsModalOpen(true);
              }}
              className="w-full py-2.5 mt-3 flex items-center justify-center gap-2 text-slate-500 bg-white hover:text-slate-800 hover:bg-slate-100 rounded-xl text-sm border border-dashed border-slate-300 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" /> Add Task
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  const renderSalesPipelineView = () => (
    <div className="p-8">
      <div className="flex gap-6 overflow-x-auto pb-4 h-[calc(100vh-140px)]">
        {["New", "Contacted", "Negotiating", "Closed Won"].map((stage) => (
          <div
            key={stage}
            className="w-80 shrink-0 bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col h-full"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-700">{stage}</h3>
              <span className="bg-slate-200 text-slate-600 text-xs px-2 py-1 rounded-full font-semibold">
                {leads.filter((l) => l.stage === stage).length}
              </span>
            </div>
            <div className="space-y-3 flex-1 overflow-y-auto">
              {leads
                .filter((l) => l.stage === stage)
                .map((lead) => (
                  <div
                    key={lead.id}
                    className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 border-l-4 border-l-amber-500 relative group"
                  >
                    {role === "admin" && (
                      <button
                        onClick={() => handleDelete("leads", lead.id)}
                        className="absolute top-3 right-3 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <h4 className="font-bold text-slate-800 pr-6">
                      {lead.name}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 mb-3">
                      {lead.product}
                    </p>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm font-bold text-emerald-600">
                        ₹{lead.value}
                      </span>
                    </div>
                    <select
                      value={lead.stage}
                      onChange={(e) =>
                        handleUpdateStatus("leads", lead.id, "stage", e.target.value)
                      }
                      className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-700 font-bold px-2 py-2 rounded-lg outline-none cursor-pointer hover:bg-slate-100"
                    >
                      <option value="New">Stage: New</option>
                      <option value="Contacted">Stage: Contacted</option>
                      <option value="Negotiating">Stage: Negotiating</option>
                      <option value="Closed Won">Stage: Closed Won</option>
                    </select>
                  </div>
                ))}
            </div>
            <button
              onClick={() => {
                setModalType("lead");
                setModalContext(stage);
                setIsModalOpen(true);
              }}
              className="w-full py-2.5 mt-3 flex items-center justify-center gap-2 text-slate-500 bg-white hover:text-slate-800 hover:bg-slate-100 rounded-xl text-sm border border-dashed border-slate-300 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" /> Add Lead
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  const renderContentScheduleView = () => (
    <div className="p-8 max-w-5xl">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-bold text-slate-800">
          Content Calendar Tracker
        </h3>
        <button
          onClick={() => {
            setModalType("content");
            setIsModalOpen(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-blue-700 shadow-sm"
        >
          <Plus className="w-4 h-4" /> Add Post
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
            <tr>
              <th className="p-4">Content Title</th>
              <th className="p-4">Platform</th>
              <th className="p-4">Publish Date</th>
              <th className="p-4">Status</th>
              <th className="p-4 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {content.map((c) => (
              <tr
                key={c.id}
                className="hover:bg-slate-50 transition-colors group"
              >
                <td className="p-4 font-medium text-slate-800">{c.title}</td>
                <td className="p-4 text-sm text-slate-600">{c.platform}</td>
                <td className="p-4 text-sm text-slate-600">{c.date}</td>
                <td className="p-4">
                  <select
                    value={c.status}
                    onChange={(e) =>
                      handleUpdateStatus("content", c.id, "status", e.target.value)
                    }
                    className={`text-xs px-2.5 py-1.5 rounded-lg font-bold outline-none cursor-pointer border ${c.status === "Scheduled" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-amber-50 border-amber-200 text-amber-700"}`}
                  >
                    <option value="Drafting">Drafting</option>
                    <option value="Scheduled">Scheduled</option>
                  </select>
                </td>
                <td className="p-4">
                  {role === "admin" && (
                    <button
                      onClick={() => handleDelete("content", c.id)}
                      className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderGbpView = () => (
    <div className="p-8 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" /> Master GBP Leaderboard
        </h3>
        {role === "admin" && (
          <button
            onClick={() => {
              setModalType("gbp");
              setIsModalOpen(true);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-blue-700 shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add Record
          </button>
        )}
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="space-y-3">
          {gbpStats.length === 0 && (
            <p className="text-slate-400 text-center py-4">
              No GBP data recorded yet.
            </p>
          )}
          {gbpStats
            .sort((a, b) => b.gbp - a.gbp)
            .map((stat, idx) => (
              <div
                key={idx}
                className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100 transition-colors group"
              >
                <span className="font-bold text-slate-800">
                  #{idx + 1} {stat.team}
                </span>
                <div className="text-right flex items-center gap-4">
                  <div>
                    <span className="block font-bold text-emerald-600">
                      {stat.gbp} GBP
                    </span>
                    <span className="text-xs text-slate-500">
                      {stat.tasks} Tasks Completed
                    </span>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );

  // --- Creation Modal ---
  const renderCreationModal = () => {
    if (!isModalOpen) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden">
          <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 capitalize">
              <Plus className="w-5 h-5 text-blue-600" /> Add {modalType}
            </h3>
            <button
              onClick={() => setIsModalOpen(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleModalSubmit} className="p-6 space-y-4">
            {modalType === "task" && (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    Task Title
                  </label>
                  <input
                    type="text"
                    required
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="e.g. Audit Vendor Report"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      Assigned Team
                    </label>
                    <input
                      type="text"
                      required
                      onChange={(e) =>
                        setFormData({ ...formData, team: e.target.value })
                      }
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="e.g. 01_Team"
                      defaultValue={role === "team" ? authId : ""}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      Assignee
                    </label>
                    <input
                      type="text"
                      required
                      onChange={(e) =>
                        setFormData({ ...formData, assignee: e.target.value })
                      }
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="@username"
                      defaultValue={authId}
                    />
                  </div>
                </div>
              </>
            )}

            {modalType === "lead" && (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    Company/Lead Name
                  </label>
                  <input
                    type="text"
                    required
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="e.g. Wellness Inc."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      Product
                    </label>
                    <input
                      type="text"
                      required
                      onChange={(e) =>
                        setFormData({ ...formData, product: e.target.value })
                      }
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="e.g. Shungite Pyramid"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      Value (₹)
                    </label>
                    <input
                      type="number"
                      required
                      onChange={(e) =>
                        setFormData({ ...formData, value: e.target.value })
                      }
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="5000"
                    />
                  </div>
                </div>
              </>
            )}

            {modalType === "content" && (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    Content Title
                  </label>
                  <input
                    type="text"
                    required
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="e.g. Instagram Reel #1"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      Platform
                    </label>
                    <input
                      type="text"
                      required
                      onChange={(e) =>
                        setFormData({ ...formData, platform: e.target.value })
                      }
                      className="w-full px-3 py-2 border rounded-lg text-sm outline-none"
                      placeholder="LinkedIn"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      required
                      onChange={(e) =>
                        setFormData({ ...formData, date: e.target.value })
                      }
                      className="w-full px-3 py-2 border rounded-lg text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      Status
                    </label>
                    <select
                      onChange={(e) =>
                        setFormData({ ...formData, status: e.target.value })
                      }
                      className="w-full px-3 py-2 border rounded-lg text-sm outline-none"
                    >
                      <option value="Drafting">Drafting</option>
                      <option value="Scheduled">Scheduled</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {modalType === "gbp" && (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    Team Name
                  </label>
                  <input
                    type="text"
                    required
                    onChange={(e) =>
                      setFormData({ ...formData, team: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="e.g. 05_Team_Omega"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      Total Tasks Completed
                    </label>
                    <input
                      type="number"
                      required
                      onChange={(e) =>
                        setFormData({ ...formData, tasks: e.target.value })
                      }
                      className="w-full px-3 py-2 border rounded-lg outline-none"
                      placeholder="10"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      Total GBP
                    </label>
                    <input
                      type="number"
                      required
                      onChange={(e) =>
                        setFormData({ ...formData, gbp: e.target.value })
                      }
                      className="w-full px-3 py-2 border rounded-lg outline-none"
                      placeholder="1500"
                    />
                  </div>
                </div>
              </>
            )}
            <button
              type="submit"
              className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors mt-6 shadow-sm"
            >
              Create & Save
            </button>
          </form>
        </div>
      </div>
    );
  };

  if (!isLoaded)
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex text-slate-900 overflow-hidden relative">
      {role === "guest" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full border border-slate-200">
            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Lock className="w-8 h-8 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-center mb-2">
              Workspace Login
            </h2>
            <p className="text-slate-500 text-center text-sm mb-8">
              Enter your Team or Admin Telegram ID to access the unified
              GO-BRICS workspace.
            </p>
            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="text"
                value={authId}
                onChange={(e) => setAuthId(e.target.value)}
                placeholder="@username"
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
              <button
                type="submit"
                className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 transition-colors"
              >
                Authenticate Access
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {renderSidebar()}

      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50/50">
        {renderTopbar()}
        <main className="flex-1 overflow-y-auto">
          {activeTab === "tasks" && renderTaskTrackingView()}
          {activeTab === "gbp" && renderGbpView()}
          {activeTab === "content" && renderContentScheduleView()}
          {activeTab === "sales" && renderSalesPipelineView()}
        </main>
      </div>

      {renderCreationModal()}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-6 py-3 rounded-xl shadow-2xl text-sm font-medium animate-in slide-in-from-bottom-5 z-[60]">
          {toast}
        </div>
      )}
    </div>
  );
}