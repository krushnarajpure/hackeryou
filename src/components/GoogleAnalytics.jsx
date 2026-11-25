import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

let initializedMeasurementId = ''

export default function GoogleAnalytics() {
  const location = useLocation()
  const lastPageView = useRef('')
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

  useEffect(() => {
    if (!measurementId || initializedMeasurementId === measurementId) return

    window.dataLayer = window.dataLayer || []
    window.gtag = window.gtag || function gtag() {
      window.dataLayer.push(arguments)
    }
    window.gtag('js', new Date())
    window.gtag('config', measurementId, { send_page_view: false })
    initializedMeasurementId = measurementId

    if (!document.querySelector('script[src*="googletagmanager.com/gtag/js"]')) {
      const script = document.createElement('script')
      script.async = true
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`
      document.head.appendChild(script)
    }
  }, [measurementId])

  useEffect(() => {
    if (!measurementId || !window.gtag) return

    const pagePath = location.pathname
    const pageKey = `${location.pathname}${location.search}`
    if (lastPageView.current === pageKey) return
    lastPageView.current = pageKey

    window.gtag('event', 'page_view', {
      page_path: pagePath,
      page_location: `${window.location.origin}${pagePath}`,
      page_title: document.title
    })
  }, [location.pathname, location.search, measurementId])

  return null
}
