const rolePermissions = {
  super_admin: ['*'],
  admin: ['*'],
  content_editor: [
    'analytics:read', 'articles:read', 'articles:write',
    'categories:read', 'categories:write', 'homepage:read', 'homepage:write',
    'media:read', 'media:write', 'pages:read', 'pages:write',
    'revisions:read', 'revisions:restore', 'stories:read', 'stories:write'
  ],
  design_manager: [
    'analytics:read', 'categories:read', 'global:read', 'global:write',
    'homepage:read', 'homepage:write', 'media:read', 'media:write',
    'navigation:read', 'navigation:write', 'pages:read', 'pages:write',
    'revisions:read', 'revisions:restore', 'settings:read', 'settings:write'
  ],
  viewer: ['analytics:read'],
  analyst: ['analytics:read'],
  store_manager: ['orders:read', 'orders:write', 'store:read', 'store:write']
};

const hasPermission = (role, permission) => {
  const permissions = rolePermissions[role] || [];
  return permissions.includes('*') || permissions.includes(permission);
};

const requirePermission = (permission) => (req, res, next) => {
  if (!hasPermission(req.user?.role, permission)) {
    return res.status(403).json({ message: 'You do not have permission to perform this action' });
  }
  next();
};

module.exports = { hasPermission, requirePermission, rolePermissions };
