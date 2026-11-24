import { CircleUserRound, Clock3, Eye, MessageCircle } from 'lucide-react'
import ArticleAuthor from './ArticleAuthor'
import Breadcrumb from './Breadcrumb'
import SocialShare from './SocialShare'

export function ArticleHeader({
  title,
  category,
  subtitle,
  date,
  readingTime = '५ मि.',
  commentCount,
  viewCount,
  breadcrumbParent,
  breadcrumbParentLink,
  authorLogo = false,
}) {
  return (
    <header className="reference-article-header">
      <div className="reference-article-header-content">
        <Breadcrumb
          items={[
            { label: 'मुख्यपृष्ठ', to: '/' },
            breadcrumbParent ? { label: breadcrumbParent, to: breadcrumbParentLink } : null,
            { label: title },
          ]}
        />
        <div className="reference-category-row">
          {category && <span>{category}</span>}
        </div>
        <h1>{title}</h1>
        {subtitle && <p className="reference-article-subtitle">{subtitle}</p>}
        <div className="reference-article-meta">
          <span className={authorLogo ? 'reference-article-author' : ''}>{authorLogo ? <ArticleAuthor size={16} /> : <a href="https://www.instagram.com/express_udyojak/" target="_blank" rel="noopener noreferrer"><CircleUserRound size={16} /> मराठी उद्योजक</a>}</span>
          {date && <span><Clock3 size={15} /><time>{date}</time></span>}
          {Number.isFinite(commentCount) && <span><MessageCircle size={15} /> {commentCount}</span>}
          {Number.isFinite(viewCount) && <span><Eye size={15} /> {viewCount.toLocaleString('en-US')} Views</span>}
          <span className="reference-reading-time">वाचने {readingTime}</span>
        </div>
        <SocialShare compact />
      </div>
    </header>
  )
}
