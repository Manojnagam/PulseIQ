-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS pulsezen_centers (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at   timestamptz DEFAULT now(),
  center_name  text NOT NULL,
  owner_name   text NOT NULL,
  whatsapp     text NOT NULL,
  city         text NOT NULL,
  locality     text NOT NULL,
  landmark     text,
  timings      text,
  maps_link    text,
  tier         text NOT NULL,
  status       text DEFAULT 'pending',  -- pending | approved | rejected | waitlist
  exclusive    boolean DEFAULT false,   -- true = area locked to this center
  rank         int DEFAULT null         -- 1 = first in locality, 2 = second, etc.
);

-- View: see all centers grouped by locality with their rank
-- Run this query anytime to check who is first in each area:

-- SELECT city, locality, center_name, owner_name, whatsapp, tier, exclusive, rank, created_at
-- FROM pulsezen_centers
-- ORDER BY city, locality, created_at ASC;
