import express from 'express';
import cors from 'cors';
import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;
const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Database init
async function initDB() {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS posts (id SERIAL PRIMARY KEY, title VARCHAR(500) NOT NULL, slug VARCHAR(500) UNIQUE NOT NULL, content TEXT NOT NULL, category VARCHAR(100) DEFAULT 'Genel', excerpt TEXT, thumbnail VARCHAR(500), date VARCHAR(100), read_time VARCHAR(50), status VARCHAR(20) DEFAULT 'draft', scheduled_at TIMESTAMP, published_at TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS settings (key VARCHAR(100) PRIMARY KEY, value TEXT)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS youtube_videos (id VARCHAR(50) PRIMARY KEY, title VARCHAR(500), description TEXT, thumbnail VARCHAR(500), duration INTEGER, view_count INTEGER, published_at TIMESTAMP, channel_id VARCHAR(50), video_type VARCHAR(20) DEFAULT 'video', audio_url TEXT, audio_status VARCHAR(20) DEFAULT 'pending', transcript TEXT, transcript_status VARCHAR(20) DEFAULT 'pending', transcript_job_id VARCHAR(100), transcript_model VARCHAR(50), transcript_updated_at TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS allowed_users (id SERIAL PRIMARY KEY, email VARCHAR(255) UNIQUE NOT NULL, name VARCHAR(255), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    
    await pool.query(`ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS audio_url TEXT`);
    await pool.query(`ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS audio_status VARCHAR(20) DEFAULT 'pending'`);
    await pool.query(`ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS transcript_job_id VARCHAR(100)`);
    
    await pool.query(`INSERT INTO settings (key, value) VALUES ('autopilot', 'false') ON CONFLICT (key) DO NOTHING`);
    await pool.query(`INSERT INTO allowed_users (email, name) VALUES ('afganrasulov@gmail.com', 'Afgan Rasulov') ON CONFLICT (email) DO NOTHING`);
    console.log('✅ Database initialized');
  } catch (error) { console.error('Database init error:', error); }
}

function generateSlug(title) {
  return title.toLowerCase().replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
}
function formatDateTR() { return new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }); }
function calculateReadTime(content) { return Math.ceil(content.split(' ').length / 200) + ' dk okuma'; }

// Scheduled posts check
setInterval(async () => {
  try {
    const result = await pool.query(`UPDATE posts SET status = 'published', published_at = CURRENT_TIMESTAMP, date = $1 WHERE status = 'scheduled' AND scheduled_at <= CURRENT_TIMESTAMP RETURNING title`, [formatDateTR()]);
    result.rows.forEach(post => console.log(`📅 Published: ${post.title}`));
  } catch (error) { console.error('Schedule check error:', error); }
}, 60000);

app.get('/', (req, res) => res.json({ status: 'ok', message: 'Atasa Blog API' }));

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
      await pool.query(`INSERT INTO youtube_videos (id, title, description, thumbnail, duration, view_count, published_at, channel_id, video_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO UPDATE SET title = $2, description = $3, thumbnail = $4, duration = $5, view_count = $6, published_at = $7, updated_at = CURRENT_TIMESTAMP`, [video.id, video.title, video.description, video.thumbnail, video.duration, video.viewCount, video.publishedAt, video.channelId, video.type || 'video']);
    }
    res.json({ success: true, count: videos.length });
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

// =====================
// AUDIO EXTRACTION - Multiple Methods
// =====================

