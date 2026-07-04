import { CodeChunk, Endpoint, CodeFile } from "./types";

/**
 * Split source code into logical chunks of roughly maxLines (50 lines) or maxCharacters (1500 chars).
 * Splits on line breaks, keeping logical functions and import/route groups together when possible.
 */
export function chunkCode(file: CodeFile, projectId: string): CodeChunk[] {
  const lines = file.content.split("\n");
  const chunks: CodeChunk[] = [];
  let currentChunkLines: string[] = [];
  let currentStartLine = 1;
  let currentCharCount = 0;

  const maxLines = 60;
  const maxChars = 2000;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    currentChunkLines.push(line);
    currentCharCount += line.length + 1;

    // Check if we should split
    const isBlankLine = line.trim() === "";
    const isClosingBrace = line.trim() === "}" || line.trim() === "};" || line.trim() === "]" || line.trim() === "];";
    const reachedSizeLimit = currentChunkLines.length >= maxLines || currentCharCount >= maxChars;

    if (reachedSizeLimit && (isBlankLine || isClosingBrace || currentChunkLines.length > maxLines + 20)) {
      chunks.push({
        id: `${projectId}-${file.name}-${currentStartLine}`,
        projectId,
        filePath: file.path,
        content: currentChunkLines.join("\n"),
        lineStart: currentStartLine,
        lineEnd: i + 1,
      });

      // Reset
      currentChunkLines = [];
      currentStartLine = i + 2;
      currentCharCount = 0;
    }
  }

  // Handle trailing lines
  if (currentChunkLines.length > 0) {
    chunks.push({
      id: `${projectId}-${file.name}-${currentStartLine}`,
      projectId,
      filePath: file.path,
      content: currentChunkLines.join("\n"),
      lineStart: currentStartLine,
      lineEnd: lines.length,
    });
  }

  return chunks;
}

/**
 * Compute the cosine similarity between two numeric vectors.
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Realistic Template Codebases to pre-populate or import instantly
 */
