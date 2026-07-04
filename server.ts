import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { chunkCode, cosineSimilarity, TEMPLATE_PROJECTS } from "./src/backendUtils";
import { DatabaseSchema, Project, User, UserRole, Endpoint, CodeChunk, ChatMessage, DocumentVersion } from "./src/types";

// Load environment variables
dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const DB_FILE = path.join(process.cwd(), "data", "db.json");

// Ensure the data directory exists
if (!fs.existsSync(path.dirname(DB_FILE))) {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
}

// In-Memory fallback if files fail
let dbState: DatabaseSchema = {
  users: [
    { id: "u-1", name: "ckavipriya", email: "ckavipriya2006@gmail.com", role: UserRole.DEVELOPER, createdAt: new Date().toISOString() },
    { id: "u-2", name: "Jane Tester", email: "jane@test.com", role: UserRole.QA_ENGINEER, createdAt: new Date().toISOString() },
    { id: "u-3", name: "Bob Product", email: "bob@pm.com", role: UserRole.PROJECT_MANAGER, createdAt: new Date().toISOString() },
    { id: "u-4", name: "Alice Consumer", email: "alice@external.com", role: UserRole.API_CONSUMER, createdAt: new Date().toISOString() },
  ],
  projects: [],
  endpoints: [],
  chunks: [],
  chatHistories: {},
  versions: [],
};

// Load database state from file if exists
function loadDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      dbState = JSON.parse(data);
    } else {
      saveDb();
    }
  } catch (error) {
    console.error("Error loading database:", error);
  }
}

// Save database state to file
function saveDb() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(dbState, null, 2), "utf-8");
  } catch (error) {
    console.error("Error saving database:", error);
  }
}

// Load DB initially
loadDb();

// Initialize Gemini SDK
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
} else {
  console.warn("WARNING: GEMINI_API_KEY environment variable is not set. AI operations will be mock-simulated.");
}

const app = express();
app.use(express.json({ limit: "50mb" }));

// Helper to check if AI is available
function getAiClient(): GoogleGenAI {
  if (!ai) {
    throw new Error("Gemini API Client is not configured. Please add GEMINI_API_KEY in Settings > Secrets.");
  }
  return ai;
}

// --- API ROUTES ---

// 1. Authentication Simulators
app.get("/api/auth/users", (req, res) => {
  res.json(dbState.users);
});

app.post("/api/auth/register", (req, res) => {
  const { name, email, role } = req.body;
  if (!name || !email || !role) {
    return res.status(400).json({ error: "Name, email, and role are required." });
  }

  const existing = dbState.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(400).json({ error: "User with this email already exists." });
  }

  const newUser: User = {
    id: `u-${Date.now()}`,
    name,
    email,
    role: role as UserRole,
    createdAt: new Date().toISOString(),
  };

  dbState.users.push(newUser);
  saveDb();
  res.status(201).json(newUser);
});

// 2. Project Templates
app.get("/api/projects/templates", (req, res) => {
  res.json(TEMPLATE_PROJECTS);
});

// 3. Project Management
app.get("/api/projects", (req, res) => {
  res.json(dbState.projects);
});

app.get("/api/projects/:id", (req, res) => {
  const project = dbState.projects.find((p) => p.id === req.params.id);
  if (!project) return res.status(404).json({ error: "Project not found." });
  res.json(project);
});

app.delete("/api/projects/:id", (req, res) => {
  const { id } = req.params;
  dbState.projects = dbState.projects.filter((p) => p.id !== id);
  dbState.endpoints = dbState.endpoints.filter((e) => e.projectId !== id);
  dbState.chunks = dbState.chunks.filter((c) => c.projectId !== id);
  dbState.versions = dbState.versions.filter((v) => v.projectId !== id);
  delete dbState.chatHistories[id];
  saveDb();
  res.json({ message: "Project deleted successfully" });
});

