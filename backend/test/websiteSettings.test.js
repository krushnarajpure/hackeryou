const assert = require('node:assert/strict');
const { test } = require('node:test');
const officialSettings = require('../../shared/official-website-settings.json');
const { normalizeSettings, prepareSettingsUpdate } = require('../utils/websiteSettings');

test('legacy website settings resolve to the official contact and social defaults', () => {
  const settings = normalizeSettings({
    defaultEmail: 'old@example.com',
    defaultPhone: '8169758384',
    contacts: { generalEmail: 'old@example.com', whatsappNumber: '8169758384' },
    social: {
      instagram: 'https://www.instagram.com/old/',
      facebook: 'https://www.facebook.com/old',
      youtube: 'https://www.youtube.com/@old',
      x: 'https://x.com/old'
    }
  });

  assert.equal(settings.defaultEmail, officialSettings.email);
  assert.equal(settings.defaultPhone, officialSettings.mobileNumber);
  assert.equal(settings.contacts.generalEmail, officialSettings.email);
  assert.equal(settings.contacts.whatsappNumber, officialSettings.whatsappNumber);
  assert.deepEqual(settings.social, officialSettings.social);
});

test('saved admin contact settings are preserved while unrelated social fields are excluded', () => {
  const settings = normalizeSettings({
    contactSettingsVersion: officialSettings.version,
    defaultEmail: 'admin@example.com',
    defaultPhone: '9123456789',
    contacts: { whatsappNumber: '9988776655', supportEmail: 'other@example.com' },
    social: { instagram: 'https://www.instagram.com/custom/', x: 'https://x.com/custom' }
  });

  assert.equal(settings.defaultEmail, 'admin@example.com');
  assert.equal(settings.defaultPhone, '9123456789');
  assert.equal(settings.contacts.whatsappNumber, '9988776655');
  assert.equal(settings.contacts.supportEmail, 'admin@example.com');
  assert.deepEqual(Object.keys(settings.social).sort(), ['facebook', 'instagram', 'youtube']);
  assert.equal(settings.social.instagram, 'https://www.instagram.com/custom/');
  assert.equal(settings.social.facebook, officialSettings.social.facebook);
});

test('partial settings updates migrate legacy values and mark contacts as configured', () => {
  const settings = prepareSettingsUpdate(
    { design: { primaryColor: '#123456' } },
    {
      defaultEmail: 'old@example.com',
      defaultPhone: '8169758384',
      social: { facebook: 'https://www.facebook.com/old' }
    }
  );

  assert.equal(settings.contactSettingsVersion, officialSettings.version);
  assert.equal(settings.defaultEmail, officialSettings.email);
  assert.equal(settings.defaultPhone, officialSettings.mobileNumber);
  assert.deepEqual(settings.social, officialSettings.social);
  assert.equal(settings.design.primaryColor, '#123456');
});
