require('dotenv').config();
const scraper = require('../../App/Scraper/Manhwaid.js');

(async () => {
  await scraper.start();
  
  const data = await scraper.getManga('https://manhwaid.fun/manga/banging-mother-and-daughter/');
  console.log(data);
  
  await scraper.end();
})();