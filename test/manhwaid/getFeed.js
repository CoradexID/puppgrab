require('dotenv').config();
const scraper = require('../../App/Scraper/Manhwaid.js');

(async () => {
  await scrape.start();
  
  const data = await scraper.getFeed();
  console.log(data);
  
  await scrape.end();
})();