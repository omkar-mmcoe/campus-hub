
-- ============ USERS / PROFILES ============
CREATE TABLE public.evm_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  avatar_url TEXT,
  college_name TEXT,
  department TEXT,
  roll_number TEXT,
  role TEXT NOT NULL DEFAULT 'student',
  interests TEXT[] NOT NULL DEFAULT '{}',
  onboarding_complete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evm_users TO authenticated;
GRANT SELECT ON public.evm_users TO anon;
GRANT ALL ON public.evm_users TO service_role;
ALTER TABLE public.evm_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON public.evm_users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.evm_users FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.evm_users FOR INSERT WITH CHECK (auth.uid() = id);

-- ============ EVENTS ============
CREATE TABLE public.evm_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL REFERENCES public.evm_users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  tagline TEXT,
  description TEXT,
  event_type TEXT NOT NULL DEFAULT 'technical',
  venue TEXT NOT NULL DEFAULT '',
  location_city TEXT,
  start_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  max_participants INTEGER,
  registration_fee NUMERIC NOT NULL DEFAULT 0,
  poster_url TEXT,
  banner_url TEXT,
  status TEXT NOT NULL DEFAULT 'upcoming',
  total_registrations INTEGER NOT NULL DEFAULT 0,
  average_rating NUMERIC NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evm_events TO authenticated;
GRANT SELECT ON public.evm_events TO anon;
GRANT ALL ON public.evm_events TO service_role;
ALTER TABLE public.evm_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published events are public" ON public.evm_events FOR SELECT USING (status <> 'draft' OR auth.uid() = organizer_id);
CREATE POLICY "Organizers manage own events" ON public.evm_events FOR ALL USING (auth.uid() = organizer_id) WITH CHECK (auth.uid() = organizer_id);

-- ============ EVENT AGENDA ============
CREATE TABLE public.evm_event_agenda (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.evm_events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  speaker_name TEXT,
  start_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evm_event_agenda TO authenticated;
GRANT SELECT ON public.evm_event_agenda TO anon;
GRANT ALL ON public.evm_event_agenda TO service_role;
ALTER TABLE public.evm_event_agenda ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agenda is public" ON public.evm_event_agenda FOR SELECT USING (true);
CREATE POLICY "Organizers manage own agenda" ON public.evm_event_agenda FOR ALL
  USING (EXISTS (SELECT 1 FROM public.evm_events e WHERE e.id = event_id AND e.organizer_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.evm_events e WHERE e.id = event_id AND e.organizer_id = auth.uid()));

-- ============ REGISTRATIONS ============
CREATE TABLE public.evm_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.evm_users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.evm_events(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'confirmed',
  qr_code TEXT NOT NULL DEFAULT encode(gen_random_bytes(12), 'hex'),
  checked_in BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evm_registrations TO authenticated;
GRANT ALL ON public.evm_registrations TO service_role;
ALTER TABLE public.evm_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own registrations" ON public.evm_registrations FOR SELECT
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.evm_events e WHERE e.id = event_id AND e.organizer_id = auth.uid()));
CREATE POLICY "Users create own registrations" ON public.evm_registrations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own registrations" ON public.evm_registrations FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own registrations" ON public.evm_registrations FOR DELETE USING (auth.uid() = user_id);

-- ============ REVIEWS ============
CREATE TABLE public.evm_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.evm_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.evm_users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL DEFAULT 5,
  organizer_rating INTEGER NOT NULL DEFAULT 5,
  comment TEXT,
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evm_reviews TO authenticated;
GRANT SELECT ON public.evm_reviews TO anon;
GRANT ALL ON public.evm_reviews TO service_role;
ALTER TABLE public.evm_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reviews are public" ON public.evm_reviews FOR SELECT USING (is_hidden = false OR auth.uid() = user_id);
CREATE POLICY "Users manage own reviews" ON public.evm_reviews FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ ATTENDANCE SESSIONS ============
CREATE TABLE public.evm_attendance_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.evm_events(id) ON DELETE CASCADE,
  session_code TEXT NOT NULL,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  qr_code_data TEXT,
  qr_code_generated_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES public.evm_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evm_attendance_sessions TO authenticated;
GRANT ALL ON public.evm_attendance_sessions TO service_role;
ALTER TABLE public.evm_attendance_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Attendance sessions viewable by event members" ON public.evm_attendance_sessions FOR SELECT
  USING (auth.uid() = created_by OR EXISTS (SELECT 1 FROM public.evm_events e WHERE e.id = event_id AND e.organizer_id = auth.uid())
         OR EXISTS (SELECT 1 FROM public.evm_registrations r WHERE r.event_id = evm_attendance_sessions.event_id AND r.user_id = auth.uid()));
