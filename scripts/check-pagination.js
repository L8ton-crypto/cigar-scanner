const https = require('https');
https.get('https://www.gqtobaccos.com/cohiba/', {headers:{'User-Agent':'Mozilla/5.0'}}, res => {
  let d=''; res.on('data',c=>d+=c); res.on('end',()=>{
    const imgs = d.match(/card-figure/g);
    console.log('Products on page:', imgs ? imgs.length : 0);
    // Find pagination
    const pag = d.match(/class="pagination[^"]*"/g);
    if(pag) console.log('Pagination classes:', pag.join(', '));
    const nextLinks = d.match(/href="[^"]*"[^>]*class="[^"]*next/g);
    if(nextLinks) console.log('Next links:', nextLinks.join('\n'));
    // Any page= params
    const pageParams = d.match(/[?&]page=\d+/g);
    if(pageParams) console.log('Page params:', [...new Set(pageParams)].join(', '));
    // Check pagination section specifically
    const pagSection = d.match(/<ul class="pagination[^"]*"[\s\S]*?<\/ul>/);
    if(pagSection) console.log('Pagination HTML:', pagSection[0].substring(0, 500));
  });
});
