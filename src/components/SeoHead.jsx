import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import expressLogoUrl from '../image/express-udyojak-logo.png'

export const SITE_URL = 'https://expressudyojak.vercel.app'
export const SITE_NAME = 'Express Udyojak'

const routeMetadata = [
  { pattern: /^\/$/, title: 'Express Udyojak | नवीन व्यवसाय कल्पना, सरकारी योजना आणि उद्योजक मार्गदर्शन', description: 'महाराष्ट्रातील उद्योजकांसाठी नवीन व्यवसाय कल्पना, कमी गुंतवणुकीचे उद्योग, सरकारी योजना आणि मशीनरी व फ्रँचायझी माहिती मराठीत वाचा.' },
  { pattern: /^\/business-ideas\/?$/, title: 'नवीन व्यवसाय कल्पना आणि कमी गुंतवणुकीचे उद्योग | Express Udyojak', description: 'Maharashtra मधील नवीन Small Business Ideas, कमी गुंतवणुकीचे Business Ideas आणि उद्योग सुरू करण्याची माहिती मराठीत मिळवा.' },
  { pattern: /^\/guidance\/?$/, title: 'व्यवसाय मार्गदर्शन | Express Udyojak', description: 'महाराष्ट्रातील उद्योजकांसाठी व्यवसाय सुरू करण्याचे मार्गदर्शन, नियोजन आणि उपयुक्त माहिती मराठीत वाचा.' },
  { pattern: /^\/schemes\/?$/, title: 'सरकारी योजना महाराष्ट्र उद्योजकांसाठी | Express Udyojak', description: 'Entrepreneurs आणि small businesses साठी सरकारी योजना, पात्रता आणि अर्ज प्रक्रिया याबद्दल मराठी माहिती वाचा.' },
  { pattern: /^\/business-loans\/?$/, title: 'व्यवसाय कर्ज आणि व्यवसायासाठी आर्थिक मदत | Express Udyojak', description: 'व्यवसाय कर्ज, लघुउद्योजक वित्तपुरवठा आणि उपलब्ध योजना याबद्दल नेमकी मराठी मार्गदर्शन वाचा.' },
  { pattern: /^\/category\/[^/]+\/?$/, title: 'व्यवसाय आणि उद्योग लेख | Express Udyojak', description: 'महाराष्ट्रातील उद्योजकांसाठी संबंधित व्यवसाय कल्पना, सरकारी योजना, तंत्रज्ञान आणि उद्योगविषयक लेख वाचा.' },
  { pattern: /^\/articles\/?$/, title: 'सर्व नवीन पोस्ट आणि उद्योजकता लेख | Express Udyojak', description: 'नवीन व्यवसाय कल्पना, उद्योग व्यवसाय माहिती, सरकारी योजना आणि Maharashtra business opportunities याबद्दल सर्व लेख वाचा.' },
  { pattern: /^\/all-posts\/?$/, title: 'सर्व मराठी उद्योजक लेख | Express Udyojak', description: 'व्यवसाय कल्पना, सरकारी योजना, मशीनरी, तंत्रज्ञान आणि उद्योजकता याबद्दल सर्व मराठी लेख एका ठिकाणी.' },
  { pattern: /^\/business-licenses\/?$/, title: 'परवाने आणि नोंदणी मार्गदर्शन | Express Udyojak', description: 'व्यवसाय सुरू करण्यासाठी परवाने, नोंदणी आणि documents व compliance याबद्दल मराठी मार्गदर्शन वाचा.' },
  { pattern: /^\/business-setup\/?$/, title: 'Business Setup Guide महाराष्ट्र | Express Udyojak', description: 'महाराष्ट्रात उद्योग किंवा छोटा व्यवसाय सुरू करण्यासाठी setup, investment आणि planning याबद्दल मार्गदर्शन.' },
  { pattern: /^\/government-schemes\/?$/, title: 'महाराष्ट्रातील उद्योजकांसाठी सरकारी योजना | Express Udyojak', description: 'उद्योजक आणि small business owners साठी उपलब्ध सरकारी योजना आणि application process बद्दल माहिती.' },
  { pattern: /^\/machinery-equipment\/?$/, title: 'मशीनरी आणि उपकरणे व्यवसाय माहिती | Express Udyojak', description: 'उद्योगासाठी मशीनरी, equipment आणि supplier माहिती याबद्दल मराठी व्यवसाय मार्गदर्शन वाचा.' },
  { pattern: /^\/franchise-opportunities\/?$/, title: 'Franchise संधी आणि ब्रँड व्यवसाय | Express Udyojak', description: 'महाराष्ट्रातील franchise opportunities, brand investment आणि व्यवसाय संधी याबद्दल माहिती मिळवा.' },
  { pattern: /^\/about-us\/?$|^\/about\/?$/, title: 'आमच्याबद्दल | Express Udyojak', description: 'Express Udyojak चे उद्दिष्ट, मराठी उद्योजकांसाठी आमची माहितीसेवा आणि मूल्यमापन जाणून घ्या.' },
  { pattern: /^\/contact-us\/?$|^\/contact\/?$/, title: 'संपर्क करा | Express Udyojak', description: 'Express Udyojak टीमाशी व्यवसाय मार्गदर्शन किंवा website संबंधी प्रश्नांसाठी संपर्क साधा.' },
  { pattern: /^\/faq\/?$/, title: 'वारंवार विचारले जाणारे प्रश्न | Express Udyojak', description: 'Express Udyojak वेबसाइट, व्यवसाय लेख आणि माहिती सेवेबद्दल FAQ वाचा.' },
  { pattern: /^\/privacy-policy\/?$/, title: 'Privacy Policy | Express Udyojak', description: 'Express Udyojak वेबसाइटच्या privacy policy आणि data handling बाबतची माहिती.' },
  { pattern: /^\/terms-and-conditions\/?$/, title: 'Terms आणि Conditions | Express Udyojak', description: 'Express Udyojak वेबसाइट वापरण्याच्या अटी व शर्ती वाचा.' },
  { pattern: /^\/directory\/?$/, title: 'महाराष्ट्र व्यवसाय डिरेक्टरी | Express Udyojak', description: 'महाराष्ट्रातील व्यवसाय आणि उद्योजक माहिती एकाच ठिकाणी शोधा.' },
  { pattern: /^\/stories\/?$/, title: 'Marathi उद्योजक यशोगाथा | Express Udyojak', description: 'Marathi entrepreneurs आणि small business success stories प्रेरणादायी मराठी स्वरूपात वाचा.' },
  { pattern: /^\/books\/?$/, title: 'व्यवसाय पुस्तके आणि मार्गदर्शिका | Express Udyojak', description: 'व्यवसाय, उद्योजकता आणि Maharashtra entrepreneurship विषयक पुस्तके व मार्गदर्शिका.' },
  { pattern: /^\/search\/?$/, title: 'शोधा | Express Udyojak', description: 'Express Udyojak मधील लेख, सरकारी योजना आणि व्यवसाय कल्पना शोधा.', noindex: true }
]

