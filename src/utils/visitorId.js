const STORAGE_KEY = 'marathiUdyojakVisitorId'
let memoryVisitorId = ''

const createVisitorId = () => window.crypto.randomUUID()

export default function getVisitorId() {
  try {
    const storedId = window.localStorage.getItem(STORAGE_KEY)
    if (storedId) return storedId
    const visitorId = createVisitorId()
    window.localStorage.setItem(STORAGE_KEY, visitorId)
    return visitorId
  } catch {
    try {
      const storedId = window.sessionStorage.getItem(STORAGE_KEY)
      if (storedId) return storedId
      const visitorId = createVisitorId()
      window.sessionStorage.setItem(STORAGE_KEY, visitorId)
      return visitorId
    } catch {
      memoryVisitorId ||= createVisitorId()
      return memoryVisitorId
    }
  }
}