async function getYouTubeAudioUrl(videoId) {
  console.log(`🎵 Getting audio URL for: ${videoId}`);
  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
  
  // Yöntem 1: y2mate.nu API
  try {
    console.log('Trying y2mate...');
    const analyzeRes = await fetch('https://www.y2mate.nu/api/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `url=${encodeURIComponent(youtubeUrl)}&task=download&filetypes=mp3`
    });
    const data = await analyzeRes.json();
    if (data.download_url) { 
      console.log('✅ y2mate success'); 
      return data.download_url; 
    }
  } catch (e) { console.log('y2mate failed:', e.message); }
  
  // Yöntem 2: loader.to API
  try {
    console.log('Trying loader.to...');
    const loaderRes = await fetch(`https://loader.to/api/button/?url=${encodeURIComponent(youtubeUrl)}&f=mp3`);
    const html = await loaderRes.text();
    const match = html.match(/href="(https:\/\/[^"]+)"/);
    if (match && match[1]) { 
      console.log('✅ loader.to success'); 
      return match[1]; 
    }
  } catch (e) { console.log('loader.to failed:', e.message); }
  
  // Yöntem 3: ssyoutube API
  try {
    console.log('Trying ssyoutube...');
    const ssRes = await fetch(`https://ssyoutube.com/api/convert?url=${encodeURIComponent(youtubeUrl)}`);
    const ssData = await ssRes.json();
    if (ssData.url) { 
      console.log('✅ ssyoutube success'); 
      return ssData.url; 
    }
  } catch (e) { console.log('ssyoutube failed:', e.message); }
  
  // Yöntem 4: 9convert
  try {
    console.log('Trying 9convert...');
    const convertRes = await fetch('https://9convert.com/api/ajaxSearch/index', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `query=${encodeURIComponent(youtubeUrl)}&vt=mp3`
    });
    const convertData = await convertRes.json();
    if (convertData.links?.mp3) {
      const mp3Links = Object.values(convertData.links.mp3);
      if (mp3Links[0]?.k) {
        const convertRes2 = await fetch('https://9convert.com/api/ajaxConvert/convert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `vid=${convertData.vid}&k=${encodeURIComponent(mp3Links[0].k)}`
        });
        const convertData2 = await convertRes2.json();
        if (convertData2.dlink) {
          console.log('✅ 9convert success');
          return convertData2.dlink;
        }
      }
    }
  } catch (e) { console.log('9convert failed:', e.message); }
  
  // Yöntem 5: yt1s
  try {
    console.log('Trying yt1s...');
    const yt1sRes = await fetch('https://www.yt1s.com/api/ajaxSearch/index', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `q=${encodeURIComponent(youtubeUrl)}&vt=mp3`
    });
    const yt1sData = await yt1sRes.json();
    if (yt1sData.links?.mp3) {
      const mp3Links = Object.values(yt1sData.links.mp3);
      if (mp3Links[0]?.k) {
        const yt1sRes2 = await fetch('https://www.yt1s.com/api/ajaxConvert/convert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `vid=${yt1sData.vid}&k=${encodeURIComponent(mp3Links[0].k)}`
        });
        const yt1sData2 = await yt1sRes2.json();
        if (yt1sData2.dlink) {
          console.log('✅ yt1s success');
          return yt1sData2.dlink;
        }
      }
    }
  } catch (e) { console.log('yt1s failed:', e.message); }

  // Yöntem 6: vevioz (eski)
  try {
    console.log('Trying vevioz...');
    const analyzeRes = await fetch(`https://api.vevioz.com/api/button/mp3/${videoId}`);
    const html = await analyzeRes.text();
    const match = html.match(/href="(https:\/\/[^"]+\.mp3[^"]*)"/);
    if (match) { console.log('✅ Vevioz success'); return match[1]; }
  } catch (e) { console.log('Vevioz failed:', e.message); }
  
  // Yöntem 7: mp3download.to
  try {
    console.log('Trying mp3download.to...');
    const mp3Res = await fetch(`https://mp3download.to/api/v1/download?url=${encodeURIComponent(youtubeUrl)}`);
    const mp3Data = await mp3Res.json();
    if (mp3Data.downloadUrl) {
      console.log('✅ mp3download.to success');
      return mp3Data.downloadUrl;
    }
  } catch (e) { console.log('mp3download.to failed:', e.message); }
  
  throw new Error('Tüm audio extraction yöntemleri başarısız oldu');
}

