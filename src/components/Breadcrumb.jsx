import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Breadcrumb({ items = [] }) {
  return (
    <nav className="reference-breadcrumb" aria-label="Breadcrumb">
      {items.filter(Boolean).map((item, index) => (
        <span key={`${item.label}-${index}`}>
          {index > 0 && <ChevronRight size={14} />}
          {item.to ? <Link to={item.to}>{item.label}</Link> : <span>{item.label}</span>}
        </span>
      ))}
    </nav>
  )
}
