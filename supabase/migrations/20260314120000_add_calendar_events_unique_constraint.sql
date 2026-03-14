DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'calendar_events_person_name_event_date_key'
      AND conrelid = 'public.calendar_events'::regclass
  ) THEN
    ALTER TABLE public.calendar_events
      ADD CONSTRAINT calendar_events_person_name_event_date_key
      UNIQUE (person_name, event_date);
  END IF;
END $$;
