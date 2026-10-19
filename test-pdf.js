const fs = require('fs').promises;
const path = require('path');
const puppeteer = require('puppeteer');

async function test() {
  console.log('🧪 Test génération PDF simple...');
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial; padding: 20mm; }
    h1 { color: #2d5016; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; }
    th { background: #2d5016; color: white; }
  </style>
</head>
<body>
  <h1>TEST PDF NEXT LTD</h1>
  <p>Date: ${new Date().toLocaleString('fr-FR')}</p>
  
  <table>
    <tr><th>Description</th><th>Montant</th></tr>
    <tr><td>Test produit</td><td>1000 FCFA</td></tr>
    <tr><td>TVA 20%</td><td>200 FCFA</td></tr>
    <tr><td><strong>TOTAL</strong></td><td><strong>1200 FCFA</strong></td></tr>
  </table>
  
  <p style="margin-top: 30px;">Ceci est un test de génération PDF.</p>
</body>
</html>`;
  
  const outputPath = '/var/www/numericexport/media/test-real.pdf';
  
  try {
    console.log('🚀 Lancement Puppeteer...');
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      executablePath: '/usr/bin/chromium-browser',
      timeout: 60000
    });
    
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    
    console.log('🖨️  Génération PDF...');
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' }
    });
    
    await browser.close();
    
    await fs.writeFile(outputPath, pdfBuffer);
    const stats = await fs.stat(outputPath);
    
    console.log(`✅ PDF généré: ${outputPath}`);
    console.log(`📊 Taille: ${stats.size} bytes (${(stats.size/1024).toFixed(2)} KB)`);
    
    if (stats.size < 5000) {
      console.error('❌ PDF trop petit! Contenu probablement vide.');
      const content = await fs.readFile(outputPath, 'utf8').catch(() => '');
      console.log('Contenu:', content.substring(0, 200));
    }
    
    return stats.size;
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  }
}

test().catch(console.error);
