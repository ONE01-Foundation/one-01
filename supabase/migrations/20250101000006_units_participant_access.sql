-- Allow participants to read units they belong to
CREATE POLICY "participants_read_units" ON public.units
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.participants
      WHERE participants.unit_id = units.id
      AND participants.user_id = auth.uid()
      AND participants.status = 'active'
    )
  );

-- Allow collaborators to update units they participate in
CREATE POLICY "collaborators_update_units" ON public.units
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.participants
      WHERE participants.unit_id = units.id
      AND participants.user_id = auth.uid()
      AND participants.role IN ('collaborator', 'provider')
      AND participants.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.participants
      WHERE participants.unit_id = units.id
      AND participants.user_id = auth.uid()
      AND participants.role IN ('collaborator', 'provider')
      AND participants.status = 'active'
    )
  );
