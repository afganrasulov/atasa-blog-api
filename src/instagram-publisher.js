// Instagram Graph API Publisher for Carousel Posts
// Supports multi-tenant architecture for SaaS

const INSTAGRAM_GRAPH_API = 'https://graph.facebook.com/v18.0';

/**
 * Upload a single image to Instagram container
 * @param {string} accessToken - Facebook/Instagram access token
 * @param {string} igUserId - Instagram Business Account ID
 * @param {string} imageUrl - Public URL of the image
 * @param {string} caption - Caption for the post (only for single image posts)
 * @returns {Promise<string>} - Container ID
 */
export async function createMediaContainer(accessToken, igUserId, imageUrl, caption = null) {
  const params = new URLSearchParams({
    image_url: imageUrl,
    access_token: accessToken
  });
  
  if (caption) {
    params.append('caption', caption);
  }
  
  const response = await fetch(`${INSTAGRAM_GRAPH_API}/${igUserId}/media?${params}`, {
    method: 'POST'
  });
  
  const data = await response.json();
  
  if (data.error) {
    throw new Error(`Instagram API Error: ${data.error.message}`);
  }
  
  return data.id;
}

/**
 * Create a carousel container with multiple images
 * @param {string} accessToken - Facebook/Instagram access token
 * @param {string} igUserId - Instagram Business Account ID
 * @param {string[]} childContainerIds - Array of child container IDs
 * @param {string} caption - Caption for the carousel post
 * @returns {Promise<string>} - Carousel container ID
 */
export async function createCarouselContainer(accessToken, igUserId, childContainerIds, caption) {
  const params = new URLSearchParams({
    media_type: 'CAROUSEL',
    caption: caption,
    children: childContainerIds.join(','),
    access_token: accessToken
  });
  
  const response = await fetch(`${INSTAGRAM_GRAPH_API}/${igUserId}/media?${params}`, {
    method: 'POST'
  });
  
  const data = await response.json();
  
  if (data.error) {
    throw new Error(`Instagram API Error: ${data.error.message}`);
  }
  
  return data.id;
}

/**
 * Publish a media container (single image or carousel)
 * @param {string} accessToken - Facebook/Instagram access token
 * @param {string} igUserId - Instagram Business Account ID
 * @param {string} containerId - Container ID to publish
 * @returns {Promise<string>} - Published media ID
 */
export async function publishContainer(accessToken, igUserId, containerId) {
  const params = new URLSearchParams({
    creation_id: containerId,
    access_token: accessToken
  });
  
  const response = await fetch(`${INSTAGRAM_GRAPH_API}/${igUserId}/media_publish?${params}`, {
    method: 'POST'
  });
  
  const data = await response.json();
  
  if (data.error) {
    throw new Error(`Instagram API Error: ${data.error.message}`);
  }
  
  return data.id;
}

/**
 * Check container status (important for carousel - all images must be processed)
 * @param {string} accessToken - Facebook/Instagram access token
 * @param {string} containerId - Container ID to check
 * @returns {Promise<object>} - Container status
 */
export async function checkContainerStatus(accessToken, containerId) {
  const params = new URLSearchParams({
    fields: 'status_code,status',
    access_token: accessToken
  });
  
  const response = await fetch(`${INSTAGRAM_GRAPH_API}/${containerId}?${params}`);
  const data = await response.json();
  
  if (data.error) {
    throw new Error(`Instagram API Error: ${data.error.message}`);
  }
  
  return data;
}

/**
 * Wait for container to be ready
 * @param {string} accessToken - Facebook/Instagram access token
 * @param {string} containerId - Container ID to check
 * @param {number} maxAttempts - Maximum number of attempts
 * @param {number} delayMs - Delay between attempts
 * @returns {Promise<boolean>} - True if ready
 */
