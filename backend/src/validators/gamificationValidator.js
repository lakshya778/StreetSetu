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
  if (ward !== undefined && !mongoose.isValidObjectId(ward)) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Ward must be a valid identifier' }
    });
  }
  req.leaderboardQuery = { scope, ward };
  return next();
}
