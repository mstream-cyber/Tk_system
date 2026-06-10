import { Router } from 'express';
import { supabase } from '../supabase';
import { success, error } from '../utils/response';

const router = Router();

router.get('/', async (_req, res) => {
  const { data, error: dbError } = await supabase
    .from('events')
    .select('*, ticket_types(*)')
    .eq('status', 'published')
    .order('date', { ascending: true });

  if (dbError) {
    console.error('Failed to fetch events:', dbError);
    res.status(500).json(error('Failed to fetch events'));
    return;
  }

  res.json(success(data));
});

export default router;
