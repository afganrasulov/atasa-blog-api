import express from 'express';
import cors from 'cors';
import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;
const app = express();
const PORT = process.env.PORT || 3000;

// Audio Processor Service URL
const AUDIO_PROCESSOR_URL = process.env.AUDIO_PROCESSOR_URL || 'http://localhost:3001';

// YouTube API URL
const YT_API = 'https://www.googleapis.com/youtube/v3';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Database init
async function initDB() {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS posts (id SERIAL PRIMARY KEY, title VARCHAR(500) NOT NULL, slug VARCHAR(500) UNIQUE NOT NULL, content TEXT NOT NULL, category VARCHAR(100) DEFAULT 'Genel', excerpt TEXT, thumbnail VARCHAR(500), date VARCHAR(100), read_time VARCHAR(50), status VARCHAR(20) DEFAULT 'draft', scheduled_at TIMESTAMP, published_at TIMESTAMP, video_id VARCHAR(50), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS settings (key VARCHAR(100) PRIMARY KEY, value TEXT)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS youtube_videos (id VARCHAR(50) PRIMARY KEY, title VARCHAR(500), description TEXT, thumbnail VARCHAR(500), duration INTEGER, view_count INTEGER, published_at TIMESTAMP, channel_id VARCHAR(50), video_type VARCHAR(20) DEFAULT 'video', audio_url TEXT, audio_status VARCHAR(20) DEFAULT 'pending', transcript TEXT, transcript_status VARCHAR(20) DEFAULT 'pending', transcript_job_id VARCHAR(100), transcript_model VARCHAR(50), transcript_updated_at TIMESTAMP, blog_created BOOLEAN DEFAULT FALSE, blog_post_id INTEGER, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS allowed_users (id SERIAL PRIMARY KEY, email VARCHAR(255) UNIQUE NOT NULL, name VARCHAR(255), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    
    // Carousel posts table for Instagram
    await pool.query(`CREATE TABLE IF NOT EXISTS carousel_posts (
      id SERIAL PRIMARY KEY,
      title VARCHAR(500) NOT NULL,
      week_start DATE,
      week_end DATE,
      status VARCHAR(20) DEFAULT 'draft',
      cover_image_url TEXT,
      cover_image_prompt TEXT,
      slides JSONB DEFAULT '[]',
      raw_news JSONB DEFAULT '[]',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      published_at TIMESTAMP
    )`);
    
    // News items table for carousel content
    await pool.query(`CREATE TABLE IF NOT EXISTS news_items (
      id SERIAL PRIMARY KEY,
      category VARCHAR(100) NOT NULL,
      title VARCHAR(500) NOT NULL,
      summary TEXT,
      source_url TEXT,
      source_name VARCHAR(100),
      emoji VARCHAR(10),
      news_date DATE,
      is_used BOOLEAN DEFAULT FALSE,
      carousel_id INTEGER REFERENCES carousel_posts(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    
    await pool.query(`ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS audio_url TEXT`);
    await pool.query(`ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS audio_status VARCHAR(20) DEFAULT 'pending'`);
    await pool.query(`ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS transcript_job_id VARCHAR(100)`);
    await pool.query(`ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS blog_created BOOLEAN DEFAULT FALSE`);
    await pool.query(`ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS blog_post_id INTEGER`);
    await pool.query(`ALTER TABLE posts ADD COLUMN IF NOT EXISTS video_id VARCHAR(50)`);
    
    // Default settings
    await pool.query(`INSERT INTO settings (key, value) VALUES ('autopilot', 'false') ON CONFLICT (key) DO NOTHING`);
    await pool.query(`INSERT INTO settings (key, value) VALUES ('transcription_provider', 'openai') ON CONFLICT (key) DO NOTHING`);
    await pool.query(`INSERT INTO settings (key, value) VALUES ('auto_scan_enabled', 'false') ON CONFLICT (key) DO NOTHING`);
    await pool.query(`INSERT INTO settings (key, value) VALUES ('auto_transcribe', 'false') ON CONFLICT (key) DO NOTHING`);
    await pool.query(`INSERT INTO settings (key, value) VALUES ('auto_blog', 'false') ON CONFLICT (key) DO NOTHING`);
    await pool.query(`INSERT INTO settings (key, value) VALUES ('auto_publish', 'false') ON CONFLICT (key) DO NOTHING`);
    await pool.query(`INSERT INTO settings (key, value) VALUES ('scan_interval_hours', '6') ON CONFLICT (key) DO NOTHING`);
    await pool.query(`INSERT INTO settings (key, value) VALUES ('last_scan_time', '') ON CONFLICT (key) DO NOTHING`);
    await pool.query(`INSERT INTO allowed_users (email, name) VALUES ('afganrasulov@gmail.com', 'Afgan Rasulov') ON CONFLICT (email) DO NOTHING`);
    console.log('✅ Database initialized');
  } catch (error) { console.error('Database init error:', error); }
}

function generateSlug(title) {
  return title.toLowerCase().replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
}
function formatDateTR() { return new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }); }
function calculateReadTime(content) { return Math.ceil(content.split(' ').length / 200) + ' dk okuma'; }

function parseDuration(d) {
  const m = d.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  return (parseInt(m?.[1]) || 0) * 3600 + (parseInt(m?.[2]) || 0) * 60 + (parseInt(m?.[3]) || 0);
}

// Helper to get setting value
async function getSetting(key) {
  const result = await pool.query('SELECT value FROM settings WHERE key = $1', [key]);
  return result.rows[0]?.value || null;
}

// =====================
// DEMO NEWS API - Sahte göçmenlik haberleri
// =====================
function generateDemoNews() {
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay() + 1); // Monday
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6); // Sunday
  
  const formatDate = (d) => `${d.getDate()} ${['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'][d.getMonth()]}`;
  
  return {
    weekRange: `${formatDate(weekStart)} - ${formatDate(weekEnd)} ${today.getFullYear()}`,
    weekStart: weekStart.toISOString().split('T')[0],
    weekEnd: weekEnd.toISOString().split('T')[0],
    categories: [
      {
        name: "Oturma İzni",
        emoji: "🏠",
        news: [
          {
            title: "Kısa dönem oturma izni başvurularında yeni düzenleme yapıldı.",
            source: "GİB",
            url: "https://goc.gov.tr"
          },
          {
            title: "İstanbul'da oturma izni randevu sistemi güncellendi.",
            source: "İl Göç",
            url: "https://istanbul.goc.gov.tr"
          },
          {
            title: "Aile ikamet izni için gerekli belgeler listesi yenilendi.",
            source: "GİB",
            url: "https://goc.gov.tr"
          }
        ]
      },
      {
        name: "Çalışma İzni",
        emoji: "💼",
        news: [
          {
            title: "Yabancı çalışanlar için yeni istihdam teşviki açıklandı.",
            source: "ÇSGB",
            url: "https://csgb.gov.tr"
          },
          {
            title: "Bağımsız çalışma izni başvuru süreci kolaylaştırıldı.",
            source: "ÇSGB",
            url: "https://csgb.gov.tr"
          },
          {
            title: "Turkuaz Kart sahipleri için yeni haklar tanımlandı.",
            source: "Resmi Gazete",
            url: "https://resmigazete.gov.tr"
          }
        ]
      },
      {
        name: "Vatandaşlık",
        emoji: "🇹🇷",
        news: [
          {
            title: "Yatırım yoluyla vatandaşlık için dolar kuru güncellendi.",
            source: "Nüfus",
            url: "https://nvi.gov.tr"
          },
          {
            title: "Olağanüstü vatandaşlık başvuruları hızlandırılıyor.",
            source: "İçişleri",
            url: "https://icisleri.gov.tr"
          }
        ]
      },
      {
        name: "Vize",
        emoji: "✈️",
        news: [
          {
            title: "Schengen vize randevuları için yeni dönem başlıyor.",
            source: "Konsolosluk",
            url: "https://vfs.com"
          },
          {
            title: "Türkiye-Rusya arasında vizesiz seyahat süresi uzatıldı.",
            source: "Dışişleri",
            url: "https://mfa.gov.tr"
          },
          {
            title: "E-Vize sistemine yeni ülkeler eklendi.",
            source: "E-Vize",
            url: "https://evisa.gov.tr"
          }
        ]
      },
      {
        name: "Genel",
        emoji: "📢",
        news: [
          {
            title: "Göç İdaresi online hizmetler portalı yenilendi.",
            source: "GİB",
            url: "https://goc.gov.tr"
          },
          {
            title: "Yabancılar için TÜRKSAT uydu TV paketi tanıtıldı.",
            source: "TÜRKSAT",
            url: "https://turksat.com.tr"
          }
        ]
      }
    ]
  };
}

// =====================
// CAROUSEL API ENDPOINTS
// =====================

// Demo news endpoint - sahte haberler döner
app.get('/api/carousel/demo-news', (req, res) => {
  res.json(generateDemoNews());
});

// Get all carousel posts
app.get('/api/carousel', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM carousel_posts ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
});

// Get single carousel post
app.get('/api/carousel/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM carousel_posts WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Carousel not found' });
    res.json(result.rows[0]);
  } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
});

// Create new carousel post
app.post('/api/carousel', async (req, res) => {
  try {
    const { title, week_start, week_end, slides, raw_news, cover_image_prompt } = req.body;
    const result = await pool.query(
      `INSERT INTO carousel_posts (title, week_start, week_end, slides, raw_news, cover_image_prompt) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [title, week_start, week_end, JSON.stringify(slides || []), JSON.stringify(raw_news || []), cover_image_prompt]
    );
    res.status(201).json({ success: true, carousel: result.rows[0] });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Update carousel post
app.put('/api/carousel/:id', async (req, res) => {
  try {
    const { title, slides, cover_image_url, cover_image_prompt, status } = req.body;
    const result = await pool.query(
      `UPDATE carousel_posts SET 
        title = COALESCE($1, title),
        slides = COALESCE($2, slides),
        cover_image_url = COALESCE($3, cover_image_url),
        cover_image_prompt = COALESCE($4, cover_image_prompt),
        status = COALESCE($5, status),
        updated_at = CURRENT_TIMESTAMP,
        published_at = CASE WHEN $5 = 'published' THEN CURRENT_TIMESTAMP ELSE published_at END
       WHERE id = $6 RETURNING *`,
      [title, slides ? JSON.stringify(slides) : null, cover_image_url, cover_image_prompt, status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Carousel not found' });
    res.json({ success: true, carousel: result.rows[0] });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Delete carousel post
app.delete('/api/carousel/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM carousel_posts WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
});

// Generate carousel with OpenAI - webhook for n8n
app.post('/api/carousel/generate', async (req, res) => {
  try {
    const { news_data, openai_content } = req.body;
    
    // news_data: raw demo news
    // openai_content: OpenAI tarafından düzenlenmiş içerik (n8n'den gelecek)
    
    if (!news_data) {
      return res.status(400).json({ error: 'news_data required' });
    }
    
    // Parse OpenAI content if provided
    let slides = [];
    if (openai_content) {
      // OpenAI'dan gelen düzenlenmiş içeriği parse et
      slides = parseOpenAIContent(openai_content, news_data);
    } else {
      // Ham veriden basit slides oluştur
      slides = createBasicSlides(news_data);
    }
    
    // Save to database
    const result = await pool.query(
      `INSERT INTO carousel_posts (title, week_start, week_end, slides, raw_news, cover_image_prompt) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        `Göçmenlik Haberleri - ${news_data.weekRange}`,
        news_data.weekStart,
        news_data.weekEnd,
        JSON.stringify(slides),
        JSON.stringify(news_data),
        generateCoverPrompt(news_data)
      ]
    );
    
    res.status(201).json({ 
      success: true, 
      carousel: result.rows[0],
      slides_count: slides.length
    });
    
  } catch (error) { 
    console.error('Carousel generate error:', error);
    res.status(500).json({ error: error.message }); 
  }
});

// Helper: Parse OpenAI content into slides
function parseOpenAIContent(content, rawNews) {
  const slides = [];
  
  // Slide 1: Cover
  slides.push({
    type: 'cover',
    title: 'Türkiye Göçmenlik Haberleri',
    subtitle: rawNews.weekRange,
    brand: 'ATASA',
    image_placeholder: true // Gemini API için yer tutucu
  });
  
  // Slide 2: Introduction
  slides.push({
    type: 'intro',
    greeting: 'Merhaba,',
    content: `Bu hafta Göçmenlik Haberleri serisinde, Türkiye'deki göçmenlik mevzuatı ve uygulamalarındaki son gelişmeleri sizin için derledik.\n\nOturma izni düzenlemelerinden çalışma izni kolaylıklarına, vatandaşlık güncellemelerinden vize haberlerine kadar bu sayıda haberdar olmanız gereken birçok yeni gelişme sizi bekliyor.\n\nKeyifli okumalar ☕`,
    brand: 'ATASA'
  });
  
  // Category slides
  rawNews.categories.forEach(cat => {
    slides.push({
      type: 'category',
      emoji: cat.emoji,
      category: cat.name,
      items: cat.news.map(n => ({
        text: n.title,
        source: n.source,
        url: n.url
      })),
      brand: 'ATASA'
    });
  });
  
  return slides;
}

// Helper: Create basic slides from raw news
function createBasicSlides(rawNews) {
  return parseOpenAIContent(null, rawNews);
}

// Helper: Generate cover image prompt for Gemini
function generateCoverPrompt(news) {
  return `Minimalist black and white illustration for Instagram carousel cover. 
Theme: Immigration and travel in Turkey. 
Style: Clean line art, similar to modern editorial illustrations.
Elements: Two people - one holding documents/passport, another with a suitcase or looking at a phone.
Text space needed at bottom for title.
No text in the image itself.
Professional, friendly, and approachable mood.`;
}

// =====================
// CRON JOB - Auto Video Scanner
// =====================
async function autoScanVideos() {
  try {
    const autoScanEnabled = await getSetting('auto_scan_enabled');
    if (autoScanEnabled !== 'true') return;
    
    const youtubeApiKey = await getSetting('youtube_api_key');
    const channelId = await getSetting('channel_id');
    
    if (!youtubeApiKey) {
      console.log('⚠️ Auto-scan skipped: No YouTube API key configured');
      return;
    }
    
    console.log('🔄 Starting auto video scan...');
    
    // Get channel ID if not set
    let activeChannelId = channelId;
    if (!activeChannelId) {
      const ch = await fetch(`${YT_API}/search?part=snippet&type=channel&q=@atasa_tr&key=${youtubeApiKey}`).then(r => r.json());
      if (ch.items?.[0]) {
        activeChannelId = ch.items[0].snippet.channelId;
        await pool.query(`INSERT INTO settings (key, value) VALUES ('channel_id', $1) ON CONFLICT (key) DO UPDATE SET value = $1`, [activeChannelId]);
      }
    }
    
    if (!activeChannelId) {
      console.log('⚠️ Auto-scan failed: Could not determine channel ID');
      return;
    }
    
    // Fetch last 50 videos
    let allVideos = [];
    let pageToken = null;
    
    for (let page = 0; page < 2; page++) { // 2 pages = 100 videos max
      let searchUrl = `${YT_API}/search?part=snippet&channelId=${activeChannelId}&maxResults=50&order=date&type=video&key=${youtubeApiKey}`;
      if (pageToken) searchUrl += `&pageToken=${pageToken}`;
      
      const search = await fetch(searchUrl).then(r => r.json());
      if (!search.items?.length) break;
      
      const ids = search.items.map(i => i.id.videoId).join(',');
      const details = await fetch(`${YT_API}/videos?part=contentDetails,statistics&id=${ids}&key=${youtubeApiKey}`).then(r => r.json());
      
      const videos = search.items.map(i => {
        const d = details.items.find(x => x.id === i.id.videoId);
        const dur = parseDuration(d?.contentDetails?.duration || 'PT0S');
        return {
          id: i.id.videoId,
          title: i.snippet.title,
          description: i.snippet.description,
          thumbnail: i.snippet.thumbnails.high?.url,
          duration: dur,
          viewCount: parseInt(d?.statistics?.viewCount || 0),
          publishedAt: i.snippet.publishedAt,
          channelId: activeChannelId,
          type: dur <= 60 ? 'short' : 'video'
        };
      });
      
      allVideos = allVideos.concat(videos);
      pageToken = search.nextPageToken;
      if (!pageToken) break;
    }
    
    // Find new videos (not in database)
    const existingIds = (await pool.query('SELECT id FROM youtube_videos')).rows.map(r => r.id);
    const newVideos = allVideos.filter(v => !existingIds.includes(v.id));
    
    if (newVideos.length === 0) {
      console.log('✅ Auto-scan complete: No new videos found');
      await pool.query(`INSERT INTO settings (key, value) VALUES ('last_scan_time', $1) ON CONFLICT (key) DO UPDATE SET value = $1`, [new Date().toISOString()]);
      return;
    }
    
    // Save new videos
    for (const video of newVideos) {
      await pool.query(`INSERT INTO youtube_videos (id, title, description, thumbnail, duration, view_count, published_at, channel_id, video_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO NOTHING`,
        [video.id, video.title, video.description, video.thumbnail, video.duration, video.viewCount, video.publishedAt, video.channelId, video.type]);
    }
    
    console.log(`✅ Auto-scan complete: ${newVideos.length} new videos found`);
    await pool.query(`INSERT INTO settings (key, value) VALUES ('last_scan_time', $1) ON CONFLICT (key) DO UPDATE SET value = $1`, [new Date().toISOString()]);
    
    // Auto transcribe if enabled
    const autoTranscribe = await getSetting('auto_transcribe');
    if (autoTranscribe === 'true') {
      const openaiApiKey = await getSetting('openai_api_key');
      if (openaiApiKey) {
        for (const video of newVideos) {
          console.log(`🎙️ Auto-transcribing: ${video.title}`);
          await startTranscription(video.id, openaiApiKey, 'openai');
        }
      } else {
        console.log('⚠️ Auto-transcribe skipped: No OpenAI API key');
      }
    }
    
  } catch (error) {
    console.error('❌ Auto-scan error:', error.message);
  }
}

// Start transcription for a video (internal function)
async function startTranscription(videoId, apiKey, provider = 'openai') {
  try {
    await pool.query(`UPDATE youtube_videos SET transcript_status = 'processing', audio_status = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [videoId]);
    
    const transcribeResponse = await fetch(`${AUDIO_PROCESSOR_URL}/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId, provider, apiKey, language: 'tr' })
    });
    
    const transcribeData = await transcribeResponse.json();
    if (!transcribeData.success) throw new Error(transcribeData.error || 'Transcription request failed');
    
    const jobId = transcribeData.jobId;
    await pool.query(`UPDATE youtube_videos SET transcript_job_id = $1 WHERE id = $2`, [jobId, videoId]);
    
    // Poll for result
    let completed = false;
    let attempts = 0;
    
    while (!completed && attempts < 120) {
      await new Promise(r => setTimeout(r, 5000));
      attempts++;
      
      const statusResponse = await fetch(`${AUDIO_PROCESSOR_URL}/status/${jobId}`);
      const statusData = await statusResponse.json();
      
      if (statusData.status === 'completed') {
        completed = true;
        await pool.query(`UPDATE youtube_videos SET audio_status = 'completed', transcript = $1, transcript_status = 'completed', transcript_model = $2, transcript_updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
          [statusData.transcript, provider, videoId]);
        console.log(`✅ Transcription completed for ${videoId}`);
        
        // Check for auto blog creation
        await checkAutoBlogCreation(videoId);
        
      } else if (statusData.status === 'failed') {
        throw new Error(statusData.error || 'Transcription failed');
      } else if (statusData.status === 'transcribing') {
        await pool.query(`UPDATE youtube_videos SET audio_status = 'completed' WHERE id = $1`, [videoId]);
      }
    }
    
    if (!completed) throw new Error('Transcription timeout');
    
  } catch (error) {
    console.error(`❌ Transcription failed for ${videoId}:`, error.message);
    await pool.query(`UPDATE youtube_videos SET transcript_status = 'failed', audio_status = CASE WHEN audio_status = 'processing' THEN 'failed' ELSE audio_status END, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [videoId]);
  }
}

// Check if auto blog creation is enabled and create blog
async function checkAutoBlogCreation(videoId) {
  try {
    const autoBlog = await getSetting('auto_blog');
    if (autoBlog !== 'true') return;
    
    const openaiApiKey = await getSetting('openai_api_key');
    if (!openaiApiKey) {
      console.log('⚠️ Auto-blog skipped: No OpenAI API key');
      return;
    }
    
    // Get video data
    const videoResult = await pool.query('SELECT * FROM youtube_videos WHERE id = $1', [videoId]);
    if (videoResult.rows.length === 0) return;
    
    const video = videoResult.rows[0];
    if (!video.transcript || video.blog_created) return;
    
    console.log(`📝 Auto-creating blog for: ${video.title}`);
    
    // Get blog prompt and SEO rules
    const blogPrompt = await getSetting('blog_prompt') || getDefaultBlogPrompt();
    const seoRules = await getSetting('ai_seo_rules') || '';
    const systemPrompt = seoRules ? `${blogPrompt}\n\n--- AI SEO KURALLARI ---\n${seoRules}` : blogPrompt;
    
    // Generate blog content
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${openaiApiKey}` 
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Video Başlığı: ${video.title}\n\nTranskript:\n${video.transcript}` }
        ],
        temperature: 0.7,
        max_tokens: 3500
      })
    });
    
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    
    const content = data.choices[0].message.content;
    const titleMatch = content.match(/BAŞLIK:\s*(.+)/);
    const blogTitle = titleMatch ? titleMatch[1].trim() : video.title;
    const blogContent = content.replace(/BAŞLIK:\s*.+\n---\n?/, '').trim();
    
    // Check auto publish setting
    const autoPublish = await getSetting('auto_publish');
    const postStatus = autoPublish === 'true' ? 'published' : 'draft';
    
    // Save blog post
    const slug = generateSlug(blogTitle) + '-' + Date.now();
    const postResult = await pool.query(
      `INSERT INTO posts (title, slug, content, category, excerpt, thumbnail, date, read_time, status, published_at, video_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [blogTitle, slug, blogContent, video.video_type === 'short' ? 'Shorts' : 'YouTube', blogContent.substring(0, 150) + '...', video.thumbnail, formatDateTR(), calculateReadTime(blogContent), postStatus, postStatus === 'published' ? new Date() : null, videoId]
    );
    
    // Mark video as blog created
    await pool.query(`UPDATE youtube_videos SET blog_created = TRUE, blog_post_id = $1 WHERE id = $2`, [postResult.rows[0].id, videoId]);
    
    console.log(`✅ Auto-blog created: ${blogTitle} (${postStatus})`);
    
  } catch (error) {
    console.error(`❌ Auto-blog creation failed for ${videoId}:`, error.message);
  }
}

function getDefaultBlogPrompt() {
  return `Sen bir blog yazarısın. Verilen video transkriptini kullanarak SEO uyumlu, akıcı bir blog yazısı oluştur.

Kurallar:
- Başlığı "BAŞLIK: [başlık]" formatında yaz, ardından "---" koy
- İçerik en az 500 kelime olmalı
- Paragraflar halinde yaz, başlık kullanma
- Doğal ve akıcı bir dil kullan
- Video transkriptindeki bilgileri düzenle ve zenginleştir`;
}

// Scheduled posts check (every minute)
setInterval(async () => {
  try {
    const result = await pool.query(`UPDATE posts SET status = 'published', published_at = CURRENT_TIMESTAMP, date = $1 WHERE status = 'scheduled' AND scheduled_at <= CURRENT_TIMESTAMP RETURNING title`, [formatDateTR()]);
    result.rows.forEach(post => console.log(`📅 Published: ${post.title}`));
  } catch (error) { console.error('Schedule check error:', error); }
}, 60000);

// Auto scan check (every hour, respects scan_interval_hours setting)
setInterval(async () => {
  try {
    const autoScanEnabled = await getSetting('auto_scan_enabled');
    if (autoScanEnabled !== 'true') return;
    
    const lastScanTime = await getSetting('last_scan_time');
    const scanIntervalHours = parseInt(await getSetting('scan_interval_hours') || '6');
    
    if (lastScanTime) {
      const hoursSinceLastScan = (Date.now() - new Date(lastScanTime).getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastScan < scanIntervalHours) return;
    }
    
    await autoScanVideos();
  } catch (error) {
    console.error('Auto-scan check error:', error);
  }
}, 60 * 60 * 1000); // Check every hour

app.get('/', (req, res) => res.json({ status: 'ok', message: 'Atasa Blog API', audioProcessor: AUDIO_PROCESSOR_URL }));

// =====================
// AUTH
// =====================
app.post('/api/auth/verify', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    const result = await pool.query('SELECT * FROM allowed_users WHERE email = $1', [email.toLowerCase()]);
    res.json(result.rows.length > 0 ? { allowed: true, user: result.rows[0] } : { allowed: false });
  } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
});

app.get('/api/auth/users', async (req, res) => {
  try { res.json((await pool.query('SELECT * FROM allowed_users ORDER BY created_at')).rows); }
  catch (error) { res.status(500).json({ error: 'Internal server error' }); }
});

app.post('/api/auth/users', async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    const result = await pool.query('INSERT INTO allowed_users (email, name) VALUES ($1, $2) ON CONFLICT (email) DO UPDATE SET name = $2 RETURNING *', [email.toLowerCase(), name || '']);
    res.json({ success: true, user: result.rows[0] });
  } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
});

app.delete('/api/auth/users/:id', async (req, res) => {
  try { await pool.query('DELETE FROM allowed_users WHERE id = $1', [req.params.id]); res.json({ success: true }); }
  catch (error) { res.status(500).json({ error: 'Internal server error' }); }
});

// =====================
// YOUTUBE VIDEOS
// =====================
app.get('/api/youtube/videos', async (req, res) => {
  try {
    const { type } = req.query;
    let query = 'SELECT * FROM youtube_videos';
    let params = [];
    if (type) { query += ' WHERE video_type = $1'; params.push(type); }
    query += ' ORDER BY published_at DESC';
    res.json((await pool.query(query, params)).rows);
  } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
});

app.post('/api/youtube/videos', async (req, res) => {
  try {
    const { videos } = req.body;
    if (!videos || !Array.isArray(videos)) return res.status(400).json({ error: 'Videos array required' });
    for (const video of videos) {
      await pool.query(`INSERT INTO youtube_videos (id, title, description, thumbnail, duration, view_count, published_at, channel_id, video_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO UPDATE SET title = $2, description = $3, thumbnail = $4, duration = $5, view_count = $6, published_at = $7, video_type = $9, updated_at = CURRENT_TIMESTAMP`, [video.id, video.title, video.description, video.thumbnail, video.duration, video.viewCount, video.publishedAt, video.channelId, video.type || 'video']);
    }
    res.json({ success: true, count: videos.length });
  } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
});

// Reclassify videos - update video types based on provided data
app.post('/api/youtube/videos/reclassify', async (req, res) => {
  try {
    const { videos } = req.body;
    if (!videos || !Array.isArray(videos)) return res.status(400).json({ error: 'Videos array required' });
    
    let updated = 0;
    for (const video of videos) {
      const result = await pool.query(
        `UPDATE youtube_videos SET video_type = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND video_type != $1`,
        [video.type, video.id]
      );
      if (result.rowCount > 0) updated++;
    }
    
    res.json({ success: true, updated, total: videos.length });
  } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
});

// Manual trigger for auto scan
app.post('/api/youtube/scan', async (req, res) => {
  try {
    res.json({ success: true, message: 'Scan started' });
    await autoScanVideos();
  } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
});

app.get('/api/youtube/videos/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM youtube_videos WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Video not found' });
    res.json(result.rows[0]);
  } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
});

app.put('/api/youtube/videos/:id/transcript', async (req, res) => {
  try {
    const { transcript, model, status } = req.body;
    await pool.query(`UPDATE youtube_videos SET transcript = $1, transcript_model = $2, transcript_status = $3, transcript_updated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $4`, [transcript, model, status || 'completed', req.params.id]);
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
});

// Mark video as blog created
app.put('/api/youtube/videos/:id/blog-created', async (req, res) => {
  try {
    const { blogPostId } = req.body;
    await pool.query(`UPDATE youtube_videos SET blog_created = TRUE, blog_post_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [blogPostId, req.params.id]);
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
});

// =====================
// TRANSCRIPTION via Audio Processor Service
// =====================

app.post('/api/youtube/videos/:id/transcribe', async (req, res) => {
  try {
    const videoId = req.params.id;
    const { apiKey, provider } = req.body;
    if (!apiKey) return res.status(400).json({ error: 'apiKey required' });
    
    const videoResult = await pool.query('SELECT * FROM youtube_videos WHERE id = $1', [videoId]);
    if (videoResult.rows.length === 0) return res.status(404).json({ error: 'Video not found' });
    
    // Get provider from settings if not provided
    let transcriptionProvider = provider;
    if (!transcriptionProvider) {
      transcriptionProvider = await getSetting('transcription_provider') || 'openai';
    }
    
    res.json({ success: true, status: 'processing', provider: transcriptionProvider });
    
    // Start transcription in background
    startTranscription(videoId, apiKey, transcriptionProvider);
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk transcribe multiple videos
app.post('/api/youtube/videos/bulk-transcribe', async (req, res) => {
  try {
    const { videoIds, apiKey, provider } = req.body;
    if (!videoIds || !Array.isArray(videoIds)) return res.status(400).json({ error: 'videoIds array required' });
    if (!apiKey) return res.status(400).json({ error: 'apiKey required' });
    
    let transcriptionProvider = provider;
    if (!transcriptionProvider) {
      transcriptionProvider = await getSetting('transcription_provider') || 'openai';
    }
    
    // Start transcription for each video
    for (const videoId of videoIds) {
      startTranscription(videoId, apiKey, transcriptionProvider);
    }
    
    res.json({ success: true, count: videoIds.length, status: 'processing' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Extract audio only
app.post('/api/youtube/videos/:id/extract-audio', async (req, res) => {
  try {
    const videoId = req.params.id;
    
    await pool.query(`UPDATE youtube_videos SET audio_status = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [videoId]);
    res.json({ success: true, status: 'processing' });
    
    (async () => {
      try {
        const extractResponse = await fetch(`${AUDIO_PROCESSOR_URL}/extract`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId })
        });
        
        const extractData = await extractResponse.json();
        if (!extractData.success) throw new Error(extractData.error);
        
        const jobId = extractData.jobId;
        let completed = false;
        let attempts = 0;
        
        while (!completed && attempts < 60) {
          await new Promise(r => setTimeout(r, 5000));
          attempts++;
          
          const statusResponse = await fetch(`${AUDIO_PROCESSOR_URL}/status/${jobId}`);
          const statusData = await statusResponse.json();
          
          if (statusData.status === 'completed') {
            completed = true;
            const audioUrl = `${AUDIO_PROCESSOR_URL}/audio/${videoId}`;
            await pool.query(`UPDATE youtube_videos SET audio_url = $1, audio_status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [audioUrl, videoId]);
            console.log(`✅ Audio extracted for ${videoId}`);
          } else if (statusData.status === 'failed') {
            throw new Error(statusData.error);
          }
        }
        
        if (!completed) throw new Error('Audio extraction timeout');
        
      } catch (error) {
        await pool.query(`UPDATE youtube_videos SET audio_status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [videoId]);
        console.error(`❌ Audio extraction failed for ${videoId}:`, error.message);
      }
    })();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =====================
// SETTINGS
// =====================
app.get('/api/settings', async (req, res) => {
  try {
    const result = await pool.query('SELECT key, value FROM settings');
    const settings = {};
    result.rows.forEach(row => {
      if (row.value === 'true') settings[row.key] = true;
      else if (row.value === 'false') settings[row.key] = false;
      else settings[row.key] = row.value;
    });
    res.json(settings);
  } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
});

app.put('/api/settings', async (req, res) => {
  try {
    for (const [key, value] of Object.entries(req.body)) {
      await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', [key, String(value)]);
    }
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
});

// =====================
// POSTS
// =====================
app.get('/api/posts/all', async (req, res) => {
  try { res.json((await pool.query('SELECT * FROM posts ORDER BY created_at DESC')).rows.map(formatPost)); }
  catch (error) { res.status(500).json({ error: 'Internal server error' }); }
});

app.get('/api/posts', async (req, res) => {
  try { res.json((await pool.query("SELECT * FROM posts WHERE status = 'published' ORDER BY published_at DESC")).rows.map(formatPost)); }
  catch (error) { res.status(500).json({ error: 'Internal server error' }); }
});

app.get('/api/posts/:slug', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM posts WHERE slug = $1 AND status = 'published'", [req.params.slug]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Post not found' });
    res.json(formatPost(result.rows[0]));
  } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
});

app.post('/api/posts', async (req, res) => {
  try {
    const { title, content, category, excerpt, thumbnail, status, videoId } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'Title and content required' });
    const slug = generateSlug(title) + '-' + Date.now();
    const postStatus = status || 'draft';
    const result = await pool.query(`INSERT INTO posts (title, slug, content, category, excerpt, thumbnail, date, read_time, status, published_at, video_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`, [title, slug, content, category || 'Genel', excerpt || content.substring(0, 150) + '...', thumbnail || '', formatDateTR(), calculateReadTime(content), postStatus, postStatus === 'published' ? new Date() : null, videoId || null]);
    
    // Mark video as blog created
    if (videoId) {
      await pool.query(`UPDATE youtube_videos SET blog_created = TRUE, blog_post_id = $1 WHERE id = $2`, [result.rows[0].id, videoId]);
    }
    
    res.status(201).json({ success: true, post: formatPost(result.rows[0]) });
  } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
});

app.post('/api/webhook/blog', async (req, res) => {
  try {
    const { title, content, category, excerpt, thumbnail } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'Title and content required' });
    const autopilot = await getSetting('autopilot') === 'true';
    const postStatus = autopilot ? 'published' : 'draft';
    const slug = generateSlug(title) + '-' + Date.now();
    const result = await pool.query(`INSERT INTO posts (title, slug, content, category, excerpt, thumbnail, date, read_time, status, published_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`, [title, slug, content, category || 'Genel', excerpt || content.substring(0, 150) + '...', thumbnail || '', formatDateTR(), calculateReadTime(content), postStatus, postStatus === 'published' ? new Date() : null]);
    res.status(201).json({ success: true, post: formatPost(result.rows[0]), autopilot });
  } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
});

app.put('/api/posts/:id/publish', async (req, res) => {
  try {
    const result = await pool.query(`UPDATE posts SET status = 'published', published_at = CURRENT_TIMESTAMP, scheduled_at = NULL, date = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`, [formatDateTR(), req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Post not found' });
    res.json({ success: true, post: formatPost(result.rows[0]) });
  } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
});

app.put('/api/posts/:id/schedule', async (req, res) => {
  try {
    const { scheduledAt } = req.body;
    if (!scheduledAt) return res.status(400).json({ error: 'scheduledAt required' });
    const result = await pool.query(`UPDATE posts SET status = 'scheduled', scheduled_at = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`, [scheduledAt, req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Post not found' });
    res.json({ success: true, post: formatPost(result.rows[0]) });
  } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
});

app.put('/api/posts/:id/unpublish', async (req, res) => {
  try {
    const result = await pool.query(`UPDATE posts SET status = 'draft', published_at = NULL, scheduled_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Post not found' });
    res.json({ success: true, post: formatPost(result.rows[0]) });
  } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
});

app.put('/api/posts/:id', async (req, res) => {
  try {
    const { title, content, category, excerpt, thumbnail, status } = req.body;
    const existing = await pool.query('SELECT * FROM posts WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Post not found' });
    const post = existing.rows[0];
    const result = await pool.query(`UPDATE posts SET title = $1, content = $2, category = $3, excerpt = $4, thumbnail = $5, read_time = $6, status = $7, updated_at = CURRENT_TIMESTAMP WHERE id = $8 RETURNING *`, [title || post.title, content || post.content, category || post.category, excerpt || post.excerpt, thumbnail || post.thumbnail, content ? calculateReadTime(content) : post.read_time, status || post.status, req.params.id]);
    res.json({ success: true, post: formatPost(result.rows[0]) });
  } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
});

app.delete('/api/posts/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM posts WHERE id = $1 RETURNING title, video_id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Post not found' });
    
    // Reset blog_created flag on video
    if (result.rows[0].video_id) {
      await pool.query(`UPDATE youtube_videos SET blog_created = FALSE, blog_post_id = NULL WHERE id = $1`, [result.rows[0].video_id]);
    }
    
    res.json({ success: true, deleted: result.rows[0].title });
  } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
});

function formatPost(row) {
  return { id: row.id.toString(), title: row.title, slug: row.slug, content: row.content, category: row.category, excerpt: row.excerpt, thumbnail: row.thumbnail, date: row.date, readTime: row.read_time, status: row.status, scheduledAt: row.scheduled_at, publishedAt: row.published_at, videoId: row.video_id, createdAt: row.created_at, updatedAt: row.updated_at };
}

app.listen(PORT, async () => {
  console.log(`🚀 Atasa Blog API on port ${PORT}`);
  console.log(`📡 Audio Processor: ${AUDIO_PROCESSOR_URL}`);
  await initDB();
  
  // Run initial scan after 10 seconds
  setTimeout(() => {
    autoScanVideos();
  }, 10000);
});
