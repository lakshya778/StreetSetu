import { runSlaEscalation } from '../services/escalationService.js';

export async function runEscalation(req, res, next) {
  try {
    return res.json({ success: true, data: await runSlaEscalation(), message: 'SLA escalation run completed' });
  } catch (error) { return next(error); }
}
