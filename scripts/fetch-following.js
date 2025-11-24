const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config(); // Local development için .env dosyasını yükle

/**
 * Twitter/X API'den takip edilen kullanıcıları çeker (tek sayfa)
 * @param {string} cursor - Pagination için cursor (opsiyonel)
 */
async function fetchFollowingPage(cursor = null) {
  // API key kontrolü
  if (!process.env.RAPIDAPI_KEY) {
    throw new Error('❌ RAPIDAPI_KEY environment variable bulunamadı!');
  }

  // Path oluştur (cursor varsa ekle)
  let path = `/Following/?id=${process.env.TWITTER_USER_ID}&count=50`;
  if (cursor) {
    path += `&cursor=${encodeURIComponent(cursor)}`;
  }

  const options = {
    method: 'GET',
    hostname: process.env.RAPIDAPI_HOST || 'x-com2.p.rapidapi.com',
    port: null,
    path: path,
    headers: {
      'x-rapidapi-key': process.env.RAPIDAPI_KEY,
      'x-rapidapi-host': process.env.RAPIDAPI_HOST || 'x-com2.p.rapidapi.com'
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks = [];
      
      res.on('data', (chunk) => chunks.push(chunk));
      
      res.on('end', () => {
        const body = Buffer.concat(chunks);
        try {
          const data = JSON.parse(body.toString());
          resolve(data);
        } catch (error) {
          reject(new Error('❌ JSON parse hatası: ' + error.message));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(new Error('❌ API istek hatası: ' + error.message));
    });
    
    req.end();
  });
}

/**
 * Tüm takip edilen kullanıcıları çeker (pagination ile)
 */
async function fetchFollowing() {
  console.log('🔍 Twitter takip edilen listesi çekiliyor...');
  
  const maxCount = parseInt(process.env.FOLLOWING_COUNT || 200);
  let allUsers = [];
  let cursor = null;
  let pageCount = 0;

  while (allUsers.length < maxCount) {
    pageCount++;
    console.log(`📄 Sayfa ${pageCount} çekiliyor... (Toplam: ${allUsers.length})`);
    
    const response = await fetchFollowingPage(cursor);
    const instructions = response?.data?.user?.result?.timeline?.timeline?.instructions || [];
    const entries = instructions.find(i => i.type === 'TimelineAddEntries')?.entries || [];
    
    // Kullanıcıları filtrele
    const users = entries.filter(entry => entry.content.itemContent?.user_results?.result);
    
    if (users.length === 0) {
      console.log('⚠️ Bu sayfada kullanıcı bulunamadı, durduruluyor.');
      break;
    }
    
    allUsers = allUsers.concat(users);
    
    // Cursor'u bul (bir sonraki sayfa için)
    const cursorEntry = entries.find(entry => entry.content.cursorType === 'Bottom');
    
    if (!cursorEntry || !cursorEntry.content.value) {
      console.log('✅ Tüm sayfalar çekildi (cursor bulunamadı)');
      break;
    }
    
    cursor = cursorEntry.content.value;
    
    // Maksimum sayıya ulaştık mı?
    if (allUsers.length >= maxCount) {
      console.log(`✅ Maksimum sayıya ulaşıldı: ${maxCount}`);
      allUsers = allUsers.slice(0, maxCount);
      break;
    }
    
    // Rate limiting için küçük bir gecikme
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`✅ Toplam ${allUsers.length} kullanıcı çekildi (${pageCount} sayfa)`);
  
  // Response formatını koruyalım
  return {
    data: {
      user: {
        result: {
          timeline: {
            timeline: {
              instructions: [{
                type: 'TimelineAddEntries',
                entries: allUsers
              }]
            }
          }
        }
      }
    }
  };
}

/**
 * API response'dan kullanıcı verilerini parse eder
 */
function parseFollowingData(apiResponse) {
  const instructions = apiResponse?.data?.user?.result?.timeline?.timeline?.instructions || [];
  const entries = instructions.find(i => i.type === 'TimelineAddEntries')?.entries || [];
  
  const users = entries
    .filter(entry => entry.content.itemContent?.user_results?.result)
    .map(entry => {
      const user = entry.content.itemContent.user_results.result;
      const legacy = user.legacy;
      
      return {
        id: user.rest_id,
        name: legacy.name,
        screen_name: legacy.screen_name,
        description: legacy.description || '',
        profile_image: legacy.profile_image_url_https,
        followers_count: legacy.followers_count,
        following_count: legacy.friends_count,
        location: legacy.location || '',
        url: legacy.url || '',
        verified: legacy.verified || false,
        professional: user.professional ? {
          type: user.professional.professional_type,
          category: user.professional.category?.[0]?.name || ''
        } : null
      };
    })
    .filter(user => user.id && user.screen_name); // Geçersiz kullanıcıları filtrele

  console.log(`📊 ${users.length} kullanıcı parse edildi`);
  return users;
}

/**
 * Veriyi JSON dosyasına kaydeder
 */
function saveData(users) {
  const dataDir = path.join(__dirname, '..', 'data');
  const filePath = path.join(dataDir, 'following.json');
  
  // data klasörü yoksa oluştur
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  const data = {
    updated_at: new Date().toISOString(),
    total_count: users.length,
    users: users
  };
  
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`💾 ${users.length} kullanıcı kaydedildi: ${filePath}`);
}

/**
 * Ana fonksiyon
 */
async function main() {
  try {
    console.log('🚀 Twitter Following Tracker başlatılıyor...\n');
    
    // API'den veri çek
    const apiResponse = await fetchFollowing();
    
    // Veriyi parse et
    const users = parseFollowingData(apiResponse);
    
    if (users.length === 0) {
      console.warn('⚠️ Hiç kullanıcı bulunamadı!');
      return;
    }
    
    // Veriyi kaydet
    saveData(users);
    
    console.log('\n✅ İşlem başarıyla tamamlandı!');
  } catch (error) {
    console.error('\n❌ Hata:', error.message);
    process.exit(1);
  }
}

// Script'i direkt çalıştırıldığında main fonksiyonunu çağır
if (require.main === module) {
  main();
}

module.exports = { fetchFollowing, parseFollowingData, saveData };
