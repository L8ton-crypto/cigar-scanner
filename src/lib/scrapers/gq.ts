/**
 * GQ Tobaccos scraper
 * HTML scraping with regex extraction
 */

import { ScrapedProduct, decodeEntities, httpFetch, sleep } from './index';

export async function scrapeGQ(): Promise<ScrapedProduct[]> {
  const brandPages = [
    'bolivar', 'cohiba', 'cuaba', 'diplomaticos', 'el-rey-del-mundo',
    'fonseca', 'guantanamera', 'h-upmann', 'hoyo-de-monterrey',
    'jose-l-piedra', 'juan-lopez', 'la-gloria-cubana', 'montecristo',
    'partagas', 'por-larranaga', 'punch', 'quai-dorsay', 'quintero',
    'rafael-gonzalez', 'ramon-allones', 'romeo-y-julieta',
    'saint-luis-rey', 'san-cristobal-de-la-habana', 'sancho-panza',
    'trinidad', 'vegas-robaina', 'vegueros',
    'a-j-fernandez', 'aladino', 'alec-bradley', 'arturo-fuente',
    'avo', 'brick-house', 'camacho', 'cao', 'casa-turrent',
    'charatan', 'chinchalero', 'davidoff', 'drew-estate',
    'flor-de-selva', 'foundation-cigars', 'gurkha', 'inka-secret-blend',
    'joya-de-nicaragua', 'kristoff', 'la-aurora', 'la-flor-dominicana',
    'la-invicta', 'macanudo', 'my-father', 'nub-cigars', 'oliva',
    'oscar-valladares', 'padron', 'perdomo', 'plasencia',
    'quorum', 'regius', 'rocky-patel', 'tatuaje', 'vegafina',
    'ritmeester', 'villiger-cigars', 'hamlet-cigars',
    'henri-wintermans-cigars', 'conquistador', 'mitchellero',
    'puffin-cigars', 'two-smoking-barrels', 'meerapfel',
  ];

  const products: ScrapedProduct[] = [];
  
  for (const brand of brandPages) {
    let page = 1;
    while (true) {
      const url = page === 1
        ? `https://www.gqtobaccos.com/${brand}/`
        : `https://www.gqtobaccos.com/${brand}/?page=${page}`;
      
      const html = await httpFetch(url);
      if (!html) break;

      // Extract products using regex patterns from CLI script
      const imgRegex = /class="card-figure"[\s\S]*?<img[^>]*src="([^"]+)"[^>]*alt="([^"]*)"/g;
      const pageProducts: Array<{ name: string; imageUrl: string; price: number | null; url: string | null }> = [];
      let match;
      
      while ((match = imgRegex.exec(html)) !== null) {
        const name = decodeEntities(match[2]).trim();
        if (!name || name.length < 3) continue;
        pageProducts.push({ name, imageUrl: match[1], price: null, url: null });
      }

      // Get prices
      const priceRegex = /class="price[^"]*"[^>]*>\s*£([\d,.]+)/g;
      let i = 0;
      while ((match = priceRegex.exec(html)) !== null && i < pageProducts.length) {
        pageProducts[i].price = parseFloat(match[1].replace(',', ''));
        i++;
      }

      // Get URLs
      const urlRegex = /class="card-figure"[\s\S]*?<a[^>]*href="([^"]+)"/g;
      i = 0;
      while ((match = urlRegex.exec(html)) !== null && i < pageProducts.length) {
        pageProducts[i].url = match[1];
        i++;
      }

      // Add valid products
      for (const p of pageProducts) {
        if (p.price && p.url) {
          products.push({
            name: p.name,
            price: p.price,
            url: p.url,
            retailer: 'GQ Tobaccos',
            retailerUrl: 'https://www.gqtobaccos.com'
          });
        }
      }

      // Check for more pages
      const maxPageMatch = html.match(/Page \d+ of (\d+)/);
      const maxPage = maxPageMatch ? parseInt(maxPageMatch[1]) : 1;
      if (page >= maxPage) break;
      page++;
      await sleep(300);
    }
    await sleep(200);
  }

  return products;
}