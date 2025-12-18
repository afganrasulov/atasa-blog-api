import puppeteer from 'puppeteer';
import archiver from 'archiver';

// HTML Template Generator for Instagram Carousel Slides
export function generateSlideHTML(slide, brandLogo = null) {
  const baseStyles = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    body { 
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      width: 1080px; 
      height: 1080px; 
      background: #FFFFFF;
      display: flex;
      flex-direction: column;
      padding: 60px;
    }
    .brand {
      position: absolute;
      bottom: 40px;
      left: 0;
      right: 0;
      text-align: center;
      font-size: 28px;
      font-weight: 700;
      letter-spacing: 8px;
      color: #000;
    }
    .brand span { color: #000; }
  `;

  let content = '';

  switch (slide.type) {
    case 'cover':
      content = `
        <style>
          ${baseStyles}
          body { justify-content: flex-end; padding-bottom: 140px; }
          .illustration {
            position: absolute;
            top: 60px;
            left: 60px;
            right: 60px;
            height: 500px;
            display: flex;
            justify-content: center;
            align-items: center;
          }
          .illustration-placeholder {
            width: 100%;
            height: 100%;
            background: #f5f5f5;
            border-radius: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #999;
            font-size: 18px;
          }
          .title {
            font-size: 64px;
            font-weight: 700;
            line-height: 1.1;
            color: #000;
            text-align: center;
            margin-bottom: 24px;
          }
          .subtitle {
            font-size: 24px;
            color: #666;
            text-align: center;
            text-transform: uppercase;
            letter-spacing: 2px;
          }
        </style>
        <div class="illustration">
          <div class="illustration-placeholder">
            🎨 Gemini AI Görseli Buraya Gelecek
          </div>
        </div>
        <h1 class="title">${slide.title}</h1>
        <p class="subtitle">${slide.subtitle}</p>
        <div class="brand">A<span>T</span>ASA</div>
      `;
      break;

    case 'intro':
      content = `
        <style>
          ${baseStyles}
          body { justify-content: center; padding: 80px; }
          .greeting {
            font-size: 32px;
            font-weight: 500;
            color: #000;
            margin-bottom: 24px;
          }
          .content {
            font-size: 28px;
            line-height: 1.7;
            color: #333;
          }
          .content .highlight {
            color: #0066FF;
            font-weight: 500;
          }
        </style>
        <p class="greeting">${slide.greeting}</p>
        <p class="content">${slide.content.replace(/\n/g, '<br>').replace('Pazarlama Notları', '<span class="highlight">Göçmenlik Haberleri</span>')}</p>
        <div class="brand">A<span>T</span>ASA</div>
      `;
      break;

    case 'category':
      const items = slide.items || [];
      content = `
        <style>
          ${baseStyles}
          body { justify-content: flex-start; padding: 80px 60px; }
          .header {
            display: flex;
            align-items: center;
            gap: 16px;
            margin-bottom: 48px;
          }
          .emoji { font-size: 48px; }
          .category-title { font-size: 42px; font-weight: 700; color: #000; }
          .items { flex: 1; }
          .item {
            display: flex;
            align-items: flex-start;
            gap: 16px;
            margin-bottom: 32px;
            padding-bottom: 32px;
            border-bottom: 1px solid #eee;
          }
          .item:last-child { border-bottom: none; }
          .bullet {
            width: 8px;
            height: 8px;
            background: #000;
            border-radius: 50%;
            margin-top: 12px;
            flex-shrink: 0;
          }
          .item-content { flex: 1; }
          .item-text { font-size: 26px; line-height: 1.5; color: #000; margin-bottom: 8px; }
          .item-source { font-size: 20px; color: #0066FF; }
        </style>
        <div class="header">
          <span class="emoji">${slide.emoji}</span>
          <h2 class="category-title">${slide.category}</h2>
        </div>
        <div class="items">
          ${items.map(item => `
            <div class="item">
              <div class="bullet"></div>
              <div class="item-content">
                <p class="item-text">${item.text}</p>
                <span class="item-source">(${item.source})</span>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="brand">A<span>T</span>ASA</div>
      `;
      break;

    default:
      content = `
        <style>${baseStyles}</style>
        <div style="display:flex;align-items:center;justify-content:center;height:100%;">
          <p>Unknown slide type: ${slide.type}</p>
        </div>
      `;
  }

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>${content}</body></html>`;
}

// Render slides to PNG images using Puppeteer
export async function renderSlidesToImages(slides) {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  const images = [];

  try {
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      const html = generateSlideHTML(slide);
      
      const page = await browser.newPage();
      await page.setViewport({ width: 1080, height: 1080 });
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      // Wait for fonts to load
      await page.evaluate(() => document.fonts.ready);
      
      const imageBuffer = await page.screenshot({ type: 'png', encoding: 'binary' });
      
      images.push({
        filename: `slide_${String(i + 1).padStart(2, '0')}_${slide.type}.png`,
        buffer: imageBuffer,
        slideNumber: i + 1,
        type: slide.type
      });
      
      await page.close();
    }
  } finally {
    await browser.close();
  }

  return images;
}

// Create ZIP archive from images
export async function createImagesZip(images, weekRange) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    archive.on('data', chunk => chunks.push(chunk));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', reject);

    images.forEach(img => archive.append(img.buffer, { name: img.filename }));

    const readme = `Instagram Carousel - ${weekRange}\nGenerated: ${new Date().toISOString()}\n\nFiles:\n${images.map(img => `- ${img.filename}`).join('\n')}\n\nNote: Replace slide_01_cover.png illustration with Gemini AI generated image.\n`;
    archive.append(readme, { name: 'README.txt' });

    archive.finalize();
  });
}

// Express route handler for rendering carousel
export function setupCarouselRenderRoutes(app, pool) {
  
  // Render single slide as PNG
  app.get('/api/carousel/:id/render/:slideNumber', async (req, res) => {
    try {
      const { id, slideNumber } = req.params;
      const result = await pool.query('SELECT * FROM carousel_posts WHERE id = $1', [id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Carousel not found' });
      
      const carousel = result.rows[0];
      const slides = typeof carousel.slides === 'string' ? JSON.parse(carousel.slides) : carousel.slides;
      const slideIndex = parseInt(slideNumber) - 1;
      
      if (slideIndex < 0 || slideIndex >= slides.length) return res.status(404).json({ error: 'Slide not found' });
      
      const images = await renderSlidesToImages([slides[slideIndex]]);
      res.set('Content-Type', 'image/png');
      res.set('Content-Disposition', `inline; filename="slide_${slideNumber}.png"`);
      res.send(images[0].buffer);
    } catch (error) {
      console.error('Render error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Render all slides and return as ZIP
  app.get('/api/carousel/:id/render-zip', async (req, res) => {
    try {
      const { id } = req.params;
      const result = await pool.query('SELECT * FROM carousel_posts WHERE id = $1', [id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Carousel not found' });
      
      const carousel = result.rows[0];
      const slides = typeof carousel.slides === 'string' ? JSON.parse(carousel.slides) : carousel.slides;
      
      console.log(`🎨 Rendering ${slides.length} slides for carousel ${id}...`);
      
      const images = await renderSlidesToImages(slides);
      const zipBuffer = await createImagesZip(images, carousel.title);
      const filename = `carousel_${id}_${Date.now()}.zip`;
      
      res.set('Content-Type', 'application/zip');
      res.set('Content-Disposition', `attachment; filename="${filename}"`);
      res.set('Content-Length', zipBuffer.length);
      res.send(zipBuffer);
      
      console.log(`✅ ZIP created: ${filename} (${images.length} images)`);
    } catch (error) {
      console.error('ZIP render error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Render slides from POST data (for n8n webhook)
  app.post('/api/carousel/render', async (req, res) => {
    try {
      const { slides, weekRange } = req.body;
      if (!slides || !Array.isArray(slides)) return res.status(400).json({ error: 'slides array required' });
      
      console.log(`🎨 Rendering ${slides.length} slides from webhook...`);
      
      const images = await renderSlidesToImages(slides);
      const zipBuffer = await createImagesZip(images, weekRange || 'carousel');
      const filename = `carousel_${Date.now()}.zip`;
      
      res.set('Content-Type', 'application/zip');
      res.set('Content-Disposition', `attachment; filename="${filename}"`);
      res.set('Content-Length', zipBuffer.length);
      res.send(zipBuffer);
      
      console.log(`✅ ZIP created: ${filename} (${images.length} images)`);
    } catch (error) {
      console.error('Render error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Preview HTML for a slide (for debugging)
  app.get('/api/carousel/:id/preview/:slideNumber', async (req, res) => {
    try {
      const { id, slideNumber } = req.params;
      const result = await pool.query('SELECT * FROM carousel_posts WHERE id = $1', [id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Carousel not found' });
      
      const carousel = result.rows[0];
      const slides = typeof carousel.slides === 'string' ? JSON.parse(carousel.slides) : carousel.slides;
      const slideIndex = parseInt(slideNumber) - 1;
      
      if (slideIndex < 0 || slideIndex >= slides.length) return res.status(404).json({ error: 'Slide not found' });
      
      res.set('Content-Type', 'text/html');
      res.send(generateSlideHTML(slides[slideIndex]));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}