// Create/Upload Project
app.post("/api/projects/upload", async (req, res) => {
  const { name, framework, files, userId } = req.body;
  if (!name || !framework || !files || !Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: "Project name, framework, and code files are required." });
  }

  const projectId = `p-${Date.now()}`;
  const newProject: Project = {
    id: projectId,
    userId: userId || "u-1",
    name,
    framework,
    status: "pending",
    codeFiles: files,
    versionNo: 1,
    createdAt: new Date().toISOString(),
  };

  dbState.projects.push(newProject);
  saveDb();

  // Async process the documentation generation in background
  processProjectAnalysis(projectId).catch((err) => {
    console.error(`Error processing project ${projectId}:`, err);
  });

  res.status(201).json(newProject);
});

// Trigger a new version / update of codefiles
app.post("/api/projects/:id/update", async (req, res) => {
  const { id } = req.params;
  const { files } = req.body;
  if (!files || !Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: "Updated files are required." });
  }

  const projectIndex = dbState.projects.findIndex((p) => p.id === id);
  if (projectIndex === -1) return res.status(404).json({ error: "Project not found." });

  const project = dbState.projects[projectIndex];
  project.codeFiles = files;
  project.versionNo += 1;
  project.status = "pending";
  saveDb();

  // Background process update
  processProjectAnalysis(id).catch((err) => {
    console.error(`Error updating project ${id}:`, err);
  });

  res.json(project);
});

// Get endpoints for a project
app.get("/api/projects/:id/endpoints", (req, res) => {
  const endpoints = dbState.endpoints.filter((e) => e.projectId === req.params.id);
  res.json(endpoints);
});

// Get documentation versions for a project
app.get("/api/projects/:id/versions", (req, res) => {
  const versions = dbState.versions.filter((v) => v.projectId === req.params.id);
  res.json(versions);
});

// Update/Edit an endpoint directly
app.put("/api/endpoints/:id", (req, res) => {
  const { id } = req.params;
  const updatedEndpoint = req.body;
  
  const idx = dbState.endpoints.findIndex((e) => e.id === id);
  if (idx === -1) return res.status(404).json({ error: "Endpoint not found." });

  dbState.endpoints[idx] = { ...dbState.endpoints[idx], ...updatedEndpoint };
  saveDb();

  // Also update the OpenAPI Spec on the active version
  updateOpenApiSpec(dbState.endpoints[idx].projectId);

  res.json(dbState.endpoints[idx]);
});

// Create custom endpoint manually
app.post("/api/projects/:id/endpoints", (req, res) => {
  const projectId = req.params.id;
  const endpointData = req.body;

  const newEndpoint: Endpoint = {
    id: `e-${Date.now()}`,
    projectId,
    method: endpointData.method || "GET",
    path: endpointData.path || "/api/custom",
    description: endpointData.description || "Custom endpoint description",
    authRequired: !!endpointData.authRequired,
    requestBodySchema: endpointData.requestBodySchema || "",
    parameters: endpointData.parameters || [],
    responses: endpointData.responses || [{ statusCode: 200, description: "Success" }],
    fileOrigin: "Manual Entry",
    lineStart: 0,
    lineEnd: 0,
  };

  dbState.endpoints.push(newEndpoint);
  saveDb();
  updateOpenApiSpec(projectId);

  res.status(201).json(newEndpoint);
});

// Delete an endpoint
app.delete("/api/endpoints/:id", (req, res) => {
  const { id } = req.params;
  const endpoint = dbState.endpoints.find((e) => e.id === id);
  if (!endpoint) return res.status(404).json({ error: "Endpoint not found." });

  const projectId = endpoint.projectId;
  dbState.endpoints = dbState.endpoints.filter((e) => e.id !== id);
  saveDb();
  updateOpenApiSpec(projectId);

  res.json({ message: "Endpoint deleted" });
});

// Get Chat history
app.get("/api/projects/:id/chat", (req, res) => {
  const history = dbState.chatHistories[req.params.id] || [];
  res.json(history);
});

// Delete Chat history
app.delete("/api/projects/:id/chat", (req, res) => {
  dbState.chatHistories[req.params.id] = [];
  saveDb();
  res.json({ message: "Chat history cleared" });
});

