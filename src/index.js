import express from 'express';
import cors from 'cors';
import pg from 'pg';
import { YoutubeTranscript } from 'youtube-transcript';
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
        value VARCHAR(500)
      )
    `);

    // Insert default autopilot setting if not exists
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

// Helper: Generate slug from title
function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

// Helper: Format date in Turkish
function formatDateTR() {
  return new Date().toLocaleDateString('tr-TR', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });
}

// Helper: Calculate read time
function calculateReadTime(content) {
  const words = content.split(' ').length;
  return Math.ceil(words / 200) + ' dk okuma';
}

// Check and publish scheduled posts
async function checkScheduledPosts() {
  try {
    const result = await pool.query(`
      UPDATE posts 
      SET status = 'published', 
          published_at = CURRENT_TIMESTAMP,
          date = $1
      WHERE status = 'scheduled' 
        AND scheduled_at <= CURRENT_TIMESTAMP
      RETURNING title
    `, [formatDateTR()]);
    
    if (result.rows.length > 0) {
      result.rows.forEach(post => {
        console.log(`📅 Scheduled post published: ${post.title}`);
      });
    }
  } catch (error) {
    console.error('Schedule check error:', error);
  }
}

// Check scheduled posts every minute
setInterval(checkScheduledPosts, 60000);

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Atasa Blog API is running (PostgreSQL)',
    endpoints: {
      'GET /api/posts': 'List published posts (for frontend)',
      'GET /api/posts/all': 'List all posts (for admin)',
      'GET /api/posts/drafts': 'List draft posts',
      'GET /api/posts/scheduled': 'List scheduled posts',
      'GET /api/posts/:slug': 'Get post by slug',
      'GET /api/posts/id/:id': 'Get post by ID',
      'POST /api/webhook/blog': 'Create new post (from n8n)',
      'POST /api/posts': 'Create new post',
      'PUT /api/posts/:id': 'Update post by ID',
      'PUT /api/posts/:id/publish': 'Publish a draft post',
      'PUT /api/posts/:id/schedule': 'Schedule a post',
      'PUT /api/posts/:id/unpublish': 'Unpublish to draft',
      'DELETE /api/posts/:id': 'Delete post by ID',
      'GET /api/settings': 'Get settings',
      'PUT /api/settings': 'Update settings',
      'GET /api/youtube/transcript/:videoId': 'Get YouTube video transcript'
    }
  });
});

// =====================
// YOUTUBE TRANSCRIPT
// =====================

// GET YouTube video transcript
app.get('/api/youtube/transcript/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const { lang } = req.query; // Optional language parameter
    
    console.log(`📺 Fetching transcript for video: ${videoId}`);
    
    // Try to get transcript
    let transcript;
    try {
      if (lang) {
        transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang });
      } else {
        // Try Turkish first, then English, then any available
        try {
          transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'tr' });
        } catch {
          try {
            transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'en' });
          } catch {
            transcript = await YoutubeTranscript.fetchTranscript(videoId);
          }
        }
      }
    } catch (error) {
      console.error('Transcript fetch error:', error.message);
      return res.status(404).json({ 
        error: 'Transcript not available',
        message: 'Bu video için altyazı bulunamadı. Video altyazısı kapalı olabilir.',
        videoId 
      });
    }
    
    if (!transcript || transcript.length === 0) {
      return res.status(404).json({ 
        error: 'No transcript found',
        message: 'Altyazı bulunamadı',
        videoId 
      });
    }
    
    // Combine transcript segments into full text
    const fullText = transcript.map(segment => segment.text).join(' ');
    
    // Clean up the text
    const cleanedText = fullText
      .replace(/\[.*?\]/g, '') // Remove [Music], [Applause] etc.
      .replace(/\s+/g, ' ')    // Normalize whitespace
      .trim();
    
    console.log(`✅ Transcript fetched: ${cleanedText.length} characters`);
    
    res.json({
      success: true,
      videoId,
      transcript: cleanedText,
      segments: transcript,
      segmentCount: transcript.length,
      characterCount: cleanedText.length,
      wordCount: cleanedText.split(' ').length
    });
    
  } catch (error) {
    console.error('Transcript error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// =====================
// SETTINGS
// =====================

// GET settings
app.get('/api/settings', async (req, res) => {
  try {
    const result = await pool.query('SELECT key, value FROM settings');
    const settings = {};
    result.rows.forEach(row => {
      settings[row.key] = row.value === 'true';
    });
    res.json(settings);
  } catch (error) {
    console.error('Settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT settings
app.put('/api/settings', async (req, res) => {
  try {
    const { autopilot } = req.body;
    
    if (typeof autopilot === 'boolean') {
      await pool.query(
        'UPDATE settings SET value = $1 WHERE key = $2',
        [autopilot.toString(), 'autopilot']
      );
    }
    
    const result = await pool.query('SELECT key, value FROM settings');
    const settings = {};
    result.rows.forEach(row => {
      settings[row.key] = row.value === 'true';
    });
    
    console.log(`⚙️ Settings updated: autopilot=${settings.autopilot}`);
    res.json({ success: true, settings });
  } catch (error) {
    console.error('Settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =====================
// POSTS
// =====================

// GET all posts (for admin)
app.get('/api/posts/all', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM posts ORDER BY created_at DESC'
    );
    res.json(result.rows.map(formatPost));
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET only published posts (for frontend)
app.get('/api/posts', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM posts WHERE status = 'published' ORDER BY published_at DESC"
    );
    res.json(result.rows.map(formatPost));
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET draft posts
app.get('/api/posts/drafts', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM posts WHERE status = 'draft' ORDER BY created_at DESC"
    );
    res.json(result.rows.map(formatPost));
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET scheduled posts
app.get('/api/posts/scheduled', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM posts WHERE status = 'scheduled' ORDER BY scheduled_at ASC"
    );
    res.json(result.rows.map(formatPost));
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET single post by ID
app.get('/api/posts/id/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM posts WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }
    res.json(formatPost(result.rows[0]));
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET single post by slug (only published)
app.get('/api/posts/:slug', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM posts WHERE slug = $1 AND status = 'published'", 
      [req.params.slug]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }
    res.json(formatPost(result.rows[0]));
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST - Create new post
app.post('/api/posts', async (req, res) => {
  try {
    const { title, content, category, excerpt, thumbnail, status } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }
    
    const slug = generateSlug(title);
    const postStatus = status || 'draft';
    const date = formatDateTR();
    const readTime = calculateReadTime(content);
    const postExcerpt = excerpt || content.substring(0, 150) + '...';
    const postThumbnail = thumbnail || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&q=80';
    
    const result = await pool.query(`
      INSERT INTO posts (title, slug, content, category, excerpt, thumbnail, date, read_time, status, published_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      title, slug, content, category || 'Genel', postExcerpt, postThumbnail,
      date, readTime, postStatus, 
      postStatus === 'published' ? new Date() : null
    ]);
    
    console.log(`✅ New post created: ${title} (${postStatus})`);
    
    res.status(201).json({ 
      success: true, 
      message: 'Blog post created successfully',
      post: formatPost(result.rows[0])
    });
  } catch (error) {
    console.error('Create error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST webhook - receives data from n8n
app.post('/api/webhook/blog', async (req, res) => {
  try {
    const { title, content, category, excerpt, thumbnail } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }
    
    // Check autopilot setting
    const settingsResult = await pool.query("SELECT value FROM settings WHERE key = 'autopilot'");
    const autopilot = settingsResult.rows[0]?.value === 'true';
    
    const slug = generateSlug(title);
    const postStatus = autopilot ? 'published' : 'draft';
    const date = formatDateTR();
    const readTime = calculateReadTime(content);
    const postExcerpt = excerpt || content.substring(0, 150) + '...';
    const postThumbnail = thumbnail || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&q=80';
    
    const result = await pool.query(`
      INSERT INTO posts (title, slug, content, category, excerpt, thumbnail, date, read_time, status, published_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      title, slug, content, category || 'Genel', postExcerpt, postThumbnail,
      date, readTime, postStatus,
      postStatus === 'published' ? new Date() : null
    ]);
    
    console.log(`📝 Webhook post: ${title} (${postStatus}, autopilot=${autopilot})`);
    
    res.status(201).json({ 
      success: true, 
      message: `Blog post created as ${postStatus}`,
      post: formatPost(result.rows[0]),
      autopilot
    });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT - Publish a post
app.put('/api/posts/:id/publish', async (req, res) => {
  try {
    const result = await pool.query(`
      UPDATE posts 
      SET status = 'published', 
          published_at = CURRENT_TIMESTAMP,
          scheduled_at = NULL,
          date = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [formatDateTR(), req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    console.log(`🚀 Post published: ${result.rows[0].title}`);
    res.json({ success: true, message: 'Post published', post: formatPost(result.rows[0]) });
  } catch (error) {
    console.error('Publish error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT - Schedule a post
app.put('/api/posts/:id/schedule', async (req, res) => {
  try {
    const { scheduledAt } = req.body;
    
    if (!scheduledAt) {
      return res.status(400).json({ error: 'scheduledAt is required' });
    }
    
    const result = await pool.query(`
      UPDATE posts 
      SET status = 'scheduled', 
          scheduled_at = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [scheduledAt, req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    console.log(`📅 Post scheduled: ${result.rows[0].title} for ${scheduledAt}`);
    res.json({ success: true, message: 'Post scheduled', post: formatPost(result.rows[0]) });
  } catch (error) {
    console.error('Schedule error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT - Unpublish a post
app.put('/api/posts/:id/unpublish', async (req, res) => {
  try {
    const result = await pool.query(`
      UPDATE posts 
      SET status = 'draft', 
          published_at = NULL,
          scheduled_at = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    console.log(`📝 Post unpublished: ${result.rows[0].title}`);
    res.json({ success: true, message: 'Post moved to drafts', post: formatPost(result.rows[0]) });
  } catch (error) {
    console.error('Unpublish error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT - Update post
app.put('/api/posts/:id', async (req, res) => {
  try {
    const { title, content, category, excerpt, thumbnail, status } = req.body;
    
    // Get existing post
    const existing = await pool.query('SELECT * FROM posts WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    const post = existing.rows[0];
    const newTitle = title || post.title;
    const newContent = content || post.content;
    
    const result = await pool.query(`
      UPDATE posts SET
        title = $1,
        slug = $2,
        content = $3,
        category = $4,
        excerpt = $5,
        thumbnail = $6,
        read_time = $7,
        status = $8,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING *
    `, [
      newTitle,
      title ? generateSlug(newTitle) : post.slug,
      newContent,
      category || post.category,
      excerpt || (content ? content.substring(0, 150) + '...' : post.excerpt),
      thumbnail || post.thumbnail,
      content ? calculateReadTime(newContent) : post.read_time,
      status || post.status,
      req.params.id
    ]);
    
    console.log(`✏️ Post updated: ${result.rows[0].title}`);
    res.json({ success: true, message: 'Post updated', post: formatPost(result.rows[0]) });
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE - Delete post
app.delete('/api/posts/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM posts WHERE id = $1 RETURNING title',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    console.log(`🗑️ Post deleted: ${result.rows[0].title}`);
    res.json({ success: true, message: 'Post deleted', deletedPost: result.rows[0] });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper: Format post for API response (convert snake_case to camelCase)
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

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Atasa Blog API running on port ${PORT}`);
  await initDB();
  checkScheduledPosts();
});