CREATE POLICY "Organizers manage own sessions" ON public.evm_attendance_sessions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.evm_events e WHERE e.id = event_id AND e.organizer_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.evm_events e WHERE e.id = event_id AND e.organizer_id = auth.uid()));

-- ============ ATTENDANCE RECORDS ============
CREATE TABLE public.evm_attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.evm_attendance_sessions(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.evm_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.evm_users(id) ON DELETE CASCADE,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'on_time',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evm_attendance_records TO authenticated;
GRANT ALL ON public.evm_attendance_records TO service_role;
ALTER TABLE public.evm_attendance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Attendance records viewable by organizer and self" ON public.evm_attendance_records FOR SELECT
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.evm_events e WHERE e.id = event_id AND e.organizer_id = auth.uid()));
CREATE POLICY "Users check themselves in" ON public.evm_attendance_records FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Organizers manage attendance records" ON public.evm_attendance_records FOR ALL
  USING (EXISTS (SELECT 1 FROM public.evm_events e WHERE e.id = event_id AND e.organizer_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.evm_events e WHERE e.id = event_id AND e.organizer_id = auth.uid()));

-- ============ NOTIFICATIONS ============
CREATE TABLE public.evm_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.evm_users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'general',
  title TEXT NOT NULL,
  message TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evm_notifications TO authenticated;
GRANT ALL ON public.evm_notifications TO service_role;
ALTER TABLE public.evm_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own notifications" ON public.evm_notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.evm_notifications FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Anyone can insert notifications" ON public.evm_notifications FOR INSERT WITH CHECK (true);

-- ============ TRIGGERS ============
CREATE OR REPLACE FUNCTION public.evm_handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.evm_users (id, name, email, college_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)), NEW.email, NEW.raw_user_meta_data->>'college_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER evm_on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.evm_handle_new_user();

CREATE OR REPLACE FUNCTION public.evm_handle_registration()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ev_title TEXT;
BEGIN
  UPDATE public.evm_events SET total_registrations = total_registrations + 1 WHERE id = NEW.event_id
  RETURNING title INTO ev_title;
  INSERT INTO public.evm_notifications (user_id, type, title, message)
  VALUES (NEW.user_id, 'registration', 'Registration confirmed', 'You are registered for ' || COALESCE(ev_title,'an event') || '. Your QR ticket is ready.');
  RETURN NEW;
END;
$$;
CREATE TRIGGER evm_on_registration AFTER INSERT ON public.evm_registrations FOR EACH ROW EXECUTE FUNCTION public.evm_handle_registration();

CREATE OR REPLACE FUNCTION public.evm_handle_unregistration()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.evm_events SET total_registrations = GREATEST(total_registrations - 1, 0) WHERE id = OLD.event_id;
  RETURN OLD;
END;
$$;
CREATE TRIGGER evm_on_unregistration AFTER DELETE ON public.evm_registrations FOR EACH ROW EXECUTE FUNCTION public.evm_handle_unregistration();

CREATE OR REPLACE FUNCTION public.evm_handle_review()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE eid UUID;
BEGIN
  eid := COALESCE(NEW.event_id, OLD.event_id);
  UPDATE public.evm_events SET average_rating = COALESCE((
    SELECT ROUND(AVG(rating)::numeric, 2) FROM public.evm_reviews WHERE event_id = eid AND is_hidden = false
  ), 0) WHERE id = eid;
  RETURN NULL;
END;
$$;
CREATE TRIGGER evm_on_review AFTER INSERT OR UPDATE OR DELETE ON public.evm_reviews FOR EACH ROW EXECUTE FUNCTION public.evm_handle_review();

CREATE OR REPLACE FUNCTION public.evm_handle_checkin()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.evm_registrations SET checked_in = true WHERE event_id = NEW.event_id AND user_id = NEW.user_id;
  INSERT INTO public.evm_notifications (user_id, type, title, message)
  VALUES (NEW.user_id, 'attendance', 'Checked in', 'Your attendance has been recorded.');
  RETURN NEW;
END;
$$;
CREATE TRIGGER evm_on_checkin AFTER INSERT ON public.evm_attendance_records FOR EACH ROW EXECUTE FUNCTION public.evm_handle_checkin();

-- ============ REALTIME ============
ALTER TABLE public.evm_attendance_records REPLICA IDENTITY FULL;
ALTER TABLE public.evm_notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.evm_attendance_records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.evm_notifications;
