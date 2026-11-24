import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

export default function NewsTicker({ items = [], label = 'LATEST', containerLabel = false }) {
  const [titles, setTitles] = useState(items)
  const [error, setError] = useState('')
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    if (items.length) return
    const controller = new AbortController()
    fetch('/api/articles/latest?limit=5', { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Latest articles unavailable')))
      .then((data) => {
        setTitles((data.articles || []).map((article) => ({
          id: article.slug || article._id,
          title: article.title
        })))
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setTitles([])
          setError('ताजे लेख सध्या उपलब्ध नाहीत.')
        }
      })
    return () => controller.abort()
  }, [])

  const orderedTitles = titles.length
    ? titles.map((_, index) => titles[(index + offset) % titles.length])
    : titles

  const tickerContent = (
    <>
      <div className="reference-news-label">{label}</div>
      <div className="reference-news-track">
        <div className="reference-news-items" aria-live="polite">
          {!titles.length && <span>{error || 'नवीन लेख उपलब्ध नाहीत'}</span>}
          {orderedTitles.map((item, index) => (
            typeof item === 'string'
              ? <span key={`${item}-${index}`}>{item}</span>
              : <Link key={item.id} to={`/articles/${item.id}`}>{item.title}</Link>
          ))}
        </div>
        <div className="reference-news-controls">
          <button type="button" aria-label="मागील बातमी" disabled={!titles.length} onClick={() => setOffset((value) => (value + titles.length - 1) % titles.length)}>‹</button>
          <button type="button" aria-label="पुढील बातमी" disabled={!titles.length} onClick={() => setOffset((value) => (value + 1) % titles.length)}>›</button>
        </div>
      </div>
    </>
  )

  return (
    <div className={`reference-news-ticker${containerLabel ? ' reference-news-ticker-contained' : ''}`} role="region" aria-label="ताजे लेख">
      {containerLabel ? <div className="reference-news-ticker-inner">{tickerContent}</div> : tickerContent}
    </div>
  )
}
