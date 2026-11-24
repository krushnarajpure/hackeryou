const mongoose = require('mongoose');
const officialSettings = require('../../shared/official-website-settings.json');

const websiteSettingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'main' },
  websiteName: { type: String, default: 'मराठी उद्योजक' },
  websiteUrl: { type: String, default: '' },
  logo: { type: String, default: '' },
  favicon: { type: String, default: '' },
  tagline: { type: String, default: '' },
  language: { type: String, default: 'mr' },
  timezone: { type: String, default: 'Asia/Kolkata' },
  defaultEmail: { type: String, default: officialSettings.email },
  defaultPhone: { type: String, default: officialSettings.mobileNumber },
  contactSettingsVersion: { type: Number, default: 0 },
  address: { type: String, default: '' },
  maintenanceMode: { type: Boolean, default: false },
  contacts: {
    generalEmail: { type: String, default: officialSettings.email },
    copyrightEmail: { type: String, default: officialSettings.email },
    businessEmail: { type: String, default: officialSettings.email },
    advertisingEmail: { type: String, default: officialSettings.email },
    supportEmail: { type: String, default: officialSettings.email },
    mobileNumber: { type: String, default: officialSettings.mobileNumber },
    whatsappNumber: { type: String, default: officialSettings.whatsappNumber }
  },
  social: {
    facebook: { type: String, default: officialSettings.social.facebook },
    instagram: { type: String, default: officialSettings.social.instagram },
    youtube: { type: String, default: officialSettings.social.youtube }
  },
  seo: {
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    canonicalUrl: { type: String, default: '' },
    ogImage: { type: String, default: '' },
    robots: { type: String, default: 'index,follow' },
    structuredData: { type: mongoose.Schema.Types.Mixed, default: null }
  },
  design: {
    marathiFont: { type: String, default: 'Noto Sans Devanagari' },
    headingFont: { type: String, default: 'Mukta' },
    bodyFont: { type: String, default: 'Hind' },
    primaryColor: { type: String, default: '#137a3d' },
    accentColor: { type: String, default: '#f28c28' },
    backgroundColor: { type: String, default: '#ffffff' },
    containerWidth: { type: Number, default: 1180 }
  },
  store: {
    checkoutEnabled: { type: Boolean, default: false },
    shippingFeePaise: { type: Number, default: null, min: 0 },
    taxTreatment: { type: String, enum: ['', 'inclusive', 'exclusive'], default: '' },
    taxRateBasisPoints: { type: Number, default: null, min: 0, max: 10000 },
    privacyPolicyUrl: { type: String, default: '' },
    shippingPolicyUrl: { type: String, default: '' },
    returnPolicyUrl: { type: String, default: '' }
  },
  headers: { type: mongoose.Schema.Types.Mixed, default: [] },
  footers: { type: mongoose.Schema.Types.Mixed, default: [] },
  defaultHeader: { type: String, default: 'main' },
  defaultFooter: { type: String, default: 'main' }
}, { timestamps: true });

module.exports = mongoose.model('WebsiteSettings', websiteSettingsSchema);
