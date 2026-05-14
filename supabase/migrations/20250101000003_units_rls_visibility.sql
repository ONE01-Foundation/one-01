-- Add ownership and visibility columns
ALTER TABLE public.units 
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private' 
    CHECK (visibility IN ('private', 'shared', 'public'));

-- Backfill owner_id from user_id (cast text to uuid if user_id is text)
-- Only if user_id column exists and contains valid UUIDs
UPDATE public.units 
  SET owner_id = user_id::uuid 
  WHERE owner_id IS NULL AND user_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

-- Policy: owners can do everything with their own units
CREATE POLICY "owners_full_access" ON public.units
  FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Policy: shared units are readable by authenticated users (for now, until participant model exists)
CREATE POLICY "shared_units_readable" ON public.units
  FOR SELECT
  USING (visibility = 'shared' AND auth.role() = 'authenticated');

-- Policy: public units are readable by anyone (including anon)
CREATE POLICY "public_units_readable" ON public.units
  FOR SELECT
  USING (visibility = 'public');

-- Index for visibility queries
CREATE INDEX IF NOT EXISTS idx_units_visibility ON public.units(visibility);
CREATE INDEX IF NOT EXISTS idx_units_owner ON public.units(owner_id);
