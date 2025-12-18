# 📱 Instagram Carousel SaaS Platform

## Genel Bakış

Bu platform, işletmelerin haftalık Instagram carousel postlarını otomatik olarak oluşturup yayınlamasını sağlar. Multi-tenant mimari sayesinde birden fazla müşteriye hizmet verebilir.

---

## 🏗️ Mimari

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React/Next.js)                     │
│  • Admin Dashboard      • Content Editor      • Analytics            │
│  • Instagram Connect    • Template Designer   • Scheduler            │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                            API LAYER                                 │
│                    (atasa-blog-api - Node.js)                        │
├─────────────────────────────────────────────────────────────────────┤
│  /api/tenants/*           Müşteri yönetimi                          │
│  /api/carousel/*          Carousel CRUD + Generate                  │
│  /api/carousel/:id/render/* PNG/ZIP render (Puppeteer)              │
│  /api/instagram/*         Instagram OAuth + Publish                 │
│  /api/templates/*         Tasarım şablonları                        │
│  /api/scheduler/*         Zamanlanmış paylaşımlar                   │
│  /api/analytics/*         Instagram Insights                        │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         ▼                         ▼                         ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   PostgreSQL    │    │    Puppeteer    │    │  Instagram API  │
│   (Railway)     │    │  (Chromium)     │    │  (Graph API)    │
│                 │    │                 │    │                 │
│ • ig_tenants    │    │ • HTML → PNG    │    │ • OAuth 2.0     │
│ • carousel_posts│    │ • 1080x1080px   │    │ • Media Upload  │
│ • ig_templates  │    │ • ZIP export    │    │ • Carousel Post │
│ • ig_analytics  │    │                 │    │ • Insights      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

---

## 🔐 Instagram Entegrasyonu Gereksinimleri

### Ön Koşullar
1. **Instagram Business veya Creator Account** (kişisel hesap çalışmaz)
2. **Facebook Page** - Instagram hesabına bağlı olmalı
3. **Meta Business Suite** hesabı
4. **Meta Developer App** (developers.facebook.com)

### Kurulum Adımları

#### 1. Meta Developer App Oluşturma
```
1. developers.facebook.com → Create App
2. App Type: Business
3. Products → Instagram Graph API ekle
4. Settings → Basic:
   - App ID ve App Secret'ı kaydet
   - Privacy Policy URL ekle
   - Valid OAuth Redirect URIs:
     https://your-api.railway.app/api/instagram/callback
5. App Review → Permissions:
   - instagram_basic
   - instagram_content_publish
   - pages_show_list
```

#### 2. Environment Variables
```env
INSTAGRAM_APP_ID=your_app_id
INSTAGRAM_APP_SECRET=your_app_secret
API_BASE_URL=https://atasa-blog-api-production.up.railway.app
FRONTEND_URL=https://your-frontend.vercel.app
```

---

## 📊 API Endpoints

### Carousel
| Endpoint | Method | Açıklama |
|----------|--------|----------|
| `/api/carousel/demo-news` | GET | Demo haber verisi |
| `/api/carousel` | GET/POST | Carousel listesi / oluştur |
| `/api/carousel/:id` | GET/PUT/DELETE | Tek carousel |
| `/api/carousel/:id/render-zip` | GET | Görselleri ZIP indir |
| `/api/carousel/:id/render/:slideNumber` | GET | Tek slide PNG |
| `/api/carousel/render` | POST | Webhook ile render |

### Instagram
| Endpoint | Method | Açıklama |
|----------|--------|----------|
| `/api/instagram/auth-url/:tenantId` | GET | OAuth URL al |
| `/api/instagram/callback` | GET | OAuth callback |
| `/api/instagram/status/:tenantId` | GET | Bağlantı durumu |
| `/api/instagram/publish/:carouselId` | POST | Instagram'a yayınla |

---

## 💰 Fiyatlandırma Önerisi

| Plan | Fiyat/Ay | Post | Özellikler |
|------|----------|------|------------|
| Free | $0 | 2 | Manuel yayın |
| Starter | $29 | 8 | Zamanlama, 3 şablon |
| Pro | $79 | 20 | Tüm özellikler |
| Enterprise | $199 | ∞ | White-label, API |

---

## 🎯 Sonraki Adımlar

1. [ ] Meta Developer App oluştur
2. [ ] Instagram Business Account bağla
3. [ ] Database migration çalıştır
4. [ ] Frontend admin panel
5. [ ] Cloudinary entegrasyonu
6. [ ] Zamanlanmış paylaşımlar
