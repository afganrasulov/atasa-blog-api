---
trigger: always_on
---

# Supabase Veritabanı Kuralı

## Proje Bilgileri

- **Proje:** Atasa Mobi (`khlvkvusavalbkjrwbsy`)
- **Schema:** `atasa_mobi`
- **Region:** Supabase default

## Kurallar

1. Bu projenin tüm tabloları **`atasa_mobi`** schema'sı altında oluşturulmalı
2. Tablo oluştururken: `CREATE TABLE atasa_mobi.tablo_adi (...)`
3. Sorgu yazarken: `SELECT * FROM atasa_mobi.tablo_adi`
4. `public` schema'sını bu proje için **kullanma** — diğer projelerle karışır
5. RLS (Row Level Security) her tabloda aktif olmalı
6. Migration isimleri `snake_case` olmalı

## Tracking Bilgileri

- **GTM Web Container:** `GTM-PKCZGSPL`
- **Facebook Pixel ID:** `425789933297680`
- **GTM Android:** `GTM-KD8G6C4B`
- **GTM iOS:** `GTM-TKW5WLJJ`
