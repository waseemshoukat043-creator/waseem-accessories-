export function getWhatsAppApiBaseUrl() {
  const configuredUrl = import.meta.env.VITE_WHATSAPP_API_URL?.trim()
  const isDevelopment = import.meta.env.MODE === 'development'

  if (configuredUrl) {
    const parsedUrl = new URL(configuredUrl)

    if (
      !isDevelopment &&
      (
        parsedUrl.protocol !== 'https:' ||
        parsedUrl.hostname === 'localhost' ||
        parsedUrl.hostname === '127.0.0.1' ||
        parsedUrl.hostname === '[::1]'
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
