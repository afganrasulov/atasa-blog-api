import express from 'express';
import cors from 'cors';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const POSTS_FILE = join(__dirname, '../data/posts.json');
const SETTINGS_FILE = join(__dirname, '../data/settings.json');

// Ensure data directory exists
const dataDir = join(__dirname, '../data');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json());

// Helper: Read posts from file
function getPosts() {
  if (!existsSync(POSTS_FILE)) {
    return [];
  }
  const data = readFileSync(POSTS_FILE, 'utf-8');
  return JSON.parse(data);
}

// Helper: Write posts to file
function savePosts(posts) {
  writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2));
}

// Helper: Read settings
function getSettings() {
  if (!existsSync(SETTINGS_FILE)) {
    return { autopilot: false };
  }
  const data = readFileSync(SETTINGS_FILE, 'utf-8');
  return JSON.parse(data);
}

// Helper: Write settings
function saveSettings(settings) {
  writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
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

// Helper: Check and publish scheduled posts
function checkScheduledPosts() {
  const posts = getPosts();
  const now = new Date();
  let updated = false;

  posts.forEach(post => {
    if (post.status === 'scheduled' && post.scheduledAt) {
      const scheduledDate = new Date(post.scheduledAt);
      if (scheduledDate <= now) {
        post.status = 'published';
        post.publishedAt = now.toISOString();
        post.date = now.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
        updated = true;
        console.log(`Scheduled post published: ${post.title}`);
      }
    }
  });

  if (updated) {
    savePosts(posts);
  }
}

// Check scheduled posts every minute
setInterval(checkScheduledPosts, 60000);

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Atasa Blog API is running',
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
      'PUT /api/settings': 'Update settings (autopilot etc)'
    }
  });
});

// GET settings
app.get('/api/settings', (req, res) => {
  const settings = getSettings();
  res.json(settings);
});

