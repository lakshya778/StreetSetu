import { Router } from 'express';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ success: true, message: 'StreetSetu API is healthy' });
});

export default router;
