import PopularPostsSidebar from './PopularPostsSidebar'
import logoUrl from '../image/fallback-logo.svg'
import ArticleAuthor, { ArticleAuthorLogo } from './ArticleAuthor'
import { useState } from 'react'

export default function ArticleDetailLayout({
  header,
  image,
  imageAlt,
  intro,
  children,
  relatedItems,
  variant,
  socialLinks,
  articleSlug,
  onCommentCountChange,
}) {
  const articleDetail = variant === 'article'
  const [commentState, setCommentState] = useState({ status: 'idle', message: '' })
  const submitComment = async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    setCommentState({ status: 'saving', message: '' })
    try {
      const response = await fetch(`/api/articles/${encodeURIComponent(articleSlug)}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.get('name'),
          email: formData.get('email'),
          website: formData.get('website'),
          message: formData.get('message')
        })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'टिप्पणी सेव करता आली नाही.')
      form.reset()
      if (Number.isFinite(data.commentCount)) onCommentCountChange?.(data.commentCount)
      setCommentState({ status: 'success', message: data.message })
    } catch (error) {
      setCommentState({ status: 'error', message: error.message })
    }
  }

  return (
    <section className={`reference-detail-page${articleDetail ? ' article-detail-page' : ''}`}>
      <div className="container reference-detail-grid">
        <article className="reference-article-column">
          {header}
          {image && (
            <img
              className="reference-featured-image"
              src={image}
              alt={imageAlt || ''}
              onError={(event) => {
                if (event.currentTarget.dataset.fallback !== 'true') {
                  event.currentTarget.dataset.fallback = 'true'
                  event.currentTarget.src = logoUrl
                }
              }}
            />
          )}
          <div className="reference-article-body">
            {intro && <p className="reference-article-intro">{intro}</p>}
            {children}
            <section className="reference-author-card">
              <a className="reference-author-avatar" href="https://www.instagram.com/express_udyojak/" target="_blank" rel="noopener noreferrer" aria-label="मराठी उद्योजक Instagram profile">{articleDetail ? <ArticleAuthorLogo size={58} /> : <span>MU</span>}</a>
              <div>
                <h2><a href="https://www.instagram.com/express_udyojak/" target="_blank" rel="noopener noreferrer">मराठी उद्योजक</a></h2>
                <p>मराठी उद्योजक वेबसाइटवर उद्योजकता, सरकारी योजना, छोटा उद्योग आणि व्यवसाय मार्गदर्शन याबद्दल नेमकी व विश्वासार्ह माहिती मराठीत उपलब्ध होते.</p>
              </div>
            </section>
            {relatedItems?.length > 0 && (
              <section className="reference-related">
                <h2>Related Articles</h2>
                <div>{relatedItems.map((item) => (
                  <a href={item.to || '#'} key={item.title}>
                    <img
                      src={item.image}
                      alt={`${item.title} - Related article`}
                      onError={(event) => {
                        if (event.currentTarget.dataset.fallback !== 'true') {
                          event.currentTarget.dataset.fallback = 'true'
                          event.currentTarget.src = logoUrl
                        }
                      }}
                    />
                    <strong>{item.title}</strong>
                    {articleDetail && <ArticleAuthor className="reference-related-author" size={12} linked={false} />}
                  </a>
                ))}</div>
              </section>
            )}
            {articleDetail && (
              <section className="reference-comment-form">
                <h2>Leave a Reply</h2>
                {commentState.status === 'success' && <p className="comment-success" role="status">{commentState.message}</p>}
                {commentState.status === 'error' && <p className="comment-error" role="alert">{commentState.message}</p>}
                <p>Your email address will not be published. Required fields are marked *</p>
                <form onSubmit={submitComment}>
                  <label aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
                    Company<input name="company" tabIndex={-1} autoComplete="off" />
                  </label>
                  <label>Comment *<textarea name="message" required minLength="10" maxLength="2000" rows="6" /></label>
                  <div className="reference-comment-fields">
                    <label>Name *<input name="name" required minLength="2" maxLength="100" /></label>
                    <label>Email *<input name="email" type="email" required maxLength="254" /></label>
                    <label>Website<input name="website" type="url" maxLength="500" /></label>
                  </div>
                  <label className="reference-comment-check"><input type="checkbox" name="saveDetails" />Save my name, email, and website in this browser for the next time I comment.</label>
                  <label className="reference-comment-check"><input type="checkbox" name="notifications" />Notify me of follow-up comments by email.</label>
                  <label className="reference-comment-check"><input type="checkbox" name="newPosts" />Notify me of new posts by email.</label>
                  <button type="submit" disabled={commentState.status === 'saving'}>{commentState.status === 'saving' ? 'Submitting…' : 'Post Comment'}</button>
                </form>
              </section>
            )}
          </div>
        </article>
        <div className="reference-sidebar-column">
          <div className="reference-sidebar-sticky">
            {articleDetail && socialLinks}
            <PopularPostsSidebar />
          </div>
        </div>
      </div>
    </section>
  )
}
