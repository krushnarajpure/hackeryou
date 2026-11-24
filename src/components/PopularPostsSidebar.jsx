import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock3 } from 'lucide-react'
import logoUrl from '../image/fallback-logo.svg'

export default function PopularPostsSidebar({ title = 'Popular' }) {
  const [state, setState] = useState({ status: 'loading', articles: [] })

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/articles/popular?limit=5', { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.message || `Popular articles unavailable (${response.status})`)
        if (!Array.isArray(data.articles)) throw new Error('Popular articles response is invalid')
        return data.articles
      })
      .then((articles) => setState({ status: 'success', articles }))
      .catch((error) => {
        if (error.name === 'AbortError') return
        console.error('Popular articles request failed:', error)
        setState({ status: 'error', articles: [] })
      })

    return () => controller.abort()
  }, [])

  const articles = state.articles
    .map((article) => {
      const timestamp = article.publicationDate ? new Date(article.publicationDate) : null
      return {
        id: article.slug || article._id,
        title: article.title,
        image: article.featuredImage || article.ogImage || article.image || logoUrl,
        date: timestamp && !Number.isNaN(timestamp.getTime())
          ? timestamp.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
          : 'अलीकडील'
      }
    })
    .filter((article) => article.id && article.title)

  return (
    <aside className="reference-popular-sidebar">
      <h2>{title}</h2>
      {state.status === 'loading' && <p className="reference-popular-message" role="status">Popular लेख लोड होत आहेत…</p>}
      {state.status === 'error' && <p className="reference-popular-message" role="alert">Popular लेख सध्या उपलब्ध नाहीत.</p>}
      {state.status === 'success' && !articles.length && <p className="reference-popular-message">Popular लेख उपलब्ध नाहीत.</p>}
      {state.status === 'success' && articles.length > 0 && (
        <div className="reference-popular-list">
          {articles.slice(0, 5).map((article) => (
            <Link key={article.id} to={`/articles/${article.id}`}>
              <img
                src={article.image}
                alt=""
                loading="lazy"
                onError={(event) => {
                  if (event.currentTarget.dataset.fallback !== 'true') {
                    event.currentTarget.dataset.fallback = 'true'
                    event.currentTarget.src = logoUrl
                  }
                }}
              />
              <div>
                <strong>{article.title}</strong>
                <time><Clock3 size={12} aria-hidden="true" />{article.date}</time>
              </div>
            </Link>
          ))}
        </div>
      )}
    </aside>
  )
}