// MP3'e çevir endpoint
app.post('/api/youtube/videos/:id/extract-audio', async (req, res) => {
  try {
    const videoId = req.params.id;
    
    await pool.query(`UPDATE youtube_videos SET audio_status = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [videoId]);
    res.json({ success: true, status: 'processing' });
    
    (async () => {
      try {
        const audioUrl = await getYouTubeAudioUrl(videoId);
        await pool.query(`UPDATE youtube_videos SET audio_url = $1, audio_status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [audioUrl, videoId]);
        console.log(`✅ Audio extracted for ${videoId}`);
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
// TRANSCRIPTION
// =====================

app.post('/api/youtube/videos/:id/transcribe', async (req, res) => {
  try {
    const videoId = req.params.id;
    const { apiKey } = req.body;
    if (!apiKey) return res.status(400).json({ error: 'apiKey required' });
    
    const videoResult = await pool.query('SELECT * FROM youtube_videos WHERE id = $1', [videoId]);
    if (videoResult.rows.length === 0) return res.status(404).json({ error: 'Video not found' });
    
    const video = videoResult.rows[0];
    
    await pool.query(`UPDATE youtube_videos SET transcript_status = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [videoId]);
    res.json({ success: true, status: 'processing' });
    
    (async () => {
      try {
        let audioUrl = video.audio_url;
        if (!audioUrl || video.audio_status !== 'completed') {
          console.log(`🎵 Extracting audio for ${videoId}...`);
          await pool.query(`UPDATE youtube_videos SET audio_status = 'processing' WHERE id = $1`, [videoId]);
          audioUrl = await getYouTubeAudioUrl(videoId);
          await pool.query(`UPDATE youtube_videos SET audio_url = $1, audio_status = 'completed' WHERE id = $2`, [audioUrl, videoId]);
          console.log(`✅ Audio URL obtained: ${audioUrl.substring(0, 50)}...`);
        }
        
        console.log(`🎙️ Starting transcription for ${videoId}...`);
        
        const submitResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
          method: 'POST',
          headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ audio_url: audioUrl, language_code: 'tr' })
        });
        
        const submitData = await submitResponse.json();
        console.log('AssemblyAI response:', JSON.stringify(submitData));
        
        if (submitData.error) throw new Error(submitData.error);
        
        const transcriptId = submitData.id;
        await pool.query(`UPDATE youtube_videos SET transcript_job_id = $1 WHERE id = $2`, [transcriptId, videoId]);
        
        console.log(`📝 Transcript job started: ${transcriptId}`);
        
        let completed = false;
        let attempts = 0;
        const maxAttempts = 60; // 5 dakika max
        
        while (!completed && attempts < maxAttempts) {
          await new Promise(r => setTimeout(r, 5000));
          attempts++;
          
          const checkResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
            headers: { 'Authorization': apiKey }
          });
          const checkData = await checkResponse.json();
          
          console.log(`Polling ${attempts}: status = ${checkData.status}`);
          
          if (checkData.status === 'completed') {
            completed = true;
            await pool.query(`UPDATE youtube_videos SET transcript = $1, transcript_status = 'completed', transcript_model = 'assemblyai', transcript_updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [checkData.text, videoId]);
            console.log(`✅ Transcription completed for ${videoId}`);
          } else if (checkData.status === 'error') {
            throw new Error(checkData.error || 'Transcription failed');
          }
        }
        
        if (!completed) {
          throw new Error('Transcription timeout');
        }
      } catch (error) {
        console.error(`❌ Transcription failed for ${videoId}:`, error.message);
        await pool.query(`UPDATE youtube_videos SET transcript_status = 'failed', audio_status = CASE WHEN audio_status = 'processing' THEN 'failed' ELSE audio_status END, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [videoId]);
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
    const { title, content, category, excerpt, thumbnail, status } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'Title and content required' });
    const slug = generateSlug(title) + '-' + Date.now();
    const postStatus = status || 'draft';
    const result = await pool.query(`INSERT INTO posts (title, slug, content, category, excerpt, thumbnail, date, read_time, status, published_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`, [title, slug, content, category || 'Genel', excerpt || content.substring(0, 150) + '...', thumbnail || '', formatDateTR(), calculateReadTime(content), postStatus, postStatus === 'published' ? new Date() : null]);
    res.status(201).json({ success: true, post: formatPost(result.rows[0]) });
  } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
});

app.post('/api/webhook/blog', async (req, res) => {
  try {
    const { title, content, category, excerpt, thumbnail } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'Title and content required' });
    const settingsResult = await pool.query("SELECT value FROM settings WHERE key = 'autopilot'");
    const autopilot = settingsResult.rows[0]?.value === 'true';
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
    const result = await pool.query('DELETE FROM posts WHERE id = $1 RETURNING title', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Post not found' });
    res.json({ success: true, deleted: result.rows[0].title });
  } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
});

function formatPost(row) {
  return { id: row.id.toString(), title: row.title, slug: row.slug, content: row.content, category: row.category, excerpt: row.excerpt, thumbnail: row.thumbnail, date: row.date, readTime: row.read_time, status: row.status, scheduledAt: row.scheduled_at, publishedAt: row.published_at, createdAt: row.created_at, updatedAt: row.updated_at };
}

app.listen(PORT, async () => {
  console.log(`🚀 Atasa Blog API on port ${PORT}`);
  await initDB();
});
