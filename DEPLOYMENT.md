# Aurora Portal - Deployment Guide

This guide will help you deploy Aurora Portal for select users with password protection.

## Architecture

- **Frontend (Next.js)**: Deployed on Vercel
- **Backend (Express/Socket.io)**: Deployed on Railway
- **Authentication**: Simple password protection
- **Data Storage**: Client-side (IndexedDB/localStorage)

---

## Prerequisites

1. GitHub account
2. Vercel account (free tier): https://vercel.com/signup
3. Railway account (free tier): https://railway.app
4. Your Anthropic API key

---

## Part 1: Deploy Backend Server (Railway)

### Step 1: Prepare Server for Deployment

The server code is already configured for deployment. It uses environment variables for configuration.

### Step 2: Deploy to Railway

1. Go to https://railway.app and sign in
2. Click "New Project" → "Deploy from GitHub repo"
3. Connect your GitHub account and select your repository
4. Railway will detect the `server` directory
5. Configure the root directory:
   - Click on your service
   - Go to "Settings" → "Service Settings"
   - Set "Root Directory" to `server`

### Step 3: Set Environment Variables

In Railway, go to your service → "Variables" tab and add:

```
CLIENT_URL=http://localhost:3000,https://your-app-name.vercel.app
PORT=3001
ANTHROPIC_API_KEY=your-anthropic-api-key-here
```