const privatePatterns = [
  /^\/admin(?:\/|$)/,
  /^\/auth(?:\/|$)/,
  /^\/cart(?:\/|$)/,
  /^\/checkout(?:\/|$)/,
  /^\/add-idea(?:\/|$)/,
  /^\/add-story(?:\/|$)/,
  /^\/add-business(?:\/|$)/,
  /^\/promotions(?:\/|$)/,
  /^\/search(?:\/|$)/
]

const categoryMetadata = {
  entrepreneurship: {
    title: 'उद्योजकता आणि नवीन व्यवसाय कल्पना | Express Udyojak',
    description: 'महाराष्ट्रातील उद्योजकांसाठी नवीन व्यवसाय कल्पना, कमी गुंतवणुकीत उद्योग आणि Small Business Ideas Marathi मध्ये वाचा.'
  },
  'sarkari-yojana': {
    title: 'सरकारी योजना महाराष्ट्र उद्योजकांसाठी | Express Udyojak',
    description: 'Government Schemes for Entrepreneurs, महाराष्ट्रातील सरकारी योजना आणि उद्योजकांना उपलब्ध लाभ व अर्ज प्रक्रिया जाणून घ्या.'
  },
  technology: {
    title: 'तंत्रज्ञान आणि उद्योग व्यवसाय माहिती | Express Udyojak',
    description: 'उद्योग आणि व्यवसायांसाठी नवीन तंत्रज्ञान, digital opportunities आणि महाराष्ट्रातील Business Opportunities याबद्दल वाचा.'
  },
  'farming-business': {
    title: 'शेती उद्योग आणि Maharashtra व्यवसाय संधी | Express Udyojak',
    description: 'शेती उद्योग, कमी गुंतवणुकीत व्यवसाय आणि महाराष्ट्रातील कृषी व ग्रामीण उद्योग कल्पना मराठीत जाणून घ्या.'
  },
  'personality-development': {
    title: 'स्वतःची डेव्हलपमेंट आणि उद्योजक वाढ | Express Udyojak',
    description: 'व्यवसाय आणि व्यक्तिमत्त्व विकासासाठी व्यक्तिमत्त्व डेव्हलपमेंट, leadership आणि Entrepreneur skills यांची मराठी मार्गदर्शन.'
  }
}

const canonicalAliases = new Map([
  ['/about', '/about-us'],
  ['/contact', '/contact-us'],
  ['/all-posts', '/articles'],
  ['/category/business-loans', '/business-loans']
])

function ensureMeta({ name, property, content }) {
  if (!content) return
  const attribute = property ? 'property' : 'name'
  const value = property || name
  let element = document.head.querySelector(`meta[${attribute}="${value}"]`)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, value)
    document.head.appendChild(element)
  }
  element.setAttribute('content', content)
}

