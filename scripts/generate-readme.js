const fs = require('fs');
const path = require('path');

/**
 * JSON verisini okur
 */
function loadFollowingData() {
  const filePath = path.join(__dirname, '..', 'data', 'following.json');

  if (!fs.existsSync(filePath)) {
    throw new Error('❌ data/following.json dosyası bulunamadı! Önce "npm run fetch" komutunu çalıştırın.');
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  console.log(`📖 ${data.total_count} kullanıcı verisi yüklendi`);
  return data;
}

/**
 * Kullanıcıları sıralar
 */
function sortUsers(users) {
  // 1. Önce doğrulanmış hesaplar
  // 2. Sonra takipçi sayısına göre (büyükten küçüğe)
  return users.sort((a, b) => {
    if (a.verified && !b.verified) return -1;
    if (!a.verified && b.verified) return 1;
    return b.followers_count - a.followers_count;
  });
}

/**
 * README içeriğini oluşturur
 */
function generateReadme(data) {
  const users = sortUsers([...data.users]); // Orijinal diziyi değiştirmemek için kopyala

  const lastUpdate = new Date(data.updated_at).toLocaleString('tr-TR', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const verifiedCount = users.filter(u => u.verified).length;
  const avgFollowers = Math.round(users.reduce((sum, u) => sum + u.followers_count, 0) / users.length);

  let readme = `# Türkiye'nin en iyi yazılımcıları 👩‍💻👨‍💻

Türkiye'nin en iyi yazılımcılarını https://x.com/eniyiyazilimci profilinin takip listesinden referans alarak derleyen liste.

---

## 👥 Takip Edilen Kullanıcılar

`;

  users.forEach((user, index) => {
    // Profil resmini büyük versiyona çevir
    const profileImage = user.profile_image.replace('_normal', '_bigger');

    readme += `
### ${user.name} ${user.verified ? '✓' : ''}

<table>
<tr>
<td width="80">
  <img src="${profileImage}" width="80" height="80" style="border-radius: 50%;">
</td>
<td>

**[@${user.screen_name}](https://twitter.com/${user.screen_name})**

${user.description || '_Açıklama yok_'}

📍 ${user.location || 'Konum belirtilmemiş'} | 👥 ${user.followers_count.toLocaleString('tr-TR')} takipçi | 🔗 ${user.following_count.toLocaleString('tr-TR')} takip${user.url ? ` | 🌐 [Website](${user.url})` : ''}${user.professional ? ` | 💼 ${user.professional.category || user.professional.type}` : ''}

</td>
</tr>
</table>

`;
  });

  readme += `
---

## 🤖 Otomasyon

Bu liste **GitHub Actions** ile günde 2 kez (09:00 ve 21:00 TSI) otomatik olarak güncellenmektedir.

---

<div align="center">

**Powered by GitHub Actions** 🚀

_Toplam ${users.length} kullanıcı_
_Son güncelleme: ${lastUpdate}_

</div>
`;

  return readme;
}

/**
 * README.md dosyasını kaydeder
 */
function saveReadme(content) {
  const filePath = path.join(__dirname, '..', 'README.md');
  fs.writeFileSync(filePath, content);
  console.log(`📝 README.md güncellendi: ${filePath}`);
}

/**
 * Ana fonksiyon
 */
async function main() {
  try {
    console.log('📝 README.md oluşturuluyor...\n');

    // Veriyi yükle
    const data = loadFollowingData();

    // README içeriğini oluştur
    const readme = generateReadme(data);

    // Kaydet
    saveReadme(readme);

    console.log('\n✅ README.md başarıyla oluşturuldu!');
  } catch (error) {
    console.error('\n❌ Hata:', error.message);
    process.exit(1);
  }
}

// Script'i direkt çalıştırıldığında main fonksiyonunu çağır
if (require.main === module) {
  main();
}

module.exports = { loadFollowingData, generateReadme, saveReadme };
