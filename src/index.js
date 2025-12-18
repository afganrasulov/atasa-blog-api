import express from 'express';
import cors from 'cors';
import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database tables
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        title VARCHAR(500) NOT NULL,
        slug VARCHAR(500) UNIQUE NOT NULL,
        content TEXT NOT NULL,
        category VARCHAR(100) DEFAULT 'Genel',
        excerpt TEXT,
        thumbnail VARCHAR(500),
        date VARCHAR(100),
        read_time VARCHAR(50),
        status VARCHAR(20) DEFAULT 'draft',
        scheduled_at TIMESTAMP,
        published_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT
      )
    `);

    await pool.query(`
      INSERT INTO settings (key, value) 
      VALUES ('autopilot', 'false') 
      ON CONFLICT (key) DO NOTHING
    `);

    console.log('✅ Database initialized');
  } catch (error) {
    console.error('Database init error:', error);
  }
}

// Helper functions
function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
    .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function formatDateTR() {
  return new Date().toLocaleDateString('tr-TR', { 
    day: 'numeric', month: 'long', year: 'numeric' 
  });
}

function calculateReadTime(content) {
  const words = content.split(' ').length;
  return Math.ceil(words / 200) + ' dk okuma';
}

// Check scheduled posts
async function checkScheduledPosts() {
  try {
    const result = await pool.query(`
      UPDATE posts SET status = 'published', published_at = CURRENT_TIMESTAMP, date = $1
      WHERE status = 'scheduled' AND scheduled_at <= CURRENT_TIMESTAMP
      RETURNING title
    `, [formatDateTR()]);
    
    result.rows.forEach(post => console.log(`📅 Published: ${post.title}`));
  } catch (error) {
    console.error('Schedule check error:', error);
  }
}

setInterval(checkScheduledPosts, 60000);

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Atasa Blog API (PostgreSQL)',
    endpoints: [
      'GET /api/posts', 'GET /api/posts/all', 'GET /api/posts/:slug',
      'POST /api/posts', 'PUT /api/posts/:id', 'DELETE /api/posts/:id',
      'GET /api/youtube/transcript/:videoId'
    ]
  });
});

// =====================
// YOUTUBE TRANSCRIPT - Multiple methods
// =====================

async function fetchTranscriptMethod1(videoId) {
  // Method 1: Direct YouTube innertube API
  const response = await fetch('https://www.youtube.com/youtubei/v1/get_transcript?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      context: {
        client: {
          clientName: 'WEB',
          clientVersion: '2.20231219.04.00'
        }
      },
      params: Buffer.from(`\n\x0b${videoId}`).toString('base64')
    })
  });
  
  if (!response.ok) throw new Error('Innertube API failed');
  
  const data = await response.json();
  
  // Extract transcript from response
  const transcriptRenderer = data?.actions?.[0]?.updateEngagementPanelAction?.content?.transcriptRenderer;
  const cueGroups = transcriptRenderer?.content?.transcriptSearchPanelRenderer?.body?.transcriptSegmentListRenderer?.initialSegments
    || transcriptRenderer?.body?.transcriptSegmentListRenderer?.initialSegments
    || [];
  
  if (cueGroups.length === 0) throw new Error('No transcript in innertube response');
  
  const segments = cueGroups
    .map(seg => seg?.transcriptSegmentRenderer?.snippet?.runs?.[0]?.text)
    .filter(text => text);
  
  return segments;
}

async function fetchTranscriptMethod2(videoId) {
  // Method 2: Scrape from YouTube watch page
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const response = await fetch(watchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8'
    }
  });
  
  if (!response.ok) throw new Error('Failed to fetch YouTube page');
  
  const html = await response.text();
  
  // Find timedtext URL in the page
  const patterns = [
    /"baseUrl"\s*:\s*"(https:\/\/www\.youtube\.com\/api\/timedtext[^"]+)"/g,
    /"captionTracks"\s*:\s*\[\s*\{[^}]*"baseUrl"\s*:\s*"([^"]+)"/g
  ];
  
  let captionUrl = null;
  
  for (const pattern of patterns) {
    const matches = [...html.matchAll(pattern)];
    for (const match of matches) {
      const url = match[1].replace(/\\u0026/g, '&').replace(/\\"/g, '"');
      if (url.includes('lang=tr')) {
        captionUrl = url;
        break;
      }
      if (!captionUrl) captionUrl = url;
    }
    if (captionUrl) break;
  }
  
  if (!captionUrl) throw new Error('No caption URL found');
  
  // Fetch the captions
  const captionResponse = await fetch(captionUrl);
  if (!captionResponse.ok) throw new Error('Failed to fetch captions');
  
  const captionText = await captionResponse.text();
  
  // Parse XML or JSON
  let segments = [];
  
  if (captionText.includes('<transcript>') || captionText.includes('<text')) {
    // XML format
    const textMatches = [...captionText.matchAll(/<text[^>]*>([^<]*)<\/text>/g)];
    segments = textMatches.map(m => decodeHTMLEntities(m[1])).filter(t => t.trim());
  } else {
    // Try JSON format
    try {
      const json = JSON.parse(captionText);
      segments = (json.events || [])
        .filter(e => e.segs)
        .flatMap(e => e.segs.map(s => s.utf8))
        .filter(t => t && t.trim());
    } catch {
      throw new Error('Unknown caption format');
    }
  }
  
  return segments;
}

async function fetchTranscriptMethod3(videoId) {
  // Method 3: Use a third-party transcript service
  const response = await fetch(`https://yt.lemnoslife.com/videos?part=transcript&id=${videoId}`);
  
  if (!response.ok) throw new Error('Third-party API failed');
  
  const data = await response.json();
  const transcript = data?.items?.[0]?.transcript?.content;
  
  if (!transcript || transcript.length === 0) throw new Error('No transcript from third-party');
  
  return transcript.map(item => item.text).filter(t => t);
}

function decodeHTMLEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/\\n/g, ' ')
    .replace(/\n/g, ' ');
}

app.get('/api/youtube/transcript/:videoId', async (req, res) => {
  const { videoId } = req.params;
  console.log(`📺 Fetching transcript for: ${videoId}`);
  
  const methods = [
    { name: 'Method3-ThirdParty', fn: () => fetchTranscriptMethod3(videoId) },
    { name: 'Method2-Scrape', fn: () => fetchTranscriptMethod2(videoId) },
    { name: 'Method1-Innertube', fn: () => fetchTranscriptMethod1(videoId) }
  ];
  
  let lastError = null;
  
  for (const method of methods) {
    try {
      console.log(`  Trying ${method.name}...`);
      const segments = await method.fn();
      
      if (segments && segments.length > 0) {
        const fullText = segments
          .join(' ')
          .replace(/\[.*?\]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        
        if (fullText.length > 10) {
          console.log(`✅ Success with ${method.name}: ${segments.length} segments`);
          
          return res.json({
            success: true,
            videoId,
            method: method.name,
            transcript: fullText,
            segments,
            segmentCount: segments.length,
            characterCount: fullText.length,
            wordCount: fullText.split(/\s+/).filter(w => w).length
          });
        }
      }
    } catch (error) {
      console.log(`  ${method.name} failed: ${error.message}`);
      lastError = error;
    }
  }
  
  console.log(`❌ All methods failed for ${videoId}`);
  
  res.status(404).json({
    success: false,
    videoId,
    error: 'Transcript not available',
    message: lastError?.message || 'Bu video için altyazı bulunamadı. Video altyazısı kapalı veya mevcut olmayabilir.'
  });
});

// =====================
// SETTINGS
// =====================

app.get('/api/settings', async (req, res) => {
  try {
    const result = await pool.query('SELECT key, value FROM settings');
    const settings = {};
    result.rows.forEach(row => {
      settings[row.key] = row.value === 'true';
    });
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/settings', async (req, res) => {
  try {
    const { autopilot } = req.body;
    if (typeof autopilot === 'boolean') {
      await pool.query('UPDATE settings SET value = $1 WHERE key = $2', [autopilot.toString(), 'autopilot']);
    }
    const result = await pool.query('SELECT key, value FROM settings');
    const settings = {};
    result.rows.forEach(row => settings[row.key] = row.value === 'true');
    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =====================
// POSTS
// =====================

app.get('/api/posts/all', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM posts ORDER BY created_at DESC');
    res.json(result.rows.map(formatPost));
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/posts', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM posts WHERE status = 'published' ORDER BY published_at DESC");
    res.json(result.rows.map(formatPost));
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/posts/drafts', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM posts WHERE status = 'draft' ORDER BY created_at DESC");
    res.json(result.rows.map(formatPost));
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/posts/scheduled', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM posts WHERE status = 'scheduled' ORDER BY scheduled_at ASC");
    res.json(result.rows.map(formatPost));
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/posts/id/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM posts WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Post not found' });
    res.json(formatPost(result.rows[0]));
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/posts/:slug', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM posts WHERE slug = $1 AND status = 'published'", [req.params.slug]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Post not found' });
    res.json(formatPost(result.rows[0]));
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/posts', async (req, res) => {
  try {
    const { title, content, category, excerpt, thumbnail, status } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'Title and content required' });
    
    const slug = generateSlug(title);
    const postStatus = status || 'draft';
    const result = await pool.query(`
      INSERT INTO posts (title, slug, content, category, excerpt, thumbnail, date, read_time, status, published_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *
    `, [
      title, slug, content, category || 'Genel',
      excerpt || content.substring(0, 150) + '...',
      thumbnail || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&q=80',
      formatDateTR(), calculateReadTime(content), postStatus,
      postStatus === 'published' ? new Date() : null
    ]);
    
    console.log(`✅ Created: ${title}`);
    res.status(201).json({ success: true, post: formatPost(result.rows[0]) });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/webhook/blog', async (req, res) => {
  try {
    const { title, content, category, excerpt, thumbnail } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'Title and content required' });
    
    const settingsResult = await pool.query("SELECT value FROM settings WHERE key = 'autopilot'");
    const autopilot = settingsResult.rows[0]?.value === 'true';
    const postStatus = autopilot ? 'published' : 'draft';
    
    const slug = generateSlug(title);
    const result = await pool.query(`
      INSERT INTO posts (title, slug, content, category, excerpt, thumbnail, date, read_time, status, published_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *
    `, [
      title, slug, content, category || 'Genel',
      excerpt || content.substring(0, 150) + '...',
      thumbnail || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&q=80',
      formatDateTR(), calculateReadTime(content), postStatus,
      postStatus === 'published' ? new Date() : null
    ]);
    
    console.log(`📝 Webhook: ${title} (${postStatus})`);
    res.status(201).json({ success: true, post: formatPost(result.rows[0]), autopilot });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/posts/:id/publish', async (req, res) => {
  try {
    const result = await pool.query(`
      UPDATE posts SET status = 'published', published_at = CURRENT_TIMESTAMP,
        scheduled_at = NULL, date = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 RETURNING *
    `, [formatDateTR(), req.params.id]);
    
    if (result.rows.length === 0) return res.status(404).json({ error: 'Post not found' });
    res.json({ success: true, post: formatPost(result.rows[0]) });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/posts/:id/schedule', async (req, res) => {
  try {
    const { scheduledAt } = req.body;
    if (!scheduledAt) return res.status(400).json({ error: 'scheduledAt required' });
    
    const result = await pool.query(`
      UPDATE posts SET status = 'scheduled', scheduled_at = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 RETURNING *
    `, [scheduledAt, req.params.id]);
    
    if (result.rows.length === 0) return res.status(404).json({ error: 'Post not found' });
    res.json({ success: true, post: formatPost(result.rows[0]) });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/posts/:id/unpublish', async (req, res) => {
  try {
    const result = await pool.query(`
      UPDATE posts SET status = 'draft', published_at = NULL, scheduled_at = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 RETURNING *
    `, [req.params.id]);
    
    if (result.rows.length === 0) return res.status(404).json({ error: 'Post not found' });
    res.json({ success: true, post: formatPost(result.rows[0]) });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/posts/:id', async (req, res) => {
  try {
    const { title, content, category, excerpt, thumbnail, status } = req.body;
    const existing = await pool.query('SELECT * FROM posts WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Post not found' });
    
    const post = existing.rows[0];
    const newTitle = title || post.title;
    const newContent = content || post.content;
    
    const result = await pool.query(`
      UPDATE posts SET title = $1, slug = $2, content = $3, category = $4,
        excerpt = $5, thumbnail = $6, read_time = $7, status = $8, updated_at = CURRENT_TIMESTAMP
      WHERE id = $9 RETURNING *
    `, [
      newTitle, title ? generateSlug(newTitle) : post.slug, newContent,
      category || post.category,
      excerpt || (content ? content.substring(0, 150) + '...' : post.excerpt),
      thumbnail || post.thumbnail,
      content ? calculateReadTime(newContent) : post.read_time,
      status || post.status, req.params.id
    ]);
    
    res.json({ success: true, post: formatPost(result.rows[0]) });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/posts/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM posts WHERE id = $1 RETURNING title', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Post not found' });
    res.json({ success: true, deleted: result.rows[0].title });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

function formatPost(row) {
  return {
    id: row.id.toString(),
    title: row.title,
    slug: row.slug,
    content: row.content,
    category: row.category,
    excerpt: row.excerpt,
    thumbnail: row.thumbnail,
    date: row.date,
    readTime: row.read_time,
    status: row.status,
    scheduledAt: row.scheduled_at,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

app.listen(PORT, async () => {
  console.log(`🚀 Atasa Blog API on port ${PORT}`);
  await initDB();
  checkScheduledPosts();
});