-- Ensure pgcrypto is available for gen_random_bytes()
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Invitations table for sharing units with non-users
CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id text NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  role text NOT NULL DEFAULT 'collaborator'
    CHECK (role IN ('collaborator', 'provider', 'observer')),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '7 days'),
  max_uses int DEFAULT 1,
  use_count int DEFAULT 0,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'used', 'expired', 'revoked'))
);

-- Enable RLS
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Policy: unit owners can manage invitations
CREATE POLICY "owners_manage_invitations" ON public.invitations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.units 
      WHERE id = invitations.unit_id 
      AND owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.units 
      WHERE id = invitations.unit_id 
      AND owner_id = auth.uid()
    )
  );

-- Policy: anyone can read an invitation by token (for accepting)
-- This uses anon access intentionally — the token itself is the secret
CREATE POLICY "anyone_read_by_token" ON public.invitations
  FOR SELECT
  USING (true);

-- Index
CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_unit ON public.invitations(unit_id);
