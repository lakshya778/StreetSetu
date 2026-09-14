function authorize(requiredPermissions = []) {
  return (req, res, next) => {
    const userPermissions = req.user?.permissions || [];
    const roles = req.user?.roles || [];

    const hasPermission = requiredPermissions.every((permission) => {
      return userPermissions.includes(permission) || roles.includes('super_admin');
    });

    if (!hasPermission) {
      return next({
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'You do not have the required permission',
        details: [],
      });
    }

    return next();
  };
}

module.exports = {
  authorize,
};