// Ask the RAG chatbot
app.post("/api/projects/:id/chat", async (req, res) => {
  const projectId = req.params.id;
  const { question } = req.body;

  if (!question) {
    return res.status(400).json({ error: "Question is required." });
  }

  const project = dbState.projects.find((p) => p.id === projectId);
  if (!project) return res.status(404).json({ error: "Project not found." });

  try {
    const aiClient = getAiClient();
    const projectChunks = dbState.chunks.filter((c) => c.projectId === projectId);

    let topChunks: { chunk: CodeChunk; similarity: number }[] = [];

    if (projectChunks.length > 0) {
      // 1. Generate embedding for query
      let queryEmbedding: number[] | null = null;
      try {
        const embedResponse = await aiClient.models.embedContent({
          model: "gemini-embedding-2-preview",
          contents: question,
        });
        queryEmbedding = (embedResponse as any).embedding?.values || (embedResponse as any).embeddings?.[0]?.values || null;
      } catch (err) {
        console.error("Embedding generation failed, falling back to substring keyword search:", err);
      }

      if (queryEmbedding) {
        // Compute similarity to all chunks
        const matches = projectChunks.map((chunk) => {
          const similarity = chunk.embedding ? cosineSimilarity(queryEmbedding!, chunk.embedding) : 0;
          return { chunk, similarity };
        });

        // Sort descending by similarity
        matches.sort((a, b) => b.similarity - a.similarity);
        topChunks = matches.slice(0, 3);
      } else {
        // Keyword fallback matching
        const words = question.toLowerCase().split(/\s+/);
        const matches = projectChunks.map((chunk) => {
          let score = 0;
          const contentLower = chunk.content.toLowerCase();
          words.forEach((word) => {
            if (word.length > 2 && contentLower.includes(word)) score += 1;
          });
          return { chunk, similarity: score > 0 ? 0.3 + (score / 10) : 0 };
        });
        matches.sort((a, b) => b.similarity - a.similarity);
        topChunks = matches.slice(0, 3).filter(m => m.similarity > 0);
      }
    }

    // 2. Prepare LLM prompt with retrieved chunks context
    const contextContent = topChunks.length > 0
      ? topChunks.map((match, i) => `[Chunk #${i + 1} from ${match.chunk.filePath} Lines ${match.chunk.lineStart}-${match.chunk.lineEnd}, Similarity: ${(match.similarity * 100).toFixed(1)}%]\n${match.chunk.content}`).join("\n\n")
      : "No matching code chunks found.";

    const systemInstruction = `You are an AI API Documentation Agent. You answer technical questions about a backend codebase using only the provided code chunks retrieved from a vector database (ChromaDB).
    
    Format your response in beautiful, clear Markdown.
    Quote relevant file names, paths, endpoints, status codes, and lines in your answer.
    If the question is about specific routes or functions, use code snippets.
    Be precise, accurate, and direct. Ground your response strictly in the source code provided in the context.`;

    const contents = `Context of retrieved code chunks from vector database:
    ${contextContent}
    
    User Question: ${question}
    
    Please provide an accurate answer, referencing specific files, methods, paths, and line numbers when applicable.`;

    const chatResponse = await aiClient.models.generateContent({
      model: "gemini-3.5-flash",
      contents,
      config: {
        systemInstruction,
        temperature: 0.2,
      },
    });

    const answer = chatResponse.text || "I was unable to analyze the codebase for this question.";

    const message: ChatMessage = {
      id: `msg-${Date.now()}`,
      projectId,
      sender: "assistant",
      content: answer,
      retrievedChunks: topChunks.map((match) => ({
        filePath: match.chunk.filePath,
        content: match.chunk.content,
        lineStart: match.chunk.lineStart,
        lineEnd: match.chunk.lineEnd,
        similarity: match.similarity,
      })),
      createdAt: new Date().toISOString(),
    };

    if (!dbState.chatHistories[projectId]) {
      dbState.chatHistories[projectId] = [];
    }

    // Save user message and assistant response
    const userMsg: ChatMessage = {
      id: `msg-u-${Date.now()}`,
      projectId,
      sender: "user",
      content: question,
      createdAt: new Date().toISOString(),
    };

    dbState.chatHistories[projectId].push(userMsg);
    dbState.chatHistories[projectId].push(message);
    saveDb();

    res.json(message);
  } catch (error: any) {
    console.error("Error in chat assistant:", error);
    res.status(500).json({ error: error.message || "Failed to generate chat answer." });
  }
});

