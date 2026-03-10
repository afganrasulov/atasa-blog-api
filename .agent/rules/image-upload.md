---
trigger: always_on
---

# Görsel Yükleme Kuralı

## Supabase Storage Kullanımı

Bu projede tüm görseller (logolar, bannerlar, fotoğraflar) **Supabase Storage** üzerinde barındırılır.

- **Proje:** Atasa Mobi (`khlvkvusavalbkjrwbsy`)
- **Bucket:** `public-assets` (public)
- **Klasör:** `atasa_mobi/`
- **S3 Endpoint:** `https://khlvkvusavalbkjrwbsy.storage.supabase.co/storage/v1/s3`
- **Public URL Pattern:** `https://khlvkvusavalbkjrwbsy.supabase.co/storage/v1/object/public/public-assets/atasa_mobi/{alt_klasör}/{dosya_adı}`

## Kurallar

1. Yeni görsel eklendiğinde **mutlaka** Supabase Storage'a yükle
2. Alt klasör yapısını koru: `referanslar/`, `banners/`, `team/` vb.
3. Dosya adlarında Türkçe karakter kullanma, `kebab-case` tercih et
4. Anon key ile yükleme yapılabilir (RLS policy mevcut)
5. Görselleri optimize et (max 500KB logo, max 2MB fotoğraf)
6. WebP formatını tercih et (fallback: PNG/JPG)
