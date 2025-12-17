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

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Atasa Blog API is running',
    endpoints: {
      'GET /api/posts': 'List all posts',
      'GET /api/posts/:slug': 'Get post by slug',
      'GET /api/posts/id/:id': 'Get post by ID',
      'POST /api/webhook/blog': 'Create new post (from n8n)',
      'POST /api/posts': 'Create new post',
      'PUT /api/posts/:id': 'Update post by ID',
      'DELETE /api/posts/:id': 'Delete post by ID'
    }
  });
});

// GET all posts
app.get('/api/posts', (req, res) => {
  const posts = getPosts();
  res.json(posts);
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
  const post = posts.find(p => p.slug === req.params.slug);
  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }
  res.json(post);
});

// POST - Create new post (direct API)
app.post('/api/posts', (req, res) => {
  try {
    const { title, content, category, excerpt, thumbnail } = req.body;
    
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    posts.unshift(newPost);
    savePosts(posts);
    
    console.log(`New blog post created: ${newPost.title}`);
    
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

// POST webhook - receives data from n8n
app.post('/api/webhook/blog', (req, res) => {
  try {
    const { title, content, category, excerpt, thumbnail } = req.body;
    
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    posts.unshift(newPost);
    savePosts(posts);
    
    console.log(`New blog post created via webhook: ${newPost.title}`);
    
    res.status(201).json({ 
      success: true, 
      message: 'Blog post created successfully',
      post: newPost 
    });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT - Update post by ID
app.put('/api/posts/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, category, excerpt, thumbnail } = req.body;
    
    const posts = getPosts();
    const postIndex = posts.findIndex(p => p.id === id);
    
    if (postIndex === -1) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    const existingPost = posts[postIndex];
    
    // Update only provided fields
    const updatedPost = {
      ...existingPost,
      title: title || existingPost.title,
      slug: title ? generateSlug(title) : existingPost.slug,
      content: content || existingPost.content,
      category: category || existingPost.category,
      excerpt: excerpt || (content ? content.substring(0, 150) + '...' : existingPost.excerpt),
      thumbnail: thumbnail || existingPost.thumbnail,
      readTime: content ? Math.ceil(content.split(' ').length / 200) + ' dk okuma' : existingPost.readTime,
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
});