// --- HELPER BACKGROUND PROCESSING LOGIC ---

/**
 * Split project files into chunks, compute vector embeddings using Gemini,
 * and invoke LLM to extract all structured endpoints.
 */
async function processProjectAnalysis(projectId: string) {
  const projectIdx = dbState.projects.findIndex((p) => p.id === projectId);
  if (projectIdx === -1) return;

  const project = dbState.projects[projectIdx];
  project.status = "processing";
  saveDb();

  try {
    const aiClient = getAiClient();

    // Remove any existing endpoints & chunks for this project
    dbState.endpoints = dbState.endpoints.filter((e) => e.projectId !== projectId);
    dbState.chunks = dbState.chunks.filter((c) => c.projectId !== projectId);

    // 1. CHUNK FILES AND GENERATE EMBEDDINGS
    const chunks: CodeChunk[] = [];
    for (const file of project.codeFiles) {
      const fileChunks = chunkCode(file, projectId);
      for (const chunk of fileChunks) {
        // Generate embedding for chunk
        try {
          const embedRes = await aiClient.models.embedContent({
            model: "gemini-embedding-2-preview",
            contents: chunk.content,
          });
          chunk.embedding = (embedRes as any).embedding?.values || (embedRes as any).embeddings?.[0]?.values;
        } catch (err) {
          console.error(`Failed embedding for chunk of ${file.name}:`, err);
        }
        chunks.push(chunk);
      }
    }
    dbState.chunks.push(...chunks);
    saveDb();

    // 2. LLM ENDPOINT EXTRACTION
    // We send code files description and content to extract all API routes
    // For smaller codebases, we do a single consolidated prompt so we can analyze route links across files perfectly.
    const codebaseOverview = project.codeFiles.map(f => `File Path: ${f.path}\n\`\`\`\n${f.content}\n\`\`\``).join("\n\n");

    const endpointSchema = {
      type: Type.OBJECT,
      properties: {
        method: { type: Type.STRING, description: "HTTP Method, e.g., GET, POST, PUT, DELETE, PATCH" },
        path: { type: Type.STRING, description: "The relative endpoint route path, e.g. /api/auth/register" },
        description: { type: Type.STRING, description: "Detailed description of what this API endpoint does" },
        authRequired: { type: Type.BOOLEAN, description: "Whether JWT authorization header is required" },
        requestBodySchema: { type: Type.STRING, description: "Detailed explanation or JSON Schema of request body (if any)" },
        parameters: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              in: { type: Type.STRING, description: "query, path, header, or body" },
              type: { type: Type.STRING, description: "string, integer, boolean, object, etc" },
              required: { type: Type.BOOLEAN },
              description: { type: Type.STRING },
            },
            required: ["name", "in", "type", "required", "description"]
          }
        },
        responses: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              statusCode: { type: Type.INTEGER },
              description: { type: Type.STRING },
              schema: { type: Type.STRING, description: "JSON format or visual description of response schema payload" },
            },
            required: ["statusCode", "description"]
          }
        },
        fileOrigin: { type: Type.STRING, description: "Relative file path where this route is defined" },
        lineStart: { type: Type.INTEGER, description: "Approximate start line of this endpoint definition in code" },
        lineEnd: { type: Type.INTEGER, description: "Approximate end line of this endpoint definition in code" },
      },
      required: ["method", "path", "description", "authRequired", "parameters", "responses", "fileOrigin"]
    };

    const prompt = `You are an AI Code Parser Layer. Analyze the backend project code files below.
    Identify all API endpoints/routes declared, parsing their methods, path routes, descriptions, auth headers, parameter schemas, response statuses, and payloads.
    
    Return a structured JSON list of all endpoints found.
    
    Project Framework: ${project.framework}
    
    Source Files:
    ${codebaseOverview}`;

    const modelResponse = await aiClient.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: endpointSchema,
        },
        temperature: 0.1,
      },
    });

    let extractedEndpoints: any[] = [];
    try {
      extractedEndpoints = JSON.parse(modelResponse.text!.trim());
    } catch (err) {
      console.error("Failed to parse Gemini generated endpoints JSON, falling back to empty list:", err);
    }

    // Normalize and add to database
    const finalEndpoints: Endpoint[] = extractedEndpoints.map((item, idx) => ({
      id: `e-${projectId}-${idx}-${Date.now()}`,
      projectId,
      method: (item.method || "GET").toUpperCase() as any,
      path: item.path.startsWith("/") ? item.path : `/${item.path}`,
      description: item.description || "No description provided.",
      authRequired: !!item.authRequired,
      requestBodySchema: item.requestBodySchema || "",
      parameters: item.parameters || [],
      responses: item.responses || [{ statusCode: 200, description: "OK" }],
      fileOrigin: item.fileOrigin || "unknown",
      lineStart: item.lineStart || 1,
      lineEnd: item.lineEnd || 10,
    }));

    dbState.endpoints.push(...finalEndpoints);
    saveDb();

    // 3. GENERATE OPENAPI AND MARKDOWN DOCUMENTS
    await generateDocsAndSaveVersion(projectId, project.versionNo);

    // Mark completed
    project.status = "completed";
    saveDb();
    console.log(`Successfully completed documentation generation for project: ${project.name}`);
  } catch (err: any) {
    console.error(`Error processing project ${projectId}:`, err);
    project.status = "failed";
    project.error = err.message || "Unknown analysis error occurred.";
    saveDb();
  }
}

