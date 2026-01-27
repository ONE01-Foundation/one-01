# 🚀 Quick Deployment Steps

## ⚠️ Important: About "Cannot GET /"

**This is NORMAL!** Your backend is a Socket.io server, not a web server. It doesn't serve HTML pages.

- ✅ Backend is working if you see: "⏳ Waiting for connections..."
- ✅ Test it: Visit `http://localhost:3000/health` (should return JSON)
- ❌ Don't expect `http://localhost:3000/` to show a webpage

## Step 1: Commit and Push to Git

```bash
# Add all files
git add .

# Create commit
git commit -m "Initial commit - ONE Platform ready for deployment"

# Push to your repository (replace with your actual repo URL)
git remote add origin https://github.com/YOUR_USERNAME/one-01.git
git branch -M main
git push -u origin main
```

**If you already have a remote:**
```bash
git push origin main
```

## Step 2: Cloudflare Pages Configuration

Based on your screenshot, fill in:

1. **Production branch**: 
   - Select: `main` (or whatever your main branch is called)

2. **Build command**: 
   ```bash
   npm install && npx expo export --platform web
   ```

3. **Build output directory**: 
   ```bash
   dist
   ```

4. **Framework preset**: 
   - Leave empty or select "None"

5. **Environment variables** (Click "Add variable"):
   - `EXPO_PUBLIC_SOCKET_SERVER_URL` = `wss://api.one01.io` (or your backend URL)
   - `EXPO_PUBLIC_SUPABASE_URL` = (your Supabase URL)
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` = (your Supabase key)
   - `EXPO_PUBLIC_ELEVENLABS_API_KEY` = (your ElevenLabs key)

6. Click **"Save and Deploy"**

## Step 3: After First Deployment

1. Go to **Settings → Custom domains**
2. Add: `one01.io`
3. Cloudflare will auto-configure DNS and SSL

## Step 4: Backend Deployment (Separate)

Your backend needs separate hosting. Quick options:

### Railway (Easiest):
1. Go to https://railway.app
2. New Project → Deploy from GitHub
3. Select `one-01-backend` folder
4. Add environment variables
5. Get URL like: `your-app.railway.app`
6. Update frontend env var: `EXPO_PUBLIC_SOCKET_SERVER_URL`

### Render:
1. Go to https://render.com
2. New Web Service
3. Connect GitHub → Select `one-01-backend`
4. Build: `npm install && npm run build`
5. Start: `npm start`

## ✅ Checklist

- [ ] Git repo pushed (main branch)
- [ ] Cloudflare Pages: Production branch = `main`
- [ ] Cloudflare Pages: Build command = `npm install && npx expo export --platform web`
- [ ] Cloudflare Pages: Output directory = `dist`
- [ ] Environment variables added in Cloudflare
- [ ] Custom domain `one01.io` connected
- [ ] Backend deployed separately
- [ ] Frontend env var updated with backend URL

## 🎯 Test After Deployment

1. Visit: `https://one01.io` (should show your app)
2. Check backend: Your app should connect to Socket.io server
3. Monitor: Cloudflare Pages → Deployments (check build logs)

