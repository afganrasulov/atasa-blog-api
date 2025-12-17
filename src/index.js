import express from 'express';
import cors from 'cors';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const POSTS_FILE = join(__dirname, '../data/posts.json');

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
  res.json({ status: 'ok', message: 'Atasa Blog API is running' });
});

// GET all posts
app.get('/api/posts', (req, res) => {
  const posts = getPosts();
  res.json(posts);
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
      createdAt: new Date().toISOString()
    };
    
    posts.unshift(newPost); // Add to beginning
    savePosts(posts);
    
    console.log(`New blog post created: ${newPost.title}`);
    
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

app.listen(PORT, () => {
  console.log(`🚀 Atasa Blog API running on port ${PORT}`);
});