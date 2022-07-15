require('dotenv').config();
const scraper = require('../../App/Scraper/Manhwaid.js');

process.on('SIGINT', async () => {
  console.log('[#] Closing Browser...');
  await scraper.end();
});

(async () => {
  await scraper.start();
  
  const feeds = await scraper.getFeed();
  for (const feed of feeds) {
    const manga = await scraper.getManga(feed.url);
    console.log(manga);
    for (const chapter of manga.chapters) {
      const data = await scraper.getChapter(chapter.url);
      console.log(data);
    }
  }
  
  await scraper.end();
})();