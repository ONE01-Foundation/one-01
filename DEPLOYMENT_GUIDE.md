# 🚀 Deployment Guide - one01.io

## Architecture Overview

- **Frontend (Expo Web)**: Deploy to Cloudflare Pages → `one01.io`
- **Backend (Socket.io)**: Needs separate hosting (Railway, Render, etc.) → `api.one01.io` or subdomain

## Step 1: Initialize Git Repository

If you haven't already:

```bash
# Initialize git (if not done)
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit - ONE Platform"
```

## Step 2: Push to GitHub/GitLab/Bitbucket

### If using GitHub:

```bash
# Create repo on GitHub first, then:
git remote add origin https://github.com/YOUR_USERNAME/one-01.git
git branch -M main
git push -u origin main
```

### If using GitLab:

```bash
git remote add origin https://gitlab.com/YOUR_USERNAME/one-01.git
git branch -M main
git push -u origin main
```

## Step 3: Configure Cloudflare Pages

### In Cloudflare Dashboard:

1. **Project name**: `one-01` ✅ (already set)

2. **Production branch**: 
   - Select: `main` (or `master` if that's your branch name)
   - This is REQUIRED - select your main branch

3. **Build settings**:
   - **Framework preset**: Leave empty or select "None"
   - **Build command**: 
     ```bash
     npm install && npx expo export --platform web
     ```
   - **Build output directory**: 
     ```bash
     dist
     ```

4. **Environment variables** (Important!):
   Click "Add environment variable" and add:
   - `EXPO_PUBLIC_SOCKET_SERVER_URL` = `wss://api.one01.io` (or your backend URL)
   - `EXPO_PUBLIC_SUPABASE_URL` = (your Supabase URL)
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` = (your Supabase key)
   - `EXPO_PUBLIC_ELEVENLABS_API_KEY` = (your ElevenLabs key)

5. Click **"Save and Deploy"**

## Step 4: Connect Custom Domain

After first deployment:

1. Go to **Settings → Custom domains**
2. Click **"Set up a custom domain"**
3. Enter: `one01.io`
4. Cloudflare will auto-configure DNS and SSL

## Step 5: Backend Deployment (Separate)

The backend needs separate hosting. Options:

### Option A: Railway (Recommended - Easy)

1. Go to https://railway.app
2. New Project → Deploy from GitHub
3. Select `one-01-backend` folder
4. Add environment variables from `.env`
5. Railway gives you a URL like: `your-app.railway.app`
6. Update CORS in backend to include `https://one01.io`

### Option B: Render

1. Go to https://render.com
2. New Web Service → Connect GitHub
3. Select `one-01-backend`
4. Build: `npm install && npm run build`
5. Start: `npm start`
6. Add environment variables

### Option C: Cloudflare Workers (Advanced)

For Socket.io, you'd need Cloudflare Durable Objects.

## Step 6: Update Frontend Environment Variables

After backend is deployed:

1. In Cloudflare Pages → Settings → Environment variables
2. Update `EXPO_PUBLIC_SOCKET_SERVER_URL` to your backend URL
3. Redeploy (or it auto-deploys on next push)

## Step 7: DNS Configuration

In Cloudflare DNS:

- **A Record**: `@` → Cloudflare Pages IP (auto-set)
- **CNAME**: `www` → `one-01-9kf.pages.dev` (or your Pages URL)
- **CNAME**: `api` → Your backend URL (if using subdomain)

## 🔧 Troubleshooting

### "Cannot GET /" in Browser

**This is NORMAL for the backend!** The backend is a Socket.io server, not a web server. It doesn't serve HTML pages.

To test backend:
- Visit: `http://localhost:3000/health` (should return JSON)
- Or connect via Socket.io client (your Expo app)

### Build Fails on Cloudflare

**Check build logs:**
1. Go to Cloudflare Pages → Deployments
2. Click on failed deployment
3. Check error messages

**Common fixes:**
- Make sure `package.json` has all dependencies
- Check Node version (use 18 in build settings)
- Verify build command is correct

### Environment Variables Not Working

- Make sure they start with `EXPO_PUBLIC_`
- Redeploy after adding variables
- Check build logs to verify they're being used

## 📋 Quick Checklist

- [ ] Git repo initialized and pushed
- [ ] Cloudflare Pages connected to repo
- [ ] Production branch selected (main/master)
- [ ] Build command set: `npm install && npx expo export --platform web`
- [ ] Output directory set: `dist`
- [ ] Environment variables added
- [ ] Custom domain `one01.io` connected
- [ ] Backend deployed separately
- [ ] Frontend environment variables updated with backend URL

## 🎯 Next Steps After Deployment

1. **Test frontend**: Visit `https://one01.io`
2. **Test backend**: Connect from frontend
3. **Monitor**: Check Cloudflare Analytics
4. **Update**: Push changes → Auto-deploys

