# API Documentation Agent

A full-stack app for analyzing backend code and generating API documentation with an AI-assisted workflow.

## Run locally

Prerequisites: Node.js

1. Install dependencies:
   `npm install`
2. Create a `.env` file and add your Gemini key:
   `GEMINI_API_KEY=your_key_here`
3. Start the app:
   `npm run dev`

## Deploy to Render

This project is configured for Render deployment.

1. Push this repository to GitHub.
2. In Render, create a new Web Service and connect the repository.
3. Use these settings:
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
4. Add the environment variable:
   - `GEMINI_API_KEY=your_key_here`
   - `NODE_ENV=production`