**Note**: Replace `your-app-name.vercel.app` with your actual Vercel domain (you'll get this in Part 2).

### Step 4: Get Your Server URL

1. Go to "Settings" → "Networking"
2. Click "Generate Domain"
3. Copy the generated URL (e.g., `https://your-server.up.railway.app`)
4. **Save this URL** - you'll need it for the frontend deployment

---

## Part 2: Deploy Frontend (Vercel)

### Step 1: Set Environment Variables Locally

Create a `.env.local` file in the root directory:

```bash
AURORA_PASSWORD=your-secure-password-here
AUTH_SECRET=iFDAbQTw8fA06e/aJPC7jKrAyiIfPNI/9ln//qjWFNk=
NEXT_PUBLIC_SERVER_URL=https://your-server.up.railway.app
ANTHROPIC_API_KEY=your-anthropic-api-key-here
```

Replace:
- `your-secure-password-here` with a strong password
- `https://your-server.up.railway.app` with your Railway server URL from Part 1

### Step 2: Deploy to Vercel

1. Push your code to GitHub
2. Go to https://vercel.com and sign in
3. Click "Add New..." → "Project"
4. Import your GitHub repository
5. Vercel will auto-detect Next.js settings
6. Click "Deploy"

### Step 3: Set Environment Variables in Vercel

1. Go to your project → "Settings" → "Environment Variables"
2. Add the same variables from `.env.local`:
   - `AURORA_PASSWORD`
   - `AUTH_SECRET`
   - `NEXT_PUBLIC_SERVER_URL`
   - `ANTHROPIC_API_KEY`
3. Make sure to select "Production", "Preview", and "Development" for each variable
4. Click "Save"

### Step 4: Redeploy

After adding environment variables:
1. Go to "Deployments" tab
2. Click the three dots on the latest deployment
3. Click "Redeploy"

### Step 5: Update Railway CORS

Now that you have your Vercel URL:
1. Go back to Railway → your service → "Variables"
2. Update `CLIENT_URL` to include your Vercel domain:
   ```
   CLIENT_URL=http://localhost:3000,https://your-app-name.vercel.app
   ```
3. Railway will automatically redeploy

---

## Part 3: Test Your Deployment

### Test Authentication

1. Visit your Vercel URL (e.g., `https://your-app-name.vercel.app`)
2. You should be redirected to the login page
3. Enter the password you set in `AURORA_PASSWORD`
4. You should be redirected to the main app

### Test Real-time Features

1. Open the browser console (F12)
2. Create a new universe or nexus
3. Check the console for WebSocket connection messages
4. You should see: `✅ Connected to WebSocket: [socket-id]`

### Test on Multiple Devices

1. Open the app on a different device or browser
2. Log in with the same password
3. Verify everything works

---

## Part 4: Share Access with Users

### Sharing Instructions

Send your users:

1. **URL**: `https://your-app-name.vercel.app`
2. **Password**: The password you set in `AURORA_PASSWORD`
3. **Instructions**:
   ```
   Welcome to Aurora Portal!
   
   1. Visit: https://your-app-name.vercel.app
   2. Enter the access code: [your-password]
   3. Start creating universes and exploring ideas!
   
   Note: Your data is stored locally in your browser.
   Use the same browser to access your saved universes.
   ```

### Changing the Password

To change the access password:

1. Go to Vercel → your project → "Settings" → "Environment Variables"
2. Edit `AURORA_PASSWORD`
3. Click "Save"
4. Go to "Deployments" → Redeploy
5. Inform your users of the new password

---

## Troubleshooting

### Login page doesn't appear
- Check that `middleware.ts` is in the root directory
- Verify `AURORA_PASSWORD` is set in Vercel environment variables
- Check browser console for errors

### "Invalid password" error
- Verify the password matches exactly (case-sensitive)
- Check Vercel environment variables are set correctly
- Try redeploying after setting variables

### WebSocket connection fails
- Check `NEXT_PUBLIC_SERVER_URL` is set correctly in Vercel
- Verify Railway server is running (check Railway dashboard)
- Check `CLIENT_URL` in Railway includes your Vercel domain
- Open browser console and look for CORS errors

### Real-time features don't work
- Verify WebSocket connection in browser console
- Check Railway logs for errors
- Ensure both frontend and backend are deployed and running

### Data not persisting
- This is expected - data is stored client-side
- Users must use the same browser to access their data
- Consider implementing server-side storage for production use

---

## Monitoring

### Railway Logs
- Go to Railway → your service → "Deployments" → click on a deployment
- View real-time logs to debug issues

### Vercel Logs
- Go to Vercel → your project → "Deployments" → click on a deployment
- View function logs and errors

---

## Cost Estimates

### Free Tier Limits

**Vercel**:
- 100 GB bandwidth/month
- Unlimited deployments
- Serverless function executions: 100 GB-hours

**Railway**:
- $5 free credit/month
- ~500 hours of uptime (if server is always running)

### Scaling Considerations

If you exceed free tier limits:
- Vercel Pro: $20/month
- Railway: Pay-as-you-go after free credit

---

## Security Notes

1. **Password Protection**: Simple but effective for small groups
2. **HTTPS**: Both Vercel and Railway provide HTTPS by default
3. **HTTP-only Cookies**: Auth cookies are secure and can't be accessed by JavaScript
4. **Environment Variables**: Never commit `.env.local` to git

---

## Next Steps

### For Production Use

Consider implementing:
1. **Individual user accounts** with NextAuth.js
2. **Server-side data storage** (PostgreSQL, MongoDB)
3. **Rate limiting** to prevent abuse
4. **Analytics** to monitor usage
5. **Backup system** for user data

---

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review Railway and Vercel logs
3. Check browser console for errors
4. Verify all environment variables are set correctly

---

## Quick Reference

### Environment Variables

**Frontend (.env.local)**:
```
AURORA_PASSWORD=your-password
AUTH_SECRET=your-secret-key
NEXT_PUBLIC_SERVER_URL=https://your-server.railway.app
ANTHROPIC_API_KEY=your-api-key
```

**Backend (Railway)**:
```
CLIENT_URL=http://localhost:3000,https://your-app.vercel.app
PORT=3001
ANTHROPIC_API_KEY=your-api-key
```

### Useful Commands

```bash
# Test locally
npm run dev                    # Frontend (port 3000)
cd server && npm start         # Backend (port 3001)

# Build for production
npm run build                  # Test production build locally
```
