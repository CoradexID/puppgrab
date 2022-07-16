require('dotenv').config();
const scraper = require('../../App/Scraper/Manhwaid.js');

(async () => {
  await scraper.start();
  
  const data = await scraper.getChapter('https://manhwaid.fun/manga/banging-mother-and-daughter/chapter-7/');
  console.log(data);
  
  await scraper.end();
})();

// 