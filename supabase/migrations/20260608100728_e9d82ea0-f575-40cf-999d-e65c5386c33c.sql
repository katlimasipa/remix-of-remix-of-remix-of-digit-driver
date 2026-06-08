
DROP POLICY IF EXISTS "own profile update" ON public.profiles;
CREATE POLICY "own profile update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "own sessions update" ON public.trading_sessions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
