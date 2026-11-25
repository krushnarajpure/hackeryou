import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, ArrowUp, BadgeIndianRupee, Building2, CalendarDays, ChevronRight, CircleUserRound, Clock3, Eye, FileCheck, ImagePlus, Landmark, Laptop,
  MessageCircle, HeartHandshake, Home, Leaf, Lightbulb, MapPin, Menu, Phone, Rocket, Save, Search, Send, Settings, Sparkles, Sprout, Store,
  TrendingUp, WandSparkles, Wrench, X
} from 'lucide-react'
import NewsTicker from './components/NewsTicker'
import { ArticleHeader } from './components/ArticleHeader'
import ArticleAuthor, { PUBLIC_AUTHOR_NAME } from './components/ArticleAuthor'
import ArticleDetailLayout from './components/ArticleDetailLayout'
import PopularPostsSidebar from './components/PopularPostsSidebar'
import SeoHead, { SITE_URL } from './components/SeoHead'
import GoogleAnalytics from './components/GoogleAnalytics'
import { normalizeWebsiteSettings, useSetWebsiteSettings, useWebsiteSettings } from './context/websiteSettings'
import { WebsiteSettingsProvider } from './context/WebsiteSettingsContext'
import DOMPurify from 'dompurify'
import logoUrl from './image/fallback-logo.svg'
import expressLogoUrl from './image/express-udyojak-logo.png'
import officialWebsiteSettings from '../shared/official-website-settings.json'
import './App.css'

function mapBusinessIdea(idea) {
  return {
    id: idea.slug || idea._id,
    title: idea.title,
    category: idea.category?.name || 'व्यवसाय',
    investment: idea.investmentLabel || `₹${Number(idea.investment || 0).toLocaleString('mr-IN')}+`,
    investmentValue: Number(idea.investment || 0),
    profit: '30-40%',
    image: idea.images?.[0] || '',
    location: 'महाराष्ट्र',
    description: idea.description,
    machinery: idea.machinery,
    rawMaterials: idea.rawMaterials,
    licenses: idea.licenses,
    process: idea.process,
    marketing: idea.marketing
  }
}

function useLiveIdeas() {
  const [state, setState] = useState({ status: 'loading', ideas: [], error: null })
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/business-ideas?limit=50', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('API unavailable')
        return response.json()
      })
      .then((data) => {
        if (!Array.isArray(data.ideas) || data.ideas.length === 0) {
          setState({ status: 'empty', ideas: [], error: null })
          return
        }
        setState({ status: 'success', error: null, ideas: data.ideas.map(mapBusinessIdea) })
      })
      .catch((error) => {
        if (error.name === 'AbortError') return
        setState({ status: 'error', ideas: [], error: 'Live data उपलब्ध नाही. कृपया नंतर पुन्हा प्रयत्न करा.' })
      })
    return () => controller.abort()
  }, [])
  return state
}

function mapArticleRecord(article) {
  return {
    id: article.slug || article._id,
    title: article.title,
    tag: article.category || 'लेख',
    date: article.publicationDate ? new Date(article.publicationDate).toLocaleDateString('mr-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Date unavailable',
    publicationDate: article.publicationDate,
    updatedAt: article.updatedAt,
    createdAt: article.createdAt,
    image: article.featuredImage || article.ogImage || article.image || logoUrl,
    schemaAuthorName: article.author?.name || article.authorName || PUBLIC_AUTHOR_NAME,
    schemaCategory: article.category,
    excerpt: article.excerpt || article.subtitle || '',
    subtitle: article.subtitle || '',
    content: article.content,
    authorName: PUBLIC_AUTHOR_NAME,
    readingTime: article.readingTime,
    seoTitle: article.seoTitle,
    seoDescription: article.seoDescription,
    canonicalUrl: article.canonicalUrl,
    ogImage: article.ogImage,
    tags: article.tags,
    keywords: article.keywords,
    commentCount: Array.isArray(article.comments) ? article.comments.filter((comment) => comment.isApproved !== false).length : article.commentCount,
    totalViews: article.totalViews ?? 0,
    uniqueVisitors: article.uniqueVisitors ?? 0
  }
}

function formatArticlePublicationDate(article) {
  const date = article.publicationDate
  return date ? new Date(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Date unavailable'
}

function ArticleCardMetadata({ article, className = '' }) {
  const commentCount = Number(article.commentCount) || 0
  const totalViews = Number(article.totalViews) || 0
  return (
    <div className={`article-card-metadata ${className}`.trim()}>
      <span><ArticleAuthor size={12} /></span>
      <span><Clock3 size={12} aria-hidden="true" />{formatArticlePublicationDate(article)}</span>
      <span><MessageCircle size={12} aria-hidden="true" />{commentCount}</span>
      <span><Eye size={12} aria-hidden="true" />{totalViews.toLocaleString('en-US')} Views</span>
    </div>
  )
}

function getArticleVisitorId() {
  const storageKey = 'marathiUdyojakVisitorId'
  try {
    const storedId = window.localStorage.getItem(storageKey)
    if (storedId) return storedId
    const visitorId = window.crypto.randomUUID()
    window.localStorage.setItem(storageKey, visitorId)
    return visitorId
  } catch {
    return window.crypto.randomUUID()
  }
}

async function requestJson(path, signal) {
  const response = await fetch(path, { signal })
  const data = await response.json()
  if (!response.ok) throw new Error(data.message || `Request failed (${response.status})`)
  return data
}

async function searchArticleTitleSuggestions(prefix, signal) {
  const encodedPrefix = encodeURIComponent(prefix)
  const firstPage = await requestJson(`/api/articles/suggestions?prefix=${encodedPrefix}&page=1&limit=50`, signal)
  const pages = firstPage.matchMode === 'title-prefix' ? firstPage.pagination?.pages || 1 : 1
  const remainingPages = await Promise.all(Array.from({ length: Math.max(pages - 1, 0) }, (_, index) => (
    requestJson(`/api/articles/suggestions?prefix=${encodedPrefix}&page=${index + 2}&limit=50`, signal)
  )))
  const results = [firstPage, ...remainingPages].flatMap((data) => data.articles || []).map((article) => {
    const item = mapArticleRecord(article)
    return {
      id: item.id,
      title: item.title,
      image: item.image,
      date: item.date,
      category: item.tag,
      kind: 'लेख',
      to: `/articles/${item.id}`
    }
  })
  return { results, matchMode: firstPage.matchMode || 'title-prefix' }
}

async function searchWebsite(query, signal) {
  const encodedQuery = encodeURIComponent(query.trim())
  const requests = [
    requestJson(`/api/articles?search=${encodedQuery}&limit=6`, signal).then((data) => (data.articles || []).map((article) => {
      const item = mapArticleRecord(article)
      return {
        id: item.id,
        title: item.title,
        image: item.image,
        excerpt: plainTextExcerpt(item.excerpt || item.subtitle || item.content || ''),
        date: item.date,
        category: item.tag,
        kind: 'लेख',
        to: `/articles/${item.id}`
      }
    })),
    requestJson(`/api/business-ideas?search=${encodedQuery}&limit=6`, signal).then((data) => (data.ideas || []).map((idea) => ({
      id: idea.slug || idea._id,
      title: idea.title,
      image: idea.images?.[0] || logoUrl,
      excerpt: plainTextExcerpt(idea.description || ''),
      date: idea.createdAt ? new Date(idea.createdAt).toLocaleDateString('mr-IN') : 'अलीकडील',
      category: idea.category?.name || 'व्यवसाय कल्पना',
      kind: 'व्यवसाय कल्पना',
      to: `/business-ideas/${idea.slug || idea._id}`
    }))),
    requestJson(`/api/schemes?search=${encodedQuery}`, signal).then((data) => (data.schemes || []).slice(0, 6).map((scheme) => ({
      id: scheme.slug || scheme._id,
      title: scheme.name,
      image: logoUrl,
      excerpt: plainTextExcerpt(scheme.description || ''),
      date: scheme.createdAt ? new Date(scheme.createdAt).toLocaleDateString('mr-IN') : 'अलीकडील',
      category: 'सरकारी योजना',
      kind: 'सरकारी योजना',
      to: `/schemes/${scheme.slug || scheme._id}`
    })))
  ]
  const settled = await Promise.allSettled(requests)
  if (signal?.aborted) {
    const error = new Error('Search aborted')
    error.name = 'AbortError'
    throw error
  }
  const results = []
  const errors = []
  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') results.push(...result.value)
    else errors.push(`${['लेख', 'व्यवसाय कल्पना', 'सरकारी योजना'][index]}: ${result.reason.message}`)
  })
  if (errors.length === settled.length) throw new Error(errors[0] || 'शोध उपलब्ध नाही.')
  const seen = new Set()
  const uniqueResults = results.filter((result) => {
    const key = `${result.kind}:${result.id || result.title}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  return { results: uniqueResults, errors }
}

function useLiveItem(path, property) {
  const [state, setState] = useState({ path, status: 'loading', item: null, error: null })
  useEffect(() => {
    const controller = new AbortController()
    setState({ path, status: 'loading', item: null, error: null })
    fetch(path, { signal: controller.signal })
      .then(async (response) => {
        if (response.status === 404) return { status: 'not-found' }
        if (!response.ok) throw new Error('API unavailable')
        const data = await response.json()
        return data[property] ? { status: 'success', item: data[property] } : { status: 'not-found' }
      })
      .then((result) => {
        if (!controller.signal.aborted) setState({ ...result, path, item: result.item || null, error: null })
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setState({ path, status: 'error', item: null, error: 'माहिती लोड करता आली नाही. कृपया पुन्हा प्रयत्न करा.' })
      })
    return () => controller.abort()
  }, [path, property])
  return state.path === path ? state : { path, status: 'loading', item: null, error: null }
}

function useLiveArticles(refreshInterval = 0, limit = 4) {
  const [state, setState] = useState({ status: 'loading', articles: [], error: null })
  useEffect(() => {
    const controller = new AbortController()
    const loadArticles = async () => {
      try {
        const response = await fetch(`/api/articles/latest?limit=${limit}`, { signal: controller.signal })
        if (!response.ok) throw new Error(`Articles unavailable (${response.status})`)
        const data = await response.json()
        if (!Array.isArray(data.articles) || data.articles.length === 0) {
          setState({ status: 'empty', articles: [], error: null, refreshError: null })
          return
        }
        setState({
          status: 'success',
          error: null,
          refreshError: null,
          articles: data.articles.map(mapArticleRecord)
        })
      } catch (error) {
        if (error.name === 'AbortError') return
        console.error('Live articles could not be refreshed:', error)
        setState((current) => current.articles.length
          ? { ...current, refreshError: 'पोस्ट अपडेट करता आल्या नाहीत; उपलब्ध लेख दाखवत आहोत.' }
          : { status: 'error', articles: [], error: 'Live articles उपलब्ध नाहीत. कृपया नंतर पुन्हा प्रयत्न करा.', refreshError: null })
      }
    }

    loadArticles()
    if (!refreshInterval) return () => controller.abort()
    const refresh = () => {
      if (!document.hidden) loadArticles()
    }
    const timer = window.setInterval(refresh, refreshInterval)
    window.addEventListener('focus', refresh)
    return () => {
      controller.abort()
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [refreshInterval, limit])
  return state
}

const HOMEPAGE_CATEGORIES = [
  { title: 'उद्योजकता', slug: 'entrepreneurship', Icon: Rocket, color: 'blue' },
  { title: 'सरकारी योजना', slug: 'sarkari-yojana', Icon: Landmark, color: 'green' },
  { title: 'तंत्रज्ञान', slug: 'technology', Icon: Laptop, color: 'orange' },
  { title: 'शेती उद्योग', slug: 'farming-business', Icon: Sprout, color: 'green' }
]

const HOMEPAGE_TOPIC_CARDS = [
  ...HOMEPAGE_CATEGORIES.map((category) => ({
    ...category,
    to: `/category/${category.slug}`,
    description: 'लेख आणि मार्गदर्शन'
  })),
  { title: 'परवाने आणि नोंदणी', to: '/business-licenses', Icon: FileCheck, color: 'blue', description: 'कागदपत्रे आणि नोंदणी' },
  { title: 'व्यवसाय कर्ज', to: '/business-loans', Icon: BadgeIndianRupee, color: 'green', description: 'कर्ज योजना आणि सहाय्य' },
  { title: 'मशीनरी आणि उपकरणे', to: '/machinery-equipment', Icon: Settings, color: 'orange', description: 'मशीन आणि उपकरणांची माहिती' },
  { title: 'फ्रँचायझी संधी', to: '/franchise-opportunities', Icon: Store, color: 'green', description: 'ब्रँड आणि व्यवसाय संधी' }
]

const BUSINESS_ESSENTIALS_TITLE = 'व्यवसायासाठी आवश्यक गोष्टी | Business Essentials'
const BUSINESS_ESSENTIALS_SUBTITLE = 'व्यवसाय सुरू करून वाढवण्यासाठीचे मार्गदर्शन | Start and Grow Your Business'
const BUSINESS_ESSENTIALS_EXCLUDED_KEYS = new Set(['business-setup', 'government-schemes'])

const BUSINESS_ESSENTIALS_DEFAULTS = [
  { key: 'licenses-registration', title: 'परवाने आणि नोंदणी | Licenses & Registration', subtitle: 'Documents, Permits आणि Compliance', icon: 'FileCheck', image: '', path: '/business-licenses', isActive: true, order: 1 },
  { key: 'business-loans', title: 'व्यवसाय कर्ज | Business Loans', subtitle: 'Loans, Subsidies आणि Financial Support', icon: 'Landmark', image: '', path: '/business-loans', isActive: true, order: 2 },
  { key: 'machinery-equipment', title: 'मशिनरी आणि Equipment | Machinery & Equipment', subtitle: 'Machines, Suppliers आणि Price Information', icon: 'Settings', image: '', path: '/machinery-equipment', isActive: true, order: 3 },
  { key: 'franchise-opportunities', title: 'फ्रँचायझी संधी | Franchise Opportunities', subtitle: 'Brands, Investment आणि Business Opportunities', icon: 'Store', image: '', path: '/franchise-opportunities', isActive: true, order: 4 }
]

function getBusinessEssentialsCards(cards) {
  return (Array.isArray(cards) ? cards : []).filter((feature) => feature && !BUSINESS_ESSENTIALS_EXCLUDED_KEYS.has(feature.key))
}

function getHomepageCategoryCtaLabel(section) {
  if (section.slug === 'entrepreneurship') return 'उद्योजकतेचे आणखी लेख'
  if (section.slug === 'sarkari-yojana') return 'सर्व सरकारी योजना पहा'
  return `सर्व ${section.title} लेख पहा`
}

function subscribeToReducedMotion(onChange) {
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
  preference.addEventListener('change', onChange)
  return () => preference.removeEventListener('change', onChange)
}

function getReducedMotionPreference() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function useHomepageCategorySections() {
  const [sections, setSections] = useState(HOMEPAGE_CATEGORIES.map((category) => ({
    ...category,
    status: 'loading',
    articles: [],
    error: ''
  })))

  useEffect(() => {
    const controller = new AbortController()
    Promise.allSettled(HOMEPAGE_CATEGORIES.map(async (category) => {
      const data = await requestJson(`/api/articles?category=${encodeURIComponent(category.slug)}&page=1&limit=3`, controller.signal)
      return Array.isArray(data.articles) ? data.articles : []
    })).then((results) => {
      if (controller.signal.aborted) return
      const seenIds = new Set()
      const seenTitles = new Set()
      setSections(results.map((result, index) => {
        const category = HOMEPAGE_CATEGORIES[index]
        if (result.status === 'rejected') {
          if (result.reason?.name !== 'AbortError') console.error(`${category.title} homepage articles could not be loaded:`, result.reason)
          return { ...category, status: 'error', articles: [], error: 'लेख लोड करता आले नाहीत.' }
        }
        const articles = result.value.filter((article) => {
          const id = String(article.slug || article._id || '')
          const title = String(article.title || '').trim().toLocaleLowerCase()
          if ((id && seenIds.has(id)) || (title && seenTitles.has(title))) return false
          if (id) seenIds.add(id)
          if (title) seenTitles.add(title)
          return true
        })
        return { ...category, status: articles.length ? 'success' : 'empty', articles, error: '' }
      }))
    })
    return () => controller.abort()
  }, [])

  return sections
}

function useLiveCategories() {
  const [categories, setCategories] = useState([])
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/categories', { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('API unavailable')))
      .then((data) => setCategories(Array.isArray(data.categories) ? data.categories : []))
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setCategories([])
          console.error('Business categories could not be loaded:', error)
        }
      })
    return () => controller.abort()
  }, [])
  return categories
}

function mapBusinessRecord(business) {
  return {
    id: business.slug || business._id,
    name: business.businessName,
    ownerName: business.ownerName || business.owner?.name || '',
    category: business.category?.name || 'व्यवसाय',
    city: business.city,
    district: business.district,
    address: business.address,
    phone: business.mobile,
    email: business.email,
    website: business.website,
    description: business.description,
    premium: business.listingType !== 'free',
    image: business.logo || business.images?.[0] || ''
  }
}

function useLiveBusinesses() {
  const [state, setState] = useState({ status: 'loading', businesses: [], error: null })
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/businesses?limit=50', { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('API unavailable')))
      .then((data) => {
        const businesses = Array.isArray(data.businesses) ? data.businesses.map(mapBusinessRecord) : []
        setState({ status: businesses.length ? 'success' : 'empty', businesses, error: null })
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setState({ status: 'error', businesses: [], error: 'Business Directory लोड करता आली नाही.' })
      })
    return () => controller.abort()
  }, [])
  return state
}

function mapSchemeRecord(scheme) {
  return {
    id: scheme.slug || scheme._id,
    title: scheme.name,
    description: scheme.description,
    agency: 'सरकारी योजना',
    amount: 'अधिकृत माहिती तपासा',
    tag: 'Government Scheme',
    eligibility: scheme.eligibility,
    benefits: scheme.benefits,
    documents: scheme.documents,
    process: scheme.applicationProcess,
    officialUrl: scheme.officialUrl,
  }
}

function useLiveSchemes() {
  const [state, setState] = useState({ status: 'loading', schemes: [], error: null })
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/schemes?limit=50', { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('API unavailable')))
      .then((data) => {
        if (Array.isArray(data.schemes) && data.schemes.length) {
          setState({
            status: 'success',
            error: null,
            schemes: data.schemes.map(mapSchemeRecord),
          })
        } else setState({ status: 'empty', schemes: [], error: null })
      })
      .catch((error) => {
          if (error.name !== 'AbortError') setState({ status: 'error', schemes: [], error: 'Live scheme data उपलब्ध नाही.' })
      })
    return () => controller.abort()
  }, [])
  return state
}

function useLiveStories(page = 1) {
  const [state, setState] = useState({ status: 'loading', stories: [], pagination: null, error: null })
  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/stories?page=${page}&limit=12`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('API unavailable')))
      .then((data) => {
        const stories = Array.isArray(data.stories) ? data.stories : []
        setState({
          status: stories.length ? 'success' : 'empty',
          stories,
          pagination: data.pagination || null,
          error: null
        })
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setState({ status: 'error', stories: [], pagination: null, error: 'Success Stories लोड करता आल्या नाहीत.' })
      })
    return () => controller.abort()
  }, [page])
  return state
}

function useLiveNavigation() {
  const settings = useWebsiteSettings()
  const followLinks = useMemo(() => getOfficialSocialLinks(settings).map(({ label, to }) => ({ label, to })), [settings])
  const fallback = useMemo(() => [
    { label: 'Home', to: '/', children: [] },
    { label: 'उद्योजकता', to: '/category/entrepreneurship' },
    { label: 'उद्योग मोटिवेशन', to: '/category/business-motivation-startup-motivation', children: [
      { label: 'स्वतःची डेव्हलोपमेंट', to: '/category/personality-development' },
      { label: 'पुस्तक सारांश', to: '/category/books' },
      { label: 'सुविचार', to: '/category/quotes-suvichar' },
      { label: 'पर्सनल वेल्थ', to: '/category/personal-wealth' }
    ] },
    { label: 'तंत्रज्ञान', to: '/category/technology', children: [
      { label: 'ई-कॉमर्स', to: '/category/e-commerce' },
      { label: 'ब्लॉगिंग', to: '/category/blogging' }
    ] },
    { label: 'शेअर मार्केट', to: '/category/share-market' },
    { label: 'शेती उद्योग', to: '/category/farming-business' },
    { label: 'स्टार्टअप Story', to: '/category/startup-story' },
    { label: 'Follow', to: '/contact', children: followLinks },
    { label: 'Search', to: '/search', children: [] }
  ], [followLinks])
  const [items, setItems] = useState(fallback)
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/navigation?location=header', { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('API unavailable')))
      .then((data) => {
        const menu = data.menus?.[0]
        if (menu?.items?.length) setItems(normalizeNavigationItems(menu.items, fallback))
      })
      .catch((error) => { if (error.name !== 'AbortError') setItems(fallback) })
    return () => controller.abort()
  }, [fallback])
  return items
}

function isSocialUrl(value) {
  try {
    const host = new URL(value).hostname.replace(/^www\./i, '').toLowerCase()
    return ['instagram.com', 'facebook.com', 'youtube.com', 'youtu.be', 'wa.me', 'whatsapp.com', 'x.com', 'twitter.com', 'linkedin.com', 't.me', 'telegram.me'].some((domain) => host === domain || host.endsWith(`.${domain}`))
  } catch {
    return false
  }
}

function isSocialLabel(value) {
  return /^(instagram|facebook|youtube|whatsapp|telegram|linkedin|x|twitter|follow|social(?: media)?)\b/i.test(String(value || '').trim())
}

function normalizeNavigationItems(items, fallback) {
  const followItem = fallback.find((item) => item.label === 'Follow')
  const safeItems = items
    .filter((item) => item?.label && item?.to && !isSocialUrl(item.to) && !isSocialLabel(item.label))
    .map((item) => ({
      ...item,
      children: Array.isArray(item.children)
        ? item.children.filter((child) => !isSocialUrl(child.to) && !isSocialLabel(child.label))
        : []
    }))
  return [...safeItems.sort((a, b) => (a.order || 0) - (b.order || 0)), followItem]
}

