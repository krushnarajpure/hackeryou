const Advertisement = require('../models/Advertisement');
exports.createAdvertisement = async (req, res) => {
  const image = req.file ? `/uploads/${req.file.filename}` : req.body.image;
  const advertisement = await Advertisement.create({ ...req.body, image });
  res.status(201).json({ advertisement });
};
exports.updateAdvertisement = async (req, res) => {
  if (req.file) req.body.image = `/uploads/${req.file.filename}`;
  const advertisement = await Advertisement.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!advertisement) throw Object.assign(new Error('Advertisement not found'), { statusCode: 404 });
  res.json({ advertisement });
};
exports.deleteAdvertisement = async (req, res) => {
  const advertisement = await Advertisement.findByIdAndDelete(req.params.id);
  if (!advertisement) throw Object.assign(new Error('Advertisement not found'), { statusCode: 404 });
  res.json({ message: 'Advertisement deleted' });
};
exports.getActiveAdvertisements = async (req, res) => {
  const now = new Date();
  const filter = { isActive: true, approvalStatus: 'approved', startAt: { $lte: now }, endAt: { $gte: now } };
  if (req.query.placement) filter.placement = req.query.placement;
  res.json({ advertisements: await Advertisement.find(filter).sort({ createdAt: -1 }) });
};
exports.approveAdvertisement = async (req, res) => {
  const advertisement = await Advertisement.findByIdAndUpdate(req.params.id, {
    approvalStatus: req.body.approvalStatus,
    isActive: req.body.approvalStatus === 'approved'
  }, { new: true, runValidators: true });
  if (!advertisement) throw Object.assign(new Error('Advertisement not found'), { statusCode: 404 });
  res.json({ advertisement });
};