export async function waitForContainerReady(accessToken, containerId, maxAttempts = 30, delayMs = 2000) {
  for (let i = 0; i < maxAttempts; i++) {
    const status = await checkContainerStatus(accessToken, containerId);
    
    if (status.status_code === 'FINISHED') {
      return true;
    }
    
    if (status.status_code === 'ERROR') {
      throw new Error(`Container processing failed: ${status.status}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  
  throw new Error('Container processing timeout');
}

/**
 * Publish a full carousel to Instagram
 * @param {object} params - Publishing parameters
 * @param {string} params.accessToken - Facebook/Instagram access token
 * @param {string} params.igUserId - Instagram Business Account ID
 * @param {string[]} params.imageUrls - Array of public image URLs (2-10 images)
 * @param {string} params.caption - Caption for the post
 * @returns {Promise<object>} - Published post info
 */
export async function publishCarousel({ accessToken, igUserId, imageUrls, caption }) {
  if (!imageUrls || imageUrls.length < 2) {
    throw new Error('Carousel requires at least 2 images');
  }
  
  if (imageUrls.length > 10) {
    throw new Error('Carousel cannot have more than 10 images');
  }
  
  console.log(`📸 Creating ${imageUrls.length} media containers...`);
  
  // Step 1: Create child containers for each image
  const childContainerIds = [];
  for (let i = 0; i < imageUrls.length; i++) {
    const containerId = await createMediaContainer(accessToken, igUserId, imageUrls[i]);
    childContainerIds.push(containerId);
    console.log(`  ✓ Container ${i + 1}/${imageUrls.length}: ${containerId}`);
  }
  
  // Step 2: Wait for all containers to be ready
  console.log('⏳ Waiting for media processing...');
  for (const containerId of childContainerIds) {
    await waitForContainerReady(accessToken, containerId);
  }
  
  // Step 3: Create carousel container
  console.log('🎠 Creating carousel container...');
  const carouselContainerId = await createCarouselContainer(
    accessToken,
    igUserId,
    childContainerIds,
    caption
  );
  
  // Step 4: Wait for carousel to be ready
  await waitForContainerReady(accessToken, carouselContainerId);
  
  // Step 5: Publish the carousel
  console.log('🚀 Publishing carousel...');
  const mediaId = await publishContainer(accessToken, igUserId, carouselContainerId);
  
  console.log(`✅ Carousel published! Media ID: ${mediaId}`);
  
  return {
    success: true,
    mediaId,
    carouselContainerId,
    childContainerIds,
    imageCount: imageUrls.length
  };
}

/**
 * Get Instagram Business Account ID from Facebook Page
 * @param {string} accessToken - Facebook access token
 * @param {string} pageId - Facebook Page ID
 * @returns {Promise<string>} - Instagram Business Account ID
 */
export async function getInstagramAccountId(accessToken, pageId) {
  const params = new URLSearchParams({
    fields: 'instagram_business_account',
    access_token: accessToken
  });
  
  const response = await fetch(`${INSTAGRAM_GRAPH_API}/${pageId}?${params}`);
  const data = await response.json();
  
  if (data.error) {
    throw new Error(`Facebook API Error: ${data.error.message}`);
  }
  
  if (!data.instagram_business_account) {
    throw new Error('No Instagram Business Account linked to this Facebook Page');
  }
  
  return data.instagram_business_account.id;
}

/**
 * Get user's Facebook Pages
 * @param {string} accessToken - Facebook access token
 * @returns {Promise<Array>} - List of pages
 */
export async function getUserPages(accessToken) {
  const params = new URLSearchParams({
    fields: 'id,name,instagram_business_account{id,username}',
    access_token: accessToken
  });
  
  const response = await fetch(`${INSTAGRAM_GRAPH_API}/me/accounts?${params}`);
  const data = await response.json();
  
  if (data.error) {
    throw new Error(`Facebook API Error: ${data.error.message}`);
  }
  
  return data.data || [];
}

/**
 * Exchange short-lived token for long-lived token
 * @param {string} appId - Facebook App ID
 * @param {string} appSecret - Facebook App Secret
 * @param {string} shortLivedToken - Short-lived access token
 * @returns {Promise<object>} - Long-lived token info
 */
export async function exchangeForLongLivedToken(appId, appSecret, shortLivedToken) {
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortLivedToken
  });
  
  const response = await fetch(`${INSTAGRAM_GRAPH_API}/oauth/access_token?${params}`);
  const data = await response.json();
  
  if (data.error) {
    throw new Error(`Facebook API Error: ${data.error.message}`);
  }
  
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in // Usually 60 days
  };
}

/**
 * Setup Express routes for Instagram publishing
 */
export function setupInstagramRoutes(app, pool) {
  
  // Publish carousel to Instagram
  app.post('/api/instagram/publish/:carouselId', async (req, res) => {
    try {
      const { carouselId } = req.params;
      const { tenantId } = req.body;
      
      // Get tenant credentials
      const tenantResult = await pool.query(
        'SELECT * FROM ig_tenants WHERE id = $1',
        [tenantId]
      );
      
      if (tenantResult.rows.length === 0) {
        return res.status(404).json({ error: 'Tenant not found' });
      }
      
      const tenant = tenantResult.rows[0];
      
      if (!tenant.ig_access_token || !tenant.ig_user_id) {
        return res.status(400).json({ error: 'Instagram not connected for this tenant' });
      }
      
      // Get carousel data
      const carouselResult = await pool.query(
        'SELECT * FROM carousel_posts WHERE id = $1 AND tenant_id = $2',
        [carouselId, tenantId]
      );
      
      if (carouselResult.rows.length === 0) {
        return res.status(404).json({ error: 'Carousel not found' });
      }
      
      const carousel = carouselResult.rows[0];
      
      // Get image URLs (these need to be publicly accessible)
      // In production, you'd upload to S3/Cloudinary first
      const baseUrl = process.env.API_BASE_URL || 'https://atasa-blog-api-production-22a4.up.railway.app';
      const slides = typeof carousel.slides === 'string' ? JSON.parse(carousel.slides) : carousel.slides;
      
      const imageUrls = slides.map((_, index) => 
        `${baseUrl}/api/carousel/${carouselId}/render/${index + 1}`
      );
      
      // Build caption
      const caption = buildInstagramCaption(carousel, tenant);
      
      // Publish to Instagram
      const result = await publishCarousel({
        accessToken: tenant.ig_access_token,
        igUserId: tenant.ig_user_id,
        imageUrls,
        caption
      });
      
      // Update carousel status
      await pool.query(
        `UPDATE carousel_posts SET 
          status = 'published', 
          published_at = CURRENT_TIMESTAMP,
          ig_media_id = $1
        WHERE id = $2`,
        [result.mediaId, carouselId]
      );
      
      res.json({
        success: true,
        mediaId: result.mediaId,
        message: 'Carousel published to Instagram successfully!'
      });
      
    } catch (error) {
      console.error('Instagram publish error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Connect Instagram account (OAuth callback)
  app.get('/api/instagram/callback', async (req, res) => {
    try {
      const { code, state } = req.query;
      const tenantId = state; // We pass tenant ID in state parameter
      
      // Exchange code for access token
      const tokenResponse = await fetch('https://api.instagram.com/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.INSTAGRAM_APP_ID,
          client_secret: process.env.INSTAGRAM_APP_SECRET,
          grant_type: 'authorization_code',
          redirect_uri: `${process.env.API_BASE_URL}/api/instagram/callback`,
          code
        })
      });
      
      const tokenData = await tokenResponse.json();
      
      if (tokenData.error) {
        throw new Error(tokenData.error_message);
      }
      
      // Exchange for long-lived token
      const longLivedToken = await exchangeForLongLivedToken(
        process.env.INSTAGRAM_APP_ID,
        process.env.INSTAGRAM_APP_SECRET,
        tokenData.access_token
      );
      
      // Get user info
      const userResponse = await fetch(
        `${INSTAGRAM_GRAPH_API}/me?fields=id,username&access_token=${longLivedToken.accessToken}`
      );
      const userData = await userResponse.json();
      
      // Update tenant with Instagram credentials
      await pool.query(
        `UPDATE ig_tenants SET 
          ig_user_id = $1,
          ig_username = $2,
          ig_access_token = $3,
          ig_token_expires_at = NOW() + INTERVAL '60 days',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $4`,
        [userData.id, userData.username, longLivedToken.accessToken, tenantId]
      );
      
      // Redirect to success page
      res.redirect(`${process.env.FRONTEND_URL}/settings/instagram?success=true`);
      
    } catch (error) {
      console.error('Instagram callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL}/settings/instagram?error=${encodeURIComponent(error.message)}`);
    }
  });
  
  // Get Instagram connection status
  app.get('/api/instagram/status/:tenantId', async (req, res) => {
    try {
      const { tenantId } = req.params;
      
      const result = await pool.query(
        'SELECT ig_user_id, ig_username, ig_token_expires_at FROM ig_tenants WHERE id = $1',
        [tenantId]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Tenant not found' });
      }
      
      const tenant = result.rows[0];
      
      res.json({
        connected: !!tenant.ig_user_id,
        username: tenant.ig_username,
        tokenExpiresAt: tenant.ig_token_expires_at
      });
      
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Generate Instagram OAuth URL
  app.get('/api/instagram/auth-url/:tenantId', async (req, res) => {
    try {
      const { tenantId } = req.params;
      
      const authUrl = `https://api.instagram.com/oauth/authorize?client_id=${process.env.INSTAGRAM_APP_ID}&redirect_uri=${encodeURIComponent(process.env.API_BASE_URL + '/api/instagram/callback')}&scope=user_profile,user_media&response_type=code&state=${tenantId}`;
      
      res.json({ authUrl });
      
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

/**
 * Build Instagram caption from carousel data
 */
function buildInstagramCaption(carousel, tenant) {
  const slides = typeof carousel.slides === 'string' ? JSON.parse(carousel.slides) : carousel.slides;
  const categoryCount = slides.filter(s => s.type === 'category').length;
  
  let caption = `📰 ${carousel.title}\n\n`;
  caption += `Bu hafta ${categoryCount} farklı kategoride güncel haberler sizlerle!\n\n`;
  
  // Add category emojis
  const categories = slides.filter(s => s.type === 'category');
  categories.forEach(cat => {
    caption += `${cat.emoji} ${cat.category}\n`;
  });
  
  caption += `\n📌 Kaydırarak tüm haberleri görüntüleyin!\n\n`;
  
  // Add hashtags from tenant settings
  if (tenant.default_hashtags) {
    caption += tenant.default_hashtags;
  } else {
    caption += '#göçmenlik #türkiye #oturmaiizni #çalışmaizni #vize #vatandaşlık';
  }
  
  return caption;
}
