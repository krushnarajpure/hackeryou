import expressLogoUrl from '../image/express-udyojak-logo.png'

export const PUBLIC_AUTHOR_NAME = 'मराठी उद्योजक'
export const PUBLIC_AUTHOR_URL = 'https://www.instagram.com/express_udyojak/'

export function ArticleAuthorLogo({ className = '', size = 14 }) {
  return (
    <img
      className={`article-author-logo ${className}`.trim()}
      src={expressLogoUrl}
      alt=""
      width={size}
      height={size}
      aria-hidden="true"
    />
  )
}

export default function ArticleAuthor({ className = '', size = 14, linked = true }) {
  const Tag = linked ? 'a' : 'span'
  return (
    <Tag
      className={`article-author-identity ${className}`.trim()}
      {...(linked ? { href: PUBLIC_AUTHOR_URL, target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      <ArticleAuthorLogo size={size} />
      <span>{PUBLIC_AUTHOR_NAME}</span>
    </Tag>
  )
}