function PageDetails({ initialPage = null } = {}) {
  const { slug: paramSlug } = useParams()
  const location = useLocation()
  const slug = paramSlug || location.pathname.split('/').filter(Boolean).pop()
  const [loadedState, setLoadedState] = useState({ status: 'loading', page: null })
  const state = initialPage ? { status: 'success', page: initialPage } : loadedState
  useEffect(() => {
    if (initialPage) return undefined
    const controller = new AbortController()
    fetch(`/api/pages/${encodeURIComponent(slug)}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Page unavailable')))
      .then((data) => setLoadedState({ status: 'success', page: data.page }))
      .catch((error) => {
        if (error.name !== 'AbortError') setLoadedState({ status: 'error', page: null })
      })
    return () => controller.abort()
  }, [slug, initialPage])
  if (state.status === 'loading') return <><PageHeader title="पान लोड होत आहे" crumb={slug}/><div className="data-loading">माहिती लोड होत आहे…</div></>
  if (state.status === 'error' || !state.page) return <><PageHeader title="पान सापडले नाही" crumb={slug}/><section className="section"><div className="container empty-state"><h2>Requested page उपलब्ध नाही</h2><Link to="/">मुख्यपृष्ठावर जा</Link></div></section></>
  return <>
    <ArticleDetailLayout
      header={<ArticleHeader
        title={state.page.title}
        category="Marathi Udyojak"
        subtitle={state.page.subtitle || state.page.excerpt}
        date={state.page.updatedAt ? new Date(state.page.updatedAt).toLocaleDateString('mr-IN') : 'संपादित पान'}
        breadcrumbParent="Pages"
        breadcrumbParentLink="/all-posts"
      />}
      image={state.page.featuredImage}
      imageAlt={state.page.title}
    >
      <div className="reference-rich-content" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(state.page.content) }}/>
    </ArticleDetailLayout>
  </>
}

function Header() {
  const [open, setOpen] = useState(false)
  const [mobileExpanded, setMobileExpanded] = useState('')
  const [desktopExpanded, setDesktopExpanded] = useState('')
  const [mobileSearch, setMobileSearch] = useState('')
  const location = useLocation()
  const navigate = useNavigate()
  const isHomePage = location.pathname === '/'
  const isCategoryArchivePage = /^\/category\/[^/]+\/?$/.test(location.pathname)
  const navItems = useLiveNavigation()
  const primaryNavItems = navItems.filter((item) => item.label !== 'Search')
  useEffect(() => { setOpen(false); setMobileExpanded(''); setDesktopExpanded(''); window.scrollTo(0, 0) }, [location.pathname])
  useEffect(() => {
    if (!open) return undefined
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])
  const submitMobileSearch = (event) => {
    event.preventDefault()
    const query = mobileSearch.trim()
    navigate(query ? `/search?search=${encodeURIComponent(query)}` : '/search')
    setOpen(false)
  }
  return (
    <>
      <header className="site-header public-home-header">
        <div className="header-main container">
          <Link className="brand" to="/" aria-label="एक्सप्रेस उद्योजक मुख्यपृष्ठ">
            <img
              className="source-logo"
              src={expressLogoUrl}
              alt="एक्सप्रेस उद्योजक लोगो"
            />
            <span className="source-logo-text"><strong>एक्सप्रेस<span> उद्योजक</span></strong></span>
          </Link>
          <nav className="desktop-nav" aria-label="मुख्य नेव्हिगेशन">
            {primaryNavItems.map((item) => item.children?.length ? (
              <div className="desktop-nav-dropdown" key={item.to || item.label}>
                <NavLink to={item.to}>{item.label}</NavLink>
                <button
                  type="button"
                  className="dropdown-toggle"
                  aria-label={`${item.label} उपमेनू`}
                  aria-expanded={desktopExpanded === item.to}
                  aria-controls={`menu-${item.to.replace(/[^a-z0-9]/gi, '-')}`}
                  onClick={() => setDesktopExpanded((current) => current === item.to ? '' : item.to)}
                ><ChevronRight className="dropdown-chevron" size={12}/></button>
                <div id={`menu-${item.to.replace(/[^a-z0-9]/gi, '-')}`} className={`desktop-dropdown-menu${desktopExpanded === item.to ? ' is-open' : ''}`}>
                  {item.children.map((child) => <SiteMenuLink key={child.to} to={child.to}>{child.label}<ChevronRight size={14}/></SiteMenuLink>)}
                </div>
              </div>
            ) : <NavLink key={item.to} to={item.to} end={item.to === '/'}>{item.label}</NavLink>)}
          </nav>
          <div className="header-actions">
            <Link className="header-search" to="/search" aria-label="Search"><Search size={20} /></Link>
            {isHomePage && <Link className="home-login" to="/auth" aria-label="लॉगिन"><CircleUserRound size={16} /><span>लॉगिन</span></Link>}
            <button className="menu-button" type="button" aria-expanded={open} aria-controls="mobile-primary-menu" onClick={() => setOpen(true)} aria-label="मेनू उघडा"><Menu /></button>
          </div>
        </div>
      </header>
      <NewsTicker label={isCategoryArchivePage || isHomePage ? 'नवीन पोस्ट्स' : undefined} containerLabel={isCategoryArchivePage} />
      {open && (
        <div className="menu-overlay" role="presentation" onClick={() => setOpen(false)}>
          <div className="mobile-menu" id="mobile-primary-menu" role="dialog" aria-modal="true" aria-label="मुख्य नेव्हिगेशन" onClick={(event) => event.stopPropagation()}>
            <div className="mobile-menu-head"><span>मेनू</span><button type="button" onClick={() => setOpen(false)} aria-label="मेनू बंद करा"><X /></button></div>
            <form className="mobile-menu-search" role="search" onSubmit={submitMobileSearch}>
              <input aria-label="Search" value={mobileSearch} onChange={(event) => setMobileSearch(event.target.value)} placeholder="Search ..." />
              <button type="submit" aria-label="Search"><Search size={20} /></button>
            </form>
            {navItems.filter((item) => item.label !== 'Search' && item.label !== 'Follow').map((item) => item.children?.length ? (
              <div className="mobile-nav-group" key={item.to}>
                <button type="button" aria-expanded={mobileExpanded === item.to} onClick={() => setMobileExpanded(mobileExpanded === item.to ? '' : item.to)}>{item.label}<ChevronRight className={mobileExpanded === item.to ? 'expanded' : ''} size={16}/></button>
                {mobileExpanded === item.to && <div className="mobile-nav-children">{item.children.map((child) => <SiteMenuLink key={child.to} to={child.to}>{child.label}<ChevronRight size={14}/></SiteMenuLink>)}</div>}
              </div>
            ) : <Link key={item.to} to={item.to}>{item.label}<ChevronRight size={18}/></Link>)}
            <SiteSocialLinks className="mobile-menu-social" />
          </div>
        </div>
      )}
    </>
  )
}

function Footer() {
  const settings = useWebsiteSettings()
  const [tags, setTags] = useState([])
  useEffect(() => {
    const controller = new AbortController()
    requestJson('/api/tags', controller.signal)
      .then((data) => setTags(Array.isArray(data.tags) ? data.tags : []))
      .catch((error) => {
        if (error.name !== 'AbortError') console.error('Footer tags request failed:', error)
      })
    return () => controller.abort()
  }, [])

  const primaryLinks = [
    { label: 'All Posts', to: '/all-posts' },
    { label: 'About Us', to: '/about-us' },
    { label: 'Advertise with Express Udyojak', to: '/promotions' },
    { label: 'Contact Us', to: '/contact-us' },
    { label: 'Privacy Policy', to: '/privacy-policy' },
    { label: 'Affiliate Disclosure', to: '/affiliate-disclosure-marathi-udyojak' },
    { label: 'DMCA Notice', to: '/dmca-notice' },
    { label: 'Terms & Conditions', to: '/terms-and-conditions' },
    { label: 'FAQs', to: '/faq' }
  ]
  const footerLinkList = (links) => links.map((item, index) => (
    <SiteMenuLink key={`${item.to}-${item.label}-${index}`} to={item.to}>{item.label}</SiteMenuLink>
  ))
  const footerTagList = () => tags.slice(0, 10).map((tag, index) => {
    const name = typeof tag === 'string' ? tag : tag.name
    const search = encodeURIComponent(name || '')
    return name ? <Link key={tag._id || tag.slug || `${name}-${index}`} to={`/search?search=${search}`}>{name}</Link> : null
  })

  return (
    <footer className="footer">
      <div className="container footer-main">
        <div className="footer-grid">
          {[0, 1, 2].map((column) => (
            <section className="footer-column" key={`important-links-${column}`}>
              <h3>Important Links</h3>
              {footerLinkList(primaryLinks)}
            </section>
          ))}
          <section className="footer-column footer-tags">
            <h3>TAGS</h3>
            <div>{footerTagList()}</div>
          </section>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="footer-bottom-inner">
          <span className="footer-copyright">© {new Date().getFullYear()} एक्सप्रेस उद्योजक · All Rights Reserved</span>
          <nav aria-label="Footer navigation">{footerLinkList(primaryLinks)}</nav>
          <div className="footer-socials" aria-label="Express Udyojak social media">
            {getOfficialSocialLinks(settings).map(({ key, label, to }) => (
              <SiteMenuLink key={key} to={to} aria-label={label} title={label} className="footer-social-link">
                <BrandSocialIcon network={key} />
              </SiteMenuLink>
            ))}
          </div>
        </div>
        <button type="button" className="footer-back-top" aria-label="Back to top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><ArrowUp size={17} /></button>
      </div>
    </footer>
  )
}

function MobileNav() {
  return (
    <nav className="mobile-bottom" aria-label="मोबाइल नेव्हिगेशन">
      <NavLink to="/" end><Home size={20} /><span>मुख्यपृष्ठ</span></NavLink>
      <NavLink to="/business-ideas"><Search size={20} /><span>कल्पना</span></NavLink>
      <NavLink className="bottom-add" to="/add-business"><span><Building2 size={22} /></span><span>व्यवसाय जोडा</span></NavLink>
      <NavLink to="/directory"><Store size={20} /><span>डिरेक्टरी</span></NavLink>
      <NavLink to="/auth"><CircleUserRound size={20} /><span>प्रोफाइल</span></NavLink>
    </nav>
  )
}

function SectionTitle({ eyebrow, title, link, to = '#' }) {
  return <div className="section-title"><div>{eyebrow && <span>{eyebrow}</span>}<h2>{title}</h2></div>{link && <Link to={to}>{link}<ArrowRight size={16} /></Link>}</div>
}

function SiteMenuLink({ to, children, ...props }) {
  if (/^https?:\/\//i.test(to || '')) {
    return <a href={to} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>
  }
  return <Link to={to} {...props}>{children}</Link>
}

function getOfficialSocialLinks(settings) {
  return [
    { key: 'instagram', label: 'Instagram', to: settings.social.instagram, className: 'archive-social-instagram' },
    { key: 'facebook', label: 'Facebook', to: settings.social.facebook, className: 'archive-social-facebook' },
    { key: 'youtube', label: 'YouTube', to: settings.social.youtube, className: 'archive-social-youtube' },
    { key: 'whatsapp', label: 'WhatsApp', to: settings.whatsappUrl, className: 'archive-social-whatsapp' }
  ]
}

function BrandSocialIcon({ network }) {
  if (network === 'facebook') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 21v-8h2.7l.4-3h-3.1V8.1c0-.9.3-1.6 1.6-1.6h1.7V3.8c-.3 0-1.3-.1-2.5-.1-2.4 0-4.1 1.5-4.1 4.2V10H7.5v3h2.7v8z" /></svg>
  }
  if (network === 'x') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3L12 14.6 5.6 22H2.4l7.3-8.4L1.8 2h6.5l4.4 6.8L18.9 2Zm-1.1 18h1.7L7.2 3.9H5.4L17.8 20Z" /></svg>
  }
  if (network === 'youtube') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="4" /><path d="m10 9 5 3-5 3z" /></svg>
  }
  if (network === 'instagram') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4" /><circle cx="12" cy="12" r="3.5" /><circle className="social-dot" cx="17.5" cy="6.8" r="1" /></svg>
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.6a8 8 0 0 1-11.8 7l-4.2 1.1 1.1-4.1A8 8 0 1 1 20 11.6Z" /><path d="M9 8.5c.2-.5.4-.5.7-.5h.5c.2 0 .4.1.5.4l.7 1.7c.1.2.1.4-.1.6l-.5.6c-.2.2-.2.4 0 .6.4.7 1 1.2 1.7 1.6.2.1.4.1.6-.1l.7-.8c.2-.2.4-.2.6-.1l1.6.8c.2.1.3.3.3.5 0 .4-.2 1.1-.7 1.5-.5.4-1.1.6-1.8.4-1-.2-2.1-.8-3.1-1.7-1.1-1-1.9-2.2-2.1-3.2-.2-.9.2-1.8.6-2.3Z" /></svg>
}

function SiteSocialLinks({ className = '', categoryArchive = false }) {
  const settings = useWebsiteSettings()
  const links = categoryArchive
    ? [
        { key: 'facebook', label: 'Facebook', to: settings.social.facebook, className: 'archive-social-facebook' },
        { key: 'x', label: 'X', to: 'https://x.com/', className: 'archive-social-x' },
        { key: 'youtube', label: 'YouTube', to: settings.social.youtube, className: 'archive-social-youtube' },
        { key: 'instagram', label: 'Instagram', to: settings.social.instagram, className: 'archive-social-instagram' },
        { key: 'whatsapp', label: 'WhatsApp', to: settings.whatsappUrl, className: 'archive-social-whatsapp' }
      ]
    : getOfficialSocialLinks(settings)
  return (
    <div className={`category-social-links ${className}`.trim()} aria-label="Social media">
      {links.map(({ key, label, to, className: linkClassName }) => (
        <SiteMenuLink key={key} to={to} className={linkClassName} aria-label={label} title={label}>
          <BrandSocialIcon network={key} />
        </SiteMenuLink>
      ))}
    </div>
  )
}

function HomePage() {
  const sections = useHomepageCategorySections()
  const articleState = useLiveArticles(60000, 4)
  const location = useLocation()
  const searchController = useRef(null)
  const suggestionController = useRef(null)
  const suggestionTimer = useRef(null)
  const [query, setQuery] = useState('')
  const [searchState, setSearchState] = useState({ status: 'idle', results: [], errors: [], error: '' })
  const [suggestionState, setSuggestionState] = useState({ status: 'idle', results: [], error: '' })
  const [activePostSlide, setActivePostSlide] = useState(0)
  const [isPostSliderHovered, setIsPostSliderHovered] = useState(false)
  const [isPostSliderFocused, setIsPostSliderFocused] = useState(false)
  const prefersReducedMotion = useSyncExternalStore(subscribeToReducedMotion, getReducedMotionPreference, () => false)
  const executeSearch = async (term, controller) => {
    setSearchState({ status: 'loading', results: [], errors: [], error: '' })
    try {
      const result = await searchWebsite(term, controller.signal)
      if (controller.signal.aborted) return
      setSearchState({ status: 'success', results: result.results, errors: result.errors, error: '' })
    } catch (error) {
      if (!controller.signal.aborted && error.name !== 'AbortError') setSearchState({ status: 'error', results: [], errors: [], error: error.message || 'शोध करता आला नाही.' })
    }
  }
  useEffect(() => {
    const initialQuery = new URLSearchParams(location.search).get('search')?.trim()
    if (!initialQuery) return undefined
    setQuery(initialQuery)
    setSuggestionState({ status: 'idle', results: [], error: '' })
    const controller = new AbortController()
    searchController.current?.abort()
    searchController.current = controller
    executeSearch(initialQuery, controller)
    return () => controller.abort()
  }, [location.search])
  useEffect(() => () => {
    searchController.current?.abort()
    suggestionController.current?.abort()
    window.clearTimeout(suggestionTimer.current)
  }, [])

  const updateQuery = (value) => {
    setQuery(value)
    searchController.current?.abort()
    setSearchState({ status: 'idle', results: [], errors: [], error: '' })
    suggestionController.current?.abort()
    window.clearTimeout(suggestionTimer.current)
    const prefix = value.trim()
    if (!prefix) {
      setSuggestionState({ status: 'idle', results: [], error: '' })
      return
    }
    const controller = new AbortController()
    suggestionController.current = controller
    setSuggestionState({ status: 'loading', results: [], error: '', matchMode: '' })
    suggestionTimer.current = window.setTimeout(async () => {
      try {
        const suggestions = await searchArticleTitleSuggestions(prefix, controller.signal)
        if (!controller.signal.aborted) {
          setSuggestionState({ status: 'success', results: suggestions.results, error: '', matchMode: suggestions.matchMode })
        }
      } catch (error) {
        if (!controller.signal.aborted && error.name !== 'AbortError') {
          setSuggestionState({ status: 'error', results: [], error: 'लेख शोधता आले नाहीत. कृपया पुन्हा प्रयत्न करा.' })
        }
      }
    }, 220)
  }
  const search = (event) => {
    event.preventDefault()
    if (!query.trim()) return
    suggestionController.current?.abort()
    window.clearTimeout(suggestionTimer.current)
    setSuggestionState({ status: 'idle', results: [], error: '' })
    searchController.current?.abort()
    const controller = new AbortController()
    searchController.current = controller
    executeSearch(query, controller)
  }

  const latestArticles = articleState.articles
    .filter((article, index, articles) => (
      article?.id &&
      articles.findIndex((candidate) => candidate.id === article.id) === index
    ))
    .slice(0, 4)
  const postSlideCount = Math.ceil(latestArticles.length / 2)
  const visiblePostSlide = postSlideCount ? activePostSlide % postSlideCount : 0
  const visibleArticles = latestArticles.slice(visiblePostSlide * 2, visiblePostSlide * 2 + 2)
  useEffect(() => {
    if (postSlideCount <= 1 || prefersReducedMotion || isPostSliderHovered || isPostSliderFocused) return undefined
    const timer = window.setInterval(() => {
      setActivePostSlide((current) => (current + 1) % postSlideCount)
    }, 5000)
    return () => window.clearInterval(timer)
  }, [postSlideCount, prefersReducedMotion, isPostSliderHovered, isPostSliderFocused])

  return (
    <div className="home-page-content">
      <section className="home-hero">
        <div className="home-hero-inner">
          <div className="home-hero-copy">
            <h1>प्रत्येक मराठी<br />उद्योजकासाठी</h1>
            <p>Business Ideas <span>•</span> सरकारी योजना <span>•</span> मार्गदर्शन <span>•</span> Success Stories</p>
            <div className="home-search-area">
              <form className="home-search" onSubmit={search}>
                <Search size={19} aria-hidden="true" />
                <input
                  aria-label="माहिती शोधा"
                  aria-autocomplete="list"
                  aria-controls="home-search-suggestions"
                  aria-expanded={suggestionState.status !== 'idle'}
                  value={query}
                  onChange={(event) => updateQuery(event.target.value)}
                  placeholder="लेख, योजना किंवा व्यवसाय कल्पना शोधा"
                />
                <button type="submit">शोधा</button>
              </form>
              {suggestionState.status === 'loading' && <div className="home-search-status" role="status">लेख शोधत आहे…</div>}
              {suggestionState.status === 'error' && <div className="home-search-status" role="alert">{suggestionState.error}</div>}
              {suggestionState.status === 'success' && (
                <div className="home-search-results" id="home-search-suggestions" role="listbox" aria-label="लेख सूचना">
                  {suggestionState.results.length ? suggestionState.results.map((result) => (
                    <Link className="home-search-result" key={result.id || result.title} to={result.to} role="option">
                      <img src={result.image} alt="" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = logoUrl }} />
                      <span><strong>{result.title}</strong><small>{result.kind} · {result.category} · {result.date}</small>{result.kind === 'लेख' && <ArticleAuthor size={12} linked={false} />}</span>
                      <ArrowRight size={14} />
                    </Link>
                  )) : <span>या शोधासाठी जुळणारे लेख सापडले नाहीत.</span>}
                </div>
              )}
              {searchState.status === 'loading' && <div className="home-search-status" role="status">शोधत आहे…</div>}
              {searchState.status === 'error' && <div className="home-search-status" role="alert">{searchState.error}</div>}
              {searchState.status === 'success' && (
                <div className="home-search-results" role="status">
                  {searchState.results.length ? searchState.results.map((result) => (
                    <Link className="home-search-result" key={`${result.kind}-${result.id || result.title}`} to={result.to}>
                      <img src={result.image} alt="" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = logoUrl }} />
                      <span><strong>{result.title}</strong><small>{result.kind} · {result.category}</small>{result.kind === 'लेख' && <ArticleAuthor size={12} linked={false} />}</span>
                      <ArrowRight size={14} />
                    </Link>
                  )) : <span>या शोधासाठी कोणतेही परिणाम सापडले नाहीत.</span>}
                  {searchState.errors.length > 0 && <small className="home-search-warning">काही प्रकारचे परिणाम सध्या लोड झाले नाहीत.</small>}
                </div>
              )}
            </div>
          </div>
          <div className="home-hero-art">
            <div className="home-hero-photo home-hero-photo-main"><img src="https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1200&q=85" alt="व्यवसाय नियोजनावर चर्चा करणारी टीम" /></div>
            <div className="home-hero-photo-badge">
              <span><Building2 size={18} aria-hidden="true" /></span>
              <div><strong>मराठी उद्योजकांसाठी</strong><small>कल्पना · मार्गदर्शन · संधी</small></div>
            </div>
          </div>
        </div>
      </section>

      <section className="home-topics">
        <div className="home-section-heading"><span></span><h2>मुख्य विषय / <em>Explore Topics</em></h2><span></span></div>
        <div className="home-topic-grid">
          {HOMEPAGE_TOPIC_CARDS.map(({ title, to, Icon, color, description }) => (
            <Link className={`home-topic-card home-topic-${color}`} to={to} key={to}>
              <Icon size={34} strokeWidth={2.5} />
              <strong>{title}</strong>
              <small>{description}</small>
            </Link>
          ))}
        </div>
      </section>

      <section
        className="home-new-post-slider"
        aria-labelledby="home-new-post-slider-heading"
        onMouseEnter={() => setIsPostSliderHovered(true)}
        onMouseLeave={() => setIsPostSliderHovered(false)}
        onFocusCapture={() => setIsPostSliderFocused(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setIsPostSliderFocused(false)
        }}
      >
        <div className="home-new-post-slider__inner">
          <header className="home-new-post-slider__heading">
            <span className="home-new-post-slider__eyebrow">ताज्या बातम्या</span>
            <h2 id="home-new-post-slider-heading">नवीन पोस्ट</h2>
            <p>उद्योजकतेच्या जगातील ताज्या घडामोडी</p>
          </header>

          {articleState.status === 'loading' && <div className="home-new-post-slider__state" role="status">नवीन पोस्ट लोड होत आहेत…</div>}
          {articleState.status === 'error' && <div className="home-new-post-slider__state" role="alert">{articleState.error}</div>}
          {articleState.status === 'empty' && <div className="home-new-post-slider__state">नवीन पोस्ट उपलब्ध नाहीत.</div>}
          {articleState.status === 'success' && latestArticles.length > 0 && (
            <>
              <div className="home-new-post-slider__cards" aria-live="off">
                {visibleArticles.map((article) => {
                  const excerpt = plainTextExcerpt(article.excerpt || article.subtitle || article.content || '')
                  return (
                    <Link className="home-new-post-slider__card" to={`/articles/${article.id}`} key={article.id} aria-label={`${article.title} वाचा`}>
                      <div className="home-new-post-slider__image-wrap">
                        <img src={article.image} alt={article.title} loading="lazy" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = logoUrl }} />
                        {article.tag && <span className="home-new-post-slider__category">{article.tag}</span>}
                      </div>
                      <div className="home-new-post-slider__copy">
                        <div className="home-new-post-slider__meta">
                          <span>{article.tag}</span>
                          <time>{article.date}</time>
                        </div>
                        <ArticleAuthor className="home-new-post-slider__author" size={14} linked={false} />
                        <h3>{article.title}</h3>
                        {excerpt && <p>{excerpt}</p>}
                        <span className="home-new-post-slider__read">लेख वाचा <ArrowRight size={15} aria-hidden="true" /></span>
                      </div>
                    </Link>
                  )
                })}
              </div>
              {postSlideCount > 1 && (
                <div className="home-new-post-slider__controls" aria-label="पोस्ट स्लाइडर नियंत्रण">
                  <span className="home-new-post-slider__count">{String(visiblePostSlide + 1).padStart(2, '0')} <i>/</i> {String(postSlideCount).padStart(2, '0')}</span>
                  <div className="home-new-post-slider__indicators" aria-label="स्लाइड निवडा">
                    {Array.from({ length: postSlideCount }, (_, index) => (
                      <button
                        type="button"
                        key={index}
                        className={index === visiblePostSlide ? 'is-active' : ''}
                        aria-label={`स्लाइड ${index + 1}`}
                        aria-current={index === visiblePostSlide ? 'true' : undefined}
                        onClick={() => setActivePostSlide(index)}
                      />
                    ))}
                  </div>
                  <div className="home-new-post-slider__arrows">
                    <button type="button" aria-label="मागील पोस्ट" onClick={() => setActivePostSlide((visiblePostSlide + postSlideCount - 1) % postSlideCount)}>
                      <ArrowLeft size={18} aria-hidden="true" />
                    </button>
                    <button type="button" aria-label="पुढील पोस्ट" onClick={() => setActivePostSlide((visiblePostSlide + 1) % postSlideCount)}>
                      <ArrowRight size={18} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
          {articleState.refreshError && <p className="home-new-post-slider__refresh-note" role="status">{articleState.refreshError}</p>}
        </div>
      </section>

      <div className="home-category-sections">
        {sections.map((section, sectionIndex) => (
          <section className={`home-category-section home-category-${section.color}`} key={section.slug}>
            <div className="home-category-head">
              <div>
                <span className="home-category-number">{String(sectionIndex + 1).padStart(2, '0')}</span>
                <div><p>तुमच्यासाठी निवडक माहिती</p><h2>{section.title}</h2></div>
              </div>
              <Link className="home-category-all" to={`/category/${section.slug}`}>सर्व लेख पहा <ArrowRight size={16} /></Link>
            </div>
            {section.status === 'loading' && <div className="home-category-state" role="status">लेख लोड होत आहेत…</div>}
            {section.status === 'error' && <div className="home-category-state" role="alert">{section.error}</div>}
            {section.status === 'empty' && <div className="home-category-state">या विभागात लेख उपलब्ध नाहीत.</div>}
            {section.articles.length > 0 && (
              <div className="home-article-grid">
                {section.articles.map((record) => {
                  const article = mapArticleRecord(record)
                  const excerpt = plainTextExcerpt(article.excerpt || article.subtitle || article.content || '')
                  return (
                    <article className="home-article-card" key={article.id || article.title}>
                      <Link className="home-article-image" to={`/articles/${article.id}`}>
                        <img src={article.image} alt={article.title} loading="lazy" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = logoUrl }} />
                      </Link>
                      <div className="home-article-copy">
                        <span className="home-article-category">{section.title}</span>
                        <h3><Link to={`/articles/${article.id}`}>{article.title}</Link></h3>
                        {excerpt && <p>{excerpt}</p>}
                        <div className="home-article-meta">
                          <ArticleAuthor size={12} />
                          <time>{article.publicationDate ? new Date(article.publicationDate).toLocaleDateString('mr-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'अलीकडील'}</time>
                          <Link to={`/articles/${article.id}`}>Read More <ArrowRight size={14} /></Link>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
            <Link className="home-category-cta" to={`/category/${section.slug}/`}>
              <span>{getHomepageCategoryCtaLabel(section)}</span>
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </section>
        ))}
      </div>
    </div>
  )
}

function IdeaCard({ idea }) {
  return (
    <article className="idea-card">
      <Link to={`/business-ideas/${idea.id}`}><img src={idea.image} alt={idea.title} /><span className="card-category">{idea.category}</span></Link>
      <div className="idea-card-body"><h3><Link to={`/business-ideas/${idea.id}`}>{idea.title}</Link></h3><div className="idea-meta"><span><MapPin size={14} />{idea.location}</span><span><TrendingUp size={14} />{idea.profit}</span></div><div className="idea-footer"><small>गुंतवणूक</small><strong>{idea.investment}</strong><Link to={`/business-ideas/${idea.id}`} aria-label={`${idea.title} पाहा`}><ArrowRight size={17} /></Link></div></div>
    </article>
  )
}

function ArticleCard({ article }) {
  return <article className="article-card"><Link to={`/articles/${article.id}`}><img src={article.image} alt="" /></Link><div><span>{article.tag} · {article.date}</span><h3><Link to={`/articles/${article.id}`}>{article.title}</Link></h3></div></article>
}

function PageHeader({ title, subtitle, crumb }) {
  return <section className="page-header"><div className="container"><div className="breadcrumb"><Link to="/">मुख्यपृष्ठ</Link><ChevronRight size={14} /><span>{crumb || title}</span></div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div></section>
}

function BusinessIdeas() {
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [maxInvestment, setMaxInvestment] = useState('')
  const ideaState = useLiveIdeas()
  const liveCategories = useLiveCategories()
  const liveIdeas = ideaState.ideas
  const filtered = liveIdeas.filter((idea) =>
    (idea.title.includes(query) || idea.category.includes(query)) &&
    (!categoryFilter || idea.category === categoryFilter) &&
    (!maxInvestment || idea.investmentValue <= Number(maxInvestment))
  )
  return <>
    <PageHeader title="व्यवसाय कल्पना" subtitle="तुमच्या गुंतवणूक आणि कौशल्यानुसार योग्य कल्पना निवडा." crumb="व्यवसाय कल्पना" />
    <section className="section"><div className="container">
      <div className="filter-bar"><label><Search size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="व्यवसाय कल्पना शोधा" /></label><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="">सर्व क्षेत्र</option>{liveCategories.map((category) => <option key={category._id} value={category.name}>{category.name}</option>)}</select><select value={maxInvestment} onChange={(event) => setMaxInvestment(event.target.value)}><option value="">सर्व गुंतवणूक</option><option value="25000">₹25 हजारपेक्षा कमी</option><option value="50000">₹50 हजारपर्यंत</option></select></div>
      {ideaState.status === 'loading' && <div className="data-loading">Business Ideas लोड होत आहेत…</div>}
      {ideaState.status === 'error' && <div className="data-notice" role="alert">{ideaState.error}</div>}
      {ideaState.status === 'empty' && <div className="empty-state"><Search /><h3>कोणत्याही Business Ideas उपलब्ध नाहीत</h3><p>नवीन कल्पना जोडण्यासाठी फॉर्म वापरा.</p><Link to="/add-idea">Business Idea जोडा</Link></div>}
      {ideaState.status === 'success' && (filtered.length ? <div className="idea-grid">{filtered.map((idea) => <IdeaCard key={idea.id} idea={idea} />)}</div> : <div className="empty-state"><Search /><h3>कोणतीही कल्पना सापडली नाही</h3><p>दुसरा शब्द किंवा filter वापरून पुन्हा शोधा.</p></div>)}
    </div></section>
  </>
}

function BusinessDetails() {
  const { id } = useParams()
  const ideaState = useLiveIdeas()
  const liveIdeas = ideaState.ideas
  const detailState = useLiveItem(`/api/business-ideas/${encodeURIComponent(id)}`, 'idea')
  const listedIdea = liveIdeas.find((item) => String(item.id) === String(id))
  const idea = detailState.item ? mapBusinessIdea(detailState.item) : listedIdea
  if (!idea && detailState.status === 'loading') return <div className="data-loading" role="status">Business Idea लोड होत आहे…</div>
  if (!idea && detailState.status === 'error') return <section className="section"><div className="container"><div className="data-notice" role="alert">{detailState.error}</div><Link to="/business-ideas">सर्व Business Ideas पाहा</Link></div></section>
  if (!idea) return <section className="section"><div className="container"><div className="empty-state"><h1>Business Idea सापडली नाही</h1><p>ही कल्पना प्रकाशित नाही किंवा URL उपलब्ध नाही.</p><Link to="/business-ideas">सर्व Business Ideas पाहा</Link></div></div></section>

  const sections = [
    ['उद्योजकासाठी सुरुवातीची माहिती', idea.description],
    ['मशीनरी आणि साधने', idea.machinery],
    ['कच्चा माल', idea.rawMaterials],
    ['परवान्या आणि आवश्यक नोंदणी', idea.licenses],
    ['कामाची प्रक्रिया', idea.process],
    ['मार्केटिंग आणि विक्री', idea.marketing],
  ]

  return <>
    {detailState.status === 'error' && <div className="container"><div className="data-notice" role="status">{detailState.error} यादीतील जुळणारी कल्पना दाखवत आहोत.</div></div>}
    <ArticleDetailLayout
      header={<ArticleHeader
        title={idea.title}
        category={idea.category}
        subtitle={idea.description}
        date="नवीन बातमी"
        breadcrumbParent="Business Ideas"
        breadcrumbParentLink="/business-ideas"
        readingTime="६ मि."
      />}
      image={idea.image}
      imageAlt={idea.title}
    >
      {sections.filter(([, content]) => content && (typeof content === 'string' ? content.trim() : content.length)).map(([heading, content], index) => (
        <section className="reference-article-section" key={heading}>
          <h2>{index + 1}. {heading}</h2>
          {Array.isArray(content)
            ? <ul>{content.map((item) => <li key={item}>{item}</li>)}</ul>
            : <p>{content}</p>}
        </section>
      ))}
      <div className="reference-guidance-box">
        <div><span>Business Guidance</span><h3>हा व्यवसाय सुरू करायचा आहे?</h3></div>
        <Link to="/contact">मार्गदर्शन मिळवा <ArrowRight size={15} /></Link>
      </div>
    </ArticleDetailLayout>
  </>
}

function GovernmentSchemes() {
  const schemeState = useLiveSchemes()
  return <>
    <PageHeader title="सरकारी योजना" subtitle="उद्योजकांसाठी सरकारी अनुदान, कर्ज आणि प्रशिक्षण संधी." crumb="सरकारी योजना" />
    <section className="section"><div className="container">
      {schemeState.status === 'loading' && <div className="data-loading">Schemes लोड होत आहेत…</div>}
      {schemeState.status === 'error' && <div className="data-notice" role="alert">{schemeState.error}</div>}
      {schemeState.status === 'empty' && <div className="empty-state"><h2>योजना लवकरच जोडल्या जातील</h2><p>अधिकृत आणि पडताळलेली माहिती उपलब्ध झाल्यावर येथे दिसेल.</p></div>}
      {schemeState.status === 'success' && <div className="scheme-grid">{schemeState.schemes.map((scheme) => <article className="scheme-card" key={scheme.id || scheme.title}><span>{scheme.tag}</span><h2><Link to={`/schemes/${scheme.id || scheme.title}`}>{scheme.title}</Link></h2><p>{scheme.agency}</p><div><small>अधिकृत तपशील</small><strong>{scheme.amount}</strong></div><Link className="scheme-detail-link" to={`/schemes/${scheme.id || scheme.title}`}>अधिक माहिती <ArrowRight size={16} /></Link></article>)}</div>}
    </div></section>
  </>
}

function Guidance() {
  const steps = [{ icon: Lightbulb, title: 'कल्पना तपासा', text: 'ग्राहकाची गरज आणि स्थानिक बाजार समजून घ्या.' }, { icon: BadgeIndianRupee, title: 'गुंतवणूक नियोजित करा', text: 'सुरुवातीची किंमत आणि मासिक खर्च ठरवा.' }, { icon: Store, title: 'नोंदणी पूर्ण करा', text: 'आवश्यक परवाना, GST आणि बैंक खाते तयार करा.' }, { icon: TrendingUp, title: 'विक्री सुरू करा', text: 'प्रात्यक्षिके, डिजिटल प्रचार आणि संदर्भ वापरा.' }]
  return <><PageHeader title="व्यवसाय मार्गदर्शन" subtitle="कल्पनेपासून व्यवसाय सुरू करण्यापर्यंत सोप्या पायऱ्या." crumb="मार्गदर्शन" /><section className="section"><div className="container guidance-grid">{steps.map(({ icon: Icon, title, text }, i) => <article key={title}><span>{i + 1}</span><Icon /><h2>{title}</h2><p>{text}</p></article>)}</div></section></>
}

function SuccessStories() {
  const [page, setPage] = useState(1)
  const storyState = useLiveStories(page)
  return (
    <>
      <section className="stories-page-header">
        <div className="container">
          <div className="breadcrumb"><Link to="/">मुख्यपृष्ठ</Link><ChevronRight size={14}/><span>यशोगाथा</span></div>
          <h1>यशोगाथा</h1>
        </div>
      </section>
      <section className="stories-page">
        <div className="container">
          <div className="stories-toolbar"><h2>प्रेरणादायी कथा</h2><Link to="/add-story">+ तुमची Success Story पाठवा</Link></div>
          {storyState.status === 'loading' && <div className="data-loading" role="status">Success Stories लोड होत आहेत…</div>}
          {storyState.status === 'error' && <div className="data-notice" role="alert">{storyState.error}</div>}
          {storyState.status === 'empty' && <div className="empty-state"><h3>अजून प्रकाशित Success Stories नाहीत</h3><p>तुमचा व्यवसाय प्रवास शेअर करून पहिली कथा पाठवा.</p><Link to="/add-story">तुमची कथा पाठवा</Link></div>}
          {storyState.status === 'success' && <>
            <div className="story-card-grid">
              {storyState.stories.map((story) => (
                <article className="story-list-card" key={story._id}>
                  <Link className="story-image" to={`/stories/${story.slug}`}>
                    {story.image ? <img src={story.image} alt={story.title} loading="lazy"/> : <span className="story-image-placeholder"><Building2 aria-hidden="true"/></span>}
                    <span>यशोगाथा</span>
                  </Link>
                  <div className="story-card-copy">
                    <div className="story-meta"><span><CircleUserRound size={13}/> {story.entrepreneurName}</span><span>{story.publicationDate ? new Date(story.publicationDate).toLocaleDateString('mr-IN') : story.city}</span></div>
                    <h2><Link to={`/stories/${story.slug}`}>{story.title}</Link></h2>
                    <p>{story.summary}</p>
                    <Link className="read-story" to={`/stories/${story.slug}`}>पूर्ण कथा वाचा <ArrowRight size={14}/></Link>
                  </div>
                </article>
              ))}
            </div>
            <div className="pagination">
              <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>‹</button>
              <button type="button" className="active">{page}</button>
              <button type="button" disabled={!storyState.pagination || page >= storyState.pagination.pages} onClick={() => setPage((value) => value + 1)}>›</button>
            </div>
          </>}
        </div>
      </section>
    </>
  )
}

function SuccessStoryDetails() {
  const { id } = useParams()
  const detailState = useLiveItem(`/api/stories/${encodeURIComponent(id)}`, 'story')
  const story = detailState.item
  if (!story && detailState.status === 'loading') return <div className="data-loading" role="status">Success Story लोड होत आहे…</div>
  if (!story && detailState.status === 'error') return <section className="section"><div className="container"><div className="data-notice" role="alert">{detailState.error}</div><Link to="/stories">सर्व Success Stories पाहा</Link></div></section>
  if (!story) return <section className="section"><div className="container"><div className="empty-state"><h1>Success Story सापडली नाही</h1><p>ही कथा प्रकाशित नाही किंवा URL उपलब्ध नाही.</p><Link to="/stories">सर्व Success Stories पाहा</Link></div></div></section>
  return <ArticleDetailLayout
    header={<ArticleHeader
      title={story.title}
      category="यशोगाथा"
      subtitle={story.summary}
      date={story.publicationDate ? new Date(story.publicationDate).toLocaleDateString('mr-IN') : story.city}
      author={story.entrepreneurName}
      breadcrumbParent="Success Stories"
      breadcrumbParentLink="/stories"
    />}
    image={story.image || undefined}
    imageAlt={story.title}
  >
    <section className="reference-article-section"><h2>{story.businessName} · {story.city}</h2>{story.story.split(/\r?\n\s*\r?\n/).filter(Boolean).map((paragraph, index) => <p key={`${index}-${paragraph.slice(0, 20)}`}>{paragraph}</p>)}</section>
  </ArticleDetailLayout>
}

function Articles() {
  const [page, setPage] = useState(1)
  const [articleState, setArticleState] = useState({ status: 'loading', articles: [], pagination: null })
  useEffect(() => {
    const controller = new AbortController()
    setArticleState((current) => ({ ...current, status: 'loading' }))
    fetch(`/api/articles?page=${page}&limit=12`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('API unavailable')))
      .then((data) => setArticleState({
        status: (data.articles || []).length ? 'success' : 'empty',
        articles: (data.articles || []).map((article) => ({
          id: article.slug || article._id,
          title: article.title,
          tag: article.category || 'लेख',
          date: article.publicationDate ? new Date(article.publicationDate).toLocaleDateString('mr-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Date unavailable',
          authorName: PUBLIC_AUTHOR_NAME,
          publicationDate: article.publicationDate,
          createdAt: article.createdAt,
          image: article.featuredImage || article.ogImage || article.image || logoUrl,
          excerpt: article.excerpt || article.subtitle || '',
          content: article.content,
          commentCount: article.commentCount ?? 0,
          totalViews: article.totalViews ?? 0,
          uniqueVisitors: article.uniqueVisitors ?? 0
        })),
        pagination: data.pagination
      }))
      .catch((error) => {
        if (error.name !== 'AbortError') setArticleState({ status: 'error', articles: [], pagination: null })
      })
    return () => controller.abort()
  }, [page])
  return <>
    <section className="all-posts-header"><div className="container"><div className="breadcrumb"><Link to="/">मुख्यपृष्ठ</Link><ChevronRight size={14}/><span>All Posts</span></div><h1>सर्व पोस्ट्स</h1></div></section>
    <section className="all-posts-page"><div className="container">
      {articleState.status === 'loading' && <div className="data-loading">Articles लोड होत आहेत…</div>}
      {articleState.status === 'error' && <div className="data-notice" role="alert">Articles लोड करता आले नाहीत. कृपया नंतर पुन्हा प्रयत्न करा.</div>}
      {articleState.status === 'empty' && <div className="empty-state"><Search/><h3>कोणतेही Articles उपलब्ध नाहीत</h3><p>थोड्या वेळाने पुन्हा तपासा.</p></div>}
      {articleState.status === 'success' && <>
        <div className="all-posts-grid">{articleState.articles.map((article) => (
          <article className="all-post-card" key={article.id}>
            <Link className="all-post-image" to={`/articles/${article.id}`}>
              <img src={article.image} alt={article.title} loading="lazy"/>
              <span>{article.tag}</span>
            </Link>
            <ArticleCardMetadata article={article} className="all-post-card-metadata"/>
            <div>
              <h2><Link to={`/articles/${article.id}`}>{article.title}</Link></h2>
              {article.excerpt && <p>{article.excerpt.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').slice(0,150)}</p>}
            </div>
          </article>
        ))}</div>
        <div className="pagination"><button type="button" disabled={!articleState.pagination || page <= 1} onClick={() => setPage((value) => value - 1)}>‹</button>{Array.from({ length: Math.min(articleState.pagination?.pages || 1, 5) }, (_, index) => index + 1).map((pageNumber) => <button type="button" key={pageNumber} className={pageNumber === page ? 'active' : ''} onClick={() => setPage(pageNumber)}>{pageNumber}</button>)}<button type="button" disabled={!articleState.pagination || page >= articleState.pagination.pages} onClick={() => setPage((value) => value + 1)}>›</button></div>
      </>}
    </div></section>
  </>
}

function SearchPage() {
  const location = useLocation()
  const searchController = useRef(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [status, setStatus] = useState({ value: 'idle', errors: [], message: '' })
  const runSearch = async (term, controller) => {
    setStatus({ value: 'loading', errors: [], message: '' })
    try {
      const data = await searchWebsite(term, controller.signal)
      if (controller.signal.aborted) return
      setResults(data.results)
      setStatus({ value: 'success', errors: data.errors, message: '' })
    } catch (error) {
      if (!controller.signal.aborted && error.name !== 'AbortError') setStatus({ value: 'error', errors: [], message: error.message || 'Search आता उपलब्ध नाही.' })
    }
  }
  useEffect(() => {
    const initialQuery = new URLSearchParams(location.search).get('search')?.trim()
    if (!initialQuery) return undefined
    setQuery(initialQuery)
    searchController.current?.abort()
    const controller = new AbortController()
    searchController.current = controller
    runSearch(initialQuery, controller)
    return () => controller.abort()
  }, [location.search])
  useEffect(() => () => searchController.current?.abort(), [])
  const search = (event) => {
    event.preventDefault()
    if (!query.trim()) return
    searchController.current?.abort()
    const controller = new AbortController()
    searchController.current = controller
    runSearch(query.trim(), controller)
  }
  return <>
    <section className="stories-page-header"><div className="container"><div className="breadcrumb"><Link to="/">मुख्यपृष्ठ</Link><ChevronRight size={14}/><span>Search</span></div><h1>वेबसाइटवर शोधा</h1></div></section>
    <section className="section"><div className="container">
      <form className="directory-search" onSubmit={search}><Search size={19}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="व्यवसाय कल्पना, योजना, मशीन किंवा लेख शोधा"/><button type="submit">शोधा</button></form>
      {status.value === 'loading' && <div className="data-loading" role="status">Search करत आहे…</div>}
      {status.value === 'error' && <div className="data-notice" role="alert">{status.message}</div>}
      {status.value === 'success' && status.errors.length > 0 && <div className="data-notice" role="status">काही प्रकारचे परिणाम लोड झाले नाहीत.</div>}
      {status.value === 'success' && (results.length ? <div className="search-result-grid">{results.map((result) => (
        <article className="search-result-card" key={`${result.kind}-${result.id || result.title}`}>
          <Link className="search-result-image" to={result.to}><img src={result.image} alt={result.title} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = logoUrl }} /><span>{result.kind}</span></Link>
          <div><small>{result.category} · {result.date}</small>{result.kind === 'लेख' && <ArticleAuthor className="search-result-author" size={14} />}<h2><Link to={result.to}>{result.title}</Link></h2>{result.excerpt && <p>{result.excerpt}</p>}<Link className="search-result-read" to={result.to}>Read More <ArrowRight size={15}/></Link></div>
        </article>
      ))}</div> : <div className="empty-state"><Search/><h3>कोणतेही परिणाम सापडले नाहीत</h3></div>)}
    </div></section>
  </>
}

function CategoryArchive({ categoryName = '' } = {}) {
  const { slug: routeSlug } = useParams()
  const slug = categoryName || routeSlug
  const [state, setState] = useState({ status: 'loading', articles: [], category: slug })
  const [page, setPage] = useState(1)
  useEffect(() => {
    setPage(1)
  }, [slug])
  useEffect(() => {
    const controller = new AbortController()
    setState((current) => ({ ...current, status: 'loading' }))
    fetch(`/api/articles?category=${encodeURIComponent(slug)}&page=${page}&limit=6`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('API unavailable')))
      .then((data) => setState({
        status: 'success',
        articles: data.articles || [],
        pagination: data.pagination,
        category: data.categoryName || slug,
      }))
      .catch((error) => {
        if (error.name !== 'AbortError') setState({ status: 'error', articles: [], category: slug })
      })
    return () => controller.abort()
  }, [slug, page])
  const goToPage = (pageNumber) => {
    setPage(pageNumber)
    window.requestAnimationFrame(() => {
      document.querySelector('.category-archive-heading')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const categoryTitle = categoryName
    ? 'व्यवसाय कर्ज | Business Loans'
    : slug === 'entrepreneurship'
    ? 'उद्योजकता'
    : slug === 'sarkari-yojana'
      ? 'सरकारी योजना'
      : slug === 'technology'
        ? 'तंत्रज्ञान'
        : slug === 'farming-business'
          ? 'शेती उद्योग'
          : (state.category || slug)
  const categorySubtitle = categoryName
    ? 'CMEGP, business loans आणि उद्योजकांसाठी आर्थिक मार्गदर्शन'
    : slug.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
  useEffect(() => {
    if (typeof categoryTitle !== 'string') return
    const categoryNames = {
      'Business Loans': { title: 'व्यवसाय कर्ज आणि आर्थिक मार्गदर्शन', description: 'CMEGP, व्यवसाय कर्ज, small business loan आणि उद्योजकांना उपलब्ध सरकारी व आर्थिक सहाय्य याबद्दल मराठी माहिती वाचा.' },
      entrepreneurship: { title: 'उद्योजकता आणि नवीन व्यवसाय कल्पना', description: 'नवीन व्यवसाय कल्पना, कमी गुंतवणुकीत उद्योग आणि Small Business Ideas in Marathi या उद्योजकता लेख संग्रहात वाचा.' },
      'sarkari-yojana': { title: 'सरकारी योजना महाराष्ट्र उद्योजकांसाठी', description: 'Government Schemes for Entrepreneurs आणि महाराष्ट्रातील सरकारी योजना, पात्रता आणि अर्ज माहिती या category मध्ये वाचा.' },
      technology: { title: 'तंत्रज्ञान आणि उद्योग व्यवसाय माहिती', description: 'महाराष्ट्रातील तंत्रज्ञान, नवीन उद्योग व्यवसाय आणि digital Business Opportunities यांचे मराठी लेख वाचा.' },
      'farming-business': { title: 'शेती उद्योग आणि महाराष्ट्र व्यवसाय संधी', description: 'शेती उद्योग, कमी गुंतवणुकीत ग्रामीण व्यवसाय आणि Maharashtra Business Opportunities याबद्दल माहिती वाचा.' },
      'personality-development': { title: 'स्वतःचा विकास आणि उद्योजक Skill', description: 'व्यवसायासाठी personality development, leadership आणि व्यक्तिमत्त्व विकासाचे मराठी लेख वाचा.' }
    }
    const fallbackTitle = `${categoryTitle} लेख आणि व्यवसाय मार्गदर्शन`
    const fallbackDescription = `${categoryTitle} category मधील नवीन व्यवसाय कल्पना, उद्योग व्यवसाय माहिती आणि Maharashtra Business Opportunities मराठीत वाचा.`
    const metadata = categoryNames[typeof slug === 'string' ? slug : ''] || {
      title: fallbackTitle,
      description: fallbackDescription
    }
    const title = `${metadata.title} | Express Udyojak`
    const canonical = categoryName
      ? `${SITE_URL}/business-loans`
      : `${SITE_URL}/category/${encodeURIComponent(String(slug).replace(/\/+$/, ''))}`
    document.title = title

    const ensureMeta = (name, content, property = false) => {
      if (!content) return
      const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`
      let meta = document.head.querySelector(selector)
      if (!meta) {
        meta = document.createElement('meta')
        meta.setAttribute(property ? 'property' : 'name', name)
        document.head.appendChild(meta)
      }
      meta.setAttribute('content', content)
    }
    ensureMeta('description', metadata.description)
    ensureMeta('robots', 'index,follow,max-image-preview:large')
    ensureMeta('og:title', title, true)
    ensureMeta('og:description', metadata.description, true)
    ensureMeta('og:type', 'website', true)
    ensureMeta('og:url', canonical, true)
    ensureMeta('twitter:card', 'summary_large_image')
    ensureMeta('twitter:title', title)
    ensureMeta('twitter:description', metadata.description)

    let canonicalLink = document.head.querySelector('link[rel="canonical"]')
    if (!canonicalLink) {
      canonicalLink = document.createElement('link')
      canonicalLink.setAttribute('rel', 'canonical')
      document.head.appendChild(canonicalLink)
    }
    canonicalLink.setAttribute('href', canonical)

    let breadcrumbSchema = document.head.querySelector('script[data-category-breadcrumb]')
    if (!breadcrumbSchema) {
      breadcrumbSchema = document.createElement('script')
      breadcrumbSchema.type = 'application/ld+json'
      breadcrumbSchema.setAttribute('data-category-breadcrumb', 'true')
      document.head.appendChild(breadcrumbSchema)
    }
    breadcrumbSchema.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'मुख्यपृष्ठ', item: `${SITE_URL}/` },
        { '@type': 'ListItem', position: 2, name: categoryTitle, item: canonical }
      ]
    })
    return () => breadcrumbSchema.remove()
  }, [categoryTitle, slug])
  return <>
    <section className="category-archive">
      <div className="container category-archive-layout">
        <main className="category-archive-main">
          <div className="category-archive-panel">
            <header className="category-archive-heading">
              <div className="archive-breadcrumb"><Link to="/"><Home size={12} aria-hidden="true" />Home</Link><span aria-hidden="true">/</span><span>{categoryTitle}</span></div>
              <h1>{categoryTitle}</h1>
              <p>{categorySubtitle}</p>
            </header>
            {state.status === 'loading' && <div className="data-loading" role="status">Articles लोड होत आहेत…</div>}
            {state.status === 'error' && <div className="data-notice" role="alert">Category articles लोड करता आले नाहीत. कृपया नंतर पुन्हा प्रयत्न करा.</div>}
            {state.status === 'success' && (
              state.articles.length ? <>
                <div className="category-article-list">{state.articles.map((article) => {
                  const categoryArticle = {
                    ...article,
                    authorName: PUBLIC_AUTHOR_NAME
                  }
                  return (
                  <article className="category-article-card" key={article.slug || article._id}>
                    <div className="category-article-media">
                      <Link className="category-article-image" to={`/articles/${article.slug || article._id}`}>
                        <img
                          src={article.featuredImage || article.image || article.ogImage || logoUrl}
                          alt={article.title}
                          loading="lazy"
                          onError={(event) => {
                            if (event.currentTarget.dataset.fallback !== 'true') {
                              event.currentTarget.dataset.fallback = 'true'
                              event.currentTarget.src = logoUrl
                            }
                          }}
                        />
                        <span className="category-article-badge">{article.category}</span>
                      </Link>
                    </div>
                    <div className="category-article-copy">
                      <ArticleCardMetadata article={categoryArticle} className="category-article-meta"/>
                      <h2><Link to={`/articles/${article.slug || article._id}`}>{article.title}</Link></h2>
                      {(article.excerpt || article.subtitle) && <p>{plainTextExcerpt(article.excerpt || article.subtitle)}</p>}
                      <Link className="category-read-more" to={`/articles/${article.slug || article._id}`}>Read More »</Link>
                    </div>
                  </article>
                  )
                })}</div>
                {(state.pagination?.pages || 1) > 1 && (
                  <nav className="category-pagination" aria-label="Category pagination">
                    {page > 1 && (
                      <button type="button" className="category-pagination-prev" onClick={() => goToPage(page - 1)}>
                        Previous
                      </button>
                    )}
                    {Array.from({ length: state.pagination?.pages || 1 }, (_, index) => index + 1)
                      .filter((pageNumber) => pageNumber === 1 || pageNumber === state.pagination?.pages || Math.abs(pageNumber - page) <= 2)
                      .map((pageNumber, index, visiblePages) => (
                        <span key={pageNumber} className="category-pagination-item">
                          {index > 0 && pageNumber - visiblePages[index - 1] > 1 && <span className="category-pagination-ellipsis" aria-hidden="true">…</span>}
                          <button
                            type="button"
                            className={pageNumber === page ? 'active' : ''}
                            aria-current={pageNumber === page ? 'page' : undefined}
                            onClick={() => goToPage(pageNumber)}
                          >
                            {pageNumber}
                          </button>
                        </span>
                      ))}
                    {page < state.pagination.pages && (
                      <button type="button" className="category-pagination-next" onClick={() => goToPage(page + 1)}>
                        Next
                      </button>
                    )}
                  </nav>
                )}
              </> : <div className="empty-state"><h3>{categoryName ? 'Business Loans मध्ये Articles उपलब्ध नाहीत' : 'या Category मध्ये Articles उपलब्ध नाहीत'}</h3>{categoryName && <p>या विषयावरील नवे articles प्रकाशित झाल्यावर इथे दिसतील.</p>}</div>
            )}
          </div>
        </main>
        <aside className="category-archive-sidebar">
          <SiteSocialLinks className="category-archive-social-links" categoryArchive />
          <PopularPostsSidebar />
        </aside>
      </div>
    </section>
  </>
}

