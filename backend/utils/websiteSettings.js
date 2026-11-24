const officialSettings = require('../../shared/official-website-settings.json');

const EMAIL_FIELDS = [
  'generalEmail',
  'copyrightEmail',
  'businessEmail',
  'advertisingEmail',
  'supportEmail'
];

const SOCIAL_FIELDS = ['instagram', 'facebook', 'youtube'];

function indianMobileNumber(value, fallback) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) digits = digits.slice(2);
  return /^\d{10}$/.test(digits) ? digits : fallback;
}

function isValidIndianMobile(value) {
  const text = String(value || '').trim();
  if (!/^[+\d\s()-]+$/.test(text)) return false;
  const digits = text.replace(/\D/g, '');
  return /^\d{10}$/.test(digits) || /^91\d{10}$/.test(digits);
}

function normalizeSettings(settings = {}) {
  const isConfigured = Number(settings.contactSettingsVersion) >= officialSettings.version;
  const defaultEmail = isConfigured ? settings.defaultEmail || officialSettings.email : officialSettings.email;
  const defaultPhone = isConfigured
    ? indianMobileNumber(settings.defaultPhone, officialSettings.mobileNumber)
    : officialSettings.mobileNumber;
  const contacts = settings.contacts || {};
  const whatsappNumber = isConfigured
    ? indianMobileNumber(contacts.whatsappNumber, officialSettings.whatsappNumber)
    : officialSettings.whatsappNumber;
  const social = Object.fromEntries(SOCIAL_FIELDS.map((field) => [
    field,
    isConfigured ? settings.social?.[field] || officialSettings.social[field] : officialSettings.social[field]
  ]));

  return {
    ...settings,
    defaultEmail,
    defaultPhone,
    contacts: {
      ...contacts,
      ...Object.fromEntries(EMAIL_FIELDS.map((field) => [field, defaultEmail])),
      mobileNumber: defaultPhone,
      whatsappNumber
    },
    social
  };
}

function prepareSettingsUpdate(input, existingSettings = {}) {
  const normalizedExisting = normalizeSettings(existingSettings);
  const updated = { ...normalizedExisting, ...input };
  const defaultEmail = input.defaultEmail || normalizedExisting.defaultEmail;
  const defaultPhone = indianMobileNumber(input.defaultPhone || normalizedExisting.defaultPhone, officialSettings.mobileNumber);
  const contacts = { ...normalizedExisting.contacts, ...(input.contacts || {}) };
  const social = { ...normalizedExisting.social, ...(input.social || {}) };

  return {
    ...updated,
    defaultEmail,
    defaultPhone,
    contactSettingsVersion: officialSettings.version,
    contacts: {
      ...contacts,
      ...Object.fromEntries(EMAIL_FIELDS.map((field) => [field, defaultEmail])),
      mobileNumber: defaultPhone,
      whatsappNumber: indianMobileNumber(contacts.whatsappNumber, officialSettings.whatsappNumber)
    },
    social: Object.fromEntries(SOCIAL_FIELDS.map((field) => [
      field,
      social[field] || officialSettings.social[field]
    ]))
  };
}

module.exports = { isValidIndianMobile, normalizeSettings, prepareSettingsUpdate };
