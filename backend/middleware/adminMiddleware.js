module.exports = (req, res, next) => {
  const privilegedRoles = ['admin', 'super_admin', 'content_editor', 'design_manager'];
  if (!privilegedRoles.includes(req.user?.role)) return res.status(403).json({ message: 'Admin access required' });
  next();
};
