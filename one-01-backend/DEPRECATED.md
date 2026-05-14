# Deprecated

This Socket.io backend has been replaced by Supabase Edge Functions.

## Replacement mapping

| Old (Socket.io) | New (Edge Function) |
|---|---|
| `openAIService.chat()` | `supabase/functions/ai-chat/` |
| Voice data handler | `supabase/functions/tts/` |
| Protocol execution | Not yet migrated (not in active flow) |

## Status

- Do NOT deploy this backend for production use
- Do NOT add new features here
- Code preserved for reference during migration
- Will be removed after edge functions are verified stable
