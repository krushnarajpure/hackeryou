import { useEffect, useState } from 'react'
import { WebsiteSettingsContext, normalizeWebsiteSettings } from './websiteSettings'

export function WebsiteSettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => normalizeWebsiteSettings())

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/cms/public/settings', { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Settings unavailable')))
      .then(({ settings: loadedSettings }) => setSettings(normalizeWebsiteSettings(loadedSettings || {})))
      .catch((error) => {
        if (error.name !== 'AbortError') console.error('Public website settings could not be loaded:', error)
      })
    return () => controller.abort()
  }, [])

  return <WebsiteSettingsContext.Provider value={{ settings, setSettings }}>{children}</WebsiteSettingsContext.Provider>
}
