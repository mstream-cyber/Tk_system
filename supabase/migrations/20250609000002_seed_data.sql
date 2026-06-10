DO $$
DECLARE
  event_id UUID;
BEGIN
  INSERT INTO events (name, date, venue, city)
  VALUES (
    'Rock the World 2026',
    '2026-09-20 19:00:00+05',
    'Expo Center',
    'Karachi'
  )
  RETURNING id INTO event_id;

  INSERT INTO ticket_types (event_id, name, price, total_quantity, available_quantity)
  VALUES
    (event_id, 'General', 150000, 100, 100),
    (event_id, 'VIP', 400000, 100, 100);

  RAISE NOTICE 'Seeded event % with ticket types', event_id;
END;
$$;
