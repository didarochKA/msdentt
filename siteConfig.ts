/**
 * Контакты и ссылки клиники — измените под свои реальные данные.
 */
export const siteConfig = {
  /** Для ссылки tel: (только цифры, 11 знаков: 7XXXXXXXXXX) */
  phoneDigits: "77477499027",
  phoneDisplay: "+7 747 749 90 27",
  /** Номер WhatsApp для заявок (wa.me, без +) */
  whatsAppDigits: "77477499027",
  email: "msdent@gmail.com",
  address: "Астана, пр. Туран 18",
  /** Ссылка на карты (2GIS, Google Maps и т.д.) */
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=Астана+проспект+Туран+18",
  telegramUrl: "https://t.me/",
  instagramUrl: "https://www.instagram.com/",
} as const;