function plainTextExcerpt(value) {
  const sanitized = DOMPurify.sanitize(value, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
  const text = new DOMParser().parseFromString(sanitized, 'text/html').body.textContent?.replace(/\s+/g, ' ').trim() || ''
  const characters = Array.from(text)
  return characters.length > 150 ? `${characters.slice(0, 149).join('')}…` : text
}

function BusinessDirectory() {
  const [query, setQuery] = useState('')
  const businessState = useLiveBusinesses()
  const filtered = businessState.businesses.filter((business) => `${business.name}${business.category}${business.city}${business.district}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  return <><PageHeader title="व्यवसाय डिरेक्टरी" subtitle="महाराष्ट्रातील मंजूर व्यवसाय शोधा." crumb="व्यवसाय डिरेक्टरी" /><section className="section"><div className="container">
    <div className="directory-search"><Search size={19} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="व्यवसाय, सेवा किंवा शहर शोधा" /></div>
    {businessState.status === 'loading' && <div className="data-loading" role="status">व्यवसाय लोड होत आहेत…</div>}
    {businessState.status === 'error' && <div className="data-notice" role="alert">{businessState.error}</div>}
    {businessState.status === 'empty' && <div className="empty-state"><h2>व्यवसाय अजून प्रकाशित झालेले नाहीत</h2><p>नोंदणी केल्यानंतर मंजुरी मिळाल्यावर व्यवसाय येथे दिसेल.</p><Link to="/add-business">व्यवसाय नोंदवा</Link></div>}
    {businessState.status === 'success' && (filtered.length ? <div className="directory-grid">{filtered.map((business) => <article className="directory-card" key={business.id}>{business.image ? <img src={business.image} alt={business.name} loading="lazy"/> : <div className="directory-image-placeholder"><Building2 aria-hidden="true"/></div>}<div>{business.premium && <span className="premium">Premium</span>}<h2><Link to={`/directory/${business.id}`}>{business.name}</Link></h2><p>{business.category}</p><div><span><MapPin size={15} />{business.city}</span><Link to={`/directory/${business.id}`}><Phone size={15} />संपर्क</Link></div></div></article>)}</div> : <div className="empty-state"><h2>जुळणारा व्यवसाय सापडला नाही</h2><p>दुसरा शोध शब्द वापरून पहा.</p></div>)}
  </div></section></>
}

function SchemeDetails() {
  const { id } = useParams()
  const schemeState = useLiveSchemes()
  const detailState = useLiveItem(`/api/schemes/${encodeURIComponent(id)}`, 'scheme')
  const listedScheme = schemeState.schemes.find((item) => String(item.id) === String(id))
  const scheme = detailState.item ? mapSchemeRecord(detailState.item) : listedScheme
  if (!scheme && detailState.status === 'loading') return <div className="data-loading" role="status">Scheme माहिती लोड होत आहे…</div>
  if (!scheme && detailState.status === 'error') return <section className="section"><div className="container"><div className="data-notice" role="alert">{detailState.error}</div><Link to="/schemes">सर्व योजना पाहा</Link></div></section>
  if (!scheme) return <section className="section"><div className="container"><div className="empty-state"><h1>योजना सापडली नाही</h1><p>ही योजना उपलब्ध नाही किंवा URL चुकीचा आहे.</p><Link to="/schemes">सर्व योजना पाहा</Link></div></div></section>
  return <>
    {detailState.status === 'error' && <div className="container"><div className="data-notice" role="status">{detailState.error} यादीतील जुळणारी योजना दाखवत आहोत.</div></div>}
    <ArticleDetailLayout
      header={<ArticleHeader
        title={scheme.title}
        category={scheme.tag}
        subtitle={scheme.description}
        date="Government Scheme"
        breadcrumbParent="Government Schemes"
        breadcrumbParentLink="/schemes"
      />}
    >
      {scheme.eligibility?.length > 0 && <section className="reference-article-section"><h2>1. पात्रता</h2><ul>{scheme.eligibility.map((item) => <li key={item}>{item}</li>)}</ul></section>}
      {scheme.benefits?.length > 0 && <section className="reference-article-section"><h2>2. लाभ</h2><ul>{scheme.benefits.map((item) => <li key={item}>{item}</li>)}</ul></section>}
      {scheme.documents?.length > 0 && <section className="reference-article-section"><h2>3. आवश्यक कागदपत्रे</h2><ul>{scheme.documents.map((item) => <li key={item}>{item}</li>)}</ul></section>}
      {scheme.process?.length > 0 && <section className="reference-article-section"><h2>4. अर्ज प्रक्रिया</h2><ul>{scheme.process.map((item) => <li key={item}>{item}</li>)}</ul></section>}
      {scheme.officialUrl && <a className="reference-official-link" href={scheme.officialUrl} target="_blank" rel="noreferrer">अधिकृत वेबसाइटवर जाण्यासाठी <ArrowRight size={16} /></a>}
    </ArticleDetailLayout>
  </>
}

function BusinessDirectoryDetails() {
  const { id } = useParams()
  const resourcePath = /^[a-f\d]{24}$/i.test(id)
    ? `/api/businesses/${encodeURIComponent(id)}`
    : `/api/businesses/slug/${encodeURIComponent(id)}`
  const detailState = useLiveItem(resourcePath, 'business')
  const business = detailState.item ? mapBusinessRecord(detailState.item) : null
  if (!business && detailState.status === 'loading') return <div className="data-loading" role="status">व्यवसाय माहिती लोड होत आहे…</div>
  if (!business && detailState.status === 'error') return <section className="section"><div className="container"><div className="data-notice" role="alert">{detailState.error}</div><Link to="/directory">व्यवसाय डिरेक्टरी पाहा</Link></div></section>
  if (!business) return <section className="section"><div className="container"><div className="empty-state"><h1>व्यवसाय सापडला नाही</h1><p>हा व्यवसाय उपलब्ध नाही किंवा मंजूर झालेला नाही.</p><Link to="/directory">व्यवसाय डिरेक्टरी पाहा</Link></div></div></section>
  return <>
    {detailState.status === 'error' && <div className="container"><div className="data-notice" role="status">{detailState.error} यादीतील व्यवसाय दाखवत आहोत.</div></div>}
    <ArticleDetailLayout
      header={<ArticleHeader
        title={business.name}
        category={business.category}
        subtitle={business.description}
        date={`${business.city}, ${business.district}`}
        author={business.ownerName}
        breadcrumbParent="Business Directory"
        breadcrumbParentLink="/directory"
      />}
      image={business.image || undefined}
      imageAlt={business.name}
    >
      <section className="reference-article-section"><h2>व्यवसायाची माहिती</h2><ul><li>शहर: {business.city}</li><li>जिल्हा: {business.district}</li><li>पत्ता: {business.address}</li>{business.email && <li>ईमेल: {business.email}</li>}{business.website && <li>वेबसाइट: <a href={business.website} target="_blank" rel="noreferrer">{business.website}</a></li>}</ul></section>
      {business.phone && <div className="reference-guidance-box"><div><span>Customer Enquiry</span><h3>मोबाइलवर थेट चौकशी करा</h3></div><a href={`tel:${business.phone}`}><Phone size={15} /> संपर्क करा</a></div>}
    </ArticleDetailLayout>
  </>
}

function AddBusiness() {
  const navigate = useNavigate()
  const categoryItems = useLiveCategories()
  const [submission, setSubmission] = useState({ status: 'idle', message: '' })
  const submit = async (event) => {
    event.preventDefault()
    const token = localStorage.getItem('marathiUdyojakToken')
    if (!token) {
      navigate('/auth', { state: { from: '/add-business' } })
      return
    }
    const formElement = event.currentTarget
    setSubmission({ status: 'saving', message: '' })
    try {
      const response = await fetch('/api/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(Object.fromEntries(new FormData(formElement).entries()))
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'व्यवसाय नोंदवता आला नाही.')
      formElement.reset()
      setSubmission({ status: 'success', message: 'तुमचे व्यवसाय नोंदणी निवेदन review साठी सेव्ह झाले. मंजुरीनंतर ते डिरेक्टरीमध्ये दिसेल.' })
    } catch (error) {
      setSubmission({ status: 'error', message: error.message })
    }
  }
  return <><PageHeader title="तुमचा व्यवसाय जोडा" subtitle="नोंदणी करा; पडताळणीनंतर तुमची माहिती डिरेक्टरीमध्ये दिसेल." crumb="व्यवसाय जोडा" /><section className="section"><div className="container add-layout"><div className="plan-card"><h2>नोंदणी पर्याय</h2><article><strong>मोफत नोंदणी</strong><p>मूलभूत माहिती आणि ग्राहक चौकशी</p><span>₹०</span></article><article><strong>Premium नोंदणी</strong><p>प्राधान्य क्रम, फोटो आणि अधिक चौकशी</p><span>उपलब्ध लवकरच</span></article><article><strong>Featured प्रमोशन</strong><p>मुख्य पानावर विशेष जाहिरात</p><span>उपलब्ध लवकरच</span></article></div><form className="business-form" onSubmit={submit}>{submission.status === 'success' ? <div className="success-message" role="status"><HeartHandshake /><h2>नोंदणी निवेदन मिळाले</h2><p>{submission.message}</p></div> : <>{submission.status === 'error' && <div className="data-notice" role="alert">{submission.message}</div>}<h2>व्यवसायाची माहिती</h2><label>व्यवसायाचे नाव<input name="businessName" required minLength="2" maxLength="160" placeholder="उदा. श्रीगणेश खाद्य पदार्थ" /></label><label>मालकाचे नाव<input name="ownerName" required minLength="2" maxLength="100" placeholder="पूर्ण नाव" /></label><div className="form-row"><label>प्रकार<select name="category" required defaultValue=""><option value="" disabled>विभाग निवडा</option>{categoryItems.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}</select></label><label>शहर<input name="city" required placeholder="नाशिक" /></label></div><div className="form-row"><label>जिल्हा<input name="district" required placeholder="नाशिक" /></label><label>मोबाइल क्रमांक<input name="mobile" required type="tel" pattern="[0-9+\\- ]{10,15}" placeholder="१० अंकी मोबाइल क्रमांक" /></label></div><label>पूर्ण पत्ता<input name="address" required placeholder="दुकान / कार्यालयाचा पत्ता" /></label><label>ईमेल (ऐच्छिक)<input name="email" type="email" placeholder="व्यवसायाचा ईमेल" /></label><label>वेबसाइट (ऐच्छिक)<input name="website" type="url" placeholder="https://..." /></label><label>संक्षिप्त माहिती<textarea name="description" required minLength="20" maxLength="3000" rows="4" placeholder="तुमच्या व्यवसायाबद्दल थोडक्यात..." /></label><button type="submit" disabled={submission.status === 'saving' || categoryItems.length === 0}>{submission.status === 'saving' ? 'नोंदणी सेव्ह होत आहे…' : 'नोंदणीसाठी पाठवा'} <ArrowRight size={17} /></button>{!localStorage.getItem('marathiUdyojakToken') && <small>नोंदणी पाठवण्यासाठी आधी लॉगिन करणे आवश्यक आहे.</small>}</>}</form></div></section></>
}

function SimplePage({ title, children }) {
  return <>
    <PageHeader title={title} crumb={title} />
    <section className="section">
      <div className="container simple-page-layout">
        <div className="simple-copy">{children}</div>
        <aside className="reference-sidebar-sticky"><PopularPostsSidebar /></aside>
      </div>
    </section>
  </>
}

const FOOTER_CONTENT_PAGES = {
  '/about-us': {
    title: 'आमच्याबद्दल',
    sections: [
      {
        heading: 'आमची ओळख – एक्सप्रेस उद्योजक',
        paragraphs: [
          'एक्सप्रेस उद्योजक हे मराठी भाषेत व्यवसाय, उद्योग, स्टार्टअप, सरकारी योजना, मशीनरी, तंत्रज्ञान आणि स्वयंरोजगार याबद्दल उपयुक्त माहिती देण्यासाठी तयार केलेले डिजिटल व्यासपीठ आहे.',
          'नवीन व्यवसाय सुरू करू इच्छिणाऱ्या व्यक्तींपासून ते आपला उद्योग वाढवू पाहणाऱ्या उद्योजकांपर्यंत सर्वांना सोप्या भाषेत माहिती मिळावी, हा आमचा प्रयत्न आहे. महाराष्ट्रातील स्थानिक व्यवसाय, उत्पादन क्षेत्र, सेवा व्यवसाय आणि ग्रामीण उद्योग यांना डिजिटल माध्यमातून अधिक लोकांपर्यंत पोहोचवण्यावर आमचा भर आहे.'
        ]
      },
      {
        heading: 'आमचे ध्येय',
        quote: 'योग्य माहिती, स्पष्ट मार्गदर्शन आणि योग्य संधी यांच्या मदतीने अधिकाधिक लोकांना स्वतःचा व्यवसाय उभारण्यासाठी प्रेरित करणे.',
        quoteBeforeParagraphs: true,
        paragraphs: [
          'व्यवसाय सुरू करताना अनेक प्रश्न पडतात—किती गुंतवणूक लागेल, कोणती मशीनरी लागेल, परवाने कुठे मिळतील, सरकारी योजनांचा लाभ कसा घ्यावा आणि ग्राहकांपर्यंत कसे पोहोचावे. अशा प्रश्नांची प्राथमिक माहिती मराठीत उपलब्ध करून देणे हे आमचे उद्दिष्ट आहे.'
        ]
      },
      {
        heading: 'आम्ही कोणती माहिती देतो?',
        subsections: [
          { heading: 'व्यवसाय कल्पना आणि उद्योग मार्गदर्शन', bullets: ['कमी, मध्यम आणि मोठ्या गुंतवणुकीतील व्यवसाय कल्पना', 'उत्पादन आणि सेवा क्षेत्रातील संधी', 'व्यवसाय सुरू करण्यासाठी लागणारी प्राथमिक तयारी', 'खर्च, यंत्रसामग्री आणि बाजारपेठेबद्दल मार्गदर्शक माहिती'] },
          { heading: 'सरकारी योजना आणि आर्थिक सहाय्य', bullets: ['केंद्र आणि महाराष्ट्र शासनाच्या व्यवसाय-संबंधित योजना', 'पात्रता, आवश्यक कागदपत्रे आणि अर्ज प्रक्रियेची माहिती', 'कर्ज, अनुदान आणि प्रशिक्षण योजनांचे मार्गदर्शन', 'अधिकृत स्रोत तपासण्याची सूचना'] },
          { heading: 'मशीनरी आणि उत्पादन व्यवसाय', bullets: ['विविध उद्योगांसाठी लागणारी मशीनरी', 'मशीनची क्षमता, वापर आणि खरेदीपूर्वी तपासायचे मुद्दे', 'उत्पादक आणि पुरवठादारांची माहिती उपलब्ध असल्यास', 'किंमत व उपलब्धता विक्रेत्याकडून पुन्हा तपासण्याची सूचना'] },
          { heading: 'शेतीपूरक आणि ग्रामीण उद्योग', bullets: ['शेतीवर आधारित प्रक्रिया उद्योग', 'पशुपालन, अन्नप्रक्रिया आणि ग्रामीण सेवा व्यवसाय', 'स्थानिक संसाधनांवर आधारित उद्योग कल्पना'] },
          { heading: 'डिजिटल व्यवसाय आणि तंत्रज्ञान', bullets: ['ऑनलाइन व्यवसाय आणि ई-कॉमर्स', 'डिजिटल मार्केटिंग व सोशल मीडिया', 'वेबसाइट, ऑनलाइन जाहिरात आणि डिजिटल साधने', 'स्टार्टअप आणि तंत्रज्ञानविषयक माहिती'] }
        ]
      },
      {
        heading: 'उद्योजकांसाठी व्यासपीठ',
        paragraphs: ['एक्सप्रेस उद्योजकच्या माध्यमातून उद्योजक, उत्पादक, सेवा पुरवठादार आणि व्यवसाय सुरू करू इच्छिणाऱ्या लोकांना माहितीची देवाणघेवाण करता यावी, अशी आमची भूमिका आहे. वाचकांनी माहिती तपासून, स्वतःचे संशोधन करून आणि आवश्यकतेनुसार तज्ज्ञांचा सल्ला घेऊन निर्णय घ्यावेत.']
      },
      {
        heading: 'माहितीबाबत आमची भूमिका',
        paragraphs: ['वेबसाइटवरील लेख माहिती आणि शैक्षणिक उद्देशाने प्रकाशित केले जातात. योजना, नियम, किंमती, मशीनची उपलब्धता आणि सरकारी प्रक्रिया बदलू शकतात. कोणताही आर्थिक किंवा व्यावसायिक निर्णय घेण्यापूर्वी संबंधित अधिकृत विभाग किंवा सेवा पुरवठादाराकडून अद्ययावत माहिती तपासा.']
      },
      {
        heading: 'आमच्याशी संपर्क',
        paragraphs: ['व्यवसायविषयक माहिती, जाहिरात, सहकार्य, दुरुस्ती किंवा सूचना पाठवण्यासाठी:'],
        links: [
          { label: 'ईमेल: contactuyogak@gmail.com', href: 'mailto:contactuyogak@gmail.com' },
          { label: 'मोबाईल / WhatsApp: 8975763519', href: 'tel:+918975763519' },
          { label: 'WhatsApp वर संदेश पाठवा', href: 'https://wa.me/918975763519' },
          { label: 'Instagram', href: 'https://www.instagram.com/express_udyojak/' },
          { label: 'Facebook', href: 'https://www.facebook.com/people/udyojakexpress/61596853830702' },
          { label: 'YouTube', href: 'https://www.youtube.com/@expresudyojak' }
        ],
        quote: 'एक्सप्रेस उद्योजक – व्यवसायाच्या प्रत्येक टप्प्यावर माहिती आणि प्रेरणा.'
      }
    ]
  },
  '/privacy-policy': {
    title: 'Privacy Policy',
    updated: '24 नोव्हेंबर 2026',
    notice: 'हा सामान्य माहितीचा मसुदा आहे, कायदेशीर सल्ला नाही. प्रकाशनापूर्वी वेबसाइट मालकाने आणि लागू असल्यास कायदेशीर तज्ज्ञाने पुनरावलोकन करावे.',
    sections: [
      { heading: 'गोपनीयता धोरण – एक्सप्रेस उद्योजक', paragraphs: ['एक्सप्रेस उद्योजक आपल्या वेबसाइटला भेट देणाऱ्या वापरकर्त्यांच्या गोपनीयतेचा आदर करते. वेबसाइट वापरताना मिळू शकणारी माहिती, तिचा वापर आणि आमच्याशी संपर्क साधण्याची पद्धत या धोरणात दिली आहे.'] },
      { heading: '1. संमती', paragraphs: ['वेबसाइट वापरण्यापूर्वी हे धोरण वाचा. या धोरणाशी सहमत नसल्यास वेबसाइटचा वापर थांबवू शकता.'] },
      { heading: '2. आम्ही कोणती माहिती गोळा करू शकतो?', bullets: ['संपर्क, व्यवसाय नोंदणी, कथा, कल्पना, अभिप्राय किंवा खात्याच्या फॉर्ममध्ये तुम्ही स्वतः दिलेली माहिती—उदा. नाव, ईमेल, मोबाईल आणि संदेशातील तपशील.', 'लॉगिन किंवा नोंदणीदरम्यान खाते ओळख आणि प्रमाणीकरणासाठी दिलेली माहिती.', 'लेख वाचताना लेख-दृश्य मोजण्यासाठी वापरला जाणारा प्रथम-पक्ष अभ्यागत ओळखकर्ता. साइट हा ओळखकर्ता ब्राउझरच्या localStorage मध्ये ठेवते; हे page-wide session analytics नाही.', 'वेबसाइट चालवण्यासाठी वापरल्या जाणाऱ्या होस्टिंग किंवा तांत्रिक सेवांकडून त्यांच्या configuration नुसार मिळू शकणारी निदान/सुरक्षा माहिती.'] },
      { heading: '3. माहितीचा वापर', bullets: ['वेबसाइट चालवणे, सुरक्षित ठेवणे आणि त्रुटी शोधणे.', 'वापरकर्त्यांच्या चौकशीला उत्तर देणे आणि सबमिट केलेले व्यवसाय, कथा किंवा इतर योगदान तपासणे.', 'खाते, नोंदणी, वेबसाइटवरील विनंती आणि संबंधित सुविधा चालवणे.', 'लेखांचे एकूण वाचन मोजणे आणि गैरवापर किंवा सुरक्षा समस्यांना प्रतिबंध करणे.', 'लागू कायदेशीर जबाबदाऱ्या पूर्ण करणे.'] },
      { heading: '4. Cookies, स्थानिक संचयन आणि analytics', paragraphs: ['या प्रकल्पाच्या तपासलेल्या फ्रंटएंड कोडमध्ये cookies वाचणे/सेट करणे किंवा Google Analytics/Facebook Pixel सारखी तृतीय-पक्ष analytics सेवा आढळली नाही. लेख-दृश्य मोजण्यासाठी ब्राउझरमध्ये प्रथम-पक्ष अभ्यागत ओळखकर्ता localStorage मध्ये ठेवला जातो. लॉगिन सत्रासाठीची माहिती आणि पुस्तकांच्या कार्टमधील निवडही काही सुविधा चालवण्यासाठी browser localStorage मध्ये साठवली जाऊ शकते. ब्राउझर सेटिंग्जमधून localStorage नियंत्रित किंवा हटवल्यास काही सुविधा पुन्हा लॉगिन मागू शकतात किंवा जतन केलेला कार्ट डेटा काढला जाऊ शकतो.'] },
      { heading: '5. तृतीय-पक्ष सेवा आणि पेमेंट', paragraphs: ['साइटवर उपलब्ध checkout वापरल्यास पेमेंट Razorpay द्वारे प्रक्रिया केले जाऊ शकते. पेमेंटची माहिती Razorpay कडे त्यांच्या अटी व गोपनीयता धोरणानुसार प्रक्रिया होते. वेबसाइटवर बाह्य सोशल मीडिया, सरकारी पोर्टल किंवा इतर संकेतस्थळांचे दुवे असू शकतात; त्या सेवांचे स्वतंत्र धोरण लागू होते.'] },
      { heading: '6. माहिती शेअर करणे', paragraphs: ['आम्ही वैयक्तिक माहिती विकण्याचा उद्देश ठेवत नाही. वेबसाइट, खाते, चौकशी किंवा पेमेंट सुविधा चालवण्यासाठी संबंधित सेवा पुरवठादारांकडून आवश्यक मर्यादेत माहिती प्रक्रिया होऊ शकते. कायद्याने आवश्यक असल्यास किंवा हक्क आणि सुरक्षा जपण्यासाठी आवश्यक असल्यास माहिती उघड केली जाऊ शकते.'] },
      { heading: '7. माहितीची सुरक्षा आणि साठवण', paragraphs: ['अनधिकृत प्रवेश, बदल, उघड होणे किंवा नष्ट होणे कमी करण्यासाठी योग्य तांत्रिक व प्रशासकीय उपाय वापरण्याचा प्रयत्न केला जातो. इंटरनेटवरील कोणतीही पद्धत पूर्णपणे सुरक्षित असल्याची हमी देता येत नाही. माहिती संबंधित उद्देशासाठी किंवा लागू कायदेशीर गरजेनुसार आवश्यक तेवढ्या काळासाठी ठेवली जाऊ शकते.'] },
      { heading: '8. बाह्य वेबसाइट्सचे दुवे', paragraphs: ['बाह्य वेबसाइट्सच्या गोपनीयता पद्धती, मजकूर किंवा सुरक्षिततेसाठी त्या संबंधित वेबसाइट्स जबाबदार असतात. बाह्य दुवा उघडण्यापूर्वी त्यांचे धोरण वाचा.'] },
      { heading: '9. मुलांची गोपनीयता', paragraphs: ['वेबसाइट विशेषतः लहान मुलांकडून वैयक्तिक माहिती गोळा करण्यासाठी तयार केलेली नाही. अल्पवयीन व्यक्तीची माहिती अनवधानाने मिळाल्याचे आढळल्यास कृपया आम्हाला कळवा.'] },
      { heading: '10. वापरकर्त्यांच्या विनंत्या', paragraphs: ['आपल्या वैयक्तिक माहितीबाबत प्रश्न, दुरुस्तीची विनंती किंवा लागू कायद्यानुसार उपलब्ध अधिकार वापरण्यासाठी आमच्याशी संपर्क साधू शकता. विनंतीची पडताळणी करण्यासाठी अतिरिक्त माहिती मागितली जाऊ शकते.'] },
      { heading: '11. या धोरणातील बदल', paragraphs: ['वेबसाइटच्या सुविधा, कायदे किंवा सेवांमध्ये बदल झाल्यास हे धोरण अद्ययावत केले जाऊ शकते. सुधारित आवृत्ती याच पृष्ठावर प्रकाशित केली जाईल.'] },
      { heading: '12. संपर्क', paragraphs: ['गोपनीयता धोरणाबद्दल प्रश्न किंवा विनंती असल्यास:'], links: [{ label: 'ईमेल: contactuyogak@gmail.com', href: 'mailto:contactuyogak@gmail.com' }, { label: 'मोबाईल: 8975763519', href: 'tel:+918975763519' }, { label: 'एक्सप्रेस उद्योजक मुख्यपृष्ठ', href: '/' }] }
    ]
  },
  '/affiliate-disclosure-marathi-udyojak': {
    title: 'Affiliate Disclosure',
    notice: 'हा पारदर्शकता-विषयक मसुदा आहे. प्रकाशित करण्यापूर्वी प्रत्यक्ष affiliate संबंध आणि संबंधित लेखांतील disclosure मालकाने तपासून मंजूर करावा.',
    sections: [
      { heading: 'एक्सप्रेस उद्योजकचे पारदर्शकता धोरण', paragraphs: ['एक्सप्रेस उद्योजकवर व्यवसाय, मशीनरी, डिजिटल सेवा, साधने किंवा इतर उत्पादनांविषयी माहिती देताना काही लेखांमध्ये affiliate links असू शकतात. अशा लिंकद्वारे वापरकर्त्याने खरेदी किंवा नोंदणी केली आणि संबंधित कंपनीच्या अटी पूर्ण झाल्या, तर आम्हाला कमिशन किंवा इतर मोबदला मिळू शकतो.', 'Affiliate link वापरल्यामुळे ग्राहकाला अतिरिक्त शुल्क लागतेच असे नाही; अंतिम किंमत, सवलत आणि अटी संबंधित विक्रेत्याच्या वेबसाइटवर तपासा.'] },
      { heading: 'Affiliate link म्हणजे काय?', paragraphs: ['Affiliate link हा विशिष्ट tracking असलेला दुवा असतो. त्या दुव्यावरून वापरकर्त्याने पात्र खरेदी किंवा कृती केल्यास संबंधित कंपनी आम्हाला कमिशन देऊ शकते.'] },
      { heading: 'आम्ही affiliate links का वापरू शकतो?', bullets: ['वेबसाइटवरील माहितीपूर्ण लेख आणि डिजिटल सेवा चालू ठेवण्यासाठी.', 'संशोधन, लेखन आणि देखभालीचा खर्च भागवण्यासाठी.', 'वाचकांना उपयुक्त उत्पादने किंवा सेवा शोधण्यात मदत करण्यासाठी.'] },
      { heading: 'आमची भूमिका आणि संपादकीय स्वातंत्र्य', bullets: ['Affiliate संबंध असल्यास शक्य तिथे संबंधित लेखात स्पष्ट सूचना दिली जाईल.', 'कमिशन मिळू शकते म्हणून उत्पादन योग्य आहे असे गृहीत धरू नये.', 'उत्पादनाची उपयुक्तता, उपलब्ध माहिती आणि वाचकांचा संभाव्य फायदा लक्षात घेऊन सामग्री तयार करण्याचा प्रयत्न केला जाईल.', 'किंमत, वैशिष्ट्ये, उपलब्धता आणि विक्रेत्याच्या अटी बदलू शकतात; खरेदीपूर्वी अधिकृत विक्रेता पृष्ठ तपासा.', 'कोणत्याही उत्पादनाच्या गुणवत्तेची किंवा परिणामांची हमी केवळ affiliate link दिल्यामुळे दिली जात नाही.'] },
      { heading: 'तृतीय-पक्ष कंपन्या', paragraphs: ['भविष्यात विविध ई-कॉमर्स, होस्टिंग, सॉफ्टवेअर किंवा डिजिटल सेवा पुरवठादारांचे affiliate कार्यक्रम वापरले जाऊ शकतात. प्रत्यक्ष संबंध असलेल्या सेवांची माहिती संबंधित लेखात किंवा या पृष्ठावर आवश्यकतेनुसार स्पष्ट केली जाईल. येथे कोणत्याही विशिष्ट कंपनीशी संबंध असल्याचा दावा केला जात नाही.'] },
      { heading: 'वाचकांनी काय लक्षात ठेवावे?', paragraphs: ['खरेदी करण्यापूर्वी स्वतः संशोधन करा. उत्पादनाचे तपशील, परतावा धोरण, warranty, विक्रेत्याची विश्वासार्हता आणि एकूण खर्च तपासा. आवश्यक असल्यास तज्ज्ञांचा सल्ला घ्या.'] },
      { heading: 'आमचा शब्द', paragraphs: ['वाचकांचा विश्वास आमच्यासाठी महत्त्वाचा आहे. Affiliate संबंध असले तरी माहिती शक्य तितकी स्पष्ट, उपयुक्त आणि पारदर्शक ठेवण्याचा आमचा प्रयत्न राहील.'], links: [{ label: 'प्रश्नांसाठी contactuyogak@gmail.com', href: 'mailto:contactuyogak@gmail.com' }] }
    ]
  },
  '/dmca-notice': {
    title: 'DMCA Notice',
    notice: 'हा सामान्य तक्रार-प्रक्रियेचा मसुदा आहे; तो कायदेशीर सल्ला किंवा औपचारिक DMCA एजंट नोंदणीचा पुरावा नाही. लागू कायदे, प्रत्यक्ष प्रक्रिया आणि अधिकृत प्रतिनिधीची माहिती तपासूनच प्रकाशित करा.',
    sections: [
      { heading: 'कॉपीराइटविषयक सूचना', paragraphs: ['एक्सप्रेस उद्योजक वेबसाइटवरील स्वतः तयार केलेला मजकूर, ग्राफिक्स, लोगो, डिझाइन आणि इतर सामग्रीवर लागू असलेले बौद्धिक संपदा हक्क जपण्याचा प्रयत्न करते. तृतीय-पक्ष सामग्री वापरली असल्यास आवश्यक परवानगी, परवाना किंवा योग्य श्रेय देण्याची जबाबदारी तपासली जाते.', 'वेबसाइटवरील एखाद्या सामग्रीमुळे आपल्या कॉपीराइटचे उल्लंघन झाले आहे असे वाटत असल्यास खालील माहिती देऊन लेखी तक्रार पाठवा.'] },
      { heading: 'तक्रार कशी पाठवावी?', paragraphs: ['ईमेलचा विषय: Copyright / DMCA Notice'], ordered: ['मूळ सामग्रीची ओळख: आपल्या हक्कातील कामाचे नाव किंवा वर्णन.', 'आक्षेपार्ह सामग्रीचा दुवा: एक्सप्रेस उद्योजकवरील नेमकी URL.', 'आपली संपर्क माहिती: पूर्ण नाव, ईमेल आणि संपर्क क्रमांक.', 'हक्काचे स्पष्टीकरण: आपण कॉपीराइट मालक आहात किंवा मालकाच्या वतीने अधिकृत प्रतिनिधी आहात याचे स्पष्टीकरण.', 'चांगल्या विश्वासाचे विधान: संबंधित वापरास परवानगी नाही असा आपला प्रामाणिक विश्वास असल्याचे विधान.', 'अचूकतेचे विधान: दिलेली माहिती आपल्या माहितीनुसार खरी आहे आणि आपण अधिकृतपणे तक्रार करत आहात असे विधान.', 'स्वाक्षरी: इलेक्ट्रॉनिक किंवा प्रत्यक्ष स्वाक्षरी.'], links: [{ label: 'contactuyogak@gmail.com', href: 'mailto:contactuyogak@gmail.com?subject=Copyright%20%2F%20DMCA%20Notice' }] },
      { heading: 'तक्रारीनंतरची प्रक्रिया', bullets: ['तक्रार प्राप्त झाल्यानंतर तिची प्राथमिक तपासणी केली जाऊ शकते.', 'अधिक माहिती किंवा अधिकाराचा पुरावा मागितला जाऊ शकतो.', 'योग्य परिस्थितीत संबंधित सामग्री तात्पुरती लपवली किंवा हटवली जाऊ शकते.', 'संबंधित सामग्री प्रकाशित करणाऱ्या व्यक्तीकडून स्पष्टीकरण मागितले जाऊ शकते.', 'तक्रारदाराला उपलब्धतेनुसार उत्तर दिले जाईल.'] },
      { heading: 'चुकीच्या किंवा अपूर्ण तक्रारी', paragraphs: ['खोटी, दिशाभूल करणारी किंवा अपूर्ण माहिती देऊन दुसऱ्याची सामग्री हटवण्याचा प्रयत्न करू नये. तक्रार पाठवण्यापूर्वी आपण योग्य हक्कधारक आहात याची खात्री करा.'] },
      { heading: 'प्रतिवाद / Counter Notice', paragraphs: ['सामग्री चुकीने हटवली गेली आहे किंवा वापरास परवानगी आहे असे संबंधित व्यक्तीस वाटत असल्यास, कारणे आणि आवश्यक पुराव्यांसह त्याच ईमेलवर प्रतिवाद पाठवू शकते. पुढील कारवाई लागू कायदे आणि परिस्थितीनुसार ठरवली जाईल.'] },
      { heading: 'संपर्क', paragraphs: ['कॉपीराइट आणि सामग्रीविषयक तक्रारींसाठी:'], links: [{ label: 'ईमेल: contactuyogak@gmail.com', href: 'mailto:contactuyogak@gmail.com' }, { label: 'मोबाईल: 8975763519', href: 'tel:+918975763519' }, { label: 'एक्सप्रेस उद्योजक मुख्यपृष्ठ', href: '/' }] }
    ]
  },
  '/terms-and-conditions': {
    title: 'Terms and Conditions – अटी व शर्ती',
    updated: '24 नोव्हेंबर 2026',
    notice: 'हा सामान्य माहितीचा मसुदा आहे, कायदेशीर सल्ला नाही. वेबसाइटची प्रत्यक्ष कार्यपद्धती, व्यवसायाचे स्वरूप आणि लागू कायदे पाहून मालकाने वकिलाकडून पुनरावलोकन करून घ्यावे.',
    sections: [
      { heading: 'अटी व शर्ती', paragraphs: ['वेबसाइट वापरण्यापूर्वी या अटी व शर्ती काळजीपूर्वक वाचा. एक्सप्रेस उद्योजक वेबसाइट वापरल्यास या अटी लागू होतील. या अटी मान्य नसल्यास वेबसाइटचा वापर करू नका.'] },
      { heading: '1. वेबसाइटचा उद्देश', paragraphs: ['एक्सप्रेस उद्योजक ही व्यवसाय, उद्योग, स्टार्टअप, सरकारी योजना, मशीनरी, तंत्रज्ञान आणि स्वयंरोजगार यासंबंधी माहिती देणारी वेबसाइट आहे. येथे दिलेला मजकूर सर्वसाधारण माहिती आणि शैक्षणिक उद्देशासाठी आहे.'] },
      { heading: '2. व्यावसायिक किंवा आर्थिक सल्ला नाही', paragraphs: ['वेबसाइटवरील माहिती ही वैयक्तिक आर्थिक, कायदेशीर, कर, गुंतवणूक किंवा व्यावसायिक सल्ल्याचा पर्याय नाही. कोणताही निर्णय घेण्यापूर्वी संबंधित अधिकृत विभाग, पात्र तज्ज्ञ, बँक, विक्रेता किंवा व्यावसायिक सल्लागाराशी पडताळणी करा.'] },
      { heading: '3. माहितीची अचूकता आणि बदल', paragraphs: ['योजना, पात्रता, अर्ज प्रक्रिया, अनुदान, कर्ज, किंमती, मशीनची क्षमता आणि बाजारातील उपलब्धता बदलू शकते. माहिती अचूक ठेवण्याचा प्रयत्न केला जातो; मात्र प्रत्येक माहिती नेहमी अद्ययावत किंवा त्रुटीविरहित असेल याची हमी दिली जात नाही.'] },
      { heading: '4. वेबसाइटचा योग्य वापर', bullets: ['कायदेशीर आणि योग्य उद्देशासाठी वेबसाइट वापरा.', 'खोटी, फसवी, धमकीची किंवा बेकायदेशीर माहिती पाठवू नका.', 'वेबसाइटची सुरक्षा किंवा कार्यक्षमता बाधित करण्याचा प्रयत्न करू नका.', 'परवानगीशिवाय इतरांचे खाते, माहिती किंवा प्रणाली वापरू नका.', 'कॉपीराइट किंवा इतर बौद्धिक संपदा हक्कांचे उल्लंघन करू नका.'] },
      { heading: '5. बौद्धिक संपदा', paragraphs: ['एक्सप्रेस उद्योजकने स्वतः तयार केलेल्या मजकूर, लोगो, ग्राफिक्स आणि इतर सामग्रीवरील लागू हक्क राखून ठेवले आहेत. पूर्वपरवानगीशिवाय सामग्रीचे मोठ्या प्रमाणावर पुनर्प्रकाशन, विक्री किंवा व्यावसायिक वापर करू नये. तृतीय-पक्ष ट्रेडमार्क, लोगो, फोटो किंवा सामग्री संबंधित हक्कधारकांची असू शकते.'] },
      { heading: '6. बाह्य दुवे आणि तृतीय-पक्ष सेवा', paragraphs: ['वेबसाइटवर सरकारी पोर्टल, विक्रेते, सेवा पुरवठादार किंवा इतर वेबसाइट्सचे दुवे दिले जाऊ शकतात. बाह्य वेबसाइटची उपलब्धता, अचूकता, सुरक्षितता, उत्पादने किंवा व्यवहारांसाठी संबंधित तृतीय-पक्ष जबाबदार आहे. बाह्य दुवा वापरण्यापूर्वी त्यांच्या अटी तपासा.'] },
      { heading: '7. जाहिरात आणि प्रायोजित सामग्री', paragraphs: ['वेबसाइटवर जाहिरात किंवा प्रायोजित सामग्री प्रकाशित होऊ शकते. अशा सामग्रीची ओळख शक्य तिथे स्पष्ट केली जाईल. जाहिरात प्रकाशित झाल्याने उत्पादन, विक्रेता किंवा सेवेची हमी दिली आहे असा अर्थ होत नाही.'] },
      { heading: '8. Affiliate Links', paragraphs: ['काही लेखांमध्ये affiliate links असू शकतात. अशा लिंकद्वारे पात्र खरेदी झाल्यास वेबसाइटला कमिशन मिळू शकते. अधिक माहितीसाठी Affiliate Disclosure पृष्ठ वाचा.'], links: [{ label: 'Affiliate Disclosure', href: '/affiliate-disclosure-marathi-udyojak' }] },
      { heading: '9. जबाबदारीची मर्यादा', paragraphs: ['वेबसाइटवरील माहितीच्या वापरामुळे झालेल्या व्यावसायिक नुकसान, आर्थिक निर्णय, नफा/तोटा, सेवा व्यत्यय किंवा तृतीय-पक्ष व्यवहारांसाठी लागू कायद्याने परवानगी दिलेल्या मर्यादेतच जबाबदारी स्वीकारली जाईल. कोणतीही तरतूद लागू कायद्याने वगळता न येणारे वापरकर्त्याचे अधिकार कमी करण्यासाठी नाही.'] },
      { heading: '10. गोपनीयता', paragraphs: ['वैयक्तिक माहितीचा वापर Privacy Policy नुसार केला जाईल. वेबसाइट वापरण्यापूर्वी Privacy Policy वाचा.'], links: [{ label: 'Privacy Policy', href: '/privacy-policy' }] },
      { heading: '11. अटींमधील बदल', paragraphs: ['वेबसाइटच्या सुविधा किंवा लागू नियमांमध्ये बदल झाल्यास या अटी अद्ययावत केल्या जाऊ शकतात. सुधारित आवृत्ती या पृष्ठावर प्रकाशित झाल्यानंतर लागू होईल.'] },
      { heading: '12. लागू कायदा', paragraphs: ['या अटी भारतातील लागू कायद्यांनुसार समजल्या जातील. कोणत्याही वादासाठी सक्षम न्यायालयाचे अधिकारक्षेत्र लागू कायद्यांनुसार निश्चित होईल.'] },
      { heading: '13. संपर्क', paragraphs: ['या अटींबद्दल प्रश्न असल्यास:'], links: [{ label: 'ईमेल: contactuyogak@gmail.com', href: 'mailto:contactuyogak@gmail.com' }, { label: 'मोबाईल: 8975763519', href: 'tel:+918975763519' }, { label: 'एक्सप्रेस उद्योजक मुख्यपृष्ठ', href: '/' }] }
    ]
  }
}

const FOOTER_FAQS = [
  ['एक्सप्रेस उद्योजक म्हणजे काय?', 'एक्सप्रेस उद्योजक हे व्यवसाय, उद्योग, स्टार्टअप, सरकारी योजना, मशीनरी, तंत्रज्ञान आणि स्वयंरोजगार याविषयी मराठी भाषेत माहिती देणारे डिजिटल व्यासपीठ आहे.'],
  ['वेबसाइटवरील माहिती कोणासाठी आहे?', 'नवीन व्यवसाय सुरू करू इच्छिणारे युवक, लघुउद्योजक, ग्रामीण उद्योजक, उत्पादक, सेवा पुरवठादार, विद्यार्थी आणि व्यवसायविषयक माहिती शोधणारे वाचक यांच्यासाठी ही माहिती उपयुक्त ठरू शकते.'],
  ['मला माझ्या व्यवसायाची माहिती वेबसाइटवर प्रसिद्ध करायची आहे. काय करावे?', 'तुमच्या व्यवसायाचे नाव, माहिती, फोटो, संपर्क तपशील आणि अधिकृत लिंकसह contactuyogak@gmail.com वर चौकशी करा. सामग्री प्रकाशित करण्यापूर्वी तपासणी आणि संपादकीय मंजुरी आवश्यक असू शकते.'],
  ['माझ्या उत्पादनाची किंवा सेवेची जाहिरात करता येईल का?', 'होय. जाहिरात आणि प्रमोशनसाठी उपलब्ध पर्याय, स्वरूप, दर आणि अटी जाणून घेण्यासाठी WhatsApp 8975763519 किंवा contactuyogak@gmail.com वर संपर्क करा. Views, leads किंवा विक्रीची हमी दिली जात नाही.'],
  ['वेबसाइटवरील सरकारी योजना माहितीवरून थेट अर्ज करता येतो का?', 'लेखांमध्ये योजना, पात्रता आणि अर्ज प्रक्रियेची प्राथमिक माहिती दिली जाऊ शकते. नियम आणि अर्जाची अंतिम माहिती संबंधित अधिकृत सरकारी पोर्टलवर तपासूनच अर्ज करा.'],
  ['व्यवसाय सुरू करण्यासाठी किती गुंतवणूक लागेल?', 'गुंतवणूक व्यवसायाचा प्रकार, जागा, मशीनरी, कच्चा माल, परवाने, कर्मचारी आणि बाजारपेठ यावर अवलंबून असते. लेखातील खर्च अंदाज म्हणून घ्या आणि प्रत्यक्ष कोटेशन/स्थानिक खर्च तपासा.'],
  ['मशीनरी किंवा पुरवठादाराची माहिती कशी मिळेल?', 'संबंधित लेखात उपलब्ध असलेली माहिती वाचू शकता. किंमत, क्षमता, warranty, delivery, installation आणि विक्रेत्याची विश्वासार्हता थेट पुरवठादाराकडून पडताळा.'],
  ['वेबसाइटवरील माहितीमध्ये चूक आढळल्यास काय करावे?', 'संबंधित पृष्ठाची लिंक आणि योग्य माहितीचा स्रोत देऊन contactuyogak@gmail.com वर कळवा. तपासणीनंतर आवश्यक असल्यास दुरुस्ती केली जाईल.'],
  ['माझी यशोगाथा किंवा व्यवसायाची कथा पाठवता येईल का?', 'होय. व्यवसायाचा प्रवास, फोटो, व्यवसायाचे तपशील आणि संपर्क माहिती पाठवा. कथा प्रकाशित करायची की नाही हे संपादकीय तपासणीनंतर ठरवले जाईल. संवेदनशील किंवा गोपनीय माहिती परवानगीशिवाय पाठवू नका.'],
  ['एक्सप्रेस उद्योजकशी सोशल मीडियावर कसे जोडता येईल?', 'आमच्या अधिकृत Instagram, Facebook आणि YouTube खात्यांवर जोडलेले राहा.'],
  ['WhatsApp वर संपर्क कसा करावा?', '8975763519 या क्रमांकावर WhatsApp संदेश पाठवा.'],
  ['वेबसाइटवरील लेख किंवा फोटो वापरता येतात का?', 'पूर्वपरवानगीशिवाय वेबसाइटवरील स्वतः तयार केलेली सामग्री कॉपी किंवा व्यावसायिक वापर करू नये. वापराची परवानगी किंवा श्रेयाबद्दल विचारण्यासाठी contactuyogak@gmail.com वर संपर्क करा.'],
  ['एक्सप्रेस उद्योजकवर नोकरी किंवा गुंतवणुकीची हमी मिळते का?', 'नाही. वेबसाइट माहिती आणि मार्गदर्शनासाठी आहे. कोणत्याही नोकरी, कर्ज मंजुरी, अनुदान, गुंतवणूक परतावा, व्यवसाय नफा किंवा ग्राहक मिळण्याची हमी दिली जात नाही.'],
  ['संपर्कासाठी अधिकृत ईमेल कोणता?', 'अधिकृत ईमेल contactuyogak@gmail.com आणि मोबाईल / WhatsApp क्रमांक 8975763519 आहे.'],
  ['Privacy Policy आणि Terms कुठे वाचता येतील?', 'वेबसाइटच्या Footer मधील Privacy Policy आणि Terms and Conditions या लिंकवरून संबंधित पृष्ठे उघडता येतील.']
]

function FooterContentPage() {
  const location = useLocation()
  const route = location.pathname.replace(/\/+$/, '') || '/'
  const page = FOOTER_CONTENT_PAGES[route === '/about' ? '/about-us' : route]
  if (!page) {
    return <SimplePage title="नेहमी विचारले जाणारे प्रश्न (FAQs)">
      <div className="footer-linked-content footer-faq-list">
        {FOOTER_FAQS.map(([question, answer], index) => <details key={question}><summary>{index + 1}. {question}</summary><p>{answer}</p></details>)}
        <section className="footer-content-section">
          <h2>एक्सप्रेस उद्योजकशी संपर्क</h2>
          <ul>
            <li><a href="mailto:contactuyogak@gmail.com">contactuyogak@gmail.com</a></li>
            <li><a href="tel:+918975763519">8975763519</a></li>
            <li><a href="https://wa.me/918975763519" target="_blank" rel="noopener noreferrer">WhatsApp वर संदेश पाठवा</a></li>
            <li><a href="https://www.instagram.com/express_udyojak/" target="_blank" rel="noopener noreferrer">Instagram</a></li>
            <li><a href="https://www.facebook.com/people/udyojakexpress/61596853830702" target="_blank" rel="noopener noreferrer">Facebook</a></li>
            <li><a href="https://www.youtube.com/@expresudyojak" target="_blank" rel="noopener noreferrer">YouTube</a></li>
          </ul>
        </section>
      </div>
    </SimplePage>
  }
  return <SimplePage title={page.title}>
    <div className="footer-linked-content">
      {page.updated && <p className="footer-page-updated">शेवटचे अद्ययावत: {page.updated}</p>}
      {page.notice && <p className="footer-page-notice" role="note">{page.notice}</p>}
      {page.sections.map((section) => (
        <section className="footer-content-section" key={section.heading}>
          <h2>{section.heading}</h2>
          {section.quoteBeforeParagraphs && <blockquote>{section.quote}</blockquote>}
          {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          {section.subsections?.map((subsection) => (
            <div className="footer-content-subsection" key={subsection.heading}>
              <h3>{subsection.heading}</h3>
              {subsection.paragraph && <p>{subsection.paragraph}</p>}
              {subsection.bullets && <ul>{subsection.bullets.map((item) => <li key={item}>{item}</li>)}</ul>}
            </div>
          ))}
          {section.bullets && <ul>{section.bullets.map((item) => <li key={item}>{item}</li>)}</ul>}
          {section.ordered && <ol>{section.ordered.map((item) => <li key={item}>{item}</li>)}</ol>}
          {section.links && <ul className="footer-content-links">{section.links.map((link) => <li key={link.href}><a href={link.href} target={/^https?:\/\//i.test(link.href) ? '_blank' : undefined} rel={/^https?:\/\//i.test(link.href) ? 'noopener noreferrer' : undefined}>{link.label}</a></li>)}</ul>}
          {section.quote && !section.quoteBeforeParagraphs && <blockquote>{section.quote}</blockquote>}
        </section>
      ))}
    </div>
  </SimplePage>
}

const BUSINESS_ESSENTIAL_PAGES = {
  '/business-licenses': BUSINESS_ESSENTIALS_DEFAULTS[0],
  '/business-loans': BUSINESS_ESSENTIALS_DEFAULTS[1],
  '/business-setup': { title: 'Business Setup Guide', subtitle: 'Investment, Machines & Profit' },
  '/government-schemes': { title: 'Government Schemes', subtitle: 'Eligibility, Benefits & Application Process' },
  '/machinery-equipment': BUSINESS_ESSENTIALS_DEFAULTS[2],
  '/franchise-opportunities': BUSINESS_ESSENTIALS_DEFAULTS[3]
}

function BusinessEssentialsPage() {
  const location = useLocation()
  const route = location.pathname.replace(/\/+$/, '') || '/'
  const feature = BUSINESS_ESSENTIAL_PAGES[route]
  const pageState = useLiveItem(`/api/pages/${encodeURIComponent(route.slice(1))}`, 'page')
  if (!feature) return <PageDetails />
  if (pageState.status === 'success') return <PageDetails initialPage={pageState.item} />
  if (pageState.status === 'loading') return <><PageHeader title={feature.title} crumb="Business Essentials" /><div className="data-loading">माहिती लोड होत आहे…</div></>
  if (pageState.status === 'error') return <><PageHeader title={feature.title} crumb="Business Essentials" /><section className="section"><div className="container empty-state" role="alert">{pageState.error}</div></section></>
  return (
    <SimplePage title={feature.title}>
      <h2>{feature.subtitle}</h2>
      <div className="reference-guidance-box">
        <div>
          <span>{BUSINESS_ESSENTIALS_TITLE}</span>
          <h3>तपशीलवार माहिती लवकरच जोडली जाईल</h3>
          <p>या विषयावरील पडताळलेली माहिती संपादकाकडून जोडली जात आहे. सरकारी नियम, पात्रता, आर्थिक तपशील किंवा दर अधिकृत स्रोतांवरून पडताळल्याशिवाय गृहीत धरू नका.</p>
        </div>
      </div>
    </SimplePage>
  )
}

function About() { return <FooterContentPage /> }

function Contact() {
  const settings = useWebsiteSettings()
  const contactEmail = officialWebsiteSettings.email
  return (
    <section className="reference-detail-page contact-reference-page">
      <div className="container reference-detail-grid contact-reference-grid">
        <main className="reference-article-column contact-reference-content">
          <div className="breadcrumb">
            <Link to="/">मुख्यपृष्ठ</Link>
            <ChevronRight size={14} aria-hidden="true" />
            <span>Contact Us</span>
          </div>
          <h1>Contact Us</h1>
          <div className="contact-reference-body">
            <section className="contact-reference-section">
              <h2><span aria-hidden="true">📬</span> संपर्क साधा</h2>
              <p>व्यवसाय, सरकारी योजना किंवा आमच्या लेखांविषयी काही प्रश्न आहेत? सहकार्याची कल्पना किंवा सूचना असल्यास एक्सप्रेस उद्योजक टीमशी संपर्क करा.</p>
              <p><a href={`mailto:${contactEmail}`}>ईमेलद्वारे लिहा</a>, <a href={`tel:+91${settings.contacts.mobileNumber}`}>फोन करा</a> किंवा <a href={settings.whatsappUrl} target="_blank" rel="noopener noreferrer">WhatsApp वर संदेश पाठवा</a>. तुमची माहिती मिळाल्यावर आम्ही शक्य तितक्या लवकर उत्तर देऊ.</p>
            </section>
            <div className="contact-reference-divider" aria-hidden="true" />
            <section className="contact-reference-section">
              <h2><span aria-hidden="true">📧</span> ईमेलद्वारे संपर्क</h2>
              <ul>
                <li>सामान्य चौकशी आणि सहकार्यासाठी: <a href={`mailto:${contactEmail}`}>{contactEmail}</a></li>
                <li>लेखातील दुरुस्ती किंवा अभिप्रायासाठी: <a href={`mailto:${contactEmail}`}>{contactEmail}</a></li>
              </ul>
            </section>
            <div className="contact-reference-divider" aria-hidden="true" />
            <section className="contact-reference-section">
              <h2><span aria-hidden="true">📱</span> सोशल मीडिया हँडल्स</h2>
              <p>नवीन माहिती आणि अपडेट्ससाठी आमच्या अधिकृत सोशल मीडिया खात्यांना भेट द्या:</p>
              <ul>
                <li><a href={settings.social.instagram} target="_blank" rel="noopener noreferrer">Instagram: @express_udyojak</a></li>
                <li><a href={settings.social.facebook} target="_blank" rel="noopener noreferrer">Facebook: एक्सप्रेस उद्योजक</a></li>
                <li><a href={settings.social.youtube} target="_blank" rel="noopener noreferrer">YouTube: @expresudyojak</a></li>
                <li><a href={settings.whatsappUrl} target="_blank" rel="noopener noreferrer">WhatsApp: {settings.contacts.whatsappNumber}</a></li>
              </ul>
            </section>
            <div className="contact-reference-divider" aria-hidden="true" />
            <section className="contact-reference-section">
              <h2><span aria-hidden="true">❓</span> आम्हाला का संपर्क करावा?</h2>
              <ul>
                <li>व्यवसाय कल्पना, मार्गदर्शन किंवा सरकारी योजनांबद्दल विचारण्यासाठी</li>
                <li>लेखातील माहिती सुधारण्यासाठी सूचना देण्यासाठी</li>
                <li>तुमच्या व्यवसायाची यशोगाथा आमच्यापर्यंत पोहोचवण्यासाठी</li>
                <li>जाहिरात, प्रमोशन किंवा सहकार्याबद्दल चर्चा करण्यासाठी</li>
              </ul>
            </section>
            <blockquote className="contact-reference-quote">
              <p>तुमच्या व्यवसायाला पुढे नेण्यासाठी उपयुक्त माहिती आणि सहकार्य देणे, हेच आमचे ध्येय.</p>
            </blockquote>
            <div className="contact-reference-divider" aria-hidden="true" />
            <p className="contact-reference-signoff">संपर्क साधल्याबद्दल धन्यवाद!<br />– एक्सप्रेस उद्योजक टीम</p>
          </div>
        </main>
        <aside className="reference-sidebar-column contact-reference-sidebar">
          <SiteSocialLinks className="contact-reference-social-links" />
          <PopularPostsSidebar title="Popular" />
        </aside>
      </div>
    </section>
  )
}

function CmegpLoanVideo() {
  const [unavailable, setUnavailable] = useState(false)

  return (
    <section className="cmegp-loan-video" aria-labelledby="cmegp-loan-video-heading">
      <div className="cmegp-loan-video__media">
        {unavailable ? (
          <p className="cmegp-loan-video__fallback" role="status">
            व्हिडिओ सध्या उपलब्ध नाही. कृपया लेखातील मार्गदर्शक माहिती वाचा.
          </p>
        ) : (
          <video
            controls
            playsInline
            preload="metadata"
            poster="/cmegp-2026-cover.png"
            onError={() => setUnavailable(true)}
          >
            <source src="/cmegp-loan-video.mp4" type="video/mp4" />
            तुमचा browser video playback support करत नाही.
          </video>
        )}
      </div>
      <div className="cmegp-loan-video__content">
        <span className="cmegp-loan-video__eyebrow">CMEGP · VIDEO GUIDE</span>
        <h2 id="cmegp-loan-video-heading">व्हिडिओ मार्गदर्शन</h2>
        <p>मुख्यमंत्री रोजगार निर्मिती कार्यक्रमावरील व्हिडिओ पाहा आणि लेखातील माहितीही वाचा.</p>
        <a className="cmegp-loan-video__link" href="https://maha-cmegp.gov.in/homepage" target="_blank" rel="noreferrer">
          अधिकृत CMEGP पोर्टल <ArrowRight size={16} aria-hidden="true" />
        </a>
      </div>
    </section>
  )
}

function ArticleDetails() {
  const { id } = useParams()
  const articleState = useLiveArticles(0, 4)
  const liveCategories = useLiveCategories()
  const detailState = useLiveItem(`/api/articles/slug/${encodeURIComponent(id)}`, 'article')
  const listedArticle = articleState.articles.find((item) => String(item.id) === String(id))
  const article = detailState.item ? mapArticleRecord(detailState.item) : listedArticle
  const [relatedItems, setRelatedItems] = useState([])
  const [viewMetrics, setViewMetrics] = useState(null)
  const [commentCount, setCommentCount] = useState(article?.commentCount ?? 0)
  useEffect(() => {
    setCommentCount(article?.commentCount ?? 0)
  }, [article?.id, article?.commentCount])
  useEffect(() => {
    if (!article?.id) return undefined

    const frame = window.requestAnimationFrame(() => {
      const poster = article.id === 'cmegp-maharashtra-business-loan-subsidy-2026'
        ? '/cmegp-2026-cover.png'
        : (article.image || undefined)

      document.querySelectorAll('.article-detail-page .reference-rich-content video').forEach((video) => {
        if (poster && !video.hasAttribute('poster')) {
          video.setAttribute('poster', poster)
        }
        video.style.background = '#ffffff'
        video.style.objectFit = 'cover'
      })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [article?.id, article?.image, article?.content])
  useEffect(() => {
    if (!id) return undefined
    const controller = new AbortController()
    fetch(`/api/articles/related/${encodeURIComponent(id)}?limit=3`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.message || 'Related articles unavailable')
        return Array.isArray(data.articles) ? data.articles : []
      })
      .then((articles) => setRelatedItems(articles.map((record) => {
        const item = mapArticleRecord(record)
        return { title: item.title, image: item.image, to: `/articles/${item.id}` }
      })))
      .catch((error) => {
        if (error.name !== 'AbortError') setRelatedItems([])
      })
    return () => controller.abort()
  }, [id])
  useEffect(() => {
    setViewMetrics(null)
    if (!article || !detailState.item || detailState.status !== 'success') return undefined

    const controller = new AbortController()
    const headers = { 'Content-Type': 'application/json' }
    try {
      const token = window.localStorage.getItem('marathiUdyojakToken')
      if (token) headers.Authorization = `Bearer ${token}`
    } catch {
      // Tracking remains anonymous when browser storage is unavailable.
    }

    fetch(`/api/articles/${encodeURIComponent(article.id)}/views`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ visitorId: getArticleVisitorId() }),
      signal: controller.signal
    })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.message || 'Article views could not be recorded.')
        if (data.tracked) setViewMetrics({ totalViews: data.totalViews, uniqueVisitors: data.uniqueVisitors })
      })
      .catch((error) => {
        if (error.name !== 'AbortError') console.error('Article view tracking failed:', error)
      })
    return () => controller.abort()
  }, [article?.id, detailState.item, detailState.status])
  useEffect(() => {
    if (!article) {
      document.title = detailState.status === 'not-found'
        ? 'लेख सापडला नाही | Express Udyojak'
        : detailState.status === 'error'
          ? 'लेख उपलब्ध नाही | Express Udyojak'
          : 'लेख लोड होत आहे | Express Udyojak'
      const robots = document.head.querySelector('meta[name="robots"]')
      if (robots) robots.setAttribute('content', 'noindex,nofollow')
      return
    }
    const title = article.seoTitle || (article.category && article.category !== 'General'
      ? `${article.title} | ${article.category} | Express Udyojak`
      : `${article.title} | Express Udyojak`)
    const contentText = typeof article.content === 'string'
      ? article.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      : ''
    const description = article.seoDescription
      || (contentText
        ? `${contentText.slice(0, 145).replace(/\s+\S*$/, '')}…`
        : `${article.title} - Express Udyojak वर मराठीमध्ये वाचा`)
    const canonicalUrl = `${SITE_URL}/articles/${article.id || article.slug}`
    const schemaCategory = article.schemaCategory || ''
    const category = liveCategories.find((item) => item.name === schemaCategory || item.slug === schemaCategory)
    const categoryPath = category
      ? category.slug === 'business-loans'
        ? '/business-loans'
        : `/category/${encodeURIComponent(category.slug)}`
      : '/articles'
    const imageUrl = /^https?:\/\//i.test(article.ogImage || article.image || '')
      ? (article.ogImage || article.image)
      : `${SITE_URL}${(article.ogImage || article.image || '/favicon.svg').startsWith('/') ? '' : '/'}${article.ogImage || article.image || 'favicon.svg'}`
    document.title = article.seoTitle || `${title} | Express Udyojak`
    const ensureMeta = (name, content, property = false) => {
      if (!content) return
      const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`
      let meta = document.head.querySelector(selector)
      if (!meta) {
        meta = document.createElement('meta')
        if (property) meta.setAttribute('property', name)
        else meta.setAttribute('name', name)
        document.head.appendChild(meta)
      }
      meta.setAttribute('content', content)
    }
    ensureMeta('description', description)
    ensureMeta('keywords', (article.keywords || []).join(', '))
    ensureMeta('og:title', title, true)
    ensureMeta('og:description', description, true)
    ensureMeta('og:image', imageUrl, true)
    ensureMeta('og:url', canonicalUrl, true)
    ensureMeta('og:type', 'article', true)
    ensureMeta('twitter:card', 'summary_large_image')
    ensureMeta('twitter:title', document.title)
    ensureMeta('twitter:description', description)
    ensureMeta('twitter:image', imageUrl)
    ensureMeta('robots', 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1')
    let canonical = document.head.querySelector('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.setAttribute('rel', 'canonical')
      document.head.appendChild(canonical)
    }
    canonical.setAttribute('href', canonicalUrl)

    let schema = document.head.querySelector('script[data-marathi-udyojak-article]')
    if (!schema) {
      schema = document.createElement('script')
      schema.type = 'application/ld+json'
      schema.setAttribute('data-marathi-udyojak-article', 'true')
      document.head.appendChild(schema)
    }
    schema.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: article.title,
      description,
      image: imageUrl,
      datePublished: article.publicationDate || undefined,
      dateModified: article.updatedAt || article.publicationDate || undefined,
      author: { '@type': 'Person', name: article.schemaAuthorName || PUBLIC_AUTHOR_NAME },
      publisher: {
        '@type': 'Organization',
        name: 'Express Udyojak',
        logo: { '@type': 'ImageObject', url: new URL(expressLogoUrl, SITE_URL).href }
      },
      inLanguage: 'mr',
      mainEntityOfPage: canonicalUrl,
    })

    let breadcrumbSchema = document.head.querySelector('script[data-marathi-udyojak-breadcrumb]')
    if (!breadcrumbSchema) {
      breadcrumbSchema = document.createElement('script')
      breadcrumbSchema.type = 'application/ld+json'
      breadcrumbSchema.setAttribute('data-marathi-udyojak-breadcrumb', 'true')
      document.head.appendChild(breadcrumbSchema)
    }
    breadcrumbSchema.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'मुख्यपृष्ठ', item: `${SITE_URL}/` },
        { '@type': 'ListItem', position: 2, name: schemaCategory || 'लेख', item: `${SITE_URL}${categoryPath}` },
        { '@type': 'ListItem', position: 3, name: article.title, item: canonicalUrl }
      ]
    })
    return () => {
      schema.remove()
      breadcrumbSchema.remove()
    }
  }, [article, detailState.status, liveCategories])
  if (!article && detailState.status === 'loading') return <div className="data-loading" role="status">Article लोड होत आहे…</div>
  if (!article && detailState.status === 'error') return <section className="section"><div className="container"><div className="data-notice" role="alert">{detailState.error}</div><Link to="/articles">सर्व लेख पाहा</Link></div></section>
  if (!article) return <section className="section"><div className="container"><div className="empty-state"><h1>लेख सापडला नाही</h1><p>हा लेख प्रकाशित नाही किंवा URL उपलब्ध नाही.</p><Link to="/articles">सर्व लेख पाहा</Link></div></div></section>

  const subtitle = plainTextExcerpt(article.subtitle || article.excerpt || '')
  const articleContentDocument = new DOMParser().parseFromString(DOMPurify.sanitize(article.content || ''), 'text/html')
  articleContentDocument.querySelectorAll('img').forEach((image, index) => {
    if (!image.getAttribute('alt')?.trim()) {
      image.setAttribute('alt', index === 0
        ? `${article.title} - featured image`
        : `${article.title} - ${article.category || 'व्यवसाय'} संबंधित चित्र`)
    }
  })
  const firstContentBlock = articleContentDocument.body.firstElementChild
  const normalizeArticleHeading = (value) => String(value || '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase()
  const isTitleBlock = firstContentBlock
    && (/^H[1-6]$/.test(firstContentBlock.tagName) || firstContentBlock.tagName === 'P')
    && normalizeArticleHeading(firstContentBlock.textContent) === normalizeArticleHeading(article.title)
  if (isTitleBlock) firstContentBlock.remove()
  const firstParagraph = articleContentDocument.body.firstElementChild
  const articleContentHtml = DOMPurify.sanitize(articleContentDocument.body.innerHTML)
  const normalizedSubtitle = subtitle.toLocaleLowerCase()
  const normalizedLead = firstParagraph?.tagName === 'P'
    ? firstParagraph.textContent?.replace(/\s+/g, ' ').trim().toLocaleLowerCase()
    : ''
  const displayIntro = normalizedSubtitle && normalizedSubtitle.length >= 40 && normalizedLead?.startsWith(normalizedSubtitle)
    ? ''
    : subtitle

  return <>
    {detailState.status === 'error' && <div className="container"><div className="data-notice" role="status">{detailState.error} यादीतील जुळणारा लेख दाखवत आहोत.</div></div>}
    <ArticleDetailLayout
      header={<ArticleHeader
        title={article.title}
        category={article.tag}
        date={article.date}
        author={article.authorName}
        authorLogo
        readingTime={article.readingTime ? `${article.readingTime} मि.` : undefined}
        commentCount={commentCount}
        viewCount={viewMetrics?.totalViews ?? article.totalViews}
        breadcrumbParent="Articles"
        breadcrumbParentLink="/articles"
      />}
      variant="article"
      image={article.image}
      imageAlt={article.title}
      articleSlug={article.id}
      onCommentCountChange={setCommentCount}
      intro={displayIntro}
      socialLinks={<SiteSocialLinks className="article-detail-social-links" />}
      relatedItems={relatedItems}
    >
      {article.id === 'cmegp-maharashtra-business-loan-subsidy-2026' && <CmegpLoanVideo />}
      {typeof article.content === 'string' && (
        <div
          className={`reference-rich-content${article.id === 'cmegp-maharashtra-business-loan-subsidy-2026' ? ' reference-rich-content--cmegp' : ''}`}
          dangerouslySetInnerHTML={{ __html: articleContentHtml }}
        />
      )}
    </ArticleDetailLayout>
  </>
}

