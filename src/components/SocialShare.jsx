import { useState } from 'react'
import { useWebsiteSettings } from '../context/websiteSettings'

export default function SocialShare({ compact = false }) {
  const settings = useWebsiteSettings()
  const [message, setMessage] = useState('')
  const currentUrl = window.location.href
  const shareUrl = encodeURIComponent(currentUrl)
  const shareTitle = encodeURIComponent(document.title)
  const whatsappShareUrl = `${settings.whatsappUrl}?text=${shareTitle}%20${shareUrl}`

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl)
      setMessage('लिंक कॉपी झाला.')
    } catch (error) {
      console.error('Share link could not be copied:', error)
      setMessage('लिंक कॉपी करता आला नाही.')
    }
  }

  return (
    <>
      <div className={compact ? 'reference-share reference-share-compact' : 'reference-share'} aria-label="Social sharing buttons">
        <a href={`https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="share-facebook">f</a>
        <a href={whatsappShareUrl} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="share-whatsapp">W</a>
        <button type="button" aria-label="लिंक कॉपी करा" className="share-more" onClick={copyLink}>↗</button>
      </div>
      {message && <span className="share-status" role="status">{message}</span>}
    </>
  )
}