function absoluteUrl(path) {
  if (!path) return `${SITE_URL}/`
  if (/^https?:\/\//i.test(path)) return path
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

export default function SeoHead() {
  const location = useLocation()

  useEffect(() => {
    const isArticlePage = /^\/articles\/[^/]+\/?$/.test(location.pathname)
    const isCategoryPage = /^\/category\/[^/]+\/?$/.test(location.pathname)
      || location.pathname.replace(/\/+$/, '') === '/business-loans'
    if (isArticlePage || isCategoryPage) {
      document.head.querySelector('script[data-seo-schema="breadcrumb"]')?.remove()
      return
    }

    const route = routeMetadata.find((item) => item.pattern.test(location.pathname))
    const categoryMatch = location.pathname.match(/^\/category\/([^/]+)\/?$/)
    const categoryRoute = categoryMatch ? categoryMetadata[categoryMatch[1]] : null
    const isPrivate = privatePatterns.some((pattern) => pattern.test(location.pathname))
    const title = categoryRoute?.title || route?.title || `Express Udyojak | ${location.pathname.replace(/[-/]/g, ' ').trim() || 'महाराष्ट्र उद्योजक माहिती'}`
    const description = categoryRoute?.description || route?.description || 'महाराष्ट्रातील उद्योजक, व्यवसाय आणि सरकारी योजना याबद्दल विश्वासार्ह मराठी माहिती.'
    const pathname = location.pathname === '/' ? '/' : location.pathname.replace(/\/+$/, '')
    const canonicalPath = canonicalAliases.get(pathname) || pathname
    const canonical = `${SITE_URL}${canonicalPath}`

    document.documentElement.lang = 'mr'
    document.title = title
    ensureMeta({ name: 'description', content: description })
    ensureMeta({ name: 'robots', content: isPrivate || route?.noindex ? 'noindex,nofollow' : 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1' })
    ensureMeta({ property: 'og:locale', content: 'mr_IN' })
    ensureMeta({ property: 'og:type', content: 'website' })
    ensureMeta({ property: 'og:site_name', content: SITE_NAME })
    ensureMeta({ property: 'og:title', content: title })
    ensureMeta({ property: 'og:description', content: description })
    ensureMeta({ property: 'og:url', content: canonical })
    ensureMeta({ property: 'og:image', content: absoluteUrl(expressLogoUrl) })
    ensureMeta({ name: 'twitter:card', content: 'summary_large_image' })
    ensureMeta({ name: 'twitter:title', content: title })
    ensureMeta({ name: 'twitter:description', content: description })
    ensureMeta({ name: 'twitter:image', content: absoluteUrl(expressLogoUrl) })
    ensureMeta({ name: 'twitter:site', content: '@MUdyojak' })

    let canonicalLink = document.head.querySelector('link[rel="canonical"]')
    if (!canonicalLink) {
      canonicalLink = document.createElement('link')
      canonicalLink.setAttribute('rel', 'canonical')
      document.head.appendChild(canonicalLink)
    }
    canonicalLink.setAttribute('href', canonical)

    let orgSchema = document.head.querySelector('script[data-seo-schema="organization"]')
    if (!orgSchema) {
      orgSchema = document.createElement('script')
      orgSchema.type = 'application/ld+json'
      orgSchema.setAttribute('data-seo-schema', 'organization')
      document.head.appendChild(orgSchema)
    }
    orgSchema.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      logo: absoluteUrl(expressLogoUrl),
      inLanguage: 'mr'
    })

    let websiteSchema = document.head.querySelector('script[data-seo-schema="website"]')
    if (!websiteSchema) {
      websiteSchema = document.createElement('script')
      websiteSchema.type = 'application/ld+json'
      websiteSchema.setAttribute('data-seo-schema', 'website')
      document.head.appendChild(websiteSchema)
    }
    websiteSchema.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      inLanguage: ['mr', 'en'],
      potentialAction: {
        '@type': 'SearchAction',
        target: `${SITE_URL}/search?search={search_term_string}`,
        'query-input': 'required name=search_term_string'
      }
    })

    let breadcrumbSchema = document.head.querySelector('script[data-seo-schema="breadcrumb"]')
    if (location.pathname === '/') {
      breadcrumbSchema?.remove()
    } else {
      if (!breadcrumbSchema) {
        breadcrumbSchema = document.createElement('script')
        breadcrumbSchema.type = 'application/ld+json'
        breadcrumbSchema.setAttribute('data-seo-schema', 'breadcrumb')
        document.head.appendChild(breadcrumbSchema)
      }
      breadcrumbSchema.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'मुख्यपृष्ठ', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: title.replace(` | ${SITE_NAME}`, ''), item: canonical }
        ]
      })
    }
  }, [location.pathname])

  return null
}
