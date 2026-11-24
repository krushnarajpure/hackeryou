import { createContext, useContext } from 'react'
import officialSettings from '../../shared/official-website-settings.json'

export const WebsiteSettingsContext = createContext(null)
const SOCIAL_FIELDS = ['instagram', 'facebook', 'youtube']
const EMAIL_FIELDS = ['generalEmail', 'copyrightEmail', 'businessEmail', 'advertisingEmail', 'supportEmail']

function indianMobileNumber(value, fallback) {
  let digits = String(value || '').replace(/\D/g, '')
  if (digits.startsWith('91') && digits.length === 12) digits = digits.slice(2)
  return /^\d{10}$/.test(digits) ? digits : fallback
}

export function normalizeWebsiteSettings(settings = {}) {
  const isConfigured = Number(settings.contactSettingsVersion) >= officialSettings.version
  const email = isConfigured ? settings.defaultEmail || officialSettings.email : officialSettings.email
  const mobileNumber = isConfigured
    ? indianMobileNumber(settings.defaultPhone, officialSettings.mobileNumber)
    : officialSettings.mobileNumber
  const whatsappNumber = isConfigured
    ? indianMobileNumber(settings.contacts?.whatsappNumber, officialSettings.whatsappNumber)
    : officialSettings.whatsappNumber
  const social = Object.fromEntries(SOCIAL_FIELDS.map((field) => [
    field,
    isConfigured ? settings.social?.[field] || officialSettings.social[field] : officialSettings.social[field]
  ]))
  return {
    ...settings,
    defaultEmail: email,
    defaultPhone: mobileNumber,
    contacts: {
      ...settings.contacts,
      ...Object.fromEntries(EMAIL_FIELDS.map((field) => [field, email])),
      mobileNumber,
      whatsappNumber
    },
    social,
    whatsappUrl: `https://wa.me/91${whatsappNumber}`
  }
}

export function useWebsiteSettings() {
  return useContext(WebsiteSettingsContext)?.settings || normalizeWebsiteSettings()
}

export function useSetWebsiteSettings() {
  const context = useContext(WebsiteSettingsContext)
  if (!context) throw new Error('WebsiteSettingsProvider is required to update website settings.')
  return context.setSettings
}
