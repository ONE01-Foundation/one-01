# 📁 Environment Files Guide

## How Many .env Files Do You Need?

### Answer: **1 or 2, depending on your setup**

---

## Option 1: Simple Setup (Recommended to Start)

### You Need: **1 .env file**

**Location:** `one-01/.env` (root of project)

**Contents:**
```env
# Supabase (for database - OPTIONAL for Phase 1)
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=

# OpenAI (for AI responses - Phase 3)
# OPENAI_API_KEY=  (not needed yet)

# ElevenLabs (for voice - Phase 4)
# EXPO_PUBLIC_ELEVENLABS_API_KEY=

# Socket.io Backend (only if using backend - Phase 6)
# EXPO_PUBLIC_SOCKET_SERVER_URL=
```

**For Phase 1 (Basic Chat):** You don't need ANY of these! Just leave them empty or don't create the file.

---

## Option 2: With Backend Server

### You Need: **2 .env files**

**1. Frontend `.env`** (same as above)
- Location: `one-01/.env`
- Used by: Expo app

**2. Backend `.env`**
- Location: `one-01-backend/.env`
- Used by: Node.js server

**Backend `.env` contents:**
```env
PORT=3000
OPENAI_API_KEY=your_key_here
CORS_ORIGIN=http://localhost:8081
```

---

## 📋 When Do You Need Each?

| Phase | Frontend .env | Backend .env | Notes |
|-------|--------------|--------------|-------|
| Phase 1: Basic Chat | ❌ Not needed | ❌ Not needed | Works without any .env |
| Phase 2: Supabase | ✅ Add Supabase keys | ❌ Not needed | Only frontend .env |
| Phase 3: OpenAI | ✅ Add OpenAI key | ❌ Not needed | Can use Supabase Edge Functions |
| Phase 4: Voice | ✅ Add ElevenLabs key | ❌ Not needed | Only frontend .env |
| Phase 6: Backend | ✅ Add Socket URL | ✅ Add backend keys | Both needed |

---

## 🎯 Recommendation

**Start with NO .env files!**

1. Test Phase 1 (basic chat) - works without any config
2. When ready for Phase 2, create `.env` and add Supabase keys
3. Add more keys as you progress through phases

---

## ⚠️ Important Notes

1. **Never commit `.env` to Git** - It's already in `.gitignore` ✅
2. **Use `.env.example`** - Template file (safe to commit)
3. **Cloudflare Pages** - Add env vars in dashboard, not in file
4. **All keys starting with `EXPO_PUBLIC_`** - Available in frontend code
5. **Keys without `EXPO_PUBLIC_`** - Only available in backend

---

## 🔍 Where Are They?

```
one-01/
├── .env                    ← Frontend env (create when needed)
├── .env.example            ← Template (safe to commit)
└── one-01-backend/
    └── .env                ← Backend env (only if using backend)
```

---

## ✅ Quick Checklist

- [ ] Phase 1: No .env needed - just test!
- [ ] Phase 2: Create `.env` with Supabase keys
- [ ] Phase 3: Add OpenAI key to `.env`
- [ ] Phase 6: Create `one-01-backend/.env` if using backend