function AddBusinessIdea() {
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    const form = new FormData(event.currentTarget)
    try {
      const response = await fetch('/api/business-ideas/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(form.entries()))
      })
      if (!response.ok) {
        const result = await response.json().catch(() => ({}))
        throw new Error(result.message || 'Idea submit करता आली नाही.')
      }
      setSent(true)
      event.currentTarget.reset()
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setSaving(false)
    }
  }
  return <>
    <section className="stories-page-header"><div className="container"><div className="breadcrumb"><Link to="/">मुख्यपृष्ठ</Link><ChevronRight size={14}/><span>Add Business Idea</span></div><h1>नवी Business Idea जोडा</h1></div></section>
    <section className="section"><div className="container add-layout">
      <aside className="story-submit-info"><Lightbulb size={38}/><h2>तुमची कल्पना शेअर करा</h2><p>योग्य तपशील भरल्यास तुमची idea websiteवर live card म्हणून दिसेल.</p></aside>
      <form className="business-form" onSubmit={submit}>
        {sent ? <div className="success-message"><HeartHandshake/><h2>Business Idea live झाली</h2><p>ही Idea आता MongoDBमध्ये सेव्ह झाली आणि websiteवर दिसेल.</p><Link to="/business-ideas">सर्व Ideas पहा <ArrowRight size={15}/></Link></div> : <>
          {error && <div className="data-notice">{error}</div>}
          <h2>Idea माहिती</h2>
          <label>Business Idea Title<input name="title" required placeholder="उदा. Paper Cup Manufacturing"/></label>
          <div className="form-row"><label>Category<input name="categoryName" required placeholder="उदा. Manufacturing"/></label><label>Investment<input name="investment" type="number" min="0" placeholder="50000"/></label></div>
          <label>Investment Label<input name="investmentLabel" placeholder="उदा. ₹50 हजार+" /></label>
          <label>Image URL<input name="image" type="url" placeholder="https://..." /></label>
          <label>संक्षिप्त वर्णन<textarea name="description" required rows="5" placeholder="या व्यवसायाबद्दल माहिती लिहा..."/></label>
          <div className="form-row"><label>Machinery<textarea name="machinery" rows="4" placeholder="प्रत्येक मुद्दा नवीन ओळीत"/></label><label>कच्चा माल<textarea name="rawMaterials" rows="4" placeholder="प्रत्येक मुद्दा नवीन ओळीत"/></label></div>
          <div className="form-row"><label>Licenses<textarea name="licenses" rows="4" placeholder="प्रत्येक परवाना नवीन ओळीत"/></label><label>Marketing<textarea name="marketing" rows="4" placeholder="प्रत्येक marketing पद्धत नवीन ओळीत"/></label></div>
          <button type="submit" disabled={saving}>{saving ? 'Save होत आहे…' : 'Idea Live करा'} <ArrowRight size={16}/></button>
        </>}
      </form>
    </div></section>
  </>
}

