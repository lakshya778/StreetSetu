import mongoose from 'mongoose';

export function validateLeaderboardQuery(req, res, next) {
  const scope = req.query.scope || 'all';
  const ward = req.query.ward;
  if (!['month', 'all'].includes(scope)) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Scope must be month or all' }
    });
  }
  const normalizedWard = typeof ward === 'string' ? ward.trim() : ward;
  if (ward !== undefined && (
    typeof normalizedWard !== 'string'
    || !normalizedWard
    || normalizedWard.length > 160
    || (!mongoose.isValidObjectId(normalizedWard) && !/^[\p{L}\p{N} .,'-]+$/u.test(normalizedWard))
  )) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Ward must be an identifier or a valid neighbourhood name' }
    });
  }
  req.leaderboardQuery = { scope, ward: normalizedWard };
  return next();
}
