require('dotenv').config();
const scraper = require('../../App/Scraper/Manhwaid.js');

(async () => {
  await scraper.start();
  
  const data = await scraper.getFeed();
  console.log(data);
  
  await scraper.end();
})();