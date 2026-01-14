# Quick Deployment Guide - Aurora Portal

Your code is already pushed to GitHub! Now just follow these steps to deploy.

---

## Step 1: Deploy Frontend to Vercel (5 minutes)

### 1.1 Import Project
1. Go to: https://vercel.com/new
2. Log in with GitHub if needed
3. Find **mdiskint/aurora_v2** in the repository list
4. Click **"Import"**

### 1.2 Configure Project
On the "Configure Project" page:

1. **Framework Preset**: Should auto-detect as "Next.js" ✅
2. **Root Directory**: Leave as `./` (default)
3. **Build Command**: Leave as default
4. **Output Directory**: Leave as default

### 1.3 Add Environment Variables
Click **"Environment Variables"** and add these **4 variables**:

| Name | Value |
|------|-------|
| `AURORA_PASSWORD` | Choose a secure password (e.g., `MySecurePass123!`) |
| `AUTH_SECRET` | `iFDAbQTw8fA06e/aJPC7jKrAyiIfPNI/9ln//qjWFNk=` |
| `NEXT_PUBLIC_SERVER_URL` | `http://localhost:3001` (we'll update this after Railway) |
| `ANTHROPIC_API_KEY` | Your Anthropic API key |

### 1.4 Deploy
1. Click **"Deploy"**
2. Wait 2-3 minutes for deployment
3. **Copy your Vercel URL** (e.g., `https://aurora-v2-xxx.vercel.app`)
4. **Save this URL** - you'll need it!

---

## Step 2: Deploy Backend to Railway (5 minutes)

### 2.1 Create New Project
1. Go to: https://railway.app
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose **mdiskint/aurora_v2**

### 2.2 Configure Service
1. Click on your new service
2. Go to **"Settings"** → **"Service Settings"**
3. Set **"Root Directory"** to: `server`
4. Click **"Save"**

### 2.3 Add Environment Variables
Go to **"Variables"** tab and add these **3 variables**:

| Name | Value |
|------|-------|
| `CLIENT_URL` | `http://localhost:3000,https://YOUR-VERCEL-URL` |
| `PORT` | `3001` |
| `ANTHROPIC_API_KEY` | Your Anthropic API key |

**Important**: Replace `YOUR-VERCEL-URL` with the URL you got from Step 1.4

### 2.4 Generate Domain
1. Go to **"Settings"** → **"Networking"**
2. Click **"Generate Domain"**
3. **Copy the Railway URL** (e.g., `https://aurora-server-production.up.railway.app`)
4. **Save this URL** - you need it for the next step!

---

## Step 3: Update Vercel with Railway URL (2 minutes)

### 3.1 Update Environment Variable
1. Go back to Vercel: https://vercel.com
2. Go to your project → **"Settings"** → **"Environment Variables"**
3. Find `NEXT_PUBLIC_SERVER_URL`
4. Click **"Edit"**
5. Change value from `http://localhost:3001` to **your Railway URL** from Step 2.4
6. Click **"Save"**

### 3.2 Redeploy
1. Go to **"Deployments"** tab
2. Click the **three dots** (⋯) on the latest deployment
3. Click **"Redeploy"**
4. Wait 1-2 minutes

---

## Step 4: Test Your Deployment (2 minutes)

### 4.1 Visit Your App
1. Go to your Vercel URL (from Step 1.4)
2. You should see the **login page** ✅
3. Enter the password you set in Step 1.3
4. You should be redirected to the **main app** ✅

### 4.2 Test WebSocket Connection
1. Press **F12** to open browser console
2. Create a new universe or nexus
3. Look for: `✅ Connected to WebSocket: [socket-id]` ✅

---

## Step 5: Share with Users

Send your users:

```
🌟 Welcome to Aurora Portal!

URL: https://your-vercel-url.vercel.app
Password: [your-password-from-step-1.3]

Just visit the URL, enter the password, and start exploring!
```

---

## Troubleshooting

### "Invalid password" error
- Make sure you're entering the exact password from Step 1.3 (case-sensitive)
- Check Vercel environment variables are saved correctly

### WebSocket not connecting
- Verify `NEXT_PUBLIC_SERVER_URL` in Vercel matches your Railway URL
- Check `CLIENT_URL` in Railway includes your Vercel URL
- Look for CORS errors in browser console

### Railway service not running
- Check Railway dashboard - service should show "Active"
- View logs in Railway to see any errors

---

## Quick Reference

**Your URLs:**
- Frontend (Vercel): `https://your-app.vercel.app`
- Backend (Railway): `https://your-server.railway.app`

**Environment Variables:**

Vercel:
```
AURORA_PASSWORD=your-chosen-password
AUTH_SECRET=iFDAbQTw8fA06e/aJPC7jKrAyiIfPNI/9ln//qjWFNk=
NEXT_PUBLIC_SERVER_URL=https://your-railway-url
ANTHROPIC_API_KEY=your-api-key
```

Railway:
```
CLIENT_URL=http://localhost:3000,https://your-vercel-url
PORT=3001
ANTHROPIC_API_KEY=your-api-key
```

---

**Total Time: ~15 minutes** ⏱️

Good luck! 🚀
