require('dotenv').config();
const scraper = require('../../App/Scraper/Komiktap.js');
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

(async () => {
  await scraper.start();
  
  const feeds = await scraper.getFeed();
  console.log(feeds);
  const manga = await scraper.getManga(feeds[0].url);
  console.log(manga);
  console.log('\n\n\n\n\n\nChapter');
  const chapter = await scraper.getChapter(manga.chapters[0].url);
  console.log(chapter);
  
  await scraper.end();
})();