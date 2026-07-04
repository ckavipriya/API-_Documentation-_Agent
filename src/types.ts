/**
 * Shared Type Definitions for the AI API Documentation Agent
 */

export enum UserRole {
  DEVELOPER = "Developer",
  PROJECT_MANAGER = "Project Manager",
  QA_ENGINEER = "QA/Test Engineer",
  API_CONSUMER = "API Consumer",
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface CodeFile {
  name: string;
  path: string;
  content: string;
  size: number;
}

export interface EndpointParameter {
  name: string;
  in: "query" | "path" | "header" | "body";
  type: string;
  required: boolean;
  description: string;
}

export interface EndpointResponse {
  statusCode: number;
  description: string;
  schema?: string; // JSON Schema or description
}

export interface Endpoint {
  id: string;
  projectId: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS" | "HEAD";
  path: string;
  description: string;
  authRequired: boolean;
  requestBodySchema?: string; // JSON schema or description
  parameters: EndpointParameter[];
  responses: EndpointResponse[];
  fileOrigin: string; // The file name/path where this was found
  lineStart?: number;
  lineEnd?: number;
}

export interface CodeChunk {
  id: string;
  projectId: string;
  filePath: string;
  content: string;
  lineStart: number;
  lineEnd: number;
  embedding?: number[];
}

export interface VectorMatch {
  chunk: CodeChunk;
  similarity: number;
}

export interface ChatMessage {
  id: string;
  projectId: string;
  sender: "user" | "assistant";
  content: string;
  retrievedChunks?: {
    filePath: string;
    content: string;
    lineStart: number;
    lineEnd: number;
    similarity: number;
  }[];
  createdAt: string;
}

export interface DocumentVersion {
  id: string;
  projectId: string;
  versionNo: number;
  generatedAt: string;
  endpoints: Endpoint[];
  openApiSpec: string; // JSON string of Swagger/OpenAPI
  markdownDoc: string; // Markdown generated representation
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  framework: "express" | "fastapi" | "springboot" | "other";
  status: "pending" | "processing" | "completed" | "failed";
  error?: string;
  codeFiles: CodeFile[];
  versionNo: number;
  createdAt: string;
}

export interface DatabaseSchema {
  users: User[];
  projects: Project[];
  endpoints: Endpoint[];
  chunks: CodeChunk[];
  chatHistories: { [projectId: string]: ChatMessage[] };
  versions: DocumentVersion[];
}
