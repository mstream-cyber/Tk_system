import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { supabase } from '../supabase';
import { success, error } from '../utils/response';

const router = Router();

router.post(
  '/',
  body('email').isEmail().withMessage('Valid email is required'),
  body('event_id').isUUID().withMessage('Valid event_id is required'),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json(error(errors.array().map((e) => e.msg).join('; ')));
      return;
    }

    const { email, event_id } = req.body;

    const { error: insertErr } = await supabase
      .from('waitlist')
      .insert({ event_id, email });

    if (insertErr) {
      if (insertErr.code === '23505') {
        res.json(success({ message: 'You are already on the waitlist!' }));
        return;
      }
      console.error('Failed to add to waitlist:', insertErr);
      res.status(500).json(error('Failed to join waitlist'));
      return;
    }

    res.status(201).json(success({ message: 'You have been added to the waitlist!' }));
  }
);

export default router;