function AddStory() {
  const [submission, setSubmission] = useState({ status: 'idle', message: '' })
  const submit = async (event) => {
    event.preventDefault()
    setSubmission({ status: 'saving', message: '' })
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    try {
      const response = await fetch('/api/stories/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(form.entries()))
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Story submit करता आली नाही.')
      formElement.reset()
      setSubmission({ status: 'success', message: result.message || 'कथा review साठी जमा झाली.' })
    } catch (error) {
      setSubmission({ status: 'error', message: error.message })
    }
  }
  return (
    <>
      <section className="stories-page-header"><div className="container"><div className="breadcrumb"><Link to="/">मुख्यपृष्ठ</Link><ChevronRight size={14}/><span>Success Story Submit</span></div><h1>तुमची Success Story सांगा</h1></div></section>
      <section className="section"><div className="container story-submit-layout">
        <aside className="story-submit-info"><Leaf size={38}/><h2>प्रेरणादायी कथा शेअर करा</h2><p>तुमच्या व्यवसाय प्रवासाने महाराष्ट्रातील नव्या उद्योजकांना प्रेरणा मिळू शकते.</p><ul><li>व्यवसायाची सुरुवात</li><li>मुळ समस्या आणि उपाय</li><li>आजची प्रगती</li></ul></aside>
        <form className="business-form" onSubmit={submit}>
          {submission.status === 'success' ? <div className="success-message" role="status"><HeartHandshake/><h2>कथा जमा झाली</h2><p>{submission.message} मंजुरीनंतर ती वेबसाइटवर दिसेल.</p><Link to="/stories">सर्व Success Stories पाहा</Link></div> : <>
            {submission.status === 'error' && <div className="data-notice" role="alert">{submission.message}</div>}
            <h2>Success Story माहिती</h2>
            <label>उद्योजकाचे नाव<input name="entrepreneurName" required minLength="2" maxLength="100" placeholder="पूर्ण नाव"/></label>
            <div className="form-row"><label>व्यवसायाचे नाव<input name="businessName" required minLength="2" maxLength="160" placeholder="व्यवसायाचे नाव"/></label><label>शहर<input name="city" required minLength="2" maxLength="100" placeholder="उदा. पुणे"/></label></div>
            <label>कथेचे शीर्षक<input name="title" required minLength="5" maxLength="180" placeholder="उदा. छोट्या गावातून उभारलेला व्यवसाय"/></label>
            <label>थोडक्यात सारांश<textarea name="summary" required minLength="20" maxLength="500" rows="3" placeholder="कथेचा सारांश लिहा"/></label>
            <label>कथेचा फोटो URL (ऐच्छिक)<input name="image" type="url" placeholder="https://..."/></label>
            <label>तुमची गोष्ट<textarea name="story" required minLength="30" maxLength="12000" rows="6" placeholder="तुमच्या संघर्षाचा, सुरुवातीचा आणि यशाचा प्रवास सांगा..."/></label>
            <button type="submit" disabled={submission.status === 'saving'}>{submission.status === 'saving' ? 'पाठवत आहे…' : 'Story Submit करा'} <ArrowRight size={16}/></button>
          </>}
        </form>
      </div></section>
    </>
  )
}

function PromotionsPage() {
  const navigate = useNavigate()
  const [paymentState, setPaymentState] = useState({ packageType: '', status: '', message: '' })
  const packages = [
    ['business_promotion','Paid Business Promotion','₹499'],
    ['premium_listing','Premium Business Listing','₹999'],
    ['featured_promotion','Featured Business Listing','₹2,999'],
    ['sponsored_article','Sponsored Article','₹4,999'],
    ['advertisement','Paid Advertisement','₹4,999'],
    ['business_enquiry_promotion','Business Enquiry Promotion','₹299'],
    ['membership','Premium Membership','₹1,999']
  ]
  const startCheckout = async (packageType) => {
    const token = localStorage.getItem('marathiUdyojakToken')
    if (!token) {
      navigate('/auth', { state: { from: '/promotions' } })
      return
    }
    setPaymentState({ packageType, status: 'loading', message: 'Order तयार होत आहे…' })
    try {
      const orderResponse = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ packageType })
      })
      const order = await orderResponse.json()
      if (!orderResponse.ok) throw new Error(order.message || 'Payment order तयार झाला नाही.')
      await loadRazorpayCheckout()
      const checkout = new window.Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: 'Express Udyojak',
        description: packages.find(([type]) => type === packageType)?.[1] || 'Promotion',
        handler: async (result) => {
          setPaymentState({ packageType, status: 'loading', message: 'Payment verify होत आहे…' })
          try {
            const verifyResponse = await fetch('/api/payments/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                razorpayOrderId: result.razorpay_order_id,
                razorpayPaymentId: result.razorpay_payment_id,
                razorpaySignature: result.razorpay_signature
              })
            })
            const verification = await verifyResponse.json()
            if (!verifyResponse.ok) throw new Error(verification.message || 'Payment verify झाले नाही.')
            setPaymentState({ packageType, status: 'success', message: 'Payment यशस्वी आणि verify झाले. Promotion active आहे.' })
          } catch (error) {
            setPaymentState({ packageType, status: 'error', message: error.message })
          }
        },
        modal: {
          ondismiss: () => setPaymentState({ packageType: '', status: '', message: '' })
        }
      })
      checkout.on('payment.failed', (failure) => {
        setPaymentState({ packageType, status: 'error', message: failure.error?.description || 'Payment अयशस्वी झाले.' })
      })
      setPaymentState({ packageType, status: 'checkout', message: 'Checkout मध्ये payment पूर्ण करा.' })
      checkout.open()
    } catch (error) {
      setPaymentState({ packageType, status: 'error', message: error.message })
    }
  }
  return <>
    <PageHeader title="एक्सप्रेस उद्योजकवर जाहिरात करा" crumb="जाहिरात" />
    <section className="section"><div className="container">
      {paymentState.message && <div className={`data-notice payment-${paymentState.status}`} role="status">{paymentState.message}</div>}
      <div className="footer-linked-content footer-advertise-page">
        <section className="footer-content-section">
          <h2>तुमचा व्यवसाय अधिक लोकांपर्यंत पोहोचवा</h2>
          <p>तुमची उत्पादने, सेवा, मशीनरी, व्यवसाय संधी किंवा उद्योजकतेशी संबंधित उपक्रम योग्य प्रेक्षकांपर्यंत पोहोचवायचा आहे का? एक्सप्रेस उद्योजकवर जाहिरात किंवा प्रमोशनसाठी चौकशी करू शकता.</p>
          <p>आमचे व्यासपीठ व्यवसाय, उद्योग, स्टार्टअप, सरकारी योजना, मशीनरी, शेतीपूरक उद्योग आणि स्वयंरोजगार यांसारख्या विषयांमध्ये रस असलेल्या वाचकांसाठी माहिती प्रकाशित करते.</p>
        </section>
        <section className="footer-content-section">
          <h2>उपलब्ध प्रमोशन प्रकार</h2>
          <ol>
            <li><strong>Website Promotion</strong> – वेबसाइटवरील योग्य विभागात जाहिरात किंवा प्रायोजित लेख.</li>
            <li><strong>Instagram Promotion</strong> – पोस्ट, स्टोरी किंवा Reel स्वरूपातील प्रमोशन.</li>
            <li><strong>Facebook Promotion</strong> – उपलब्ध Facebook पेजवर प्रमोशनल पोस्ट.</li>
            <li><strong>YouTube Promotion</strong> – उपलब्धतेनुसार व्हिडिओ किंवा समुदाय स्वरूपातील प्रमोशन.</li>
            <li><strong>Business Feature</strong> – व्यवसाय, उत्पादन किंवा उद्योजकाची माहितीपर ओळख.</li>
            <li><strong>Sponsored Content</strong> – स्पष्टपणे जाहिरात/प्रायोजित म्हणून चिन्हांकित लेख.</li>
          </ol>
          <p>प्रत्येक माध्यमाची उपलब्धता, स्वरूप, कालावधी आणि अटी आधी लेखी स्वरूपात निश्चित केल्या जातील.</p>
        </section>
        <section className="footer-content-section">
          <h2>जाहिरातीसाठी आवश्यक माहिती</h2>
          <p>चौकशी करताना व्यवसाय/ब्रँडचे नाव, उत्पादन किंवा सेवेचा तपशील, जाहिरातीचा उद्देश, अपेक्षित माध्यम, फोटो/व्हिडिओ/अधिकृत वेबसाइट लिंक आणि संपर्क व्यक्तीचे नाव व मोबाईल नंबर पाठवा.</p>
        </section>
        <section className="footer-content-section">
          <h2>दर आणि पोहोच</h2>
          <p>प्रमोशनचे दर, उपलब्ध स्लॉट, कालावधी आणि अपेक्षित स्वरूप मोहिमेनुसार ठरतील. सध्याचे दर किंवा customized campaign जाणून घेण्यासाठी थेट संपर्क करा.</p>
          <p><strong>महत्त्वाचे:</strong> कोणत्याही पोस्टसाठी ठराविक Views, Leads, Sales, Followers किंवा ग्राहकसंख्या मिळण्याची हमी दिली जात नाही. जाहिरातीची कामगिरी विषय, प्रेक्षक, प्लॅटफॉर्म आणि मोहिमेवर अवलंबून असते.</p>
        </section>
        <section className="footer-content-section">
          <h2>जाहिरात स्वीकारण्याचे निकष</h2>
          <ul>
            <li>जाहिरातीत दिलेली माहिती खरी आणि पडताळता येण्याजोगी असावी.</li>
            <li>लागू कायदे आणि प्लॅटफॉर्म धोरणांचे पालन आवश्यक आहे.</li>
            <li>फसवणूक, दिशाभूल, बेकायदेशीर उत्पादने किंवा भ्रामक कमाईच्या हमी असलेल्या जाहिराती नाकारल्या जाऊ शकतात.</li>
            <li>नेटवर्क मार्केटिंग/MLM किंवा आर्थिक योजनांसाठी अतिरिक्त तपासणी आवश्यक असू शकते.</li>
            <li>जाहिरात प्रकाशित करण्यापूर्वी मजकूर, क्रिएटिव्ह, किंमत आणि वेळापत्रक लेखी मंजूर केले जाईल.</li>
            <li>आगाऊ पेमेंट, रद्द करण्याची अट आणि परतावा धोरण मोहिमेपूर्वी स्पष्ट केले जाईल.</li>
          </ul>
        </section>
        <section className="footer-content-section">
          <h2>जाहिरातीसाठी संपर्क</h2>
          <ul className="footer-content-links">
            <li><a href="tel:+918975763519">मोबाईल / WhatsApp: 8975763519</a></li>
            <li><a href="https://wa.me/918975763519" target="_blank" rel="noopener noreferrer">WhatsApp वर संदेश पाठवा</a></li>
            <li><a href="mailto:contactuyogak@gmail.com">contactuyogak@gmail.com</a></li>
            <li><a href="https://www.instagram.com/express_udyojak/" target="_blank" rel="noopener noreferrer">Instagram: @express_udyojak</a></li>
            <li><a href="https://www.facebook.com/people/udyojakexpress/61596853830702" target="_blank" rel="noopener noreferrer">Facebook: एक्सप्रेस उद्योजक</a></li>
            <li><a href="https://www.youtube.com/@expresudyojak" target="_blank" rel="noopener noreferrer">YouTube: @expresudyojak</a></li>
          </ul>
          <blockquote>जाहिरात प्रकाशित झाली म्हणजे उत्पादनाची गुणवत्ता, विक्रेत्याची सेवा किंवा व्यवसायाच्या परिणामांची एक्सप्रेस उद्योजककडून हमी दिली आहे, असा अर्थ होत नाही. वाचकांनी स्वतः पडताळणी करावी.</blockquote>
        </section>
      </div>
      <h2 className="promotion-packages-heading">सशुल्क प्रमोशन सेवा</h2>
      <div className="guidance-grid">{packages.map(([type,title,price]) => <article key={type}><BadgeIndianRupee/><h2>{title}</h2><p>{price}</p><button className="reference-guidance-box" type="button" disabled={paymentState.status === 'loading'} onClick={() => startCheckout(type)}>{paymentState.packageType === type && paymentState.status === 'loading' ? 'प्रक्रिया सुरू…' : localStorage.getItem('marathiUdyojakToken') ? 'आता निवडा' : 'लॉगिन करून निवडा'} <ArrowRight size={15}/></button></article>)}</div>
    </div></section>
  </>
}

const bookCartStorageKey = 'marathiUdyojakBookCart'
const readBookCart = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(bookCartStorageKey) || '[]')
    return Array.isArray(saved) ? saved.filter((item) => typeof item.slug === 'string' && Number.isInteger(item.quantity) && item.quantity > 0) : []
  } catch {
    return []
  }
}