// PUT settings
app.put('/api/settings', (req, res) => {
  try {
    const settings = getSettings();
    const { autopilot } = req.body;
    
    if (typeof autopilot === 'boolean') {
      settings.autopilot = autopilot;
    }
    
    saveSettings(settings);
    console.log(`Settings updated: autopilot=${settings.autopilot}`);
    
    res.json({ success: true, settings });
  } catch (error) {
    console.error('Settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET all posts (for admin - includes drafts and scheduled)
app.get('/api/posts/all', (req, res) => {
  const posts = getPosts();
  res.json(posts);
});

// GET only published posts (for frontend)
app.get('/api/posts', (req, res) => {
  const posts = getPosts();
  const published = posts.filter(p => p.status === 'published');
  res.json(published);
});

// GET draft posts
app.get('/api/posts/drafts', (req, res) => {
  const posts = getPosts();
  const drafts = posts.filter(p => p.status === 'draft');
  res.json(drafts);
});

// GET scheduled posts
app.get('/api/posts/scheduled', (req, res) => {
  const posts = getPosts();
  const scheduled = posts.filter(p => p.status === 'scheduled');
  res.json(scheduled);
});

// GET single post by ID (must be before :slug route)
app.get('/api/posts/id/:id', (req, res) => {
  const posts = getPosts();
  const post = posts.find(p => p.id === req.params.id);
  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }
  res.json(post);
});

// GET single post by slug
app.get('/api/posts/:slug', (req, res) => {
  const posts = getPosts();
  const post = posts.find(p => p.slug === req.params.slug && p.status === 'published');
  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }
  res.json(post);
});

// POST - Create new post (direct API)
app.post('/api/posts', (req, res) => {
  try {
    const { title, content, category, excerpt, thumbnail, status } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }
    
    const posts = getPosts();
    
    const newPost = {
      id: Date.now().toString(),
      title,
      slug: generateSlug(title),
      content,
      category: category || 'Genel',
      excerpt: excerpt || content.substring(0, 150) + '...',
      thumbnail: thumbnail || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&q=80',
      date: new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }),
      readTime: Math.ceil(content.split(' ').length / 200) + ' dk okuma',
      status: status || 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    if (newPost.status === 'published') {
      newPost.publishedAt = new Date().toISOString();
    }
    
    posts.unshift(newPost);
    savePosts(posts);
    
    console.log(`New blog post created: ${newPost.title} (${newPost.status})`);
    
    res.status(201).json({ 
      success: true, 
      message: 'Blog post created successfully',
      post: newPost 
    });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST webhook - receives data from n8n (checks autopilot setting)
app.post('/api/webhook/blog', (req, res) => {
  try {
    const { title, content, category, excerpt, thumbnail } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }
    
    const settings = getSettings();
    const posts = getPosts();
    
    const newPost = {
      id: Date.now().toString(),
      title,
      slug: generateSlug(title),
      content,
      category: category || 'Genel',
      excerpt: excerpt || content.substring(0, 150) + '...',
      thumbnail: thumbnail || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&q=80',
      date: new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }),
      readTime: Math.ceil(content.split(' ').length / 200) + ' dk okuma',
      status: settings.autopilot ? 'published' : 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    if (newPost.status === 'published') {
      newPost.publishedAt = new Date().toISOString();
    }
    
    posts.unshift(newPost);
    savePosts(posts);
    
    console.log(`New blog post via webhook: ${newPost.title} (${newPost.status}, autopilot=${settings.autopilot})`);
    
    res.status(201).json({ 
      success: true, 
      message: `Blog post created as ${newPost.status}`,
      post: newPost,
      autopilot: settings.autopilot
    });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT - Publish a post
app.put('/api/posts/:id/publish', (req, res) => {
  try {
    const { id } = req.params;
    const posts = getPosts();
    const postIndex = posts.findIndex(p => p.id === id);
    
    if (postIndex === -1) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    posts[postIndex].status = 'published';
    posts[postIndex].publishedAt = new Date().toISOString();
    posts[postIndex].date = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
    posts[postIndex].updatedAt = new Date().toISOString();
    posts[postIndex].scheduledAt = null;
    
    savePosts(posts);
    
    console.log(`Blog post published: ${posts[postIndex].title}`);
    
    res.json({ 
      success: true, 
      message: 'Blog post published',
      post: posts[postIndex]
    });
  } catch (error) {
    console.error('Publish error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT - Schedule a post
app.put('/api/posts/:id/schedule', (req, res) => {
  try {
    const { id } = req.params;
    const { scheduledAt } = req.body;
    
    if (!scheduledAt) {
      return res.status(400).json({ error: 'scheduledAt is required' });
    }
    
    const posts = getPosts();
    const postIndex = posts.findIndex(p => p.id === id);
    
    if (postIndex === -1) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    posts[postIndex].status = 'scheduled';
    posts[postIndex].scheduledAt = scheduledAt;
    posts[postIndex].updatedAt = new Date().toISOString();
    
    savePosts(posts);
    
    console.log(`Blog post scheduled: ${posts[postIndex].title} for ${scheduledAt}`);
    
    res.json({ 
      success: true, 
      message: 'Blog post scheduled',
      post: posts[postIndex]
    });
  } catch (error) {
    console.error('Schedule error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT - Unpublish a post (back to draft)
app.put('/api/posts/:id/unpublish', (req, res) => {
  try {
    const { id } = req.params;
    const posts = getPosts();
    const postIndex = posts.findIndex(p => p.id === id);
    
    if (postIndex === -1) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    posts[postIndex].status = 'draft';
    posts[postIndex].publishedAt = null;
    posts[postIndex].scheduledAt = null;
    posts[postIndex].updatedAt = new Date().toISOString();
    
    savePosts(posts);
    
    console.log(`Blog post unpublished: ${posts[postIndex].title}`);
    
    res.json({ 
      success: true, 
      message: 'Blog post moved to drafts',
      post: posts[postIndex]
    });
  } catch (error) {
    console.error('Unpublish error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT - Update post by ID
app.put('/api/posts/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, category, excerpt, thumbnail, status } = req.body;
    
    const posts = getPosts();
    const postIndex = posts.findIndex(p => p.id === id);
    
    if (postIndex === -1) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    const existingPost = posts[postIndex];
    
    const updatedPost = {
      ...existingPost,
      title: title || existingPost.title,
      slug: title ? generateSlug(title) : existingPost.slug,
      content: content || existingPost.content,
      category: category || existingPost.category,
      excerpt: excerpt || (content ? content.substring(0, 150) + '...' : existingPost.excerpt),
      thumbnail: thumbnail || existingPost.thumbnail,
      readTime: content ? Math.ceil(content.split(' ').length / 200) + ' dk okuma' : existingPost.readTime,
      status: status || existingPost.status,
      updatedAt: new Date().toISOString()
    };
    
    posts[postIndex] = updatedPost;
    savePosts(posts);
    
    console.log(`Blog post updated: ${updatedPost.title}`);
    
    res.json({ 
      success: true, 
      message: 'Blog post updated successfully',
      post: updatedPost 
    });
  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE - Delete post by ID
app.delete('/api/posts/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const posts = getPosts();
    const postIndex = posts.findIndex(p => p.id === id);
    
    if (postIndex === -1) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    const deletedPost = posts[postIndex];
    posts.splice(postIndex, 1);
    savePosts(posts);
    
    console.log(`Blog post deleted: ${deletedPost.title}`);
    
    res.json({ 
      success: true, 
      message: 'Blog post deleted successfully',
      deletedPost: {
        id: deletedPost.id,
        title: deletedPost.title
      }
    });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Atasa Blog API running on port ${PORT}`);
  // Check scheduled posts on startup
  checkScheduledPosts();
});
