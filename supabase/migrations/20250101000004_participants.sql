-- Participants table for multi-user unit coordination
CREATE TABLE IF NOT EXISTS public.participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id text NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  role text NOT NULL DEFAULT 'collaborator' 
    CHECK (role IN ('owner', 'collaborator', 'provider', 'observer')),
  display_name text,
  invited_by uuid REFERENCES auth.users(id),
  invited_at timestamptz DEFAULT now(),
  joined_at timestamptz,
  status text NOT NULL DEFAULT 'invited'
    CHECK (status IN ('invited', 'active', 'declined', 'removed')),
  UNIQUE(unit_id, user_id)
);

-- Enable RLS
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;

-- Policy: unit owners can manage participants
CREATE POLICY "owners_manage_participants" ON public.participants
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.units 
      WHERE id = participants.unit_id 
      AND owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.units 
      WHERE id = participants.unit_id 
      AND owner_id = auth.uid()
    )
  );

-- Policy: participants can see their own participation records
CREATE POLICY "participants_see_own" ON public.participants
  FOR SELECT
  USING (user_id = auth.uid());

-- Policy: participants can update their own status (accept/decline)
CREATE POLICY "participants_update_own_status" ON public.participants
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_participants_unit ON public.participants(unit_id);
CREATE INDEX IF NOT EXISTS idx_participants_user ON public.participants(user_id);
