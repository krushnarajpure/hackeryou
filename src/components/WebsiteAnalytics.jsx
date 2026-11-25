import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import getVisitorId from '../utils/visitorId'

export default function WebsiteAnalytics() {
  const location = useLocation()
  const lastTrackedPage = useRef('')

  useEffect(() => {
    const pageKey = `${location.pathname}${location.search}`
    if (lastTrackedPage.current === pageKey || location.pathname.toLowerCase().startsWith('/admin')) return
    lastTrackedPage.current = pageKey

    const headers = { 'Content-Type': 'application/json' }
    try {
      const token = window.localStorage.getItem('marathiUdyojakToken')
      if (token) headers.Authorization = `Bearer ${token}`
    } catch {
      // Analytics still works anonymously when browser storage is unavailable.
    }

    fetch('/api/analytics/pageview', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        visitorId: getVisitorId(),
        path: location.pathname,
        title: document.title
      })
    }).then(async (response) => {
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Website analytics could not be recorded.')
      }
    }).catch((error) => {
      console.error('Website analytics tracking failed:', error)
    })
  }, [location.pathname, location.search])

  return null
}
