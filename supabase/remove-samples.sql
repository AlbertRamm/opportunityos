-- Run before launch: permanently removes all fictional sample opportunities
-- (and, via cascade, any student saves/status rows pointing at them).
delete from public.opportunities where is_sample;
