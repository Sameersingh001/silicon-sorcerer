# 🚀 Silicon Sorcerer — Deployment Guide

This project is now fully prepared for seamless, comfortable deployment on **Vercel** and cloud platforms like **Render**, **Railway**, or VPS.

---

## ⚡ What Has Been Configured

1. **CORS Configured to Allow ALL Origins (`*`)**:
   - Backend Express server reflects requesting origins dynamically with full credentials support.
   - Preflight `OPTIONS` requests respond with HTTP 200 and allowed methods/headers.
   - Socket.IO CORS configured to allow any origin (`*`).
   - `vercel.json` adds edge CORS headers for all `/api/*` responses.
   - Any domain (Vercel preview URLs, production domains, localhost, mobile apps, Postman) can access the API.

2. **`vercel.json` Created at Root**:
   - Automatically builds frontend into `frontend/dist`.
   - Routes `/api/(.*)` to the serverless backend function (`api/index.js`).
   - Rewrites all client-side SPA routes (`/register`, `/game`, `/admin`, etc.) to `/index.html` so page refreshes never return 404 errors.
   - Configures permissive CORS headers directly at the Vercel CDN/edge level.

3. **Serverless & Cloud Resilient Backend**:
   - Database connection caching with automatic reconnect.
   - Safe WebSocket emits (guards against uninitialized socket instances in serverless environments).
   - Trailing slash sanitization on API URLs and QR code URLs.
   - Health check endpoints at `/` and `/api/health`.

4. **Security & Clean Repository**:
   - Root `.gitignore` and `backend/.gitignore` prevent committing `node_modules` or `.env` secrets.
   - `.env.example` templates created for both frontend and backend.

---

## 🛠️ Deployment Options

### Option 1: Fullstack on Vercel (Simplest — 1 Click)
Deploy both the React frontend and Express API together directly on Vercel using the root `vercel.json`.

1. Push your code to GitHub.
2. Go to [vercel.com](https://vercel.com) and click **"Add New Project"**.
3. Import your GitHub repository.
4. Keep the **Root Directory** as `./` (default).
5. In **Environment Variables**, add:
   - `MONGODB_URI`: Your MongoDB connection string (e.g., Atlas).
   - `JWT_SECRET`: Any random secure string.
   - `ADMIN_USERNAME`: `admin`
   - `ADMIN_PASSWORD`: Your desired admin password.
6. Click **Deploy**!

> **Note on WebSockets:** Vercel serverless functions handle all REST APIs (`/api/*`). For full real-time Socket.IO live quiz synchronized events across participants, deploy the backend on a persistent Node.js host (Option 2).

---

### Option 2: Frontend on Vercel + Backend on Render / Railway (Recommended for Live Quiz)
Because this app features a synchronized live quiz with real-time timers and instant leaderboards via Socket.IO, hosting the backend on a persistent Node server provides the best real-time experience.

#### Step A: Deploy Backend (e.g. Render / Railway)
1. In Render or Railway, create a new **Web Service** from your repository.
2. Set **Root Directory** to `backend`.
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Add Environment Variables:
   - `MONGODB_URI`: Your MongoDB Atlas URI.
   - `JWT_SECRET`: Any secure string.
   - `ADMIN_USERNAME`: `admin`
   - `ADMIN_PASSWORD`: `Admin@123`
6. Deploy and copy your backend URL (e.g., `https://qr-backend.onrender.com`).

#### Step B: Deploy Frontend on Vercel
1. Import repository on Vercel.
2. In Project Settings, set:
   - **Root Directory**: `frontend` (or keep `./` with root vercel.json)
3. Add Environment Variable:
   - `VITE_API_URL`: `https://qr-backend.onrender.com` (your backend URL from Step A)
4. Click **Deploy**!

---

## ⚠️ Important MongoDB Atlas Tip
If using MongoDB Atlas:
1. Log into [cloud.mongodb.com](https://cloud.mongodb.com).
2. Go to **Network Access** in the left sidebar.
3. Click **Add IP Address** -> Select **"Allow Access from Anywhere"** (`0.0.0.0/0`).
4. Without this, cloud servers (Vercel, Render) cannot connect to Atlas and will time out.

---

## 🧪 Testing Locally
- Test backend & CORS: `node api/index.js`
- Test health endpoint: `curl http://localhost:5000/api/health`
- Build frontend: `npm run build`