export const TEMPLATE_PROJECTS = {
  express: [
    {
      name: "authController.js",
      path: "controllers/authController.js",
      size: 1540,
      content: `const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../db');

/**
 * @route POST /api/auth/register
 * @desc Register a new user
 * @access Public
 */
exports.register = async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Please provide name, email, and password.' });
  }

  try {
    const existingUser = await db.findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'A user with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await db.createUser({ name, email, password: hashedPassword, role: role || 'Developer' });
    
    res.status(201).json({
      message: 'User registered successfully',
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error during registration.' });
  }
};

/**
 * @route POST /api/auth/login
 * @desc Login user and return JWT
 * @access Public
 */
exports.login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const user = await db.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'secretkey',
      { expiresIn: '24h' }
    );

    res.status(200).json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error during login.' });
  }
};`
    },
    {
      name: "projectController.js",
      path: "controllers/projectController.js",
      size: 1940,
      content: `const db = require('../db');

/**
 * @route GET /api/projects
 * @desc Get all projects for the logged-in user
 * @access Private
 */
exports.getProjects = async (req, res) => {
  try {
    const projects = await db.getProjectsByUserId(req.user.id);
    res.status(200).json({ success: true, count: projects.length, data: projects });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve projects.' });
  }
};

/**
 * @route GET /api/projects/:id
 * @desc Get project details by ID
 * @access Private
 */
exports.getProjectById = async (req, res) => {
  try {
    const project = await db.findProjectById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }
    
    // Check ownership
    if (project.userId !== req.user.id && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Not authorized to access this project.' });
    }

    res.status(200).json({ success: true, data: project });
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching project details.' });
  }
};

/**
 * @route POST /api/projects/upload
 * @desc Upload and analyze a new project codebase
 * @access Private
 */
exports.uploadProject = async (req, res) => {
  const { name, framework } = req.body;
  if (!name || !framework) {
    return res.status(400).json({ error: 'Project name and framework (express, fastapi, springboot) are required.' });
  }

  try {
    const newProject = await db.createProject({
      userId: req.user.id,
      name,
      framework,
      status: 'pending',
      createdAt: new Date()
    });

    res.status(201).json({
      message: 'Project uploaded and queued for documentation generation.',
      project: newProject
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to upload project.' });
  }
};`
    },
    {
      name: "routes.js",
      path: "routes/routes.js",
      size: 920,
      content: `const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const projectController = require('../controllers/projectController');
const { protect, authorize } = require('../middleware/auth');

// Authentication Endpoints
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);

// Project Management Endpoints (Requires JWT)
router.get('/projects', protect, projectController.getProjects);
router.get('/projects/:id', protect, projectController.getProjectById);
router.post('/projects/upload', protect, authorize('Developer', 'Admin'), projectController.uploadProject);

module.exports = router;`
    }
  ],
  fastapi: [
    {
      name: "main.py",
      path: "app/main.py",
      size: 1450,
      content: `from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime

app = FastAPI(
    title="Core API Documentation Platform Backend",
    description="Backend analysis and storage service.",
    version="1.0.0"
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: Optional[str] = "Developer"

class UserResponse(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: str
    created_at: datetime

# Endpoint definition
@app.post("/api/auth/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user: UserRegister):
    """
    Register a new user in the platform database.
    """
    if user.email == "existing@example.com":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email address already exists."
        )
    return {
        "id": "usr_94104104",
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "created_at": datetime.now()
    }

@app.post("/token")
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    Standard OAuth2 / password login route returning a JWT token.
    """
    if form_data.username != "admin@apiagent.com" or form_data.password != "admin123":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return {"access_token": "mocked_jwt_token_payload", "token_type": "bearer"}
`
    },
    {
      name: "items.py",
      path: "app/routers/items.py",
      size: 1320,
      content: `from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List

router = APIRouter(
    prefix="/api/items",
    tags=["items"],
    responses={404: {"description": "Item not found"}}
)

class Item(BaseModel):
    name: str
    description: str
    price: float
    tax: float = 0.1

@router.get("/", response_model=List[Item])
async def read_items(limit: int = 10, offset: int = 0):
    """
    Retrieve item lists with pagination.
    """
    return [
        {"name": "Developer Console", "description": "High performance terminal", "price": 499.0},
        {"name": "Local Vector Storage Pack", "description": "Offline vectors kit", "price": 49.0}
    ]

@router.get("/{item_id}", response_model=Item)
async def read_item(item_id: int):
    """
    Fetch an item by its unique ID.
    """
    if item_id > 100:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"name": "Mock Item", "description": f"Item {item_id} details", "price": 99.0}

@router.post("/", response_model=Item, status_code=status.HTTP_201_CREATED)
async def create_item(item: Item):
    """
    Create a new catalog item. Requires authentication header.
    """
    return item
`
    }
  ],
  springboot: [
    {
      name: "UserController.java",
      path: "src/main/java/com/agent/api/controllers/UserController.java",
      size: 1980,
      content: `package com.agent.api.controllers;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final List<Map<String, Object>> mockUsers = new ArrayList<>();

    public UserController() {
        Map<String, Object> u1 = new HashMap<>();
        u1.put("id", "1");
        u1.put("name", "Jane QA");
        u1.put("email", "jane@tester.com");
        u1.put("role", "QA_ENGINEER");
        mockUsers.add(u1);
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getAllUsers() {
        return ResponseEntity.ok(mockUsers);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getUserById(@PathVariable String id) {
        Optional<Map<String, Object>> user = mockUsers.stream()
            .filter(u -> u.get("id").equals(id))
            .findFirst();

        if (user.isPresent()) {
            return ResponseEntity.ok(user.get());
        } else {
            Map<String, String> error = new HashMap<>();
            error.put("error", "User not found with ID: " + id);
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
        }
    }

    @PostMapping("/register")
    public ResponseEntity<?> registerUser(@RequestBody Map<String, String> payload) {
        String name = payload.get("name");
        String email = payload.get("email");
        String role = payload.getOrDefault("role", "API_CONSUMER");

        if (name == null || email == null) {
            Map<String, String> err = new HashMap<>();
            err.put("error", "Name and email are mandatory fields.");
            return ResponseEntity.badRequest().body(err);
        }

        Map<String, Object> newUser = new HashMap<>();
        newUser.put("id", UUID.randomUUID().toString());
        newUser.put("name", name);
        newUser.put("email", email);
        newUser.put("role", role);
        mockUsers.add(newUser);

        return ResponseEntity.status(HttpStatus.CREATED).body(newUser);
    }
}
`
    }
  ]
};
