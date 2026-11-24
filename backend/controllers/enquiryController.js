const Enquiry = require('../models/Enquiry');
const { validationResult } = require('express-validator');

exports.submitEnquiry = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw Object.assign(new Error(errors.array()[0].msg), { statusCode: 400 });
  const { name, mobile, email, message, business } = req.body;
  const enquiry = await Enquiry.create({
    name, mobile, email, message, business,
    ipAddress: req.ip,
    userAgent: req.get('user-agent') || ''
  });
  res.status(201).json({ message: 'Enquiry submitted successfully', enquiryId: enquiry._id });
};
exports.getEnquiries = async (_req, res) => {
  res.json({ enquiries: await Enquiry.find().populate('business', 'businessName city').sort({ createdAt: -1 }) });
};
exports.updateEnquiryStatus = async (req, res) => {
  const enquiry = await Enquiry.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true, runValidators: true });
  if (!enquiry) throw Object.assign(new Error('Enquiry not found'), { statusCode: 404 });
  res.json({ enquiry });
};
exports.deleteEnquiry = async (req, res) => {
  const enquiry = await Enquiry.findByIdAndDelete(req.params.id);
  if (!enquiry) throw Object.assign(new Error('Enquiry not found'), { statusCode: 404 });
  res.json({ message: 'Enquiry deleted' });
};
