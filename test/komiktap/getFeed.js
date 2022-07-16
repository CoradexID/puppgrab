require('dotenv').config();
const scraper = require('../../App/Scraper/Komiktap.js');

(async () => {
  await scraper.start();
  
  const data = await scraper.getFeed();
  console.log(data);
  
  await scraper.end();
})();