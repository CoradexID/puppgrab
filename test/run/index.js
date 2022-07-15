require('dotenv').config();
const scraper = require('../../App/Scraper/Manhwaid.js');

(async () => {
  await scraper.start();
  
  const feeds = await scraper.getFeed();
  for (const feed of feeds) {
    const manga = await scraper.getManga(feed.url);
    console.log(manga);
    for (const chapter of manga.chapters) {
      const chapter = await scraper.getChapter(chapter.url)
    }
  }
  
  await scraper.end();
})();