function BookStorefront() {
  const [books, setBooks] = useState([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/store/books?limit=50', { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Books could not be loaded.')))
      .then((data) => setBooks(data.books || []))
      .catch((loadError) => {
        if (loadError.name !== 'AbortError') setError(loadError.message)
      })
    return () => controller.abort()
  }, [])
  const addToCart = (book) => {
    if (book.productType !== 'physical') {
      setNotice('Digital delivery is not available yet.')
      return
    }
    const cart = readBookCart()
    const existing = cart.find((item) => item.slug === book.slug)
    if (existing) existing.quantity = Math.min(existing.quantity + 1, 20)
    else cart.push({ slug: book.slug, quantity: 1 })
    localStorage.setItem(bookCartStorageKey, JSON.stringify(cart))
    setNotice(`${book.title} added to cart.`)
  }
  const visible = books.filter((book) => `${book.title} ${book.author} ${book.category}`.toLowerCase().includes(search.toLowerCase()))
  return <>
    <section className="stories-page-header"><div className="container"><div className="breadcrumb"><Link to="/">मुख्यपृष्ठ</Link><ChevronRight size={14}/><span>Book Store</span></div><h1>Book Store</h1><p>Marathi Udyojak books and resources.</p></div></section>
    <section className="section"><div className="container book-store-page">
      <div className="book-store-toolbar"><label>Search books<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Title, author or category" /></label><Link className="book-cart-link" to="/cart">View cart ({readBookCart().reduce((sum, item) => sum + item.quantity, 0)})</Link></div>
      {notice && <div className="data-notice" role="status">{notice}</div>}
      {error && <div className="data-notice" role="alert">{error}</div>}
      {!books.length && !error && <div className="book-empty">No published books are available yet.</div>}
      <div className="book-grid">{visible.map((book) => <article className="book-card" key={book._id}>
        <Link to={`/books/${encodeURIComponent(book.slug)}`} className="book-cover">{book.coverImage ? <img src={book.coverImage} alt={`${book.title} cover`} loading="lazy" /> : <span>Book cover not available</span>}</Link>
        <div className="book-card-copy"><small>{book.category || book.language}</small><h2><Link to={`/books/${encodeURIComponent(book.slug)}`}>{book.title}</Link></h2><p>{book.author}</p><strong>₹{((book.salePricePaise ?? book.pricePaise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
          {book.productType === 'digital' ? <span className="book-unavailable">Digital delivery unavailable</span> : <button type="button" className="book-primary" disabled={book.availableStock <= 0} onClick={() => addToCart(book)}>{book.availableStock <= 0 ? 'Out of stock' : 'Add to cart'}</button>}
        </div>
      </article>)}</div>
      {books.length > 0 && !visible.length && <div className="book-empty">No books match that search.</div>}
    </div></section>
  </>
}

function BookDetailsPage() {
  const { slug } = useParams()
  const [book, setBook] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/store/books/${encodeURIComponent(slug)}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : response.json().then((data) => Promise.reject(new Error(data.message || 'Book not found.'))))
      .then((data) => setBook(data.book))
      .catch((loadError) => {
        if (loadError.name !== 'AbortError') setError(loadError.message)
      })
    return () => controller.abort()
  }, [slug])
  const addToCart = () => {
    if (!book || book.productType !== 'physical') return setNotice('Digital delivery is not available yet.')
    const cart = readBookCart()
    const existing = cart.find((item) => item.slug === book.slug)
    if (existing) existing.quantity = Math.min(existing.quantity + 1, 20)
    else cart.push({ slug: book.slug, quantity: 1 })
    localStorage.setItem(bookCartStorageKey, JSON.stringify(cart))
    setNotice(`${book.title} added to cart.`)
  }
  if (error) return <section className="section"><div className="container"><div className="data-notice" role="alert">{error}</div></div></section>
  if (!book) return <section className="section"><div className="container"><div className="book-empty">Loading book…</div></div></section>
  return <section className="section"><div className="container book-detail">
    <div className="breadcrumb"><Link to="/books">Book Store</Link><ChevronRight size={14}/><span>{book.title}</span></div>
    <div className="book-detail-grid">{book.coverImage ? <img src={book.coverImage} alt={`${book.title} cover`} /> : <div className="book-cover-placeholder">Book cover not available</div>}
      <div><small>{book.category || book.language}</small><h1>{book.title}</h1><p className="book-author">By {book.author}</p><p>{book.description}</p><strong className="book-price">₹{((book.salePricePaise ?? book.pricePaise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
        {notice && <div className="data-notice" role="status">{notice}</div>}
        {book.productType === 'digital' ? <div className="data-notice">Digital delivery is not available yet.</div> :         <button className="book-primary" type="button" disabled={book.availableStock <= 0} onClick={addToCart}>{book.availableStock <= 0 ? 'Out of stock' : 'Add to cart'}</button>}
        <p><Link to="/cart">View cart</Link></p>
      </div>
    </div>
  </div></section>
}

function BookCartPage() {
  const [cart, setCart] = useState(readBookCart)
  const [books, setBooks] = useState([])
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    Promise.all(cart.map((item) => fetch(`/api/store/books/${encodeURIComponent(item.slug)}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('A book in your cart is no longer available.')))
      .then((data) => ({ ...data.book, quantity: item.quantity }))))
      .then(setBooks)
      .catch((loadError) => {
        if (loadError.name !== 'AbortError') setError(loadError.message)
      })
    return () => controller.abort()
  }, [cart])
  const updateQuantity = (book, quantity) => {
    const next = quantity > 0 ? cart.map((item) => item.slug === book.slug ? { ...item, quantity: Math.min(quantity, 20) } : item) : cart.filter((item) => item.slug !== book.slug)
    setCart(next)
    localStorage.setItem(bookCartStorageKey, JSON.stringify(next))
  }
  const subtotal = books.reduce((total, book) => total + (book.salePricePaise ?? book.pricePaise) * book.quantity, 0)
  return <>
    <section className="stories-page-header"><div className="container"><div className="breadcrumb"><Link to="/books">Book Store</Link><ChevronRight size={14}/><span>Cart</span></div><h1>Your cart</h1></div></section>
    <section className="section"><div className="container book-cart-page">
      {error && <div className="data-notice" role="alert">{error}</div>}
      {!cart.length && <div className="book-empty">Your cart is empty. <Link to="/books">Browse books</Link></div>}
      {books.map((book) => <article className="book-cart-row" key={book._id}><img src={book.coverImage || logoUrl} alt={`${book.title} cover`} /><div><h2>{book.title}</h2><p>{book.author}</p><strong>₹{((book.salePricePaise ?? book.pricePaise) / 100).toFixed(2)}</strong></div><label>Quantity<input type="number" min="0" max="20" value={book.quantity} onChange={(event) => updateQuantity(book, Number(event.target.value))} /></label><strong>₹{((book.salePricePaise ?? book.pricePaise) * book.quantity / 100).toFixed(2)}</strong></article>)}
      {books.length > 0 && <div className="book-cart-summary"><p>Subtotal <strong>₹{(subtotal / 100).toFixed(2)}</strong></p><p>Shipping and any applicable tax are calculated from server settings before payment.</p><Link className="book-primary" to="/checkout">Proceed to checkout</Link></div>}
    </div></section>
  </>
}

function BookCheckoutPage() {
  const navigate = useNavigate()
  const token = localStorage.getItem('marathiUdyojakToken')
  const [cart, setCart] = useState(readBookCart)
  const [books, setBooks] = useState([])
  const [config, setConfig] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/store/checkout-config', { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Checkout availability could not be checked.')))
      .then(setConfig)
      .catch((loadError) => { if (loadError.name !== 'AbortError') setError(loadError.message) })
    return () => controller.abort()
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    Promise.all(cart.map((item) => fetch(`/api/store/books/${encodeURIComponent(item.slug)}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('A book in your cart is no longer available.')))
      .then((data) => ({ ...data.book, quantity: item.quantity }))))
      .then(setBooks)
      .catch((loadError) => { if (loadError.name !== 'AbortError') setError(loadError.message) })
    return () => controller.abort()
  }, [cart])
  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')
    if (!token) {
      navigate('/auth', { state: { from: '/checkout' } })
      return
    }
    if (!config?.checkoutAvailable) {
      setError('Checkout is not available until the store policies, taxes, shipping and test payment setup are configured.')
      return
    }
    if (books.some((book) => book.productType !== 'physical')) {
      setError('Digital delivery is not available yet.')
      return
    }
    setBusy(true)
    try {
      const form = new FormData(event.currentTarget)
      const response = await fetch('/api/store/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          items: books.map((book) => ({ bookId: book._id, quantity: book.quantity })),
          customerName: form.get('customerName'),
          customerEmail: form.get('customerEmail'),
          customerPhone: form.get('customerPhone'),
          shippingAddress: {
            line1: form.get('line1'), line2: form.get('line2'), city: form.get('city'),
            state: form.get('state'), postalCode: form.get('postalCode'), country: form.get('country')
          },
          policyAccepted: form.get('policyAccepted') === 'on'
        })
      })
      const order = await response.json()
      if (!response.ok) throw new Error(order.message || 'Order could not be created.')
      await loadRazorpayCheckout()
      const checkout = new window.Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: 'Marathi Udyojak',
        description: `Book order ${order.orderNumber}`,
        handler: async (result) => {
          setMessage('Payment captured. Verifying with the server…')
          try {
            const verifyResponse = await fetch(`/api/store/orders/${order.localOrderId}/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                razorpayOrderId: result.razorpay_order_id,
                razorpayPaymentId: result.razorpay_payment_id,
                razorpaySignature: result.razorpay_signature
              })
            })
            const verification = await verifyResponse.json()
            if (!verifyResponse.ok) throw new Error(verification.message || 'Payment verification failed.')
            localStorage.removeItem(bookCartStorageKey)
            setCart([])
            setBooks([])
            setMessage(`Payment verified. Order ${verification.order.orderNumber} is ${verification.order.paymentStatus}.`)
            setBusy(false)
          } catch (verificationError) {
            setError(verificationError.message)
            setBusy(false)
          }
        },
        modal: { ondismiss: () => { setBusy(false); setMessage('Checkout was closed. Any inventory reservation expires after 30 minutes.') } }
      })
      checkout.on('payment.failed', (failure) => { setBusy(false); setError(failure.error?.description || 'Payment failed.') })
      checkout.open()
    } catch (submitError) {
      setError(submitError.message)
      setBusy(false)
    }
  }
  const physicalCount = books.reduce((total, book) => total + book.quantity, 0)
  const subtotal = books.reduce((total, book) => total + (book.salePricePaise ?? book.pricePaise) * book.quantity, 0)
  const shipping = physicalCount ? config?.shippingFeePaise : 0
  const tax = config?.taxTreatment === 'exclusive' ? Math.round(subtotal * (config.taxRateBasisPoints || 0) / 10000) : 0
  if (!cart.length && !message) return <section className="section"><div className="container"><div className="book-empty">Your cart is empty. <Link to="/books">Browse books</Link></div></div></section>
  return <>
    <section className="stories-page-header"><div className="container"><div className="breadcrumb"><Link to="/cart">Cart</Link><ChevronRight size={14}/><span>Checkout</span></div><h1>Checkout</h1></div></section>
    <section className="section"><div className="container book-checkout-page">
      {error && <div className="data-notice" role="alert">{error}</div>}
      {message && <div className="data-notice" role="status">{message}</div>}
      {config && !config.checkoutAvailable && <div className="book-empty">Checkout is disabled until an administrator configures the required policies, tax/shipping settings and Razorpay test credentials.</div>}
      {!token && <div className="data-notice">Sign in is required to place an order. <Link to="/auth" state={{ from: '/checkout' }}>Sign in</Link></div>}
      {token && config?.checkoutAvailable && cart.length > 0 && <form className="book-checkout-form" onSubmit={submit}>
        <h2>Customer and shipping details</h2><div className="book-form-grid">
          <label>Name<input name="customerName" required minLength="2" maxLength="100" /></label>
          <label>Email<input name="customerEmail" type="email" required maxLength="254" /></label>
          <label>Phone<input name="customerPhone" type="tel" required minLength="10" maxLength="15" /></label>
          <label>Address line 1<input name="line1" required maxLength="200" /></label>
          <label>Address line 2<input name="line2" maxLength="200" /></label>
          <label>City<input name="city" required maxLength="100" /></label>
          <label>State<input name="state" required maxLength="100" /></label>
          <label>Postal code<input name="postalCode" required pattern="[A-Za-z0-9 -]{4,12}" /></label>
          <label>Country<input name="country" defaultValue="India" required maxLength="80" /></label>
        </div>
        <div className="book-order-summary"><h3>Order summary</h3>{books.map((book) => <p key={book._id}>{book.title} × {book.quantity}<strong>₹{((book.salePricePaise ?? book.pricePaise) * book.quantity / 100).toFixed(2)}</strong></p>)}<p>Subtotal<strong>₹{(subtotal / 100).toFixed(2)}</strong></p><p>Shipping<strong>{shipping == null ? 'Calculated by server' : `₹${(shipping / 100).toFixed(2)}`}</strong></p><p>Tax<strong>{config.taxTreatment === 'inclusive' ? 'Included in book prices' : `₹${(tax / 100).toFixed(2)}`}</strong></p></div>
        <label className="book-policy-consent"><input name="policyAccepted" type="checkbox" required /> I have reviewed the <a href={config.policies.privacy} target="_blank" rel="noreferrer">privacy</a>, <a href={config.policies.shipping} target="_blank" rel="noreferrer">shipping</a> and <a href={config.policies.returns} target="_blank" rel="noreferrer">returns</a> policies.</label>
        <p className="book-checkout-note">Checkout runs in Razorpay test mode only. No card details or payment credentials are stored by this site.</p>
        <button className="book-primary" type="submit" disabled={busy}>{busy ? 'Preparing secure checkout…' : 'Pay securely (test mode)'}</button>
      </form>}
    </div></section>
  </>
}

function useCmsCollection(url, token, collection, enabled = true) {
  const [items, setItems] = useState([])
  useEffect(() => {
    if (!token || !enabled) {
      if (!enabled) setItems([])
      return
    }
    const controller = new AbortController()
    fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('डेटा लोड करता आला नाही.')))
      .then((data) => setItems(Array.isArray(data[collection]) ? data[collection] : []))
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setItems([])
          console.error(`CMS ${collection} could not be loaded:`, error)
        }
      })
    return () => controller.abort()
  }, [url, token, collection, enabled])
  return [items, setItems]
}

function useSettingsAdmin(token, enabled = true) {
  const [settings, setSettings] = useState(null)
  useEffect(() => {
      if (!token || !enabled) {
        if (!enabled) setSettings(null)
        return
      }
      const controller = new AbortController()
      fetch('/api/cms/settings', { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Settings लोड करता आले नाहीत.')))
      .then((data) => setSettings(normalizeWebsiteSettings(data.settings)))
        .catch((error) => {
          if (error.name !== 'AbortError') {
            setSettings(null)
            console.error('CMS settings could not be loaded:', error)
          }
        })
      return () => controller.abort()
  }, [token, enabled])
  return [settings, setSettings]
}

function makeSlug(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\u0900-\u097F\w]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
}

function RichTextEditor({ value, onChange, token }) {
  const editorRef = useRef(null)
  const exec = (command, argument = null) => {
    editorRef.current?.focus()
    document.execCommand(command, false, argument)
    onChange(editorRef.current?.innerHTML || '')
  }
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== (value || '')) {
      editorRef.current.innerHTML = value || ''
    }
  }, [value])
  const insertLink = () => {
    const url = window.prompt('Article link URL')
    if (url) exec('createLink', url)
  }
  const insertImage = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/jpeg,image/png,image/webp'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      if (file.size > 5 * 1024 * 1024) {
        window.alert('Image 5 MB पेक्षा लहान असावी.')
        return
      }
      const formData = new FormData()
      formData.append('image', file)
      formData.append('title', file.name)
      const response = await fetch('/api/cms/media', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Image upload failed.')
      exec('insertImage', data.media.url)
    }
    input.click()
  }
  return <div className="cms-rich-editor">
    <div className="cms-rich-toolbar" role="toolbar" aria-label="Article formatting">
      <button type="button" onClick={() => exec('formatBlock', 'h2')}>H2</button>
      <button type="button" onClick={() => exec('formatBlock', 'h3')}>H3</button>
      <button type="button" onClick={() => exec('formatBlock', 'p')}>P</button>
      <button type="button" onClick={() => exec('bold')}><b>B</b></button>
      <button type="button" onClick={() => exec('italic')}><i>I</i></button>
      <button type="button" onClick={() => exec('underline')}><u>U</u></button>
      <button type="button" onClick={() => exec('insertUnorderedList')}>• List</button>
      <button type="button" onClick={() => exec('insertOrderedList')}>1. List</button>
      <button type="button" onClick={insertLink}>Link</button>
      <button type="button" onClick={insertImage}>Image</button>
      <button type="button" onClick={() => exec('undo')}>Undo</button>
      <button type="button" onClick={() => exec('redo')}>Redo</button>
    </div>
    <div
      ref={editorRef}
      className="cms-rich-content"
      contentEditable
      suppressContentEditableWarning
      data-placeholder="Article content येथे लिहा..."
      onInput={(event) => onChange(event.currentTarget.innerHTML)}
    />
  </div>
}

function StorageAdmin({ token }) {
  const [state, setState] = useState({ status: 'loading', data: null, error: '' })
  const load = async () => {
    setState((current) => ({ ...current, status: 'loading', error: '' }))
    try {
      const response = await fetch('/api/admin/storage', { headers: { Authorization: `Bearer ${token}` } })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Storage data unavailable.')
      setState({ status: 'success', data, error: '' })
    } catch (error) {
      setState({ status: 'error', data: null, error: error.message })
    }
  }
  useEffect(() => { load() }, [token])
  const formatBytes = (bytes) => {
    if (!Number.isFinite(bytes)) return 'Unavailable'
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }
  if (state.status === 'loading') return <div className="cms-loading">Storage माहिती लोड होत आहे…</div>
  if (state.status === 'error') return <div className="cms-panel cms-error" role="alert">{state.error}</div>
  const data = state.data
  return <div className="cms-storage">
    <div className="cms-storage-head cms-panel">
      <div><h2>Database & Storage</h2><p className="cms-muted">MongoDB आणि uploaded image storage यांची वास्तविक माहिती.</p></div>
      <button type="button" className="cms-secondary" onClick={load}>Refresh Storage</button>
    </div>
    <div className="cms-storage-grid">
      {[
        ['Database Name', data.databaseName],
        ['Connection Status', data.connectionStatus],
        ['MongoDB Storage Used', formatBytes(data.databaseStorageUsedBytes)],
        ['Database Data + Indexes', formatBytes(data.databaseStorageBytes)],
        ['Image Storage Used', formatBytes(data.imageStorageBytes)],
        ['Total Uploaded Images', data.totalUploadedImages?.toLocaleString('en-IN')],
        ['Total Articles', data.totalArticles?.toLocaleString('en-IN')],
        ['Storage Limit', data.quotaStatus]
      ].map(([label, value]) => <article className="cms-panel cms-storage-card" key={label}><span>{label}</span><strong>{value}</strong></article>)}
    </div>
    <div className="cms-panel">
      <h2>Storage Usage</h2>
      <div className="cms-storage-progress"><i style={{ width: data.storageLimitBytes ? `${Math.min(100, data.databaseStorageUsedBytes / data.storageLimitBytes * 100)}%` : '0%' }} /></div>
      {data.storageLimitBytes ? <p className="cms-muted">Remaining: {formatBytes(data.remainingBytes)}</p> : <p className="cms-muted">{data.quotaStatus}. Remaining storage cannot be calculated.</p>}
      <small>Image metadata size: {formatBytes(data.imageMetadataBytes)} · Local disk files: {data.diskImageFiles?.toLocaleString('en-IN')}</small>
    </div>
  </div>
}

function CmsOverview({ statistics }) {
  if (!statistics) return <div className="cms-loading">Dashboard लोड होत आहे…</div>
  const cards = [
    ['Total Articles', statistics.articles, 'article'],
    ['Published Articles', statistics.publishedArticles ?? 0, 'publish'],
    ['Draft Articles', statistics.draftArticles ?? 0, 'draft'],
    ['Total Page Views', statistics.pageViews ?? 0, 'views'],
    ['Total Users', statistics.users, 'users'],
    ['Total Categories', statistics.categories, 'category']
  ]
  return <div className="cms-overview-grid">{cards.map(([label, value, kind]) => <article className="cms-overview-card" key={label}><div className={`cms-overview-icon cms-overview-${kind}`}><Eye size={18}/></div><div><strong>{Number(value || 0).toLocaleString('en-IN')}</strong><span>{label}</span></div></article>)}</div>
}

function WebsiteSettingsAdmin({ settings, setSettings, saveJson }) {
  const setPublicSettings = useSetWebsiteSettings()
  if (!settings) return <div className="cms-loading">Settings लोड होत आहेत…</div>
  const update = (path, value) => setSettings((current) => {
    const next = structuredClone(current)
    const keys = path.split('.')
    let cursor = next
    keys.slice(0, -1).forEach((key) => { cursor[key] ||= {}; cursor = cursor[key] })
    cursor[keys.at(-1)] = value
    return next
  })
  const submit = (event) => {
    event.preventDefault()
    const payload = normalizeWebsiteSettings({ ...settings, contactSettingsVersion: 1 })
    saveJson('/api/cms/settings', 'PUT', payload)
      .then(({ settings: savedSettings }) => setPublicSettings(normalizeWebsiteSettings(savedSettings)))
      .catch((error) => alert(error.message))
  }
  return <form className="cms-panel cms-form" onSubmit={submit}>
    <h2>Website & Official Contact Settings</h2>
    <div className="cms-grid">
      <label>Website name<input value={settings.websiteName || ''} onChange={(event) => update('websiteName', event.target.value)} /></label>
      <label>Website URL<input value={settings.websiteUrl || ''} onChange={(event) => update('websiteUrl', event.target.value)} /></label>
      <label>Tagline<input value={settings.tagline || ''} onChange={(event) => update('tagline', event.target.value)} /></label>
      <label>Logo URL<input value={settings.logo || ''} onChange={(event) => update('logo', event.target.value)} /></label>
      <label>Official email<input type="email" value={settings.defaultEmail || ''} onChange={(event) => update('defaultEmail', event.target.value)} /></label>
      <label>Contact mobile number<input type="tel" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} value={settings.defaultPhone || ''} onChange={(event) => update('defaultPhone', event.target.value)} /></label>
      <label>WhatsApp number<input type="tel" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} value={settings.contacts?.whatsappNumber || ''} onChange={(event) => update('contacts.whatsappNumber', event.target.value)} /></label>
    </div>
    <h3>Official social accounts</h3>
    <div className="cms-grid">{['instagram','facebook','youtube'].map((key) => <label key={key}>{key}<input type="url" value={settings.social?.[key] || ''} onChange={(event) => update(`social.${key}`, event.target.value)} /></label>)}</div>
    <h3>SEO & Design</h3>
    <div className="cms-grid">
      <label>SEO title<input value={settings.seo?.title || ''} onChange={(event) => update('seo.title', event.target.value)} /></label>
      <label>Meta description<textarea rows="3" value={settings.seo?.description || ''} onChange={(event) => update('seo.description', event.target.value)} /></label>
      <label>Marathi font<input value={settings.design?.marathiFont || ''} onChange={(event) => update('design.marathiFont', event.target.value)} /></label>
      <label>Primary color<input type="color" value={settings.design?.primaryColor || '#137a3d'} onChange={(event) => update('design.primaryColor', event.target.value)} /></label>
    </div>
    <h3>Book Store Checkout</h3>
    <p className="cms-muted">Checkout accepts Razorpay test credentials only. Live keys are rejected by the server.</p>
    <div className="cms-grid">
      <label className="cms-check"><input type="checkbox" checked={Boolean(settings.store?.checkoutEnabled)} onChange={(event) => update('store.checkoutEnabled', event.target.checked)} /> Enable test checkout</label>
      <label>Shipping fee (INR)<input type="number" min="0" step="0.01" value={settings.store?.shippingFeePaise == null ? '' : (settings.store.shippingFeePaise / 100).toFixed(2)} onChange={(event) => update('store.shippingFeePaise', event.target.value === '' ? null : Math.round(Number(event.target.value) * 100))} /></label>
      <label>Tax treatment<select value={settings.store?.taxTreatment || ''} onChange={(event) => update('store.taxTreatment', event.target.value)}><option value="">Not configured</option><option value="inclusive">Prices include tax</option><option value="exclusive">Add configured tax rate</option></select></label>
      <label>Tax rate (basis points)<input type="number" min="0" max="10000" step="1" value={settings.store?.taxRateBasisPoints ?? ''} disabled={settings.store?.taxTreatment !== 'exclusive'} onChange={(event) => update('store.taxRateBasisPoints', event.target.value === '' ? null : Number(event.target.value))} /></label>
      <label>Privacy policy URL<input type="url" value={settings.store?.privacyPolicyUrl || ''} onChange={(event) => update('store.privacyPolicyUrl', event.target.value)} /></label>
      <label>Shipping policy URL<input type="url" value={settings.store?.shippingPolicyUrl || ''} onChange={(event) => update('store.shippingPolicyUrl', event.target.value)} /></label>
      <label>Returns policy URL<input type="url" value={settings.store?.returnPolicyUrl || ''} onChange={(event) => update('store.returnPolicyUrl', event.target.value)} /></label>
    </div>
    <button className="cms-primary" type="submit">Publish settings</button>
  </form>
}

function GlobalContentAdmin({ content, setContent, saveJson }) {
  const [draft, setDraft] = useState({ key: '', label: '', value: '', type: 'text', page: 'global', component: '' })
  const submit = (event) => {
    event.preventEvent?.()
    event.preventDefault()
    saveJson('/api/cms/content', 'POST', draft)
      .then(({ content: saved }) => setContent((current) => [saved, ...current.filter((item) => item._id !== saved._id)]))
      .catch((error) => alert(error.message))
  }
  return <div>
    <form className="cms-panel cms-form" onSubmit={submit}>
      <h2>Add or update content key</h2>
      <div className="cms-grid">
        <label>Content key<input required value={draft.key} onChange={(event) => setDraft({ ...draft, key: event.target.value })} /></label>
        <label>Label<input required value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} /></label>
        <label>Page<input value={draft.page} onChange={(event) => setDraft({ ...draft, page: event.target.value })} /></label>
        <label>Component<input value={draft.component} onChange={(event) => setDraft({ ...draft, component: event.target.value })} /></label>
        <label className="cms-span">Value<textarea required rows="4" value={draft.value} onChange={(event) => setDraft({ ...draft, value: event.target.value })} /></label>
      </div>
      <button className="cms-primary" type="submit">Save & publish</button>
    </form>
    <div className="cms-table-wrap"><table className="cms-table"><thead><tr><th>Key</th><th>Label</th><th>Page</th><th>Value</th><th>Status</th></tr></thead><tbody>{content.map((item) => <tr key={item._id}><td>{item.key}</td><td>{item.label}</td><td>{item.page}</td><td>{String(item.value)}</td><td>{item.status}</td></tr>)}</tbody></table></div>
  </div>
}

function PageAdmin({ pages, setPages, saveJson }) {
  const [selected, setSelected] = useState(null)
  const open = (page) => setSelected(page ? structuredClone(page) : { title: '', slug: '', subtitle: '', content: '', pageType: 'page', status: 'draft', seoTitle: '', seoDescription: '' })
  const submit = (event) => {
    event.preventDefault()
    const existing = Boolean(selected._id)
    saveJson(existing ? `/api/cms/pages/${selected._id}` : '/api/cms/pages', existing ? 'PUT' : 'POST', selected)
      .then(({ page }) => { setPages((current) => existing ? current.map((item) => item._id === page._id ? page : item) : [page, ...current]); setSelected(page) })
      .catch((error) => alert(error.message))
  }
  if (selected) return <form className="cms-panel cms-form" onSubmit={submit}>
    <div className="cms-editor-head"><h2>{selected.title || 'नवीन पृष्ठ'}</h2><button type="button" className="cms-secondary" onClick={() => setSelected(null)}>Back</button></div>
    <div className="cms-grid">
      <label>Page title<input required value={selected.title} onChange={(event) => setSelected({ ...selected, title: event.target.value })} /></label>
      <label>URL slug<input required value={selected.slug} onChange={(event) => setSelected({ ...selected, slug: event.target.value })} /></label>
      <label>Status<select value={selected.status || 'draft'} onChange={(event) => setSelected({ ...selected, status: event.target.value })}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label>
      <label>Page type<select value={selected.pageType || 'page'} onChange={(event) => setSelected({ ...selected, pageType: event.target.value })}><option value="page">Page</option><option value="landing">Landing</option><option value="article">Article</option></select></label>
      <label className="cms-span">Subtitle<input value={selected.subtitle || ''} onChange={(event) => setSelected({ ...selected, subtitle: event.target.value })} /></label>
      <label className="cms-span">Content<textarea rows="14" value={selected.content || ''} onChange={(event) => setSelected({ ...selected, content: event.target.value })} /></label>
      <label>SEO title<input value={selected.seoTitle || ''} onChange={(event) => setSelected({ ...selected, seoTitle: event.target.value })} /></label>
      <label>Meta description<textarea value={selected.seoDescription || ''} onChange={(event) => setSelected({ ...selected, seoDescription: event.target.value })} /></label>
    </div>
    <button className="cms-primary" type="submit">{selected.status === 'published' ? 'Publish page' : 'Save draft'}</button>
  </form>
  return <div className="cms-panel"><div className="cms-editor-head"><h2>Website pages</h2><button className="cms-primary" onClick={() => open(null)}>Create page</button></div><div className="cms-table-wrap"><table className="cms-table"><thead><tr><th>Name</th><th>Slug</th><th>Type</th><th>Status</th><th></th></tr></thead><tbody>{pages.map((page) => <tr key={page._id}><td>{page.title}</td><td>/{page.slug}</td><td>{page.pageType}</td><td>{page.status}</td><td><button className="cms-link" onClick={() => open(page)}>Edit</button></td></tr>)}</tbody></table></div></div>
}

function ArticleAdmin({ articles, setArticles, token, role, initialCreate = false }) {
  const [selected, setSelected] = useState(() => initialCreate ? {
    title: '', slug: '', category: '', subtitle: '', excerpt: '', content: '', image: '',
    featuredImage: '', images: [], seoTitle: '', seoDescription: '', tagsText: '', additionalCategoriesText: '',
    publicationDateInput: '', isPublished: false
  } : null)
  const [error, setError] = useState('')
  const [entries, setEntries] = useState(articles)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: articles.length })
  const [featuredPreview, setFeaturedPreview] = useState('')
  const [additionalImages, setAdditionalImages] = useState([])
  const [slugEdited, setSlugEdited] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({ page: String(page), limit: '25', search })
    fetch(`/api/cms/articles?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal
    })
      .then((response) => response.ok ? response.json() : response.json().then((data) => Promise.reject(new Error(data.message || 'Articles could not be loaded.'))))
      .then((data) => { setEntries(data.articles); setPagination(data.pagination); setError('') })
      .catch((loadError) => { if (loadError.name !== 'AbortError') setError(loadError.message) })
    return () => controller.abort()
  }, [page, search, token])
  const canPublish = ['admin', 'super_admin'].includes(role)
  const canArchive = ['admin', 'super_admin'].includes(role)
  const open = (article) => {
    const draft = article ? {
      ...structuredClone(article),
      tagsText: (article.tags || []).join(', '),
      additionalCategoriesText: (article.additionalCategories || []).join(', '),
      publicationDateOriginal: article.publicationDate || null,
      publicationDateInput: article.publicationDate
        ? new Date(new Date(article.publicationDate).getTime() - new Date(article.publicationDate).getTimezoneOffset() * 60000).toISOString().slice(0, 16)
        : ''
    } : {
      title: '', slug: '', category: '', subtitle: '', excerpt: '', content: '', image: '',
      featuredImage: '', images: [], seoTitle: '', seoDescription: '', tagsText: '', additionalCategoriesText: '',
      publicationDateInput: '', isPublished: false
    }
    setSelected(draft)
    setFeaturedPreview(draft.featuredImage || draft.image || '')
    setAdditionalImages(Array.isArray(draft.images) ? [...draft.images] : [])
    setSlugEdited(Boolean(article?.slug))
  }
  const submit = async (event) => {
    event.preventDefault()
    setError('')
    const formData = new FormData()
    const payload = {
      ...selected,
      images: additionalImages,
      publicationDate: selected.publicationDateInput === (selected.publicationDateOriginal
        ? new Date(new Date(selected.publicationDateOriginal).getTime() - new Date(selected.publicationDateOriginal).getTimezoneOffset() * 60000).toISOString().slice(0, 16)
        : '')
        ? selected.publicationDateOriginal || ''
        : selected.publicationDateInput ? new Date(selected.publicationDateInput).toISOString() : '',
        tags: selected.tagsText || '',
        additionalCategories: (selected.additionalCategoriesText || '').split(',').map((item) => item.trim()).filter(Boolean)
    }
    delete payload._id
    delete payload.tagsText
    delete payload.additionalCategoriesText
    delete payload.publicationDateInput
    delete payload.publicationDateOriginal
    delete payload.createdAt
    delete payload.updatedAt
    delete payload.author
    delete payload.totalViews
    delete payload.uniqueVisitors
    delete payload.commentCount
    formData.append('article', JSON.stringify(payload))
    const image = event.currentTarget.elements.articleImage.files?.[0]
    if (image) formData.append('image', image)
    const response = await fetch(selected._id ? `/api/articles/${selected._id}` : '/api/articles', {
      method: selected._id ? 'PUT' : 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.message || 'Article save failed.')
    const updateCurrent = (current) => selected._id
      ? current.map((item) => item._id === data.article._id ? data.article : item)
      : [data.article, ...current]
    setEntries(updateCurrent)
    setArticles(updateCurrent)
    setSelected(null)
  }
  const changeStatus = async (article, action) => {
    setError('')
    try {
      const response = await fetch(`/api/articles/${article._id}/${action}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Article status could not be updated.')
      const updateCurrent = (current) => current.map((item) => item._id === article._id ? data.article : item)
      setEntries(updateCurrent)
      setArticles(updateCurrent)
    } catch (statusError) {
      setError(statusError.message)
    }
  }
  if (selected) return <form className="cms-panel cms-form" onSubmit={(event) => submit(event).catch((saveError) => setError(saveError.message))}>
    <div className="cms-editor-head"><h2>{selected._id ? 'Edit article' : 'Create article'}</h2><button type="button" className="cms-secondary" onClick={() => setSelected(null)}>Back</button></div>
    {error && <div className="cms-error" role="alert">{error}</div>}
    <div className="cms-grid">
      <label>Title<input required value={selected.title} onChange={(event) => {
        const title = event.target.value
        setSelected((current) => ({ ...current, title, slug: slugEdited ? current.slug : makeSlug(title) }))
      }} /></label>
      <label>URL Slug<input value={selected.slug || ''} onChange={(event) => { setSlugEdited(true); setSelected({ ...selected, slug: event.target.value }) }} /></label>
      <label>Category<input value={selected.category || ''} placeholder="e.g. Business Loans" onChange={(event) => setSelected({ ...selected, category: event.target.value })} /></label>
      <p className="cms-muted cms-span">Business Loans page वर article दाखवण्यासाठी Category मध्ये exact “Business Loans” वापरा.</p>
      <label className="cms-span">Additional categories (comma separated)<input value={selected.additionalCategoriesText || ''} onChange={(event) => setSelected({ ...selected, additionalCategoriesText: event.target.value })} /></label>
      <p className="cms-muted cms-span">Primary category न बदलता इतर category archives मध्ये लेख दाखवण्यासाठी exact category names द्या.</p>
      <label>Featured image URL<input value={selected.featuredImage || selected.image || ''} onChange={(event) => { setSelected({ ...selected, featuredImage: event.target.value, image: event.target.value }); setFeaturedPreview(event.target.value) }} /></label>
      <label>Upload featured image<input name="articleImage" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
        const file = event.target.files?.[0]
        if (!file) return
        if (file.size > 5 * 1024 * 1024) { setError('Featured image 5 MB पेक्षा लहान असावी.'); event.target.value = ''; return }
        setFeaturedPreview(URL.createObjectURL(file))
      }} /></label>
      <label className="cms-span">Subtitle<input value={selected.subtitle || ''} onChange={(event) => setSelected({ ...selected, subtitle: event.target.value })} /></label>
      <label className="cms-span">Excerpt<textarea rows="3" maxLength="1000" value={selected.excerpt || ''} onChange={(event) => setSelected({ ...selected, excerpt: event.target.value })} /></label>
      <label className="cms-span">Article content<RichTextEditor token={token} value={selected.content || ''} onChange={(content) => setSelected({ ...selected, content })} /></label>
      <label>Tags (comma separated)<input value={selected.tagsText || ''} onChange={(event) => setSelected({ ...selected, tagsText: event.target.value })} /></label>
      <label>Publication date / schedule<input type="datetime-local" value={selected.publicationDateInput || ''} onChange={(event) => setSelected({ ...selected, publicationDateInput: event.target.value })} /></label>
      <label>SEO title<input value={selected.seoTitle || ''} onChange={(event) => setSelected({ ...selected, seoTitle: event.target.value })} /></label>
      <label>Meta description<textarea value={selected.seoDescription || ''} onChange={(event) => setSelected({ ...selected, seoDescription: event.target.value })} /></label>
      <section className="cms-article-media cms-span">
        <h3>Featured Image Preview</h3>
        {featuredPreview ? <img src={featuredPreview} alt="Featured preview" /> : <div className="cms-media-empty">No featured image selected</div>}
      </section>
      <section className="cms-article-media cms-span">
        <h3>Additional Article Images</h3>
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={async (event) => {
          const files = [...(event.target.files || [])].slice(0, 8)
          for (const file of files) {
            if (file.size > 5 * 1024 * 1024) { setError('प्रत्येक additional image 5 MB पेक्षा लहान असावी.'); continue }
            const formData = new FormData()
            formData.append('image', file)
            formData.append('title', file.name)
            try {
              const response = await fetch('/api/cms/media', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData })
              const data = await response.json()
              if (response.ok) setAdditionalImages((current) => [...current, data.media.url])
              else setError(data.message || 'Additional image upload failed.')
            } catch (uploadError) {
              setError(uploadError.message)
            }
          }
          event.target.value = ''
        }} />
        {additionalImages.length ? <div className="cms-additional-images">{additionalImages.map((url, index) => <div key={url}><img src={url} alt={`Additional ${index + 1}`} /><button type="button" onClick={() => setAdditionalImages((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></div>)}</div> : <p className="cms-muted">Additional images preserve existing selection; uploaded images remain in Media Library.</p>}
      </section>
      <section className="article-admin-analytics cms-span" aria-label="Article analytics">
        <h3>Article analytics</h3>
        <div className="article-admin-metrics">
          <div><strong>{Number(selected.totalViews || 0).toLocaleString('en-US')}</strong><span>Total Views</span></div>
          <div><strong>{Number(selected.uniqueVisitors || 0).toLocaleString('en-US')}</strong><span>Unique Visitors</span></div>
          <div><strong>{Number(selected.commentCount || 0).toLocaleString('en-US')}</strong><span>Comment Count</span></div>
        </div>
        <p><strong>Publication Date:</strong> {selected.publicationDate ? new Date(selected.publicationDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Date unavailable'}</p>
        <p><strong>Assigned Categories:</strong> {[selected.category, ...(selected.additionalCategoriesText || '').split(',').map((item) => item.trim())].filter(Boolean).join(', ') || 'General'}</p>
      </section>
      {canPublish ? <label className="cms-check"><input type="checkbox" checked={Boolean(selected.isPublished)} onChange={(event) => setSelected({ ...selected, isPublished: event.target.checked })} /> Published (future dates are scheduled)</label> : <p className="cms-muted cms-span">New articles are saved as drafts. An administrator can publish or schedule them.</p>}
      <section className="cms-live-preview cms-span">
        <h3>Live Article Preview</h3>
        {featuredPreview && <img src={featuredPreview} alt="" />}
        <h2>{selected.title || 'Article title preview'}</h2>
        {selected.subtitle && <p>{selected.subtitle}</p>}
        <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selected.content || '<p>Content preview...</p>') }} />
      </section>
    </div><button className="cms-primary" type="submit">Save article</button>
  </form>
  return <div className="cms-panel">
    <div className="cms-editor-head"><h2>Articles</h2><button className="cms-primary" type="button" onClick={() => open(null)}>Create article</button></div>
    {error && <div className="cms-error" role="alert">{error}</div>}
    <label className="cms-search">Search articles<input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Title or slug" /></label>
    <div className="cms-table-wrap"><table className="cms-table cms-article-table"><thead><tr><th>Article</th><th>Category</th><th>Published Date</th><th>Views</th><th>Status</th><th>Actions</th></tr></thead><tbody>{entries.map((article) => <tr key={article._id}><td><div className="cms-article-title"><img src={article.featuredImage || article.image || logoUrl} alt="" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = logoUrl }} /><strong>{article.title}</strong></div></td><td>{article.category || 'General'}</td><td>{article.publicationDate ? new Date(article.publicationDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unavailable'}</td><td>{Number(article.totalViews || 0).toLocaleString('en-US')}</td><td><span className={`cms-status cms-status-${article.archivedAt ? 'archived' : article.isPublished ? 'published' : 'draft'}`}>{article.archivedAt ? 'Archived' : article.scheduledAt ? 'Scheduled' : article.isPublished ? 'Published' : 'Draft'}</span></td><td><button className="cms-link" type="button" onClick={() => open(article)}>Edit</button>{canPublish && !article.archivedAt && !article.isPublished && <button className="cms-link" type="button" onClick={() => changeStatus(article, 'publish')}>Publish</button>}{canArchive && !article.archivedAt ? <button className="cms-link cms-link-danger" type="button" onClick={() => { if (window.confirm('Archive this article?')) changeStatus(article, 'archive') }}>Archive</button> : canArchive && <button className="cms-link" type="button" onClick={() => changeStatus(article, 'restore')}>Restore</button>}</td></tr>)}</tbody></table></div>
    {!entries.length && <div className="cms-empty">No articles found.</div>}
    {pagination.pages > 1 && <div className="cms-pagination"><span>{pagination.total.toLocaleString('en-IN')} articles · Page {pagination.page} of {pagination.pages}</span><button className="cms-secondary" type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button><button className="cms-secondary" type="button" disabled={page >= pagination.pages} onClick={() => setPage((current) => current + 1)}>Next</button></div>}
  </div>
}

function HomepageAdmin({ sections, setSections, articles, saveJson }) {
  const [selected, setSelected] = useState(null)
  const open = (section) => setSelected(section ? structuredClone(section) : { key: '', title: '', subtitle: '', categorySlug: '', limit: 6, order: 0, isActive: true, articleIds: [], desktopLayout: 'grid', mobileLayout: 'list', viewAllLink: '' })
  const submit = (event) => {
    event.preventDefault()
    saveJson('/api/cms/homepage', 'POST', { ...selected, articleIds: selected.articleIds.map((item) => typeof item === 'string' ? item : item._id) })
      .then(({ section }) => { setSections((current) => [section, ...current.filter((item) => item._id !== section._id)]); setSelected(null) })
      .catch((error) => alert(error.message))
  }
  if (selected) return <form className="cms-panel cms-form" onSubmit={submit}>
    <div className="cms-editor-head"><h2>Homepage section</h2><button type="button" className="cms-secondary" onClick={() => setSelected(null)}>Back</button></div>
    <div className="cms-grid">
      <label>Unique key<input required value={selected.key} onChange={(event) => setSelected({ ...selected, key: event.target.value })} /></label>
      <label>Section title<input required value={selected.title} onChange={(event) => setSelected({ ...selected, title: event.target.value })} /></label>
      <label>Subtitle<input value={selected.subtitle || ''} onChange={(event) => setSelected({ ...selected, subtitle: event.target.value })} /></label>
      <label>Category slug<input value={selected.categorySlug || ''} onChange={(event) => setSelected({ ...selected, categorySlug: event.target.value })} /></label>
      <label>Article count<input type="number" min="1" max="20" value={selected.limit} onChange={(event) => setSelected({ ...selected, limit: Number(event.target.value) })} /></label>
      <label>Display order<input type="number" value={selected.order} onChange={(event) => setSelected({ ...selected, order: Number(event.target.value) })} /></label>
      <label>Desktop layout<select value={selected.desktopLayout || 'grid'} onChange={(event) => setSelected({ ...selected, desktopLayout: event.target.value })}><option value="grid">Grid</option><option value="list">List</option><option value="featured">Featured</option></select></label>
      <label>Mobile layout<select value={selected.mobileLayout || 'list'} onChange={(event) => setSelected({ ...selected, mobileLayout: event.target.value })}><option value="list">List</option><option value="carousel">Carousel</option></select></label>
      <label className="cms-span">View all link<input value={selected.viewAllLink || ''} onChange={(event) => setSelected({ ...selected, viewAllLink: event.target.value })} /></label>
      <label className="cms-span">Selected articles<select multiple value={(selected.articleIds || []).map((item) => typeof item === 'string' ? item : item._id)} onChange={(event) => setSelected({ ...selected, articleIds: [...event.target.selectedOptions].map((option) => option.value) })}>{articles.map((article) => <option key={article._id} value={article._id}>{article.title}</option>)}</select></label>
      <label className="cms-check"><input type="checkbox" checked={Boolean(selected.isActive)} onChange={(event) => setSelected({ ...selected, isActive: event.target.checked })} /> Enabled</label>
    </div>
    <button className="cms-primary" type="submit">Publish section</button>
  </form>
  return <div className="cms-panel"><div className="cms-editor-head"><h2>Homepage sections</h2><button className="cms-primary" onClick={() => open(null)}>Create section</button></div><div className="cms-table-wrap"><table className="cms-table"><thead><tr><th>Title</th><th>Count</th><th>Order</th><th>Status</th><th></th></tr></thead><tbody>{sections.map((section) => <tr key={section._id}><td>{section.title}</td><td>{section.limit}</td><td>{section.order}</td><td>{section.isActive ? 'Enabled' : 'Disabled'}</td><td><button className="cms-link" onClick={() => open(section)}>Edit</button></td></tr>)}</tbody></table></div></div>
}

function BusinessEssentialsAdmin({ sections, setSections, saveJson }) {
  const savedSection = sections.find((section) => section.key === 'business-essentials')
  const [editedConfig, setEditedConfig] = useState(null)
  const config = editedConfig || (savedSection ? {
    title: savedSection.title === 'Business Essentials' ? BUSINESS_ESSENTIALS_TITLE : savedSection.title || BUSINESS_ESSENTIALS_TITLE,
    subtitle: savedSection.subtitle === 'Everything You Need to Start and Grow Your Business' ? BUSINESS_ESSENTIALS_SUBTITLE : savedSection.subtitle || BUSINESS_ESSENTIALS_SUBTITLE,
    isActive: savedSection.isActive !== false,
    featureCards: getBusinessEssentialsCards(savedSection.featureCards || BUSINESS_ESSENTIALS_DEFAULTS)
  } : {
    title: BUSINESS_ESSENTIALS_TITLE,
    subtitle: BUSINESS_ESSENTIALS_SUBTITLE,
    isActive: true,
    featureCards: BUSINESS_ESSENTIALS_DEFAULTS
  })
  const [status, setStatus] = useState({ saving: false, error: '', saved: false })
  const setConfig = (update) => setEditedConfig((current) => typeof update === 'function' ? update(current || config) : update)

  const updateFeature = (index, field, value) => {
    setConfig((current) => ({
      ...current,
      featureCards: current.featureCards.map((feature, featureIndex) => featureIndex === index
        ? { ...feature, [field]: value }
        : feature)
    }))
  }
  const save = async (event) => {
    event.preventDefault()
    setStatus({ saving: true, error: '', saved: false })
    try {
      const { section } = await saveJson('/api/cms/homepage', 'POST', {
        key: 'business-essentials',
        title: config.title,
        subtitle: config.subtitle,
        order: 0,
        isActive: config.isActive,
        desktopLayout: 'grid',
        mobileLayout: 'grid',
        featureCards: config.featureCards
      })
      setSections((current) => [section, ...current.filter((item) => item.key !== section.key)])
      setStatus({ saving: false, error: '', saved: true })
    } catch (error) {
      setStatus({ saving: false, error: error.message, saved: false })
    }
  }

  return (
    <form className="cms-panel cms-form cms-business-essentials-admin" onSubmit={save}>
      <div className="cms-editor-head">
        <div><h2>Business Essentials</h2><p>Homepage Manager मधून या चार feature cards आणि त्यांचे destination नियंत्रित करा.</p></div>
        <label className="cms-check"><input type="checkbox" checked={config.isActive} onChange={(event) => setConfig((current) => ({ ...current, isActive: event.target.checked }))} /> Section enabled</label>
      </div>
      {status.error && <div className="cms-error" role="alert">{status.error}</div>}
      {status.saved && <div className="cms-success" role="status">Business Essentials settings saved.</div>}
      <div className="cms-grid">
        <label>Section title<input required maxLength="120" value={config.title} onChange={(event) => setConfig((current) => ({ ...current, title: event.target.value }))} /></label>
        <label>Section subtitle<input maxLength="180" value={config.subtitle} onChange={(event) => setConfig((current) => ({ ...current, subtitle: event.target.value }))} /></label>
      </div>
      <div className="cms-business-feature-list">
        {config.featureCards.map((feature, index) => (
          <fieldset className="cms-business-feature" key={feature.key}>
            <legend>{feature.title || `Feature ${index + 1}`}</legend>
            <div className="cms-grid">
              <label>Title<input required maxLength="100" value={feature.title} onChange={(event) => updateFeature(index, 'title', event.target.value)} /></label>
              <label>Subtitle<input required maxLength="160" value={feature.subtitle} onChange={(event) => updateFeature(index, 'subtitle', event.target.value)} /></label>
              <label>Icon<select value={feature.icon} onChange={(event) => updateFeature(index, 'icon', event.target.value)}><option value="FileCheck">File Check</option><option value="Landmark">Landmark</option><option value="Factory">Factory</option><option value="ClipboardList">Clipboard List</option><option value="Settings">Settings</option><option value="Store">Store</option></select></label>
              <label>Destination route<input required pattern="\/[A-Za-z0-9][A-Za-z0-9/_-]*\/?" value={feature.path} onChange={(event) => updateFeature(index, 'path', event.target.value)} /></label>
              <label className="cms-span">Image URL or uploaded media path<input value={feature.image || ''} onChange={(event) => updateFeature(index, 'image', event.target.value)} placeholder="/uploads/feature-image.webp" /></label>
              <label>Display order<input type="number" min="0" max="1000" value={feature.order} onChange={(event) => updateFeature(index, 'order', Number(event.target.value))} /></label>
              <label className="cms-check"><input type="checkbox" checked={feature.isActive !== false} onChange={(event) => updateFeature(index, 'isActive', event.target.checked)} /> Feature enabled</label>
              <div><button className="cms-link cms-link-danger" type="button" onClick={() => setConfig((current) => ({ ...current, featureCards: current.featureCards.filter((_, featureIndex) => featureIndex !== index) }))}>Remove feature</button></div>
            </div>
          </fieldset>
        ))}
      </div>
      <div className="cms-editor-head">
        <button className="cms-secondary" type="button" onClick={() => setConfig((current) => ({
          ...current,
          featureCards: [...current.featureCards, {
            key: `business-feature-${Date.now()}`,
            title: '',
            subtitle: '',
            icon: 'FileCheck',
            image: '',
            path: '/business-licenses',
            isActive: true,
            order: current.featureCards.length + 1
          }]
        }))}>Add feature</button>
        <button className="cms-primary" type="submit" disabled={status.saving}>{status.saving ? 'Saving…' : 'Save Business Essentials'}</button>
      </div>
    </form>
  )
}

function NavigationAdmin({ menus, setMenus, saveJson }) {
  const [selected, setSelected] = useState(null)
  const open = (menu) => setSelected(menu ? structuredClone(menu) : { key: '', label: '', location: 'header', isActive: true, items: [] })
  const submit = (event) => {
    event.preventDefault()
    try {
      const body = { ...selected, items: typeof selected.items === 'string' ? JSON.parse(selected.items) : selected.items }
      saveJson('/api/cms/navigation', 'POST', body)
        .then(({ menu }) => { setMenus((current) => [menu, ...current.filter((item) => item._id !== menu._id)]); setSelected(null) })
        .catch((error) => alert(error.message))
    } catch (error) {
      alert('Navigation JSON वैध नाही.')
    }
  }
  if (selected) return <form className="cms-panel cms-form" onSubmit={submit}>
    <div className="cms-editor-head"><h2>Navigation menu</h2><button type="button" className="cms-secondary" onClick={() => setSelected(null)}>Back</button></div>
    <div className="cms-grid">
      <label>Menu key<input required value={selected.key} onChange={(event) => setSelected({ ...selected, key: event.target.value })} /></label>
      <label>Menu label<input value={selected.label || ''} onChange={(event) => setSelected({ ...selected, label: event.target.value })} /></label>
      <label>Location<select value={selected.location || 'header'} onChange={(event) => setSelected({ ...selected, location: event.target.value })}><option value="header">Header</option><option value="footer">Footer</option><option value="mobile">Mobile</option></select></label>
      <label className="cms-check"><input type="checkbox" checked={Boolean(selected.isActive)} onChange={(event) => setSelected({ ...selected, isActive: event.target.checked })} /> Enabled</label>
      <label className="cms-span">Menu items JSON<textarea rows="16" value={typeof selected.items === 'string' ? selected.items : JSON.stringify(selected.items || [], null, 2)} onChange={(event) => setSelected({ ...selected, items: event.target.value })} /></label>
    </div><button className="cms-primary" type="submit">Publish navigation</button>
  </form>
  return <div className="cms-panel"><div className="cms-editor-head"><h2>Navigation menus</h2><button className="cms-primary" onClick={() => open(null)}>Create menu</button></div><div className="cms-table-wrap"><table className="cms-table"><thead><tr><th>Key</th><th>Label</th><th>Location</th><th>Status</th><th></th></tr></thead><tbody>{menus.map((menu) => <tr key={menu._id}><td>{menu.key}</td><td>{menu.label}</td><td>{menu.location}</td><td>{menu.isActive ? 'Enabled' : 'Disabled'}</td><td><button className="cms-link" onClick={() => open(menu)}>Edit</button></td></tr>)}</tbody></table></div></div>
}

function MediaAdmin({ media, setMedia, token }) {
  const [title, setTitle] = useState('')
  const [altText, setAltText] = useState('')
  const upload = async (event) => {
    event.preventDefault()
    const input = event.currentTarget.elements.image
    if (!input.files?.[0]) return
    const form = new FormData()
    form.append('image', input.files[0])
    form.append('title', title)
    form.append('altText', altText)
    const response = await fetch('/api/cms/media', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form })
    const data = await response.json()
    if (!response.ok) throw new Error(data.message || 'Upload अयशस्वी.')
    setMedia((current) => [data.media, ...current])
  }
  return <div><form className="cms-panel cms-form" onSubmit={(event) => upload(event).catch((error) => alert(error.message))}>
    <h2>Upload image</h2><div className="cms-grid"><label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>Alt text<input value={altText} onChange={(event) => setAltText(event.target.value)} /></label><label className="cms-span">Image<input name="image" type="file" accept="image/jpeg,image/png,image/webp" required /></label></div><button className="cms-primary" type="submit">Upload</button>
  </form><div className="cms-media-grid">{media.map((item) => <article key={item._id}><img src={item.url} alt={item.altText} /><strong>{item.title}</strong><small>{item.mimeType} • {Math.round(item.size / 1024)} KB</small></article>)}</div></div>
}

function AiContentAdmin({ token, role, articles, categories, setArticles, setMedia }) {
  const canPublish = ['admin', 'super_admin'].includes(role)
  const [providerStatus, setProviderStatus] = useState({ loading: true, provider: null, configured: false })
  const [mode, setMode] = useState('create')
  const [prompt, setPrompt] = useState('')
  const [sourceArticle, setSourceArticle] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [draft, setDraft] = useState(null)
  const [sources, setSources] = useState([])
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/ai-content/status', {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal
    })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('AI provider status load failed.')))
      .then((status) => setProviderStatus({ ...status, loading: false }))
      .catch((statusError) => {
        if (statusError.name !== 'AbortError') {
          setProviderStatus({ loading: false, provider: null, configured: false })
          setError(statusError.message)
        }
      })
    return () => controller.abort()
  }, [token])

  const chooseArticle = (id) => {
    setSelectedId(id)
    setNotice('')
    setError('')
    if (!id) {
      setDraft(null)
      setSourceArticle('')
      setSources([])
      return
    }
    const article = articles.find((item) => item._id === id)
    if (!article) return
    setMode('format')
    setPrompt('')
    setSourceArticle(article.content || '')
    setSources([])
    setDraft({ ...article, featuredImage: article.featuredImage || article.image || '' })
  }

  const generate = async (event) => {
    event.preventDefault()
    const targetId = mode === 'format' ? selectedId : ''
    if (targetId !== selectedId) setSelectedId(targetId)
    setBusy('generate')
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/ai-content/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mode, prompt, content: sourceArticle })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'लेख तयार होऊ शकला नाही.')
      const previous = targetId ? articles.find((item) => item._id === targetId) : null
      setDraft({
        ...data.article,
        _id: targetId || undefined,
        slug: previous?.isPublished ? previous.slug : data.article.slug,
        isPublished: Boolean(previous?.isPublished),
        image: previous?.image || '',
        featuredImage: previous?.featuredImage || previous?.image || ''
      })
      setSources(data.sources || [])
      setNotice('AI मसुदा तयार आहे. प्रकाशित करण्यापूर्वी मजकूर तपासा.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy('')
    }
  }

  const uploadImage = async (file) => {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError('प्रतिमा JPG, PNG किंवा WEBP आणि 5 MB पेक्षा लहान असावी.')
      return
    }
    setBusy('image')
    setError('')
    try {
      const form = new FormData()
      form.append('image', file)
      form.append('title', `${draft?.title || 'Article'} - Featured image`)
      form.append('altText', draft?.title || 'Express Udyojak featured image')
      const response = await fetch('/api/cms/media', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'प्रतिमा upload होऊ शकली नाही.')
      setDraft((current) => ({ ...current, image: data.media.url, featuredImage: data.media.url }))
      setMedia((current) => [data.media, ...current.filter((item) => item._id !== data.media._id)])
      setNotice('प्रतिमा media library मध्ये upload झाली आणि featured image म्हणून जोडली.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy('')
    }
  }

  const generateImage = async () => {
    if (!draft?.title || !draft?.content) {
      setError('आधी लेखाचा मसुदा तयार करा.')
      return
    }
    setBusy('image')
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/ai-content/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: draft.title, content: draft.content })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'AI प्रतिमा तयार होऊ शकली नाही.')
      setDraft((current) => ({ ...current, image: data.media.url, featuredImage: data.media.url }))
      setMedia((current) => [data.media, ...current.filter((item) => item._id !== data.media._id)])
      setNotice('नवी AI प्रतिमा तयार होऊन media library मध्ये जोडली.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy('')
    }
  }

  const saveArticle = async (publish = false) => {
    if (!draft?.title?.trim() || !draft?.content?.trim()) {
      setError('लेखाचे शीर्षक आणि मजकूर आवश्यक आहे.')
      return
    }
    if (selectedId && !window.confirm('हा विद्यमान लेख बदलायचा आहे का? त्याचा मजकूर आणि SEO माहिती अपडेट होईल.')) return
    if (publish && !window.confirm('हा लेख वेबसाइटवर आत्ताच प्रकाशित करायचा आहे का?')) return

    setBusy(publish ? 'publish' : 'save')
    setError('')
    setNotice('')
    try {
      const payload = {
        title: draft.title,
        slug: draft.slug,
        subtitle: draft.subtitle || '',
        excerpt: draft.excerpt || '',
        content: draft.content,
        category: draft.category || 'General',
        image: draft.featuredImage || draft.image || '',
        featuredImage: draft.featuredImage || draft.image || '',
        seoTitle: draft.seoTitle || '',
        seoDescription: draft.seoDescription || '',
        tags: Array.isArray(draft.tags) ? draft.tags : [],
        isPublished: Boolean(selectedId && draft.isPublished)
      }
      const updating = Boolean(selectedId)
      const response = await fetch(updating ? `/api/ai-content/articles/${selectedId}` : '/api/articles', {
        method: selectedId ? 'PUT' : 'POST',
        headers: { Authorization: `Bearer ${token}`, ...(updating ? { 'Content-Type': 'application/json' } : {}) },
        body: updating ? JSON.stringify(payload) : (() => {
          const form = new FormData()
          form.append('article', JSON.stringify(payload))
          return form
        })()
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'लेख सेव होऊ शकला नाही.')
      let savedArticle = data.article
      if (publish) {
        const publishResponse = await fetch(`/api/articles/${savedArticle._id}/publish`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` }
        })
        const publishData = await publishResponse.json()
        if (!publishResponse.ok) throw new Error(publishData.message || 'लेख प्रकाशित होऊ शकला नाही.')
        savedArticle = publishData.article
      }
      setSelectedId(savedArticle._id)
      setDraft({ ...savedArticle, featuredImage: savedArticle.featuredImage || savedArticle.image || '' })
      setArticles((current) => [savedArticle, ...current.filter((item) => item._id !== savedArticle._id)])
      setNotice(publish ? 'लेख वेबसाइटवर प्रकाशित झाला.' : selectedId ? 'विद्यमान लेख अपडेट झाला.' : 'लेख मसुदा म्हणून सेव झाला.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy('')
    }
  }

  return <div className="cms-ai-assistant">
    <section className="cms-panel cms-ai-intro">
      <div className="cms-ai-mark"><Sparkles size={22} /></div>
      <div><h2>AI Content Assistant</h2><p>मराठी, हिंदी किंवा इंग्रजीमध्ये लेख तयार करा किंवा दिलेला लेख जपून format करा.</p></div>
      <span className="cms-ai-secure">
        {providerStatus.loading
          ? 'AI provider तपासत आहे…'
          : providerStatus.configured
            ? `${providerStatus.provider} API configured · Server-side`
            : 'AI API key configured नाही'}
      </span>
    </section>
    <section className="cms-panel cms-ai-compose">
      <div className="cms-editor-head"><div><h2>नवीन लेख किंवा विद्यमान लेख</h2><p className="cms-muted">मोड निवडा; AI मसुदा तयार करेल, प्रकाशित करण्यापूर्वी तुम्ही तपासू शकता.</p></div></div>
      <label className="cms-ai-existing">विद्यमान लेख अपडेट करायचा असल्यास निवडा
        <select value={selectedId} onChange={(event) => chooseArticle(event.target.value)}>
          <option value="">नवीन लेख तयार करा</option>
          {selectedId && !canPublish && <option value={selectedId}>Current AI draft</option>}
          {canPublish && articles.map((article) => <option key={article._id} value={article._id}>{article.title} {article.isPublished ? '· Published' : '· Draft'}</option>)}
        </select>
      </label>
      <div className="cms-ai-mode" role="tablist" aria-label="लेख तयार करण्याचा प्रकार">
        <button type="button" className={mode === 'create' ? 'active' : ''} onClick={() => { setMode('create'); setSelectedId(''); setDraft(null); setSources([]) }}><Sparkles size={16} /> AI लेख लिहील</button>
        <button type="button" className={mode === 'format' ? 'active' : ''} onClick={() => setMode('format')}><FileCheck size={16} /> माझा लेख format करा</button>
      </div>
      <form onSubmit={generate}>
        {mode === 'create'
          ? <label className="cms-ai-prompt">लेखासाठी सूचना<textarea required maxLength={500} rows="3" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="उदा. मशरूम उत्पादन व्यवसायावर संपूर्ण मराठी लेख तयार कर..." /></label>
          : <label className="cms-ai-prompt">तुमचा मूळ लेख<textarea required maxLength={30000} rows="8" value={sourceArticle} onChange={(event) => setSourceArticle(event.target.value)} placeholder="तुमचा पूर्ण लेख येथे paste करा. AI अर्थ आणि माहिती जपून रचना सुधारेल." /></label>}
        <p className="cms-ai-preserve"><strong>मूळ मजकूर जतन:</strong> Format मोडमध्ये AI माहिती किंवा अर्थ बदलणार नाही. मोठे बदल सेव/अपडेट करण्यापूर्वी तुमच्या पुष्टीची मागणी केली जाईल.</p>
        <button className="cms-primary" type="submit" disabled={Boolean(busy)}><WandSparkles size={16} /> {busy === 'generate' ? 'लेख तयार होत आहे…' : 'Generate Article'}</button>
      </form>
    </section>
    {error && <div className="cms-error" role="alert">{error}</div>}
    {notice && <div className="cms-ai-notice" role="status">{notice}</div>}
    {draft && <section className="cms-panel cms-ai-editor">
      <div className="cms-editor-head"><div><h2>लेख तपासा आणि संपादित करा</h2><p className="cms-muted">AI ने तयार केलेल्या माहितीसह प्रकाशित करण्यापूर्वी स्रोत आणि तथ्ये तपासा.</p></div></div>
      <div className="cms-grid">
        <label>शीर्षक<input value={draft.title || ''} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
        <label>URL slug<input value={draft.slug || ''} onChange={(event) => setDraft({ ...draft, slug: event.target.value })} /></label>
        <label>Category<select value={draft.category || 'General'} onChange={(event) => setDraft({ ...draft, category: event.target.value })}>
          <option value="General">General</option>{categories.filter((category) => category.isActive !== false).map((category) => <option key={category._id} value={category.name}>{category.name}</option>)}
        </select></label>
        <label>Short description<textarea rows="2" maxLength={1000} value={draft.excerpt || ''} onChange={(event) => setDraft({ ...draft, excerpt: event.target.value })} /></label>
        <label className="cms-span">SEO meta title<input value={draft.seoTitle || ''} onChange={(event) => setDraft({ ...draft, seoTitle: event.target.value })} /></label>
        <label className="cms-span">SEO meta description<textarea rows="2" value={draft.seoDescription || ''} onChange={(event) => setDraft({ ...draft, seoDescription: event.target.value })} /></label>
        <label className="cms-span">Article content<RichTextEditor token={token} value={draft.content || ''} onChange={(content) => setDraft({ ...draft, content })} /></label>
        <label className="cms-span">Featured image URL<input value={draft.featuredImage || draft.image || ''} onChange={(event) => setDraft({ ...draft, image: event.target.value, featuredImage: event.target.value })} /></label>
      </div>
      <div className="cms-ai-image-actions">
        <button type="button" className="cms-secondary" disabled={Boolean(busy)} onClick={generateImage}><ImagePlus size={16} /> {busy === 'image' ? 'प्रतिमा तयार होत आहे…' : draft.featuredImage || draft.image ? 'Regenerate Image' : 'Generate Image'}</button>
        <label className="cms-ai-upload"><span>किंवा स्वतःची image निवडा</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={Boolean(busy)} onChange={(event) => { uploadImage(event.target.files?.[0]); event.target.value = '' }} /></label>
      </div>
      {(draft.featuredImage || draft.image) && <div className="cms-ai-featured"><img src={draft.featuredImage || draft.image} alt={draft.title || 'Featured image preview'} /></div>}
      {sources.length > 0 && <section className="cms-ai-sources"><h3>संशोधन स्रोत</h3><ul>{sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></li>)}</ul></section>}
      <section className="cms-live-preview cms-ai-preview">
        <h3><Eye size={16} /> Preview Article</h3>
        {(draft.featuredImage || draft.image) && <img src={draft.featuredImage || draft.image} alt="" />}
        <h2>{draft.title}</h2><p>{draft.excerpt}</p>
        <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(draft.content || '') }} />
      </section>
      <div className="cms-ai-actions">
        <button type="button" className="cms-secondary" disabled={Boolean(busy)} onClick={() => saveArticle(false)}><Save size={16} /> {selectedId ? 'Update Article' : 'Save as Draft'}</button>
        {canPublish && <button type="button" className="cms-primary" disabled={Boolean(busy)} onClick={() => saveArticle(true)}><Send size={16} /> Publish Article</button>}
        {!canPublish && <p className="cms-muted">तुमची भूमिका मसुदे सेव करू शकते; प्रकाशित करण्यासाठी Admin ची मंजुरी आवश्यक आहे.</p>}
      </div>
    </section>}
  </div>
}

