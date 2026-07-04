import { useState, useEffect, useRef } from "react";
import { 
  FileCode, 
  Terminal, 
  Folder, 
  Layers, 
  Bot, 
  History, 
  Download, 
  Play, 
  Plus, 
  Trash2, 
  Check, 
  AlertCircle, 
  User, 
  Edit, 
  ChevronRight, 
  ChevronDown,
  HelpCircle, 
  Sparkles, 
  Code, 
  Cpu, 
  RefreshCw, 
  Save, 
  FileText,
  UserCheck,
  Maximize2,
  X,
  Search
} from "lucide-react";
import { UserRole, Project, Endpoint, ChatMessage, DocumentVersion, CodeFile } from "./types";
import ApiDashboard from "./components/ApiDashboard";
import { FoldableCodeEditor } from "./components/FoldableCodeEditor";
import { TestEndpointModal } from "./components/TestEndpointModal";

export default function App() {
  // Authentication & Roles state
  const [currentUser, setCurrentUser] = useState<string>("u-1");
  const [activeRole, setActiveRole] = useState<UserRole>(UserRole.DEVELOPER);
  const [users, setUsers] = useState<any[]>([]);

  // Project state
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [activeEndpoints, setActiveEndpoints] = useState<Endpoint[]>([]);
  const [activeVersions, setActiveVersions] = useState<DocumentVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<DocumentVersion | null>(null);
  const [selectedEndpointIds, setSelectedEndpointIds] = useState<Set<string>>(new Set());

  // UI Navigation Tabs
  const [activeTab, setActiveTab] = useState<"dashboard" | "endpoints" | "code" | "spec" | "versions">("dashboard");
  const [endpointSearch, setEndpointSearch] = useState("");

  // Selected sub-items
  const [selectedEndpoint, setSelectedEndpoint] = useState<Endpoint | null>(null);
  const [selectedFile, setSelectedFile] = useState<CodeFile | null>(null);
  const [editedCode, setEditedCode] = useState<string>("");

  // New Project Modal State
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectFramework, setNewProjectFramework] = useState<"express" | "fastapi" | "springboot">("express");
  const [projectTemplates, setProjectTemplates] = useState<any>(null);

  // Chat State
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Manual Endpoint Creator State
  const [isAddEndpointOpen, setIsAddEndpointOpen] = useState(false);
  const [newEndpointPath, setNewEndpointPath] = useState("/api/v1/users");
  const [newEndpointMethod, setNewEndpointMethod] = useState<"GET" | "POST" | "PUT" | "DELETE">("GET");
  const [newEndpointDesc, setNewEndpointDesc] = useState("Fetch list of registered system users.");

  // Editing Endpoint Mode State
  const [isEditingEndpoint, setIsEditingEndpoint] = useState(false);
  const [editingParams, setEditingParams] = useState<any[]>([]);
  const [editingResponses, setEditingResponses] = useState<any[]>([]);
  const [editingDesc, setEditingDesc] = useState("");
  const [editingAuth, setEditingAuth] = useState(false);

  // Test Endpoint Modal State
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testRequestBody, setTestRequestBody] = useState("{}");
  const [testResponse, setTestResponse] = useState<string | null>(null);

  // Source Navigation State
  const [highlightedLine, setHighlightedLine] = useState<number | undefined>();

  // Keyboard Shortcuts Refs
  const saveCodeRef = useRef<() => Promise<void>>(null);
  const sendMessageRef = useRef<() => Promise<void>>(null);

  useEffect(() => {
    saveCodeRef.current = handleSaveCode;
    sendMessageRef.current = handleSendMessage;
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+S / Cmd+S - Save Code
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        if (saveCodeRef.current) saveCodeRef.current();
      }
      // Ctrl+Enter / Cmd+Enter - Send Chat
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        if (sendMessageRef.current) sendMessageRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Interactive Code Parsing Steps (for feedback during analysis)
  const [analysisSteps, setAnalysisSteps] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // API Message toasts
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Chat Ref for auto scrolling
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Compute filtered endpoints for explorer
  const filteredEndpoints = activeEndpoints.filter((ep) => {
    const query = endpointSearch.toLowerCase().trim();
    if (!query) return true;
    return (
      (ep.path && ep.path.toLowerCase().includes(query)) ||
      (ep.method && ep.method.toLowerCase().includes(query)) ||
      (ep.description && ep.description.toLowerCase().includes(query))
    );
  });

  // 1. Fetch initial platform data
  useEffect(() => {
    fetchUsers();
    fetchProjects();
    fetchTemplates();
  }, []);

  // Sync active project's children
  useEffect(() => {
    if (activeProject) {
      fetchProjectData(activeProject.id);
    } else {
      setActiveEndpoints([]);
      setActiveVersions([]);
      setSelectedVersion(null);
      setSelectedEndpoint(null);
      setSelectedFile(null);
      setChatHistory([]);
    }
  }, [activeProject]);

  // Scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/auth/users");
      const data = await res.json();
      setUsers(data);
      if (data.length > 0) {
        const devUser = data.find((u: any) => u.role === UserRole.DEVELOPER);
        if (devUser) {
          setCurrentUser(devUser.id);
          setActiveRole(devUser.role);
        } else {
          setCurrentUser(data[0].id);
          setActiveRole(data[0].role);
        }
      }
    } catch (err) {
      console.error("Failed to fetch users", err);
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      setProjects(data);
      if (data.length > 0 && !activeProject) {
        setActiveProject(data[0]);
      }
    } catch (err) {
      console.error("Failed to fetch projects", err);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch("/api/projects/templates");
      const data = await res.json();
      setProjectTemplates(data);
    } catch (err) {
      console.error("Failed to fetch templates", err);
    }
  };

  const fetchProjectData = async (projectId: string) => {
    try {
      // 1. Fetch Endpoints
      const epRes = await fetch(`/api/projects/${projectId}/endpoints`);
      const epData = await epRes.json();
      setActiveEndpoints(epData);
      if (epData.length > 0) {
        setSelectedEndpoint(epData[0]);
      } else {
        setSelectedEndpoint(null);
      }

      // 2. Fetch Versions
      const verRes = await fetch(`/api/projects/${projectId}/versions`);
      const verData = await verRes.json();
      setActiveVersions(verData);
      if (verData.length > 0) {
        // Select latest version
        const sorted = [...verData].sort((a, b) => b.versionNo - a.versionNo);
        setSelectedVersion(sorted[0]);
      } else {
        setSelectedVersion(null);
      }

      // 3. Fetch Chat History
      const chatRes = await fetch(`/api/projects/${projectId}/chat`);
      const chatData = await chatRes.json();
      setChatHistory(chatData);

      // Select default code file
      const project = projects.find((p) => p.id === projectId) || activeProject;
      if (project && project.codeFiles.length > 0) {
        setSelectedFile(project.codeFiles[0]);
        setEditedCode(project.codeFiles[0].content);
      }
    } catch (err) {
      console.error("Failed to load project details", err);
    }
  };

  // Monitor processing projects
  useEffect(() => {
    const interval = setInterval(async () => {
      const processing = projects.some((p) => p.status === "processing" || p.status === "pending");
      if (processing) {
        const res = await fetch("/api/projects");
        const data: Project[] = await res.json();
        setProjects(data);

        // Update active project if state changed
        if (activeProject) {
          const updatedActive = data.find((p) => p.id === activeProject.id);
          if (updatedActive) {
            if (activeProject.status !== updatedActive.status) {
              setActiveProject(updatedActive);
              fetchProjectData(updatedActive.id);
              if (updatedActive.status === "completed") {
                showToast(`Analysis for "${updatedActive.name}" completed!`);
              } else if (updatedActive.status === "failed") {
                showToast(`Analysis failed: ${updatedActive.error}`, "error");
              }
            }
          }
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [projects, activeProject]);

  // Handle Actor Shift
  const handleUserChange = (userId: string) => {
    setCurrentUser(userId);
    const user = users.find((u) => u.id === userId);
    if (user) {
      setActiveRole(user.role);
      showToast(`Logged in as ${user.name} (${user.role})`);
    }
  };

  // Delete Project
  const handleDeleteProject = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this project?")) return;
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("Project deleted successfully.");
        const remaining = projects.filter((p) => p.id !== id);
        setProjects(remaining);
        if (remaining.length > 0) {
          setActiveProject(remaining[0]);
        } else {
          setActiveProject(null);
        }
      }
    } catch (err) {
      showToast("Error deleting project", "error");
    }
  };

  // Create Project with selected template
  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      showToast("Please enter a project name.", "error");
      return;
    }

    const files = projectTemplates?.[newProjectFramework];
    if (!files) {
      showToast("Template not found.", "error");
      return;
    }

    setIsNewProjectModalOpen(false);
    setIsAnalyzing(true);
    setAnalysisSteps([
      "🔍 Loading source files...",
      "🧩 RecursiveCharacterTextSplitter: Splitting code files into 1,000 character overlapping chunks...",
      "🧬 Requesting Gemini to generate 768-dimension vector embeddings...",
      "💾 Initializing vector storage index (ChromaDB emulator)...",
      "🤖 LLM Analysis: Passing chunks to Gemini-3.5 to parse route decorators and controller mappings..."
    ]);

    try {
      const res = await fetch("/api/projects/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProjectName,
          framework: newProjectFramework,
          files,
          userId: currentUser,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to create project");
      }

      const newProj = await res.json();
      setProjects((prev) => [newProj, ...prev]);
      setActiveProject(newProj);
      setNewProjectName("");

      // Staggered presentation of extraction logs
      setTimeout(() => {
        setAnalysisSteps(prev => [...prev, "✨ API Specification schemas generated successfully!"]);
        setTimeout(() => {
          setAnalysisSteps(prev => [...prev, "📑 Unified OpenAPI v3.0.0 JSON schema merged."]);
          setTimeout(() => {
            setAnalysisSteps(prev => [...prev, "✅ ChromaDB collection filled with parsed contextual index structure."]);
            setIsAnalyzing(false);
          }, 1000);
        }, 1000);
      }, 2000);

    } catch (err) {
      showToast("Error creating project.", "error");
      setIsAnalyzing(false);
    }
  };

  // Re-save modified active code file and trigger analysis run
  const handleSaveCode = async () => {
    if (!activeProject || !selectedFile) return;

    const updatedFiles = activeProject.codeFiles.map((f) =>
      f.path === selectedFile.path ? { ...f, content: editedCode, size: editedCode.length } : f
    );

    setIsAnalyzing(true);
    setAnalysisSteps([
      "📝 File modified: Saving changes to virtual filesystem...",
      "🧩 Re-chunking modified modules...",
      "🔄 Computing updated vector embeddings for changed blocks...",
      "🤖 Triggering AI Parser to refine endpoint parameters & response schemes...",
      "📂 Merging modified OpenAPI spec paths..."
    ]);

    try {
      const res = await fetch(`/api/projects/${activeProject.id}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: updatedFiles }),
      });

      if (!res.ok) throw new Error("Failed to update project source");
      
      const updatedProj = await res.json();
      setProjects((prev) => prev.map((p) => (p.id === updatedProj.id ? updatedProj : p)));
      setActiveProject(updatedProj);
      
      showToast("Code saved and indexed.", "success");
    } catch (err) {
      showToast("Failed to save changes", "error");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleNavigateToSource = (filePath: string, line: number) => {
    if (!activeProject) return;
    const foundFile = activeProject.codeFiles.find((f) => f.path === filePath);
    if (foundFile) {
      setSelectedFile(foundFile);
      setHighlightedLine(line);
      setActiveTab("code");
    }
  };

  const toggleEndpointSelection = (id: string) => {
    setSelectedEndpointIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = () => {
    setActiveEndpoints((prev) => prev.filter((e) => !selectedEndpointIds.has(e.id)));
    setSelectedEndpointIds(new Set());
    showToast(`Deleted ${selectedEndpointIds.size} endpoints.`);
  };

  const handleBulkExport = () => {
    const headers = ["Method", "Path", "Description"];
    const rows = activeEndpoints
      .filter((ep) => selectedEndpointIds.has(ep.id))
      .map((ep) => [ep.method, ep.path, (ep.description || "").replace(/,/g, " ")]);
    const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'selected_endpoints.csv';
    a.click();
    showToast(`Exported ${selectedEndpointIds.size} endpoints to CSV.`);
  };

  // Upload custom .zip or file text manually
  const handleLocalFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // We can read multiple single text files and simulate code upload
    const loadedFiles: CodeFile[] = [];
    let filesProcessed = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        loadedFiles.push({
          name: file.name,
          path: file.name,
          size: file.size,
          content: text || "",
        });
        filesProcessed++;

        if (filesProcessed === files.length) {
          // Send as custom project upload
          createUploadedProject(loadedFiles);
        }
      };
      reader.readAsText(file);
    }
  };

  const createUploadedProject = async (codeFiles: CodeFile[]) => {
    setIsAnalyzing(true);
    setAnalysisSteps([
      "📂 Code files read successfully from local machine...",
      "🧩 RecursiveCharacterTextSplitter: Analyzing code layout...",
      "🤖 Requesting Gemini-3.5 API to detect Framework type & endpoints...",
    ]);

    try {
      // Auto-detect framework
      let detectedFramework: "express" | "fastapi" | "springboot" = "express";
      const hasJava = codeFiles.some(f => f.name.endsWith(".java"));
      const hasPython = codeFiles.some(f => f.name.endsWith(".py"));
      if (hasJava) detectedFramework = "springboot";
      else if (hasPython) detectedFramework = "fastapi";

      const res = await fetch("/api/projects/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Custom Codebase Upload",
          framework: detectedFramework,
          files: codeFiles,
          userId: currentUser,
        }),
      });

      if (!res.ok) throw new Error();

      const newProj = await res.json();
      setProjects((prev) => [newProj, ...prev]);
      setActiveProject(newProj);
      showToast(`Uploaded custom files. Detected framework: ${detectedFramework.toUpperCase()}`);
    } catch (err) {
      showToast("Error processing custom file upload.", "error");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Send message to AI RAG Assistant
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || !activeProject) return;

    const query = chatInput;
    setChatInput("");
    setIsChatLoading(true);

    // Append user message immediately
    const tempUserMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      projectId: activeProject.id,
      sender: "user",
      content: query,
      createdAt: new Date().toISOString(),
    };
    setChatHistory((prev) => [...prev, tempUserMsg]);

    try {
      const res = await fetch(`/api/projects/${activeProject.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: query }),
      });

      if (!res.ok) {
        throw new Error("RAG assistant failed to answer.");
      }

      const answerMsg: ChatMessage = await res.json();
      // Replace or sync chat history
      setChatHistory((prev) => {
        // filter out temporary user message and append proper backend historical records
        return [...prev.filter((m) => m.id !== tempUserMsg.id), {
          id: `u-${Date.now()}`,
          projectId: activeProject.id,
          sender: "user" as const,
          content: query,
          createdAt: new Date().toISOString()
        }, answerMsg];
      });
    } catch (err: any) {
      showToast("Error matching vector context or querying LLM.", "error");
      setChatHistory((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          projectId: activeProject.id,
          sender: "assistant",
          content: "❌ Error: Failed to generate response. Please check your GEMINI_API_KEY inside the Secrets panel.",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Setup prompt recommendation click
  const handleRecommendationClick = (prompt: string) => {
    setChatInput(prompt);
  };

  // Add custom manual endpoint
  const handleAddCustomEndpoint = async () => {
    if (!activeProject) return;
    try {
      const res = await fetch(`/api/projects/${activeProject.id}/endpoints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: newEndpointMethod,
          path: newEndpointPath,
          description: newEndpointDesc,
          authRequired: false,
          parameters: [
            { name: "id", in: "path", type: "string", required: true, description: "Resource unique ID" }
          ],
          responses: [
            { statusCode: 200, description: "Success response containing item JSON" }
          ]
        }),
      });

      if (res.ok) {
        const added = await res.json();
        setActiveEndpoints((prev) => [...prev, added]);
        setSelectedEndpoint(added);
        setIsAddEndpointOpen(false);
        showToast("Custom endpoint injected successfully!");
        
        // Refresh versions state
        const verRes = await fetch(`/api/projects/${activeProject.id}/versions`);
        const verData = await verRes.json();
        setActiveVersions(verData);
      }
    } catch (err) {
      showToast("Error creating endpoint", "error");
    }
  };

  // Delete specific endpoint
  const handleDeleteEndpoint = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this endpoint definition?")) return;
    try {
      const res = await fetch(`/api/endpoints/${id}`, { method: "DELETE" });
      if (res.ok) {
        setActiveEndpoints((prev) => prev.filter((e) => e.id !== id));
        setSelectedEndpoint(null);
        showToast("Endpoint removed from specification.");
      }
    } catch (err) {
      showToast("Failed to delete endpoint", "error");
    }
  };

  // Save edits of current endpoint parameters/responses
  const handleSaveEndpointEdit = async () => {
    if (!selectedEndpoint) return;
    try {
      const res = await fetch(`/api/endpoints/${selectedEndpoint.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: editingDesc,
          authRequired: editingAuth,
          parameters: editingParams,
          responses: editingResponses,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setActiveEndpoints((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
        setSelectedEndpoint(updated);
        setIsEditingEndpoint(false);
        showToast("Endpoint specifications updated successfully!");
      }
    } catch (err) {
      showToast("Failed to save endpoint edits.", "error");
    }
  };

  // Initialize Edit Mode values
  const startEditingEndpoint = () => {
    if (!selectedEndpoint) return;
    setEditingDesc(selectedEndpoint.description);
    setEditingAuth(selectedEndpoint.authRequired);
    setEditingParams([...selectedEndpoint.parameters]);
    setEditingResponses([...selectedEndpoint.responses]);
    setIsEditingEndpoint(true);
  };

  // Helpers for editing lists
  const handleParamChange = (index: number, field: string, value: any) => {
    const updated = [...editingParams];
    updated[index] = { ...updated[index], [field]: value };
    setEditingParams(updated);
  };

  const handleAddParam = () => {
    setEditingParams((prev) => [
      ...prev,
      { name: "new_param", in: "query", type: "string", required: false, description: "Description here" },
    ]);
  };

  const handleRemoveParam = (index: number) => {
    setEditingParams((prev) => prev.filter((_, i) => i !== index));
  };

  const handleResponseChange = (index: number, field: string, value: any) => {
    const updated = [...editingResponses];
    updated[index] = { ...updated[index], [field]: value };
    setEditingResponses(updated);
  };

  const handleAddResponse = () => {
    setEditingResponses((prev) => [...prev, { statusCode: 400, description: "Bad Request", schema: "" }]);
  };

  const handleRemoveResponse = (index: number) => {
    setEditingResponses((prev) => prev.filter((_, i) => i !== index));
  };

  // Trigger browser download of current specs
  const triggerDownload = (content: string, filename: string, contentType: string) => {
    const a = document.createElement("a");
    const file = new Blob([content], { type: contentType });
    a.href = URL.createObjectURL(file);
    a.download = filename;
    a.click();
    showToast(`Downloaded ${filename}`);
  };

  // Clear Chat History
  const handleClearChat = async () => {
    if (!activeProject) return;
    try {
      const res = await fetch(`/api/projects/${activeProject.id}/chat`, { method: "DELETE" });
      if (res.ok) {
        setChatHistory([]);
        showToast("Chat history cleared.");
      }
    } catch (err) {
      showToast("Failed to clear chat", "error");
    }
  };

  // Helper code renderer with fallback syntax highlighting
  const renderSourceCode = (code: string) => {
    return (
      <pre className="text-xs font-mono p-4 text-slate-800 bg-slate-50 border border-slate-200 rounded-lg overflow-x-auto leading-relaxed max-h-[500px]">
        {code.split("\n").map((line, idx) => {
          // Highlight comments
          const isComment = line.trim().startsWith("//") || line.trim().startsWith("/*") || line.trim().startsWith("*") || line.trim().startsWith("#");
          const isAnnotation = line.trim().startsWith("@") || line.trim().startsWith("def ") || line.trim().startsWith("class ");
          return (
            <div key={idx} className="flex hover:bg-slate-100/80 rounded px-1">
              <span className="w-8 select-none text-slate-400 text-right pr-3 border-r border-slate-200 mr-3">{idx + 1}</span>
              <span className={isComment ? "text-slate-500 italic" : isAnnotation ? "text-indigo-600 font-semibold" : "text-slate-800"}>
                {line}
              </span>
            </div>
          );
        })}
      </pre>
    );
  };

  // Custom high-contrast role highlights based on Actor design rules
  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case UserRole.DEVELOPER:
        return "bg-indigo-600 text-white";
      case UserRole.PROJECT_MANAGER:
        return "bg-emerald-600 text-white";
      case UserRole.QA_ENGINEER:
        return "bg-purple-600 text-white";
      case UserRole.API_CONSUMER:
        return "bg-amber-600 text-white";
    }
  };

  const getRoleDescription = (role: UserRole) => {
    switch (role) {
      case UserRole.DEVELOPER:
        return "Upload and edit the codebase, inspect structural code chunks, adjust Swagger tags, and train the RAG knowledge pool.";
      case UserRole.PROJECT_MANAGER:
        return "Review documentation completion metrics, verify versioning tracks, download system exports for project documentation.";
      case UserRole.QA_ENGINEER:
        return "Review endpoint response validation codes, design payloads, configure and test request parameters.";
      case UserRole.API_CONSUMER:
        return "Ask natural language integration questions on the codebase, review security schemes, and copy payload details.";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      
      {/* 1. Global Header Bar */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-10 sticky top-0 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold tracking-tight shadow-md">
              <Layers className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-md font-extrabold tracking-tight text-slate-900">DocAgent AI</span>
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">LangChain & ChromaDB Engine</span>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-200"></div>

          {/* Active project selector dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Project:</span>
            {projects.length > 0 ? (
              <select
                value={activeProject?.id || ""}
                onChange={(e) => {
                  const p = projects.find((proj) => proj.id === e.target.value);
                  if (p) setActiveProject(p);
                }}
                className="text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.framework.toUpperCase()})
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs text-slate-400 italic">No active projects uploaded.</span>
            )}

            {/* Upload code CTA */}
            <div className="flex gap-2 ml-2">
              <button
                onClick={() => setIsNewProjectModalOpen(true)}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition rounded-lg flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                New Codebase
              </button>

              {activeProject && (
                <button
                  onClick={() => handleDeleteProject(activeProject.id)}
                  title="Delete current project"
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-slate-200"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* User Switching / Role-based Navigation Simulation */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-slate-400" />
            <span className="text-xs text-slate-500 font-medium">Workspace Role:</span>
            <select
              value={currentUser}
              onChange={(e) => handleUserChange(e.target.value)}
              className="text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-2 py-1.5 focus:outline-none"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} — {u.role}
                </option>
              ))}
            </select>
          </div>

          <span className="text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider text-[10px] bg-slate-900 text-slate-300">
            {activeRole} Mode
          </span>
        </div>
      </header>

      {/* 2. Interactive Analysis State Banner - Geometric Balance Theme */}
      {activeProject && (
        <div className="w-full max-w-7xl mx-auto px-6 pt-6">
          <div className="bg-white border border-slate-200 rounded-2xl py-3 px-6 flex flex-wrap items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-4">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Status:</span>
              {activeProject.status === "processing" || activeProject.status === "pending" ? (
                <div className="flex items-center gap-2 text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full text-xs font-semibold animate-pulse">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Generating API Documentation & Vectors...
                </div>
              ) : activeProject.status === "failed" ? (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 px-3 py-1 rounded-full text-xs font-semibold">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Analysis Failed (Code syntax error or Missing Secrets)
                </div>
              ) : (
                <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full text-xs font-semibold">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                  ChromaDB Vector Store Indexed ({activeEndpoints.length} Routes Found)
                </div>
              )}

              <span className="text-slate-300">|</span>
              <span className="text-xs text-slate-600 font-medium">
                Framework Context: <b className="text-slate-800 uppercase">{activeProject.framework}</b>
              </span>
              <span className="text-slate-300">|</span>
              <span className="text-xs text-slate-600 font-medium">
                Active Version: <b className="text-slate-800">1.{activeProject.versionNo}.0</b>
              </span>
            </div>

            {/* User Role guidance */}
            <div className="text-xs text-slate-500 italic flex items-center gap-1.5 max-w-md bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
              <HelpCircle className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
              <span className="truncate">
                <b>{activeRole}:</b> {getRoleDescription(activeRole)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Main Workspace Grid - Geometric Balance: Centered layout with consistent 24px spacing */}
      <div className="flex-1 w-full max-w-7xl mx-auto px-6 py-6 min-h-0 overflow-hidden flex flex-col gap-6">
        <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">
          
          {/* Left Columns: Tabs Navigation & Workspace content (Col Span 7) */}
          <section className="col-span-7 flex flex-col bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          
          {/* Section Tab bar */}
          <div className="bg-slate-900 text-slate-400 p-1 flex items-center justify-between px-6 border-b border-slate-800">
            <div className="flex gap-4">
              <button
                onClick={() => setActiveTab("dashboard")}
                className={`py-3 px-1 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                  activeTab === "dashboard" ? "text-white border-indigo-500" : "border-transparent hover:text-slate-200"
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setActiveTab("endpoints")}
                className={`py-3 px-1 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                  activeTab === "endpoints" ? "text-white border-indigo-500" : "border-transparent hover:text-slate-200"
                }`}
              >
                Endpoints Explorer
              </button>
              <button
                onClick={() => {
                  setActiveTab("code");
                  if (activeProject && activeProject.codeFiles.length > 0 && !selectedFile) {
                    setSelectedFile(activeProject.codeFiles[0]);
                    setEditedCode(activeProject.codeFiles[0].content);
                  }
                }}
                className={`py-3 px-1 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                  activeTab === "code" ? "text-white border-indigo-500" : "border-transparent hover:text-slate-200"
                }`}
              >
                Source Code & AST
              </button>
              <button
                onClick={() => setActiveTab("spec")}
                className={`py-3 px-1 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                  activeTab === "spec" ? "text-white border-indigo-500" : "border-transparent hover:text-slate-200"
                }`}
              >
                OpenAPI & Markdown
              </button>
              <button
                onClick={() => setActiveTab("versions")}
                className={`py-3 px-1 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                  activeTab === "versions" ? "text-white border-indigo-500" : "border-transparent hover:text-slate-200"
                }`}
              >
                Versions & Releases
              </button>
            </div>

            {/* Quick Export actions (PM or PM/Developer role authorized) */}
            {selectedVersion && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => triggerDownload(selectedVersion.openApiSpec, "openapi.json", "application/json")}
                  title="Download Swagger OpenAPI JSON"
                  className="p-1.5 hover:text-white rounded hover:bg-slate-800 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => triggerDownload(selectedVersion.markdownDoc, "API_DOCUMENTATION.md", "text/markdown")}
                  title="Download Markdown Documentation file"
                  className="p-1.5 hover:text-white rounded hover:bg-slate-800 transition text-emerald-400"
                >
                  <FileText className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {!activeProject ? (
            /* Empty state when no project */
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-50">
              <div className="w-16 h-16 bg-slate-200 text-slate-400 rounded-2xl flex items-center justify-center mb-4">
                <Folder className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-1">No Project Loaded</h3>
              <p className="text-sm text-slate-500 max-w-md mb-6">
                To start, create a project with a backend framework template or upload raw source files manually.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setIsNewProjectModalOpen(true)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase rounded-lg shadow"
                >
                  Load Codebase Template
                </button>
                <label className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold uppercase cursor-pointer hover:bg-slate-50">
                  Upload Code files
                  <input type="file" multiple onChange={handleLocalFileUpload} className="hidden" />
                </label>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              
              {/* TAB 0: HIGH FIDELITY MOBILE TELEMETRY DASHBOARD */}
              {activeTab === "dashboard" && (
                <ApiDashboard 
                  endpointsCount={activeEndpoints.length}
                  chunksCount={activeProject.codeFiles.reduce((acc, f) => acc + Math.ceil(f.size / 300), 120)}
                  projectName={activeProject.name}
                  frameworkName={activeProject.framework}
                  versionString={`v1.${activeProject.versionNo}.0`}
                  onTabChange={(tab: "endpoints" | "code" | "spec" | "versions") => setActiveTab(tab)}
                  activeRole={activeRole}
                  showToast={(text, type) => showToast(text, type)}
                  endpoints={activeEndpoints}
                />
              )}

              {/* TAB 1: ENDPOINTS EXPLORER */}
              {activeTab === "endpoints" && (
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-6 gap-4">
                    <div className="col-span-1 bg-white p-3 rounded-lg border border-slate-200 shadow-3xs">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Total</div>
                      <div className="text-2xl font-black text-slate-900">{activeEndpoints.length}</div>
                    </div>
                    <div className="col-span-1 bg-white p-3 rounded-lg border border-slate-200 shadow-3xs">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Public</div>
                      <div className="text-2xl font-black text-sky-600">
                        {activeEndpoints.filter(e => !e.authRequired).length}
                      </div>
                    </div>
                    <div className="col-span-1 bg-white p-3 rounded-lg border border-slate-200 shadow-3xs">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Private</div>
                      <div className="text-2xl font-black text-rose-600">
                        {activeEndpoints.filter(e => e.authRequired).length}
                      </div>
                    </div>
                    <div className="col-span-3 bg-white p-3 rounded-lg border border-slate-200 shadow-3xs flex items-center justify-around gap-2">
                       {["GET", "POST", "PUT", "DELETE"].map(method => (
                         <div key={method} className="text-center">
                            <div className="text-[10px] font-bold text-slate-500 uppercase">{method}</div>
                            <div className="text-lg font-black text-slate-700">
                              {activeEndpoints.filter(e => e.method === method).length}
                            </div>
                         </div>
                       ))}
                    </div>
                  </div>
                  <div className="flex-1 flex min-h-0">
                    {/* Endpoint sidebar navigation */}
                    <div className="w-64 border-r border-slate-200 bg-slate-50 flex flex-col min-h-0 shrink-0">
                    <div className="p-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between shrink-0">
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                        Endpoints ({endpointSearch ? `${filteredEndpoints.length}/${activeEndpoints.length}` : activeEndpoints.length})
                      </span>

                      <div className="flex items-center gap-1">
                        {/* CSV Export Button */}
                        <button
                          onClick={() => {
                            const headers = ["Method", "Path", "Description"];
                            const rows = filteredEndpoints.map(ep => [ep.method, ep.path, (ep.description || "").replace(/,/g, " ")]);
                            const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
                            const blob = new Blob([csvContent], { type: 'text/csv' });
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = 'endpoints.csv';
                            a.click();
                          }}
                          className="p-1 hover:bg-slate-200 rounded text-slate-600 hover:text-slate-800 transition"
                          title="Export filtered endpoints to CSV"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>

                        {/* Add Custom route action (Developer Only) */}
                        {activeRole === UserRole.DEVELOPER && (
                          <button
                            onClick={() => setIsAddEndpointOpen(true)}
                            className="p-1 hover:bg-indigo-100 rounded text-indigo-600 hover:text-indigo-800 transition"
                            title="Inject Custom Endpoint definition"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Search Input Field */}
                    <div className="p-2 border-b border-slate-150 bg-slate-50 shrink-0">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search endpoints..."
                          value={endpointSearch}
                          onChange={(e) => setEndpointSearch(e.target.value)}
                          className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition shadow-2xs text-slate-800"
                        />
                        {endpointSearch && (
                          <button
                            onClick={() => setEndpointSearch("")}
                            className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded transition"
                            title="Clear search"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {activeEndpoints.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400 italic">
                        No endpoints found in this source codebase.
                      </div>
                    ) : filteredEndpoints.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400 space-y-2">
                        <p className="italic">No endpoints match your query.</p>
                        <button
                          onClick={() => setEndpointSearch("")}
                          className="px-2.5 py-1 bg-white border border-slate-200 text-slate-600 rounded-md text-[10px] font-bold shadow-3xs hover:bg-slate-50 transition"
                        >
                          Reset Search
                        </button>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col min-h-0">
                        {selectedEndpointIds.size > 0 && (
                          <div className="bg-indigo-50 border-b border-indigo-100 p-2 flex items-center justify-between text-[10px] text-indigo-800 font-medium">
                            <span>{selectedEndpointIds.size} selected</span>
                            <div className="flex gap-2">
                              <button onClick={handleBulkExport} className="hover:text-indigo-900 underline">Export</button>
                              <button onClick={handleBulkDelete} className="hover:text-indigo-900 underline text-rose-700">Delete</button>
                            </div>
                          </div>
                        )}
                        <div className="flex-1 overflow-y-auto divide-y divide-slate-150">
                          {(() => {
                            const groupedEndpoints = filteredEndpoints.reduce((acc, ep) => {
                              const fileName = ep.fileOrigin.split('/').pop() || "unknown";
                              const group = fileName.split('.')[0] || "General";
                              if (!acc[group]) acc[group] = [];
                              acc[group].push(ep);
                              return acc;
                            }, {} as Record<string, Endpoint[]>);

                            return Object.keys(groupedEndpoints).sort().map(group => (
                              <div key={group}>
                                <div className="bg-slate-50 px-3 py-1.5 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-150 flex items-center justify-between">
                                  {group}
                                  <ChevronDown className="w-3 h-3" />
                                </div>
                                {groupedEndpoints[group].map((ep) => {
                                  const isSelected = selectedEndpoint?.id === ep.id;
                                  const isChecked = selectedEndpointIds.has(ep.id);
                                  return (
                                    <div key={ep.id} className={`flex items-start ${isSelected ? "bg-indigo-50" : "hover:bg-slate-100"} transition-colors`}>
                                      <div className="pt-4 pl-3">
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={(e) => {
                                            e.stopPropagation();
                                            toggleEndpointSelection(ep.id);
                                          }}
                                          className="w-3 h-3 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                      </div>
                                      <button
                                        onClick={() => {
                                          setSelectedEndpoint(ep);
                                          setIsEditingEndpoint(false);
                                        }}
                                        className={`w-full text-left p-3 flex flex-col gap-1`}
                                      >
                                        <div className="flex items-center gap-1.5">
                                          <span
                                            className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold shrink-0 ${
                                              ep.method === "GET"
                                                ? "bg-sky-100 text-sky-800"
                                                : ep.method === "POST"
                                                ? "bg-emerald-100 text-emerald-800"
                                                : ep.method === "PUT"
                                                ? "bg-amber-100 text-amber-800"
                                                : "bg-rose-100 text-rose-800"
                                            }`}
                                          >
                                            {ep.method}
                                          </span>
                                          <code className="text-xs font-bold text-slate-800 truncate font-mono">
                                            {ep.path}
                                          </code>
                                        </div>
                                        <span className="text-[11px] text-slate-500 truncate line-clamp-1">
                                          {ep.description || "No description provided."}
                                        </span>
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Endpoint main focus explorer card */}
                  <div className="flex-1 p-6 overflow-y-auto bg-white flex flex-col min-w-0">
                    {selectedEndpoint ? (
                      <div className="space-y-6">
                        
                        {/* Selected Endpoint title section */}
                        <div className="border-b border-slate-150 pb-5">
                          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2.5 py-1 text-xs font-extrabold rounded ${
                                  selectedEndpoint.method === "GET"
                                    ? "bg-sky-500 text-white"
                                    : selectedEndpoint.method === "POST"
                                    ? "bg-emerald-600 text-white"
                                    : selectedEndpoint.method === "PUT"
                                    ? "bg-amber-500 text-white"
                                    : "bg-rose-500 text-white"
                                }`}
                              >
                                {selectedEndpoint.method}
                              </span>
                              <code className="text-base font-extrabold text-slate-800 font-mono">
                                {selectedEndpoint.path}
                              </code>
                            </div>

                            <div className="flex items-center gap-2">
                              {/* Test Endpoint Button */}
                              <button
                                onClick={() => {
                                  setIsTestModalOpen(true);
                                  setTestRequestBody(JSON.stringify(selectedEndpoint.parameters.reduce((acc, p) => ({ ...acc, [p.name]: "" }), {}), null, 2));
                                  setTestResponse(null);
                                }}
                                className="px-2 py-1 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded hover:bg-indigo-100 transition"
                                title="Simulate API call"
                              >
                                Test Endpoint
                              </button>

                              {/* Source position link */}
                              <span className="text-[11px] text-slate-400 font-mono bg-slate-50 px-2 py-1 rounded border border-slate-200">
                                {selectedEndpoint.fileOrigin}:{selectedEndpoint.lineStart}-{selectedEndpoint.lineEnd}
                              </span>

                              {/* Edit or Delete capability for Developer/PM role */}
                              {(activeRole === UserRole.DEVELOPER || activeRole === UserRole.PROJECT_MANAGER) && (
                                <div className="flex gap-1.5">
                                  <button
                                    onClick={startEditingEndpoint}
                                    className="p-1 hover:bg-slate-100 rounded text-slate-600 border border-slate-200"
                                    title="Edit API endpoint schema details manually"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteEndpoint(selectedEndpoint.id)}
                                    className="p-1 hover:bg-red-50 hover:text-red-600 rounded border border-slate-200"
                                    title="Delete endpoint specification"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Endpoint Description */}
                          {!isEditingEndpoint ? (
                            <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                              {selectedEndpoint.description}
                            </p>
                          ) : (
                            <div className="space-y-3 p-3 border border-indigo-200 bg-indigo-50/30 rounded-lg">
                              <label className="text-[10px] font-bold uppercase text-indigo-700">Edit Description</label>
                              <textarea
                                value={editingDesc}
                                onChange={(e) => setEditingDesc(e.target.value)}
                                className="w-full text-xs p-2 border border-slate-300 rounded bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                                rows={3}
                              />
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  id="editAuth"
                                  checked={editingAuth}
                                  onChange={(e) => setEditingAuth(e.target.checked)}
                                  className="rounded"
                                />
                                <label htmlFor="editAuth" className="text-xs font-medium text-slate-700">
                                  Bearer Authorization (JWT) Token required
                                </label>
                              </div>
                            </div>
                          )}

                          {/* Security details indicator */}
                          <div className="mt-3 flex items-center gap-2">
                            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                              Auth Requirement:
                            </span>
                            {selectedEndpoint.authRequired ? (
                              <span className="bg-red-50 text-red-700 border border-red-100 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded">
                                JWT Token Required
                              </span>
                            ) : (
                              <span className="bg-slate-100 text-slate-600 text-[10px] font-medium uppercase px-2 py-0.5 rounded">
                                Public (No auth required)
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Request Parameter specifications section */}
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                              Query & Path Parameters
                            </h4>
                            {isEditingEndpoint && (
                              <button
                                onClick={handleAddParam}
                                className="px-2 py-1 text-[10px] font-bold text-indigo-600 border border-indigo-200 rounded hover:bg-indigo-50 transition"
                              >
                                + Add Parameter
                              </button>
                            )}
                          </div>

                          {!isEditingEndpoint ? (
                            selectedEndpoint.parameters.length === 0 ? (
                              <p className="text-xs text-slate-400 italic">No parameters requested.</p>
                            ) : (
                              <div className="border border-slate-200 rounded-lg overflow-hidden">
                                <table className="w-full text-xs text-left">
                                  <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                      <th className="p-2 text-slate-600 font-bold">Parameter Name</th>
                                      <th className="p-2 text-slate-600 font-bold">Type</th>
                                      <th className="p-2 text-slate-600 font-bold">Location</th>
                                      <th className="p-2 text-slate-600 font-bold">Required</th>
                                      <th className="p-2 text-slate-600 font-bold">Description</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {selectedEndpoint.parameters.map((p, idx) => (
                                      <tr key={idx} className="hover:bg-slate-50">
                                        <td className="p-2 font-mono text-slate-800 font-bold">{p.name}</td>
                                        <td className="p-2 font-mono text-[11px] text-indigo-600 bg-indigo-50/50">{p.type}</td>
                                        <td className="p-2 text-slate-500 font-mono">{p.in}</td>
                                        <td className="p-2">
                                          <span
                                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                              p.required ? "bg-amber-50 text-amber-800 border border-amber-100" : "bg-slate-50 text-slate-500"
                                            }`}
                                          >
                                            {p.required ? "Required" : "Optional"}
                                          </span>
                                        </td>
                                        <td className="p-2 text-slate-600">{p.description}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )
                          ) : (
                            <div className="space-y-3">
                              {editingParams.map((p, idx) => (
                                <div key={idx} className="p-3 border border-slate-200 rounded bg-slate-50 flex flex-wrap items-center gap-2">
                                  <input
                                    type="text"
                                    value={p.name}
                                    placeholder="Param Name"
                                    onChange={(e) => handleParamChange(idx, "name", e.target.value)}
                                    className="p-1 text-xs border rounded bg-white w-24"
                                  />
                                  <select
                                    value={p.type}
                                    onChange={(e) => handleParamChange(idx, "type", e.target.value)}
                                    className="p-1 text-xs border rounded bg-white w-20"
                                  >
                                    <option value="string">string</option>
                                    <option value="integer">integer</option>
                                    <option value="boolean">boolean</option>
                                    <option value="object">object</option>
                                  </select>
                                  <select
                                    value={p.in}
                                    onChange={(e) => handleParamChange(idx, "in", e.target.value)}
                                    className="p-1 text-xs border rounded bg-white w-20"
                                  >
                                    <option value="query">query</option>
                                    <option value="path">path</option>
                                    <option value="header">header</option>
                                    <option value="body">body</option>
                                  </select>
                                  <label className="flex items-center gap-1 text-xs">
                                    <input
                                      type="checkbox"
                                      checked={p.required}
                                      onChange={(e) => handleParamChange(idx, "required", e.target.checked)}
                                    />
                                    Required
                                  </label>
                                  <input
                                    type="text"
                                    value={p.description}
                                    placeholder="Param description"
                                    onChange={(e) => handleParamChange(idx, "description", e.target.value)}
                                    className="p-1 text-xs border rounded bg-white flex-1 min-w-[120px]"
                                  />
                                  <button
                                    onClick={() => handleRemoveParam(idx)}
                                    className="text-red-500 hover:text-red-700"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Request Body Specification schema */}
                        {selectedEndpoint.method !== "GET" && (
                          <div>
                            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3">
                              Request Body Payload Schema
                            </h4>
                            <div className="bg-slate-900 rounded-lg p-4 font-mono text-[11px] text-slate-300 border border-slate-800">
                              <pre className="overflow-x-auto whitespace-pre-wrap leading-relaxed">
                                {selectedEndpoint.requestBodySchema ||
                                  `{\n  "payload": "Refer to the Source Code Tab to review model inputs"\n}`}
                              </pre>
                            </div>
                          </div>
                        )}

                        {/* Response specifications section */}
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                              Expected HTTP Responses
                            </h4>
                            {isEditingEndpoint && (
                              <button
                                onClick={handleAddResponse}
                                className="px-2 py-1 text-[10px] font-bold text-indigo-600 border border-indigo-200 rounded hover:bg-indigo-50 transition"
                              >
                                + Add Response
                              </button>
                            )}
                          </div>

                          {!isEditingEndpoint ? (
                            <div className="space-y-3">
                              {selectedEndpoint.responses.map((res, idx) => (
                                <div key={idx} className="flex gap-4 p-4 border border-slate-150 rounded-xl hover:shadow-sm transition-all bg-white">
                                  <span
                                    className={`text-sm font-extrabold font-mono px-2 py-1 rounded h-fit ${
                                      res.statusCode >= 200 && res.statusCode < 300
                                        ? "text-emerald-700 bg-emerald-50 border border-emerald-100"
                                        : "text-rose-700 bg-rose-50 border border-rose-100"
                                    }`}
                                  >
                                    {res.statusCode}
                                  </span>
                                  <div className="space-y-2 flex-1 min-w-0">
                                    <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                                      {res.description}
                                    </p>
                                    {res.schema && (
                                      <div className="p-3 bg-slate-50 rounded-lg font-mono text-[11px] text-slate-600 border border-slate-100 overflow-x-auto">
                                        <pre>{res.schema}</pre>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {editingResponses.map((res, idx) => (
                                <div key={idx} className="p-3 border border-slate-200 bg-slate-50 rounded space-y-2">
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="number"
                                      value={res.statusCode}
                                      placeholder="HTTP Status Code (e.g. 200)"
                                      onChange={(e) => handleResponseChange(idx, "statusCode", parseInt(e.target.value) || 200)}
                                      className="p-1 text-xs border rounded bg-white w-20"
                                    />
                                    <input
                                      type="text"
                                      value={res.description}
                                      placeholder="HTTP Description"
                                      onChange={(e) => handleResponseChange(idx, "description", e.target.value)}
                                      className="p-1 text-xs border rounded bg-white flex-1"
                                    />
                                    <button
                                      onClick={() => handleRemoveResponse(idx)}
                                      className="text-red-500 hover:text-red-700"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                  <textarea
                                    value={res.schema || ""}
                                    placeholder="JSON payload/Response model schema schema (optional)"
                                    onChange={(e) => handleResponseChange(idx, "schema", e.target.value)}
                                    className="w-full text-xs font-mono p-2 border rounded bg-white"
                                    rows={3}
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Save endpoint changes block in edit mode */}
                        {isEditingEndpoint && (
                          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-200">
                            <button
                              onClick={() => setIsEditingEndpoint(false)}
                              className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                            >
                              Cancel Edits
                            </button>
                            <button
                              onClick={handleSaveEndpointEdit}
                              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 flex items-center gap-1.5 transition"
                            >
                              <Save className="w-3.5 h-3.5" />
                              Save Changes
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
                        <Layers className="w-12 h-12 mb-2 opacity-30" />
                        <span className="text-sm">Select an API route on the left to view documentation details.</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: LIVE CODE & CHUNKING VISUALIZER */}
              {activeTab === "code" && (
                <div className="flex-1 flex min-h-0">
                  {/* File sidebar selector */}
                  <div className="w-64 border-r border-slate-200 bg-slate-50 overflow-y-auto">
                    <div className="p-3 bg-slate-100 border-b border-slate-200">
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                        Project Directory Files
                      </span>
                    </div>
                    <div>
                      {activeProject.codeFiles.map((f) => {
                        const isSelected = selectedFile?.path === f.path;
                        return (
                          <button
                            key={f.path}
                            onClick={() => {
                              setSelectedFile(f);
                              setEditedCode(f.content);
                            }}
                            className={`w-full text-left p-3 flex items-center gap-2.5 transition-colors ${
                              isSelected ? "bg-indigo-50 text-indigo-700 font-bold border-l-4 border-indigo-600" : "hover:bg-slate-100 text-slate-700"
                            }`}
                          >
                            <FileCode className="w-4 h-4 text-indigo-500" />
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs truncate">{f.name}</span>
                              <span className="text-[9px] text-slate-400">
                                {(f.size / 1024).toFixed(1)} KB
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Developer instruction */}
                    {activeRole === UserRole.DEVELOPER && (
                      <div className="p-4 m-3 bg-slate-950 text-slate-300 rounded-lg space-y-2 border border-slate-800 text-[11px] leading-relaxed">
                        <Sparkles className="w-4 h-4 text-amber-400 inline mr-1" />
                        <b>Developer Console:</b> Try editing route patterns or controller JSDocs, then hit <b>Generate</b> to rebuild.
                      </div>
                    )}
                  </div>

                  {/* Code editor / visualizer panel */}
                  <div className="flex-1 p-6 overflow-y-auto bg-white flex flex-col">
                    {selectedFile ? (
                      <div className="space-y-4 flex-1 flex flex-col min-h-0">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-150">
                          <div>
                            <span className="text-xs font-bold text-slate-800">{selectedFile.path}</span>
                            <span className="ml-2 text-[10px] bg-indigo-50 text-indigo-700 font-bold px-1.5 py-0.5 rounded">
                              AST Parsing Ready
                            </span>
                          </div>

                          {/* Only Developers can update code in this sandbox */}
                          {activeRole === UserRole.DEVELOPER ? (
                            <button
                              onClick={handleSaveCode}
                              className="px-3 py-1.5 bg-slate-900 text-white hover:bg-slate-800 transition text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm"
                            >
                              <Play className="w-3.5 h-3.5 text-emerald-400" />
                              Generate & Index Code
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400 italic">
                              Switch to Developer role to edit code
                            </span>
                          )}
                        </div>

                        {/* Interactive edit and AST Visualizer section */}
                        <div className="flex-1 flex flex-col gap-4">
                          <div className="flex flex-col min-h-0">
                            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">
                              Active Code Input Node
                            </span>
                            <FoldableCodeEditor
                              code={editedCode}
                              onChange={(newCode) => setEditedCode(newCode)}
                              isEditable={activeRole === UserRole.DEVELOPER}
                              filePath={selectedFile.path}
                              highlightedLine={highlightedLine}
                            />
                          </div>

                          {/* LangChain AST parsing detail card */}
                          <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-3">
                            <h4 className="text-xs font-extrabold text-indigo-800 uppercase tracking-widest flex items-center gap-1">
                              <Cpu className="w-4 h-4" />
                              LangChain Code Extraction Insight (ChromaDB)
                            </h4>
                            <p className="text-[11px] text-slate-600 leading-relaxed">
                              This file is passed into our Code Extraction pipeline. It first parses code tokens, and isolates controller blocks. We split them into clean overlaps to keep dependencies related to their routing declarations intact.
                            </p>
                            <div className="flex items-center gap-4 flex-wrap">
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] uppercase font-bold text-slate-400">Splitter:</span>
                                <span className="font-mono text-xs text-indigo-700 font-bold">RecursiveCharacter</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] uppercase font-bold text-slate-400">Chunk Size:</span>
                                <span className="font-mono text-xs text-indigo-700 font-bold">1000 Chars</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] uppercase font-bold text-slate-400">Embedding:</span>
                                <span className="font-mono text-xs text-indigo-700 font-bold">gemini-embedding-preview</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center justify-center text-slate-400 italic">
                        Select a file to view code.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: SPECIFICATIONS EXPORT VIEW (OPENAPI & MARKDOWN) */}
              {activeTab === "spec" && (
                <div className="flex-1 p-6 overflow-y-auto bg-slate-900 text-slate-300">
                  {selectedVersion ? (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                        <div>
                          <h3 className="text-sm font-bold text-white">Swagger OpenAPI v3.0 Specification</h3>
                          <p className="text-xs text-slate-400">Live JSON schema matched against the extracted active version endpoints.</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => triggerDownload(selectedVersion.openApiSpec, "openapi.json", "application/json")}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition"
                          >
                            <Download className="w-3.5 h-3.5" />
                            OpenAPI JSON
                          </button>
                          <button
                            onClick={() => triggerDownload(selectedVersion.markdownDoc, "API_DOCUMENTATION.md", "text/markdown")}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold flex items-center gap-1.5 transition"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Markdown
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* OpenAPI Spec JSON code */}
                        <div>
                          <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 mb-2 block">
                            Swagger OpenAPI Spec Source Code
                          </span>
                          <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 max-h-[500px] overflow-y-auto">
                            <pre className="text-xs font-mono text-emerald-400 whitespace-pre-wrap leading-relaxed">
                              {selectedVersion.openApiSpec}
                            </pre>
                          </div>
                        </div>

                        {/* Beautifully Rendered Markdown structure */}
                        <div>
                          <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 mb-2 block">
                            Markdown Raw representation
                          </span>
                          <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 max-h-[500px] overflow-y-auto font-sans text-xs space-y-4">
                            <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
                              {selectedVersion.markdownDoc}
                            </pre>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-slate-500 italic">
                      No document versions compiled for this project yet. Please regenerate or analyze code.
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: RELEASES & HISTORICAL VERSIONS */}
              {activeTab === "versions" && (
                <div className="flex-1 p-6 overflow-y-auto bg-white space-y-6">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 mb-1">Documentation Version Control</h3>
                    <p className="text-xs text-slate-500">
                      We track versioning updates automatically when source code changes are compiled. Choose a previous state to inspect and retrieve.
                    </p>
                  </div>

                  {activeVersions.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 border border-dashed rounded-xl italic">
                      No versions registered yet.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {activeVersions.map((v) => {
                        const isCurrent = v.versionNo === activeProject.versionNo;
                        return (
                          <div
                            key={v.id}
                            className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
                              isCurrent ? "border-indigo-500 bg-indigo-50/25" : "border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 font-extrabold text-xs">
                                v1.{v.versionNo}.0
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-800">
                                    Release Version 1.{v.versionNo}.0
                                  </span>
                                  {isCurrent && (
                                    <span className="bg-emerald-100 text-emerald-800 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded">
                                      Active Release
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] text-slate-400 font-medium">
                                  Indexed: {new Date(v.generatedAt).toLocaleString()} | Endpoints: {v.endpoints.length}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setSelectedVersion(v);
                                  setActiveTab("spec");
                                  showToast(`Switched view context to v1.${v.versionNo}.0 spec`);
                                }}
                                className="px-3 py-1.5 border border-slate-200 hover:bg-white text-slate-700 text-xs font-bold rounded-lg transition"
                              >
                                Inspect Specification
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>

          {/* Right Columns: AI Chat Assistant (RAG Pipeline backed by ChromaDB) (Col Span 5) */}
          <section className="col-span-5 flex flex-col bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          {/* Assistant header */}
          <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
              <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1">
                <Bot className="w-4 h-4 text-indigo-600" />
                API Chat Assistant (RAG)
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 bg-slate-950 text-slate-300 text-[9px] rounded font-mono">
                ChromaDB
              </span>
              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[9px] font-bold rounded">
                Gemini-3.5-Flash
              </span>
              {chatHistory.length > 0 && (
                <button
                  onClick={handleClearChat}
                  className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-red-500"
                  title="Clear history"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Chat message logs wrapper */}
          <div className="flex-1 p-6 space-y-6 overflow-y-auto min-h-0">
            {chatHistory.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center animate-bounce">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    Knowledge Grounding Agent
                  </h4>
                  <p className="text-[11px] text-slate-500 max-w-xs mt-1">
                    Ask natural language questions about endpoints, security headers, response schemas, or database parameters. Answers are strictly grounded in active code chunks.
                  </p>
                </div>

                {activeProject && (
                  <div className="w-full space-y-2 pt-2 text-left">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block text-center">
                      Suggested Questions to Try
                    </span>
                    <button
                      onClick={() => handleRecommendationClick("What endpoints are available in this service?")}
                      className="w-full text-left p-2.5 bg-white hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-200 text-xs rounded-xl text-slate-700 block truncate transition-all shadow-sm"
                    >
                      "What endpoints are available in this service?"
                    </button>
                    <button
                      onClick={() => handleRecommendationClick("How is user authorization handled?")}
                      className="w-full text-left p-2.5 bg-white hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-200 text-xs rounded-xl text-slate-700 block truncate transition-all shadow-sm"
                    >
                      "How is user authorization handled?"
                    </button>
                    <button
                      onClick={() => handleRecommendationClick("What does the registration endpoint return on invalid arguments?")}
                      className="w-full text-left p-2.5 bg-white hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-200 text-xs rounded-xl text-slate-700 block truncate transition-all shadow-sm"
                    >
                      "What does user registration return on invalid arguments?"
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {chatHistory.map((msg, idx) => {
                  const isUser = msg.sender === "user";
                  return (
                    <div key={idx} className={`flex flex-col ${isUser ? "items-end animate-fade-in" : "items-start"}`}>
                      {/* Message Bubble */}
                      <div
                        className={`max-w-[90%] p-3.5 rounded-2xl text-xs leading-relaxed shadow-sm ${
                          isUser
                            ? "bg-indigo-600 text-white rounded-tr-none"
                            : "bg-white text-slate-800 border border-slate-200 rounded-tl-none"
                        }`}
                      >
                        {/* Formatted Text rendering */}
                        <div className="whitespace-pre-wrap font-sans text-xs">
                          {msg.content}
                        </div>

                        {/* Vector metadata references block */}
                        {!isUser && msg.retrievedChunks && msg.retrievedChunks.length > 0 && (
                          <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                            <span className="text-[9px] uppercase tracking-widest font-extrabold text-indigo-500 block">
                              📚 Vector Matches (ChromaDB Sim-Score Context)
                            </span>
                            <div className="space-y-1.5">
                              {msg.retrievedChunks.map((chunk, cidx) => (
                                <div
                                  key={cidx}
                                  title={chunk.content}
                                  className="p-2 bg-slate-50 rounded-lg text-[10px] text-slate-600 border border-slate-150 flex items-center justify-between cursor-help hover:border-indigo-300 transition-all"
                                >
                                  <span className="font-mono truncate max-w-[70%]">
                                    {chunk.filePath}:{chunk.lineStart}-{chunk.lineEnd}
                                  </span>
                                  <span className="bg-indigo-50 text-indigo-700 font-bold px-1.5 py-0.5 rounded text-[8px]">
                                    Sim: {(chunk.similarity * 100).toFixed(0)}%
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <span className="text-[9px] text-slate-400 mt-1 px-1">
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })}

                {/* Loading indicator */}
                {isChatLoading && (
                  <div className="flex items-center gap-2 text-indigo-600 font-semibold text-xs">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    ChromaDB Vector match found. Asking Gemini...
                  </div>
                )}
                
                <div ref={chatEndRef} />
              </div>
            )}
          </div>

          {/* Question input form */}
          <div className="p-4 bg-white border-t border-slate-200">
            {activeProject ? (
              <form onSubmit={handleSendMessage} className="relative">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask a natural language question about the APIs..."
                  className="w-full pl-4 pr-12 py-3 bg-slate-100 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-2 w-8 h-8 bg-slate-900 hover:bg-indigo-600 text-white rounded-lg flex items-center justify-center transition-colors shadow"
                  title="Send query"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <p className="text-[10px] text-center text-slate-400 italic">
                Please upload or select an active project to enable RAG chat.
              </p>
            )}
            <p className="mt-2 text-[10px] text-center text-slate-400">
              Response is grounded strictly in vector code segments stored in ChromaDB.
            </p>
          </div>
        </section>
      </div>
    </div>

      {/* FOOTER */}
      <footer className="h-10 bg-slate-900 border-t border-slate-800 flex items-center justify-between px-6 text-slate-500 text-[11px] z-10">
        <span>© 2026 AI-Powered API Documentation Agent Platform</span>
        <div className="flex gap-4">
          <span>Vector Database: <b>ChromaDB Engine</b></span>
          <span>Orchestration: <b>LangChain</b></span>
          <span>Model: <b>Gemini-3.5-Flash</b></span>
        </div>
      </footer>

      {/* --- MODAL 1: NEW PROJECT CREATOR MODAL --- */}
      {isNewProjectModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 animate-fade-in backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200">
            <div className="p-6 border-b border-slate-150 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2">
                <Folder className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-800">New Codebase Workspace</h3>
              </div>
              <button
                onClick={() => setIsNewProjectModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600">Workspace / Project Name</label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g. Finance-Service-API"
                  className="w-full text-xs p-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600">Backend Technology / Framework</label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => setNewProjectFramework("express")}
                    className={`p-3 rounded-lg border text-center transition ${
                      newProjectFramework === "express"
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700 font-bold"
                        : "border-slate-200 hover:bg-slate-50 text-slate-600 text-xs"
                    }`}
                  >
                    <span className="text-xs block">Express.js</span>
                    <span className="text-[9px] text-slate-400 font-medium">Node.js</span>
                  </button>

                  <button
                    onClick={() => setNewProjectFramework("fastapi")}
                    className={`p-3 rounded-lg border text-center transition ${
                      newProjectFramework === "fastapi"
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700 font-bold"
                        : "border-slate-200 hover:bg-slate-50 text-slate-600 text-xs"
                    }`}
                  >
                    <span className="text-xs block">FastAPI</span>
                    <span className="text-[9px] text-slate-400 font-medium">Python</span>
                  </button>

                  <button
                    onClick={() => setNewProjectFramework("springboot")}
                    className={`p-3 rounded-lg border text-center transition ${
                      newProjectFramework === "springboot"
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700 font-bold"
                        : "border-slate-200 hover:bg-slate-50 text-slate-600 text-xs"
                    }`}
                  >
                    <span className="text-xs block">Spring Boot</span>
                    <span className="text-[9px] text-slate-400 font-medium">Java</span>
                  </button>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-150 space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block">
                  Interactive Features Included
                </span>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Loading a template mounts realistic multi-file controllers, configures routing structures, triggers embedding pipelines, and simulates background code analysis immediately.
                </p>
              </div>

              {/* Upload raw files instead trigger */}
              <div className="border-t border-slate-150 pt-4 flex flex-col items-center">
                <span className="text-xs text-slate-400 mb-2">Or select custom files from your machine:</span>
                <label className="w-full flex items-center justify-center border border-dashed border-slate-300 rounded-lg p-3 hover:bg-slate-50 cursor-pointer transition text-xs font-bold text-slate-600">
                  Choose Source Files (.js, .py, .java, etc.)
                  <input type="file" multiple onChange={handleLocalFileUpload} className="hidden" />
                </label>
              </div>
            </div>

            <div className="p-6 border-t border-slate-150 flex items-center justify-end gap-3 bg-slate-50">
              <button
                onClick={() => setIsNewProjectModalOpen(false)}
                className="px-4 py-2 border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProject}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase tracking-wide rounded-lg transition shadow"
              >
                Initialize Workspace
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 2: ADD CUSTOM ENDPOINT DEFINITION --- */}
      {isAddEndpointOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 animate-fade-in backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200">
            <div className="p-6 border-b border-slate-150 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-800">Inject Custom Endpoint Specs</h3>
              </div>
              <button onClick={() => setIsAddEndpointOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5 col-span-1">
                  <label className="text-xs font-bold text-slate-600">HTTP Method</label>
                  <select
                    value={newEndpointMethod}
                    onChange={(e: any) => setNewEndpointMethod(e.target.value)}
                    className="w-full text-xs p-3 border border-slate-200 rounded-lg focus:outline-none bg-slate-50"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                </div>

                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs font-bold text-slate-600">Endpoint Path Route</label>
                  <input
                    type="text"
                    value={newEndpointPath}
                    onChange={(e) => setNewEndpointPath(e.target.value)}
                    className="w-full text-xs p-3 border border-slate-200 rounded-lg focus:outline-none bg-slate-50"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600">Description</label>
                <textarea
                  value={newEndpointDesc}
                  onChange={(e) => setNewEndpointDesc(e.target.value)}
                  className="w-full text-xs p-3 border border-slate-200 rounded-lg focus:outline-none bg-slate-50"
                  rows={3}
                />
              </div>

              <p className="text-[10px] text-slate-400 italic">
                Note: Creating a manual route updates the local openapi.json file dynamically on save.
              </p>
            </div>

            <div className="p-6 border-t border-slate-150 bg-slate-50 flex items-center justify-end gap-3">
              <button
                onClick={() => setIsAddEndpointOpen(false)}
                className="px-4 py-2 border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCustomEndpoint}
                className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700"
              >
                Inject Definition
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 3: INTERACTIVE EXTRACTION LOGS MODAL --- */}
      {isAnalyzing && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-50 p-4 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex items-center gap-2 bg-slate-950">
              <Terminal className="w-5 h-5 text-indigo-400 animate-spin" />
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                AST Parsing & Vector Processing Pipeline
              </h3>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Processing Workspace files...</span>
                <span className="text-xs text-indigo-400 font-extrabold animate-pulse">Running</span>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5 max-h-[300px] overflow-y-auto">
                {analysisSteps.map((step, idx) => (
                  <div key={idx} className="text-xs font-mono text-emerald-400 flex items-start gap-2 animate-fade-in">
                    <span>&gt;</span>
                    <span className="flex-1 whitespace-pre-wrap">{step}</span>
                  </div>
                ))}
              </div>

              <div className="p-3.5 bg-slate-800/50 rounded-xl border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
                <Sparkles className="w-4 h-4 text-amber-400 inline mr-1" />
                This interactive pipeline simulates actual LangChain recursive splitter chunks being vectorized with <b>gemini-embedding-2-preview</b>, and indexed locally inside our vector database for prompt-based search.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 4: TEST ENDPOINT MODAL --- */}
      <TestEndpointModal
        isOpen={isTestModalOpen}
        onClose={() => setIsTestModalOpen(false)}
        method={selectedEndpoint?.method || ""}
        path={selectedEndpoint?.path || ""}
        body={testRequestBody}
        onBodyChange={setTestRequestBody}
        onTest={() => setTestResponse(JSON.stringify({ status: "success", data: "Mock response for " + selectedEndpoint?.path }, null, 2))}
        response={testResponse}
      />

      {/* Toast Alert System */}
      {toastMessage && (
        <div className="fixed bottom-14 right-6 bg-slate-900 border border-slate-800 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 z-50 animate-fade-in text-xs font-bold">
          {toastMessage.type === "success" ? (
            <Check className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

    </div>
  );
}
