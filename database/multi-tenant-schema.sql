-- Multi-Tenant Instagram Carousel SaaS Schema
-- Run this SQL in your PostgreSQL database

-- =====================
-- TENANTS TABLE (Müşteriler/Organizasyonlar)
-- =====================
CREATE TABLE IF NOT EXISTS ig_tenants (
    id SERIAL PRIMARY KEY,
    
    -- Temel Bilgiler
    name VARCHAR(255) NOT NULL,                    -- Şirket adı: "Atasa Danışmanlık"
    slug VARCHAR(100) UNIQUE NOT NULL,             -- URL slug: "atasa"
    email VARCHAR(255) NOT NULL,                   -- İletişim email
    
    -- Branding
    brand_name VARCHAR(100),                       -- Carousel'da görünecek marka: "ATASA"
    logo_url TEXT,                                 -- Logo URL
    primary_color VARCHAR(7) DEFAULT '#000000',   -- Marka rengi
    
    -- Instagram Bağlantısı
    ig_user_id VARCHAR(50),                        -- Instagram Business Account ID
    ig_username VARCHAR(50),                       -- Instagram kullanıcı adı
    ig_access_token TEXT,                          -- Long-lived access token (şifreli saklanmalı!)
    ig_token_expires_at TIMESTAMP,                 -- Token bitiş tarihi
    
    -- Facebook Bağlantısı (Instagram için gerekli)
    fb_page_id VARCHAR(50),                        -- Bağlı Facebook Page ID
    fb_page_name VARCHAR(255),                     -- Facebook Page adı
    
    -- İçerik Ayarları
    content_language VARCHAR(5) DEFAULT 'tr',      -- Varsayılan dil
    default_hashtags TEXT,                         -- Varsayılan hashtagler
    intro_template TEXT,                           -- Giriş slide şablonu
    
    -- Abonelik
    plan VARCHAR(20) DEFAULT 'free',               -- free, starter, pro, enterprise
    plan_expires_at TIMESTAMP,                     -- Abonelik bitiş
    monthly_post_limit INTEGER DEFAULT 4,          -- Aylık post limiti
    posts_this_month INTEGER DEFAULT 0,            -- Bu ay yapılan postlar
    
    -- Durum
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================
-- TENANT USERS (Kiracı Kullanıcıları)
-- =====================
CREATE TABLE IF NOT EXISTS ig_tenant_users (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES ig_tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    role VARCHAR(20) DEFAULT 'editor',             -- owner, admin, editor, viewer
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, email)
);

-- =====================
-- CAROUSEL TEMPLATES (Tasarım Şablonları)
-- =====================
CREATE TABLE IF NOT EXISTS ig_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Tasarım Ayarları
    cover_style JSONB DEFAULT '{}',                -- Kapak slide stili
    intro_style JSONB DEFAULT '{}',                -- Giriş slide stili
    category_style JSONB DEFAULT '{}',             -- Kategori slide stili
    
    -- Renkler
    background_color VARCHAR(7) DEFAULT '#FFFFFF',
    text_color VARCHAR(7) DEFAULT '#000000',
    accent_color VARCHAR(7) DEFAULT '#0066FF',
    
    -- Font
    font_family VARCHAR(100) DEFAULT 'Inter',
    
    -- Genel
    is_public BOOLEAN DEFAULT FALSE,               -- Herkes kullanabilir mi?
    created_by INTEGER REFERENCES ig_tenants(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================
-- CONTENT SOURCES (İçerik Kaynakları)
-- =====================
CREATE TABLE IF NOT EXISTS ig_content_sources (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES ig_tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(100) NOT NULL,                    -- "Göç İdaresi RSS", "Manuel Giriş"
    source_type VARCHAR(20) NOT NULL,              -- rss, webhook, manual, scraper
    
    -- Kaynak Detayları
    config JSONB DEFAULT '{}',                     -- RSS URL, API endpoint, vs.
    
    -- Kategori Eşleştirme
    category_mapping JSONB DEFAULT '{}',           -- Otomatik kategori atama kuralları
    
    is_active BOOLEAN DEFAULT TRUE,
    last_fetched_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================
-- SCHEDULED POSTS (Zamanlanmış Paylaşımlar)
-- =====================
CREATE TABLE IF NOT EXISTS ig_scheduled_posts (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES ig_tenants(id) ON DELETE CASCADE,
    carousel_id INTEGER REFERENCES carousel_posts(id) ON DELETE CASCADE,
    
    scheduled_at TIMESTAMP NOT NULL,               -- Paylaşım zamanı
    status VARCHAR(20) DEFAULT 'pending',          -- pending, processing, published, failed
    
    -- Sonuç
    ig_media_id VARCHAR(50),                       -- Instagram media ID
    error_message TEXT,
    published_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================
-- ANALYTICS (Analitik)
-- =====================
CREATE TABLE IF NOT EXISTS ig_analytics (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES ig_tenants(id) ON DELETE CASCADE,
    carousel_id INTEGER REFERENCES carousel_posts(id) ON DELETE CASCADE,
    ig_media_id VARCHAR(50),
    
    -- Metrikler (Instagram Insights API'den çekilir)
    impressions INTEGER DEFAULT 0,
    reach INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    saves INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    
    fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================
-- UPDATE carousel_posts for multi-tenant
-- =====================
ALTER TABLE carousel_posts ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES ig_tenants(id);
ALTER TABLE carousel_posts ADD COLUMN IF NOT EXISTS template_id INTEGER REFERENCES ig_templates(id);
ALTER TABLE carousel_posts ADD COLUMN IF NOT EXISTS ig_media_id VARCHAR(50);
ALTER TABLE carousel_posts ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP;
ALTER TABLE carousel_posts ADD COLUMN IF NOT EXISTS caption TEXT;

-- =====================
-- INDEXES
-- =====================
CREATE INDEX IF NOT EXISTS idx_carousel_posts_tenant ON carousel_posts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_carousel_posts_status ON carousel_posts(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_scheduled ON ig_scheduled_posts(scheduled_at, status);
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON ig_tenants(slug);

-- =====================
-- DEFAULT TEMPLATE
-- =====================
INSERT INTO ig_templates (name, description, is_public, cover_style, intro_style, category_style)
VALUES (
    'Classic White',
    'Temiz, minimalist beyaz tasarım',
    TRUE,
    '{"background": "#FFFFFF", "titleSize": "64px", "brandPosition": "bottom"}',
    '{"background": "#FFFFFF", "greetingSize": "32px", "contentSize": "28px"}',
    '{"background": "#FFFFFF", "emojiSize": "48px", "itemSize": "26px"}'
) ON CONFLICT DO NOTHING;

-- =====================
-- SAMPLE TENANT (Atasa)
-- =====================
INSERT INTO ig_tenants (name, slug, email, brand_name, default_hashtags, plan, monthly_post_limit)
VALUES (
    'Atasa Danışmanlık',
    'atasa',
    'info@atasadanismanlik.com',
    'ATASA',
    '#göçmenlik #türkiye #oturmaiizni #çalışmaizni #vize #vatandaşlık #yabancılar #ikamet #turkiye #immigration',
    'pro',
    20
) ON CONFLICT (slug) DO NOTHING;