function RevisionAdmin({ revisions, token, saveJson }) {
  const restore = async (id) => {
    if (!window.confirm('Restore this previous version?')) return
    try { await saveJson(`/api/cms/revisions/${id}/restore`, 'POST', {}) } catch (error) { alert(error.message) }
  }
  return <div className="cms-panel"><h2>Revision history</h2><div className="cms-table-wrap"><table className="cms-table"><thead><tr><th>Entity</th><th>Change</th><th>Editor</th><th>Date</th><th></th></tr></thead><tbody>{revisions.map((item) => <tr key={item._id}><td>{item.entityType}</td><td>{item.summary}</td><td>{item.editor?.name || 'Admin'}</td><td>{new Date(item.createdAt).toLocaleString('mr-IN')}</td><td>{item.oldValue && <button className="cms-link" onClick={() => restore(item._id)}>Restore</button>}</td></tr>)}</tbody></table></div></div>
}

function StoryAdmin({ stories, setStories, token }) {
  const [message, setMessage] = useState('')
  const publish = async (id) => {
    setMessage('')
    try {
      const response = await fetch(`/api/stories/${id}/publish`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Story publish करता आली नाही.')
      setStories((current) => current.map((story) => story._id === id ? data.story : story))
      setMessage('Story प्रकाशित झाली.')
    } catch (error) {
      setMessage(error.message)
    }
  }
  return <div className="cms-panel"><h2>Success Story Review</h2>{message && <div className="data-notice" role="status">{message}</div>}<div className="cms-table-wrap"><table className="cms-table"><thead><tr><th>कथा</th><th>उद्योजक / व्यवसाय</th><th>शहर</th><th>स्थिती</th><th></th></tr></thead><tbody>{stories.map((story) => <tr key={story._id}><td>{story.title}<small>{story.summary}</small></td><td>{story.entrepreneurName}<small>{story.businessName}</small></td><td>{story.city}</td><td>{story.isPublished ? 'Published' : 'Review pending'}</td><td>{!story.isPublished && <button className="cms-link" type="button" onClick={() => publish(story._id)}>Publish</button>}</td></tr>)}</tbody></table></div>{!stories.length && <p>Review साठी कथा उपलब्ध नाहीत.</p>}</div>
}

function AnalyticsAdmin({ token }) {
  const [range, setRange] = useState('30')
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    const to = new Date()
    const from = new Date(to.getTime() - (Number(range) - 1) * 24 * 60 * 60 * 1000)
    const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() })
    fetch(`/api/analytics/overview?${params}`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then((response) => response.ok ? response.json() : response.json().then((data) => Promise.reject(new Error(data.message || 'Analytics load failed.'))))
      .then((data) => { setReport(data); setError('') })
      .catch((loadError) => {
        if (loadError.name !== 'AbortError') setError(loadError.message)
      })
    return () => controller.abort()
  }, [range, token])

  if (error) return <div className="cms-panel cms-error" role="alert">{error}</div>
  if (!report) return <div className="cms-loading">Loading analytics…</div>
  const metrics = report.metrics
  const cards = [
    ['Tracked article views', metrics.articleViews],
    ['Unique article visitors', metrics.uniqueArticleVisitors],
    ['Published articles', metrics.publishedArticles],
    ['Draft articles', metrics.draftArticles],
    ['New enquiries', metrics.newEnquiries],
    ['Verified payments', metrics.verifiedPaidPayments],
    ['Verified revenue', metrics.verifiedRevenuePaise == null ? null : `₹${(metrics.verifiedRevenuePaise / 100).toLocaleString('en-IN')}`],
    ['Verified book orders', metrics.verifiedBookOrders],
    ['Book revenue', metrics.verifiedBookRevenuePaise == null ? null : `₹${(metrics.verifiedBookRevenuePaise / 100).toLocaleString('en-IN')}`]
  ]
  const dailyVisitors = report.charts.firstSeenUniqueVisitors || []
  const dailyMax = Math.max(1, ...dailyVisitors.map((point) => point.visitors))
  const bookSalesTrend = report.charts.bookSalesTrend || []
  const bookSalesMax = Math.max(1, ...bookSalesTrend.map((point) => point.revenuePaise))
  const topArticles = report.charts.topArticles || []
  const topMax = Math.max(1, ...topArticles.map((article) => article.totalViews))
  return <div className="cms-analytics">
    <div className="cms-panel cms-analytics-toolbar">
      <div><h2>Analytics Overview</h2><p>Verified records only; unavailable tracking is explicitly identified.</p></div>
      <label>Date range<select value={range} onChange={(event) => setRange(event.target.value)}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select></label>
    </div>
    {!report.hasArticleAnalytics && <div className="cms-empty" role="status">No article analytics data yet. Public article-view tracking is available; page-wide sessions and engagement are not collected.</div>}
    <div className="cms-stat-grid">{cards.map(([label, value]) => <article key={label}><strong>{value == null ? '—' : typeof value === 'number' ? value.toLocaleString('en-IN') : value}</strong><span>{label}</span></article>)}</div>
    <div className="cms-analytics-grid">
      <section className="cms-panel"><h2>First-seen unique article visitors</h2><p className="cms-muted">By first-visit day, India time. Not total page views.</p>
        {dailyVisitors.length ? <div className="cms-bars" role="img" aria-label="Daily first-seen unique article visitors">{dailyVisitors.map((point) => <div className="cms-bar-column" key={point._id}><strong>{point.visitors}</strong><div className="cms-bar" style={{ height: `${Math.max(4, point.visitors / dailyMax * 100)}%` }} /><small>{point._id.slice(5)}</small></div>)}</div> : <div className="cms-empty">No visitor trend data in this date range.</div>}
      </section>
      <section className="cms-panel"><h2>Top viewed articles</h2>
        {topArticles.length ? <div className="cms-rank-list">{topArticles.map((article) => <div key={article.articleId}><div><strong>{article.title}</strong><span>{article.category || 'Uncategorized'} · {article.totalViews.toLocaleString('en-IN')} views</span></div><div className="cms-rank-track"><i style={{ width: `${Math.max(3, article.totalViews / topMax * 100)}%` }} /></div></div>)}</div> : <div className="cms-empty">No article view records yet.</div>}
      </section>
      <section className="cms-panel"><h2>Views by category</h2>
        {report.charts.viewsByCategory.length ? <div className="cms-rank-list">{report.charts.viewsByCategory.map((item) => <div key={item._id || 'uncategorized'}><div><strong>{item._id || 'Uncategorized'}</strong><span>{item.views.toLocaleString('en-IN')} views</span></div></div>)}</div> : <div className="cms-empty">No category view records yet.</div>}
      </section>
      <section className="cms-panel"><h2>Book sales</h2><p className="cms-muted">Server-verified paid orders, by capture date. Amounts in INR.</p>
        {bookSalesTrend.length ? <div className="cms-bars" role="img" aria-label="Daily verified book sales revenue">{bookSalesTrend.map((point) => <div className="cms-bar-column" key={point._id}><strong>₹{(point.revenuePaise / 100).toLocaleString('en-IN')}</strong><div className="cms-bar" style={{ height: `${Math.max(4, point.revenuePaise / bookSalesMax * 100)}%` }} /><small>{point._id.slice(5)}</small></div>)}</div> : <div className="cms-empty">No verified book sales in this date range.</div>}
      </section>
    </div>
    <details className="cms-panel cms-unavailable"><summary>Metrics not collected</summary><p>{report.unavailableMetrics.join(' · ')}</p><small>{report.trackingNote}</small></details>
  </div>
}

