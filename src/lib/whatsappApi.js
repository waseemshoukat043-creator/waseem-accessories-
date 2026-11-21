
export function getWhatsAppApiBaseUrl() {
  const configuredUrl = import.meta.env.VITE_WHATSAPP_API_URL?.trim()
  const isDevelopment = import.meta.env.MODE === 'development'

  if (configuredUrl) {
    let parsedUrl

    try {
      parsedUrl = new URL(configuredUrl)
    } catch {
      throw new Error(
        'VITE_WHATSAPP_API_URL is not a valid URL.'
      )
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error(
        'WhatsApp API URL must use HTTP or HTTPS.'
      )
    }

    if (
      !isDevelopment &&
      (
        parsedUrl.protocol !== 'https:' ||
        ['localhost', '127.0.0.1', '[::1]'].includes(parsedUrl.hostname)
      )
    ) {
      throw new Error(
        'VITE_WHATSAPP_API_URL must be a public HTTPS backend URL in production.'
      )
    }

    return configuredUrl.replace(/\/+$/, '')
  }

  if (isDevelopment) {
    return 'http://localhost:5000'
  }

  throw new Error(
    'VITE_WHATSAPP_API_URL is not configured for production.'
  )
}