/**
 * Re-generate OpenAPI Spec and Markdown representation and save a historical document version.
 */
async function generateDocsAndSaveVersion(projectId: string, versionNo: number) {
  const project = dbState.projects.find((p) => p.id === projectId);
  if (!project) return;

  const endpoints = dbState.endpoints.filter((e) => e.projectId === projectId);

  // A. Generate OpenAPI Spec object
  const paths: any = {};
  endpoints.forEach((ep) => {
    const formattedPath = ep.path.replace(/:(\w+)/g, "{$1}"); // Convert /api/projects/:id to /api/projects/{id}
    if (!paths[formattedPath]) {
      paths[formattedPath] = {};
    }

    const pathParameters = ep.parameters
      .filter((p) => p.in === "path")
      .map((p) => ({
        name: p.name,
        in: "path",
        required: true,
        schema: { type: p.type || "string" },
        description: p.description,
      }));

    const queryParameters = ep.parameters
      .filter((p) => p.in === "query")
      .map((p) => ({
        name: p.name,
        in: "query",
        required: p.required,
        schema: { type: p.type || "string" },
        description: p.description,
      }));

    const headerParameters = ep.parameters
      .filter((p) => p.in === "header")
      .map((p) => ({
        name: p.name,
        in: "header",
        required: p.required,
        schema: { type: p.type || "string" },
        description: p.description,
      }));

    const parameters = [...pathParameters, ...queryParameters, ...headerParameters];

    const responses: any = {};
    ep.responses.forEach((res) => {
      responses[res.statusCode] = {
        description: res.description,
        content: res.schema
          ? {
              "application/json": {
                schema: {
                  type: "object",
                  example: safeJsonParse(res.schema),
                },
              },
            }
          : undefined,
      };
    });

    const requestBody = ep.requestBodySchema
      ? {
          content: {
            "application/json": {
              schema: {
                type: "object",
                description: ep.requestBodySchema,
              },
            },
          },
        }
      : undefined;

    paths[formattedPath][ep.method.toLowerCase()] = {
      summary: ep.description.split(".")[0],
      description: ep.description,
      operationId: `${ep.method.toLowerCase()}_${ep.path.replace(/\//g, "_").replace(/{|}/g, "")}`,
      security: ep.authRequired ? [{ BearerAuth: [] }] : [],
      parameters,
      requestBody,
      responses,
    };
  });

  const openApiObject = {
    openapi: "3.0.0",
    info: {
      title: project.name,
      description: `Generated API Documentation for the ${project.framework} backend service.`,
      version: `1.${versionNo}.0`,
    },
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter your bearer token in the format: Bearer <token>",
        },
      },
    },
    paths,
  };

  const openApiSpec = JSON.stringify(openApiObject, null, 2);

  // B. Generate Markdown Doc
  let markdownDoc = `# ${project.name} - API Documentation\n\n`;
  markdownDoc += `**Framework:** ${project.framework.toUpperCase()}\n`;
  markdownDoc += `**Version:** 1.${versionNo}.0\n`;
  markdownDoc += `**Generated:** ${new Date().toLocaleDateString()}\n\n`;
  markdownDoc += `## Table of Endpoints\n\n`;
  markdownDoc += `| Method | Path | Description | Auth Required |\n`;
  markdownDoc += `|---|---|---|---|\n`;

  endpoints.forEach((ep) => {
    markdownDoc += `| \`${ep.method}\` | \`${ep.path}\` | ${ep.description.split("\n")[0]} | ${ep.authRequired ? "✅ Yes" : "❌ No"} |\n`;
  });

  markdownDoc += `\n---\n\n## API Specification Details\n\n`;

  endpoints.forEach((ep) => {
    markdownDoc += `### ${ep.method} ${ep.path}\n\n`;
    markdownDoc += `**Description:** ${ep.description}\n\n`;
    markdownDoc += `**Auth Required:** ${ep.authRequired ? "Yes (Bearer Token)" : "No"}\n\n`;
    markdownDoc += `**Source Location:** \`${ep.fileOrigin}\` (Lines ${ep.lineStart}-${ep.lineEnd})\n\n`;

    const params = ep.parameters;
    if (params.length > 0) {
      markdownDoc += `#### Request Parameters\n\n`;
      markdownDoc += `| Name | Position | Type | Required | Description |\n`;
      markdownDoc += `|---|---|---|---|---|\n`;
      params.forEach((p) => {
        markdownDoc += `| \`${p.name}\` | \`${p.in}\` | \`${p.type}\` | ${p.required ? "Required" : "Optional"} | ${p.description} |\n`;
      });
      markdownDoc += `\n`;
    }

    if (ep.requestBodySchema) {
      markdownDoc += `#### Request Body Schema\n\n`;
      markdownDoc += `\`\`\`json\n${ep.requestBodySchema}\n\`\`\`\n\n`;
    }

    markdownDoc += `#### Responses\n\n`;
    ep.responses.forEach((res) => {
      markdownDoc += `##### Status \`${res.statusCode}\`\n\n`;
      markdownDoc += `${res.description}\n\n`;
      if (res.schema) {
        markdownDoc += `\`\`\`json\n${res.schema}\n\`\`\`\n\n`;
      }
    });

    markdownDoc += `\n---\n`;
  });

  // Save the historical version
  const newVersion: DocumentVersion = {
    id: `v-${projectId}-${versionNo}-${Date.now()}`,
    projectId,
    versionNo,
    generatedAt: new Date().toISOString(),
    endpoints,
    openApiSpec,
    markdownDoc,
  };

  dbState.versions.push(newVersion);
  saveDb();
}

/**
 * Trigger update of active specification files
 */
function updateOpenApiSpec(projectId: string) {
  const project = dbState.projects.find((p) => p.id === projectId);
  if (!project) return;
  generateDocsAndSaveVersion(projectId, project.versionNo);
}

// JSON parsing helper
function safeJsonParse(val: string) {
  try {
    return JSON.parse(val);
  } catch {
    return val;
  }
}

// Start Server Setup
async function startServer() {
  // Integrate Vite as Middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