function CategoryAdmin({ categories, setCategories, saveJson }) {
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const visible = categories.filter((category) => `${category.name} ${category.slug}`.toLowerCase().includes(search.toLowerCase()))
  const open = (category) => setSelected(category ? structuredClone(category) : { name: '', slug: '', description: '', icon: '', image: '', parentCategory: '', seoTitle: '', seoDescription: '', isActive: true })
  const submit = (event) => {
    event.preventDefault()
    const isExisting = Boolean(selected._id)
    const payload = { ...selected, parentCategory: selected.parentCategory || null }
    saveJson(isExisting ? `/api/cms/categories/${selected._id}` : '/api/cms/categories', isExisting ? 'PUT' : 'POST', payload)
      .then(({ category }) => {
        setCategories((current) => isExisting ? current.map((item) => item._id === category._id ? category : item) : [...current, category])
        setSelected(null)
      })
      .catch((error) => alert(error.message))
  }
  const toggle = (category) => saveJson(`/api/cms/categories/${category._id}/status`, 'PATCH', { isActive: !category.isActive })
    .then(({ category: updated }) => setCategories((current) => current.map((item) => item._id === updated._id ? { ...item, ...updated } : item)))
    .catch((error) => alert(error.message))
  if (selected) return <form className="cms-panel cms-form" onSubmit={submit}>
    <div className="cms-editor-head"><h2>{selected._id ? 'Edit category' : 'Create category'}</h2><button type="button" className="cms-secondary" onClick={() => setSelected(null)}>Cancel</button></div>
    <div className="cms-grid">
      <label>Name<input required value={selected.name} onChange={(event) => setSelected({ ...selected, name: event.target.value })} /></label>
      <label>Slug<input required value={selected.slug} onChange={(event) => setSelected({ ...selected, slug: event.target.value })} /></label>
      <label>Parent category<select value={selected.parentCategory?._id || selected.parentCategory || ''} onChange={(event) => setSelected({ ...selected, parentCategory: event.target.value })}><option value="">None</option>{categories.filter((item) => item._id !== selected._id).map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label>
      <label>Icon / icon name<input value={selected.icon || ''} onChange={(event) => setSelected({ ...selected, icon: event.target.value })} /></label>
      <label className="cms-span">Description<textarea rows="3" value={selected.description || ''} onChange={(event) => setSelected({ ...selected, description: event.target.value })} /></label>
      <label>Image URL<input value={selected.image || ''} onChange={(event) => setSelected({ ...selected, image: event.target.value })} /></label>
      <label>SEO title<input value={selected.seoTitle || ''} onChange={(event) => setSelected({ ...selected, seoTitle: event.target.value })} /></label>
      <label className="cms-span">SEO description<textarea rows="3" value={selected.seoDescription || ''} onChange={(event) => setSelected({ ...selected, seoDescription: event.target.value })} /></label>
      {selected._id && <label className="cms-check"><input type="checkbox" checked={Boolean(selected.isActive)} onChange={(event) => setSelected({ ...selected, isActive: event.target.checked })} /> Active</label>}
    </div>
    <button className="cms-primary" type="submit">Save category</button>
  </form>
  return <div className="cms-panel">
    <div className="cms-editor-head"><div><h2>Category Manager</h2><p className="cms-muted">Article counts use existing database records. Categories with articles are archived, not deleted.</p></div><button className="cms-primary" type="button" onClick={() => open(null)}>Create category</button></div>
    <label className="cms-search">Search categories<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or slug" /></label>
    <div className="cms-table-wrap"><table className="cms-table"><thead><tr><th>Name</th><th>Slug</th><th>Articles</th><th>Status</th><th>Actions</th></tr></thead><tbody>{visible.map((category) => <tr key={category._id}><td>{category.name}</td><td>/{category.slug}</td><td>{category.articleCount ?? '—'}</td><td>{category.isActive ? 'Active' : 'Archived'}</td><td><button className="cms-link" type="button" onClick={() => open(category)}>Edit</button><button className="cms-link" type="button" onClick={() => toggle(category)}>{category.isActive ? 'Archive' : 'Restore'}</button></td></tr>)}</tbody></table></div>
    {!visible.length && <div className="cms-empty">No matching categories.</div>}
  </div>
}

function UserRoleAdmin({ users, setUsers, saveJson, role }) {
  const [search, setSearch] = useState('')
  const visible = users.filter((user) => `${user.name} ${user.email || ''} ${user.mobile || ''}`.toLowerCase().includes(search.toLowerCase()))
  const updateUser = (user, fields) => saveJson(`/api/admin/users/${user._id}`, 'PUT', fields)
    .then(({ user: updated }) => setUsers((current) => current.map((item) => item._id === updated._id ? updated : item)))
    .catch((error) => alert(error.message))
  const roles = ['user', 'admin', 'super_admin', 'content_editor', 'design_manager', 'viewer', 'analyst', 'store_manager']
  return <div className="cms-panel">
    <div className="cms-editor-head"><div><h2>Users & Roles</h2><p className="cms-muted">Role changes are enforced by the API. Only Super Admin can change roles.</p></div></div>
    <label className="cms-search">Search users<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, email or mobile" /></label>
    <div className="cms-table-wrap"><table className="cms-table"><thead><tr><th>User</th><th>Contact</th><th>Role</th><th>Status</th><th>Action</th></tr></thead><tbody>{visible.map((user) => <tr key={user._id}><td>{user.name}</td><td>{user.email || user.mobile || '—'}</td><td>{role === 'super_admin' ? <select aria-label={`Role for ${user.name}`} value={user.role} onChange={(event) => updateUser(user, { role: event.target.value })}>{roles.map((item) => <option key={item} value={item}>{item.replace('_', ' ')}</option>)}</select> : user.role}</td><td>{user.isActive ? 'Active' : 'Inactive'}</td><td>{user._id !== localStorage.getItem('marathiUdyojakUserId') && <button className="cms-link" type="button" onClick={() => updateUser(user, { isActive: !user.isActive })}>{user.isActive ? 'Deactivate' : 'Activate'}</button>}</td></tr>)}</tbody></table></div>
    {!visible.length && <div className="cms-empty">No users found.</div>}
  </div>
}

function AuditLogAdmin({ logs }) {
  return <div className="cms-panel"><div className="cms-editor-head"><div><h2>Audit Logs</h2><p className="cms-muted">Sensitive values and credentials are not stored in audit entries.</p></div></div>
    <div className="cms-table-wrap"><table className="cms-table"><thead><tr><th>Action</th><th>Record</th><th>Performed by</th><th>Date</th></tr></thead><tbody>{logs.map((log) => <tr key={log._id}><td>{log.action}</td><td>{log.summary}</td><td>{log.actor?.name || 'Unknown'}</td><td>{new Date(log.createdAt).toLocaleString('en-IN')}</td></tr>)}</tbody></table></div>
    {!logs.length && <div className="cms-empty">No audit records yet.</div>}
  </div>
}

function BookAdmin({ books, setBooks, token }) {
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const open = (book) => setSelected(book ? {
    ...structuredClone(book),
    price: ((book.pricePaise || 0) / 100).toFixed(2),
    salePrice: book.salePricePaise == null ? '' : (book.salePricePaise / 100).toFixed(2),
    stock: book.stock ?? 0,
    shippingWeightGrams: book.shippingWeightGrams ?? 0
  } : {
    title: '', slug: '', author: '', description: '', language: 'Marathi', isbn: '',
    category: '', coverImage: '', productType: 'physical', price: '', salePrice: '',
    stock: 0, sku: '', shippingWeightGrams: 0, status: 'draft',
    seoTitle: '', seoDescription: '', digitalFileUrl: ''
  })
  const submit = async (event) => {
    event.preventDefault()
    setError('')
    const formData = new FormData()
    const file = event.currentTarget.elements.cover.files?.[0]
    const payload = {
      ...selected,
      pricePaise: Math.round(Number(selected.price) * 100),
      salePricePaise: selected.salePrice === '' ? null : Math.round(Number(selected.salePrice) * 100),
      stock: Number(selected.stock),
      shippingWeightGrams: Number(selected.shippingWeightGrams)
    }
    delete payload.price
    delete payload.salePrice
    formData.append('book', JSON.stringify(payload))
    if (file) formData.append('cover', file)
    try {
      const response = await fetch(selected._id ? `/api/store/admin/books/${selected._id}` : '/api/store/admin/books', {
        method: selected._id ? 'PUT' : 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Book could not be saved.')
      setBooks((current) => selected._id
        ? current.map((item) => item._id === data.book._id ? data.book : item)
        : [data.book, ...current])
      setSelected(null)
    } catch (saveError) {
      setError(saveError.message)
    }
  }
  const changeStatus = async (book, status) => {
    setError('')
    try {
      const response = await fetch(`/api/store/admin/books/${book._id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Book status could not be updated.')
      setBooks((current) => current.map((item) => item._id === book._id ? data.book : item))
    } catch (statusError) {
      setError(statusError.message)
    }
  }
  if (selected) return <form className="cms-panel cms-form" onSubmit={(event) => submit(event).catch((saveError) => setError(saveError.message))}>
    <div className="cms-editor-head"><h2>{selected._id ? 'Edit book' : 'Add book'}</h2><button className="cms-secondary" type="button" onClick={() => setSelected(null)}>Cancel</button></div>
    {error && <div className="cms-error" role="alert">{error}</div>}
    <div className="cms-grid">
      <label>Title<input required value={selected.title} onChange={(event) => setSelected({ ...selected, title: event.target.value })} /></label>
      <label>Slug<input required value={selected.slug} onChange={(event) => setSelected({ ...selected, slug: event.target.value })} /></label>
      <label>Author<input required value={selected.author} onChange={(event) => setSelected({ ...selected, author: event.target.value })} /></label>
      <label>Category<input value={selected.category || ''} onChange={(event) => setSelected({ ...selected, category: event.target.value })} /></label>
      <label>Language<input value={selected.language || ''} onChange={(event) => setSelected({ ...selected, language: event.target.value })} /></label>
      <label>ISBN<input value={selected.isbn || ''} onChange={(event) => setSelected({ ...selected, isbn: event.target.value })} /></label>
      <label>SKU<input value={selected.sku || ''} onChange={(event) => setSelected({ ...selected, sku: event.target.value })} /></label>
      <label>Product type<select value={selected.productType || 'physical'} onChange={(event) => setSelected({ ...selected, productType: event.target.value })}><option value="physical">Physical</option><option value="digital">Digital</option></select></label>
      <label>Description<textarea required rows="6" value={selected.description || ''} onChange={(event) => setSelected({ ...selected, description: event.target.value })} /></label>
      <label>Cover image URL<input value={selected.coverImage || ''} onChange={(event) => setSelected({ ...selected, coverImage: event.target.value })} /></label>
      <label>Upload cover<input name="cover" type="file" accept="image/jpeg,image/png,image/webp" /></label>
      <label>Price (INR)<input required type="number" min="0.01" step="0.01" value={selected.price} onChange={(event) => setSelected({ ...selected, price: event.target.value })} /></label>
      <label>Sale price (INR)<input type="number" min="0.01" step="0.01" value={selected.salePrice} onChange={(event) => setSelected({ ...selected, salePrice: event.target.value })} /></label>
      {selected.productType === 'physical' && <><label>Stock<input type="number" min="0" step="1" value={selected.stock} onChange={(event) => setSelected({ ...selected, stock: event.target.value })} /></label><label>Shipping weight (grams)<input type="number" min="0" step="1" value={selected.shippingWeightGrams} onChange={(event) => setSelected({ ...selected, shippingWeightGrams: event.target.value })} /></label></>}
      {selected.productType === 'digital' && <label className="cms-span">Private file URL<input value={selected.digitalFileUrl || ''} onChange={(event) => setSelected({ ...selected, digitalFileUrl: event.target.value })} /><small>Digital fulfillment is disabled until private file delivery is configured.</small></label>}
      <label>Status<select value={selected.status || 'draft'} onChange={(event) => setSelected({ ...selected, status: event.target.value })}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label>
      <label>SEO title<input value={selected.seoTitle || ''} onChange={(event) => setSelected({ ...selected, seoTitle: event.target.value })} /></label>
      <label className="cms-span">SEO description<textarea rows="3" value={selected.seoDescription || ''} onChange={(event) => setSelected({ ...selected, seoDescription: event.target.value })} /></label>
    </div>
    {selected.coverImage && <img className="cms-book-preview" src={selected.coverImage} alt="Book cover preview" />}
    <button className="cms-primary" type="submit">Save book</button>
  </form>
  const visible = books.filter((book) => `${book.title} ${book.author} ${book.sku || ''}`.toLowerCase().includes(search.toLowerCase()))
  return <div className="cms-panel">
    <div className="cms-editor-head"><div><h2>Book Store</h2><p className="cms-muted">No sample products are inserted. Digital delivery remains unavailable until private storage is configured.</p></div><button className="cms-primary" type="button" onClick={() => open(null)}>Add book</button></div>
    {error && <div className="cms-error" role="alert">{error}</div>}
    <label className="cms-search">Search books<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Title, author or SKU" /></label>
    <div className="cms-table-wrap"><table className="cms-table"><thead><tr><th>Book</th><th>Type</th><th>Price</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead><tbody>{visible.map((book) => <tr key={book._id}><td>{book.title}<small>{book.author} · {book.sku || 'No SKU'}</small></td><td>{book.productType}</td><td>₹{((book.salePricePaise ?? book.pricePaise) / 100).toFixed(2)}</td><td>{book.productType === 'physical' ? `${book.stock - (book.reservedStock || 0)} available` : '—'}</td><td>{book.status}</td><td><button className="cms-link" type="button" onClick={() => open(book)}>Edit</button>{book.status !== 'archived' ? <button className="cms-link" type="button" onClick={() => changeStatus(book, 'archived')}>Archive</button> : <button className="cms-link" type="button" onClick={() => changeStatus(book, 'draft')}>Restore</button>}</td></tr>)}</tbody></table></div>
    {!visible.length && <div className="cms-empty">No books found.</div>}
  </div>
}

function OrdersAdmin({ orders, token, setOrders }) {
  const [error, setError] = useState('')
  const updateStatus = async (order, fulfillmentStatus) => {
    setError('')
    try {
      const response = await fetch(`/api/store/admin/orders/${order._id}/fulfillment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fulfillmentStatus })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Order status could not be updated.')
      setOrders((current) => current.map((item) => item._id === order._id ? data.order : item))
    } catch (updateError) {
      setError(updateError.message)
    }
  }
  return <div className="cms-panel"><div className="cms-editor-head"><div><h2>Orders & Payments</h2><p className="cms-muted">Payment status comes only from server-verified Razorpay captures. Refund actions are not enabled.</p></div></div>
    {error && <div className="cms-error" role="alert">{error}</div>}
    <div className="cms-table-wrap"><table className="cms-table"><thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Amount</th><th>Payment</th><th>Fulfillment</th></tr></thead><tbody>{orders.map((order) => {
      const fulfillmentOptions = order.fulfillmentStatus === 'unfulfilled'
        ? ['unfulfilled', 'processing']
        : order.fulfillmentStatus === 'processing'
        ? ['processing', 'shipped', 'delivered']
        : order.fulfillmentStatus === 'shipped'
          ? ['shipped', 'delivered']
          : ['delivered']
      return <tr key={order._id}><td>{order.orderNumber}<small>{new Date(order.createdAt).toLocaleString('en-IN')}</small></td><td>{order.customerName}<small>{order.customerEmail} · {order.customerPhone}</small></td><td>{order.items.map((item) => `${item.title} × ${item.quantity}`).join(', ')}</td><td>₹{(order.amountPaise / 100).toFixed(2)}</td><td>{order.paymentStatus}</td><td>{order.paymentStatus === 'paid' ? <select aria-label={`Fulfillment status for ${order.orderNumber}`} value={order.fulfillmentStatus} onChange={(event) => updateStatus(order, event.target.value)}>{fulfillmentOptions.map((status) => <option key={status} value={status}>{status}</option>)}</select> : order.fulfillmentStatus}</td></tr>
    })}</tbody></table></div>
    {!orders.length && <div className="cms-empty">No book orders yet.</div>}
  </div>
}

function AdminDashboard() {
  const token = localStorage.getItem('marathiUdyojakToken')
  const navigate = useNavigate()
  const [active, setActive] = useState('overview')
  const [user, setUser] = useState(null)
  const [profileLoading, setProfileLoading] = useState(Boolean(token))
  const [statistics, setStatistics] = useState(null)
  const [message, setMessage] = useState('')
  const [settings, setSettings] = useSettingsAdmin(token, active === 'settings')
  const [content, setContent] = useCmsCollection('/api/cms/content', token, 'content', active === 'global')
  const [pages, setPages] = useCmsCollection('/api/cms/pages', token, 'pages', active === 'pages')
  const [sections, setSections] = useCmsCollection('/api/cms/homepage', token, 'sections', active === 'homepage')
  const [navigation, setNavigation] = useCmsCollection('/api/cms/navigation', token, 'menus', active === 'navigation')
  const [articles, setArticles] = useCmsCollection('/api/cms/articles?limit=100', token, 'articles', active === 'articles' || active === 'homepage' || active === 'ai-assistant')
  const [media, setMedia] = useCmsCollection('/api/cms/media', token, 'media', active === 'media')
  const [revisions, setRevisions] = useCmsCollection('/api/cms/revisions', token, 'revisions', active === 'revisions')
  const [stories, setStories] = useCmsCollection('/api/stories/admin', token, 'stories', active === 'stories')
  const [categories, setCategories] = useCmsCollection('/api/cms/categories', token, 'categories', active === 'categories' || active === 'ai-assistant')
  const [users, setUsers] = useCmsCollection('/api/admin/users?limit=100', token, 'users', active === 'users')
  const [auditLogs, setAuditLogs] = useCmsCollection('/api/admin/audit?limit=100', token, 'logs', active === 'audit')
  const [books, setBooks] = useCmsCollection('/api/store/admin/books?limit=100', token, 'books', active === 'store')
  const [orders, setOrders] = useCmsCollection('/api/store/admin/orders?limit=100', token, 'orders', active === 'orders')

  useEffect(() => {
    if (!token) return
    const controller = new AbortController()
    fetch('/api/users/profile', { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Your session has expired. Please sign in again.')))
      .then(({ user: currentUser }) => {
        setUser(currentUser)
        localStorage.setItem('marathiUdyojakUser', JSON.stringify(currentUser))
        localStorage.setItem('marathiUdyojakUserId', currentUser._id || currentUser.id || '')
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setMessage(error.message)
      })
      .finally(() => setProfileLoading(false))
    return () => controller.abort()
  }, [token])

  const menu = [
    { key: 'overview', label: 'Dashboard Overview', permission: 'analytics:read' },
    { key: 'analytics', label: 'Analytics / Reports', permission: 'analytics:read' },
    { key: 'articles', label: 'Article Manager', permission: 'articles:read' },
    { key: 'create-article', label: 'Create New Article', permission: 'articles:write' },
    { key: 'ai-assistant', label: 'AI Content Assistant', permission: 'articles:write' },
    { key: 'homepage', label: 'Homepage Manager', permission: 'homepage:read' },
    { key: 'categories', label: 'Category Manager', permission: 'categories:read' },
    { key: 'pages', label: 'Page Manager', permission: 'pages:read' },
    { key: 'navigation', label: 'Navigation Manager', permission: 'navigation:read' },
    { key: 'settings', label: 'Website Settings', permission: 'settings:read' },
    { key: 'storage', label: 'Database & Storage', permission: 'settings:read' },
    { key: 'global', label: 'Global Content', permission: 'global:read' },
    { key: 'stories', label: 'Success Stories', permission: 'stories:read' },
    { key: 'media', label: 'Media Library', permission: 'media:read' },
    { key: 'store', label: 'Book Store', permission: 'store:read' },
    { key: 'orders', label: 'Orders & Payments', permission: 'orders:read' },
    { key: 'users', label: 'Users & Roles', permission: 'users:read' },
    { key: 'revisions', label: 'Revision History', permission: 'revisions:read' },
    { key: 'audit', label: 'Audit Logs', permission: 'audit:read' }
  ]
  const rolePermissions = {
    super_admin: ['*'],
    admin: ['*'],
    content_editor: ['analytics:read', 'articles:read', 'articles:write', 'categories:read', 'categories:write', 'homepage:read', 'homepage:write', 'media:read', 'media:write', 'pages:read', 'pages:write', 'revisions:read', 'revisions:restore', 'stories:read', 'stories:write'],
    design_manager: ['analytics:read', 'categories:read', 'global:read', 'global:write', 'homepage:read', 'homepage:write', 'media:read', 'media:write', 'navigation:read', 'navigation:write', 'pages:read', 'pages:write', 'revisions:read', 'revisions:restore', 'settings:read', 'settings:write'],
    viewer: ['analytics:read'],
    analyst: ['analytics:read'],
    store_manager: ['orders:read', 'orders:write', 'store:read', 'store:write']
  }
  const permittedMenu = user ? menu.filter((item) => {
    const permissions = rolePermissions[user.role] || []
    return permissions.includes('*') || permissions.includes(item.permission)
  }) : []

  useEffect(() => {
    if (permittedMenu.length && !permittedMenu.some((item) => item.key === active)) setActive(permittedMenu[0].key)
  }, [active, permittedMenu.map((item) => item.key).join('|')])

  useEffect(() => {
    if (!token || !user || !['admin', 'super_admin'].includes(user.role)) return
    const controller = new AbortController()
    fetch('/api/admin/dashboard', { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Dashboard counts could not be loaded.')))
      .then((data) => setStatistics(data.statistics))
      .catch((error) => {
        if (error.name !== 'AbortError') setMessage(error.message)
      })
    return () => controller.abort()
  }, [token, user])

  const saveJson = async (url, method, body) => {
    setMessage('')
    const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) })
    const data = await response.json()
    if (!response.ok) throw new Error(data.message || 'Save अयशस्वी.')
    setMessage('Saved successfully.')
    return data
  }

  if (!token) return <section className="section"><div className="container"><div className="data-notice">Admin accessासाठी लॉगिन करा. <Link to="/auth" state={{ from: '/admin' }}>लॉगिन</Link></div></div></section>
  if (profileLoading) return <section className="cms-admin"><main className="cms-main"><div className="cms-loading">Verifying admin access…</div></main></section>
  if (!user) return <section className="cms-admin"><main className="cms-main"><div className="cms-panel cms-error" role="alert">{message || 'Admin access required.'} <Link to="/auth" state={{ from: '/admin' }}>Sign in</Link></div></main></section>
  if (!permittedMenu.length) return <section className="cms-admin"><main className="cms-main"><div className="cms-panel cms-error" role="alert">This account does not have CMS permissions. Contact a Super Admin.</div></main></section>
  const activeMenuItem = permittedMenu.find((item) => item.key === active) || permittedMenu[0]
  const logout = () => {
    localStorage.removeItem('marathiUdyojakToken')
    localStorage.removeItem('marathiUdyojakUser')
    localStorage.removeItem('marathiUdyojakUserId')
    navigate('/auth', { replace: true })
  }

  return <section className="cms-admin">
    <aside className="cms-sidebar">
      <div className="cms-brand"><strong>मराठी<span>उद्योजक</span></strong><small>CMS Admin</small></div>
      <nav aria-label="CMS sections">{permittedMenu.map(({ key, label }) => <button key={key} className={active === key ? 'active' : ''} aria-current={active === key ? 'page' : undefined} onClick={() => setActive(key)}>{label}</button>)}</nav>
    </aside>
    <main className="cms-main">
      <header className="cms-topbar"><div><small>Management Console · {user.role.replace('_', ' ')}</small><h1>{activeMenuItem.label}</h1></div><div className="cms-topbar-actions">{message && <div className="cms-message" role="status">{message}</div>}<button type="button" className="cms-secondary" onClick={logout}>Sign out</button></div></header>
      {active === 'overview' && <>{statistics && <CmsOverview statistics={statistics} />}<AnalyticsAdmin token={token} /></>}
      {active === 'analytics' && <AnalyticsAdmin token={token} />}
      {active === 'settings' && <WebsiteSettingsAdmin settings={settings} setSettings={setSettings} saveJson={saveJson} />}
      {active === 'storage' && <StorageAdmin token={token} />}
      {active === 'global' && <GlobalContentAdmin content={content} setContent={setContent} saveJson={saveJson} />}
      {active === 'pages' && <PageAdmin pages={pages} setPages={setPages} saveJson={saveJson} />}
      {active === 'articles' && <ArticleAdmin articles={articles} setArticles={setArticles} token={token} role={user.role} />}
      {active === 'create-article' && <ArticleAdmin articles={articles} setArticles={setArticles} token={token} role={user.role} initialCreate />}
      {active === 'ai-assistant' && <AiContentAdmin token={token} role={user.role} articles={articles} categories={categories} setArticles={setArticles} setMedia={setMedia} />}
      {active === 'homepage' && <><BusinessEssentialsAdmin sections={sections} setSections={setSections} saveJson={saveJson} /><HomepageAdmin sections={sections} setSections={setSections} articles={articles} saveJson={saveJson} /></>}
      {active === 'categories' && <CategoryAdmin categories={categories} setCategories={setCategories} saveJson={saveJson} />}
      {active === 'navigation' && <NavigationAdmin menus={navigation} setMenus={setNavigation} saveJson={saveJson} />}
      {active === 'stories' && <StoryAdmin stories={stories} setStories={setStories} token={token} />}
      {active === 'media' && <MediaAdmin media={media} setMedia={setMedia} token={token} />}
      {active === 'store' && <BookAdmin books={books} setBooks={setBooks} token={token} />}
      {active === 'orders' && <OrdersAdmin orders={orders} setOrders={setOrders} token={token} />}
      {active === 'users' && <UserRoleAdmin users={users} setUsers={setUsers} saveJson={saveJson} role={user.role} />}
      {active === 'revisions' && <RevisionAdmin revisions={revisions} token={token} saveJson={saveJson} />}
      {active === 'audit' && <AuditLogAdmin logs={auditLogs} />}
    </main>
  </section>
}

function Auth() {
  const navigate = useNavigate()
  const location = useLocation()
  const [mode, setMode] = useState('login')
  const [status, setStatus] = useState({ saving: false, message: '' })
  const submit = async (event) => {
    event.preventDefault()
    setStatus({ saving: true, message: '' })
    const form = new FormData(event.currentTarget)
    const identifier = form.get('identifier')
    const payload = mode === 'register'
      ? { name: form.get('name'), email: identifier.includes('@') ? identifier : undefined, mobile: identifier.includes('@') ? undefined : identifier, password: form.get('password') }
      : { identifier, password: form.get('password') }
    try {
      const response = await fetch(`/api/auth/${mode === 'register' ? 'register' : 'login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Authentication अयशस्वी.')
      if (data.token) {
        localStorage.setItem('marathiUdyojakToken', data.token)
        localStorage.setItem('marathiUdyojakUser', JSON.stringify(data.user || {}))
        localStorage.setItem('marathiUdyojakUserId', data.user?.id || '')
      }
      setStatus({ saving: false, message: mode === 'login' ? 'लॉगिन सफल झाले.' : 'नवीन खाते तयार झाले.' })
      if (data.token) {
        const adminRoles = ['admin', 'super_admin', 'content_editor', 'design_manager', 'viewer', 'analyst', 'store_manager']
        const requestedDestination = location.state?.from
        const destination = requestedDestination === '/admin' && !adminRoles.includes(data.user?.role)
          ? '/'
          : requestedDestination || (adminRoles.includes(data.user?.role) ? '/admin' : '/')
        navigate(destination, { replace: true })
      }
    } catch (error) {
      setStatus({ saving: false, message: error.message })
    }
  }
  return <><section className="auth-section"><div className="auth-card"><div className="auth-brand"><Sprout /><strong>मराठी<span>उद्योजक</span></strong></div><h1>{mode === 'login' ? 'लॉगिन करा' : 'नवीन खाते तयार करा'}</h1><p>{mode === 'login' ? 'तुमच्या व्यवसाय प्रोफाइलमध्ये प्रवेश करा.' : 'व्यवसाय नोंदणी आणि मार्गदर्शनासाठी नोंदणी करा.'}</p><form onSubmit={submit}>{mode === 'register' && <label>पूर्ण नाव<input name="name" required placeholder="तुमचे नाव" /></label>}<label>ईमेल किंवा मोबाइल<input name="identifier" required placeholder="ईमेल / मोबाइल" /></label><label>पासवर्ड<input name="password" required type="password" minLength="8" placeholder="पासवर्ड" /></label>{status.message && <div className="data-notice">{status.message}</div>}<button type="submit" disabled={status.saving}>{status.saving ? 'प्रक्रिया सुरू…' : mode === 'login' ? 'लॉगिन' : 'नोंदणी करा'}</button></form><button className="mode-switch" onClick={() => { setStatus({ saving: false, message: '' }); setMode(mode === 'login' ? 'register' : 'login') }}>{mode === 'login' ? 'नवीन खाते तयार करा' : 'आधीच खाते आहे? लॉगिन करा'}</button></div></section></>
}

let razorpayScriptPromise
function loadRazorpayCheckout() {
  if (window.Razorpay) return Promise.resolve()
  if (!razorpayScriptPromise) {
    razorpayScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.onload = () => window.Razorpay ? resolve() : reject(new Error('Razorpay checkout load झाले नाही.'))
      script.onerror = () => reject(new Error('Razorpay checkout उपलब्ध नाही.'))
      document.body.appendChild(script)
    }).catch((error) => {
      razorpayScriptPromise = null
      throw error
    })
  }
  return razorpayScriptPromise
}

function App() {
  return (
    <BrowserRouter>
      <WebsiteSettingsProvider>
        <AppContent />
      </WebsiteSettingsProvider>
    </BrowserRouter>
  )
}

function AppContent() {
  const location = useLocation()
  const settings = useWebsiteSettings()
  const isAdminRoute = location.pathname === '/admin' || location.pathname.startsWith('/admin/')
  const isHomeRoute = location.pathname === '/'
  const isCategoryArchiveRoute = /^\/category\/[^/]+\/?$/.test(location.pathname) || /^\/business-loans\/?$/.test(location.pathname)
  const isInnerPage = !isHomeRoute && !isAdminRoute
  useEffect(() => {
    if (settings.design?.primaryColor) document.documentElement.style.setProperty('--green', settings.design.primaryColor)
    if (settings.design?.accentColor) document.documentElement.style.setProperty('--orange', settings.design.accentColor)
    if (settings.design?.backgroundColor) document.documentElement.style.setProperty('--page-bg', settings.design.backgroundColor)
  }, [settings])
  return (
    <div className={`${isHomeRoute ? 'home-page-shell' : ''}${isCategoryArchiveRoute ? ' category-page-shell' : ''}${isInnerPage ? ' inner-page-shell' : ''}`.trim() || undefined}>
      <GoogleAnalytics />
      <SeoHead />
      {!isAdminRoute && <Header />}
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/business-ideas" element={<BusinessIdeas />} />
          <Route path="/business-ideas/:id" element={<BusinessDetails />} />
          <Route path="/add-idea" element={<AddBusinessIdea />} />
          <Route path="/business-licenses" element={<BusinessEssentialsPage />} />
          <Route path="/business-loans" element={<CategoryArchive categoryName="Business Loans" />} />
          <Route path="/business-setup" element={<BusinessEssentialsPage />} />
          <Route path="/government-schemes" element={<BusinessEssentialsPage />} />
          <Route path="/machinery-equipment" element={<BusinessEssentialsPage />} />
          <Route path="/franchise-opportunities" element={<BusinessEssentialsPage />} />
          <Route path="/schemes" element={<GovernmentSchemes />} />
          <Route path="/schemes/:id" element={<SchemeDetails />} />
          <Route path="/guidance" element={<Guidance />} />
          <Route path="/stories" element={<SuccessStories />} />
          <Route path="/stories/:id" element={<SuccessStoryDetails />} />
          <Route path="/add-story" element={<AddStory />} />
          <Route path="/articles" element={<Articles />} />
          <Route path="/all-posts" element={<Articles />} />
          <Route path="/category/:slug" element={<CategoryArchive />} />
          <Route path="/articles/:id" element={<ArticleDetails />} />
          <Route path="/directory" element={<BusinessDirectory />} />
          <Route path="/directory/:id" element={<BusinessDirectoryDetails />} />
          <Route path="/add-business" element={<AddBusiness />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/about-us" element={<About />} />
          <Route path="/contact-us" element={<Contact />} />
          <Route path="/faq" element={<FooterContentPage />} />
          <Route path="/privacy-policy" element={<FooterContentPage />} />
          <Route path="/privacy-policy-2" element={<PageDetails />} />
          <Route path="/terms-and-conditions" element={<FooterContentPage />} />
          <Route path="/dmca-notice" element={<FooterContentPage />} />
          <Route path="/affiliate-disclosure-marathi-udyojak" element={<FooterContentPage />} />
          <Route path="/marathi-udyojak-whatsapp-group-telegram-group-facebook-group-udyojak-online" element={<PageDetails />} />
          <Route path="/page/:slug" element={<PageDetails />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/promotions" element={<PromotionsPage />} />
          <Route path="/books" element={<BookStorefront />} />
          <Route path="/books/:slug" element={<BookDetailsPage />} />
          <Route path="/cart" element={<BookCartPage />} />
          <Route path="/checkout" element={<BookCheckoutPage />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
      </main>
      {!isAdminRoute && <Footer />}
    </div>
  )
}

export default App
