require('dotenv').config();
const puppeteer = require("puppeteer");
const functions = require('../Functions.js');

const MAIN_URL = 'https://manhwaid.fun/';

class Scraper {

  async start() {
    const options = {
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ],
      headless: true
    }
    this.browser = await puppeteer.launch(options);
    this.page = await this.browser.newPage();
    return Promise.resolve(true);
  }
  
  async getManga(url, downloadCover = true) {
    await this.goto(url);
    await waitForSelector('');
  }
  
  async goto(url) {
    await this.page.goto(url, {waitUntil: 'networkidle0'});
    return Promise.resolve(true);
  }
  
  async end() {
    await this.browser.close();
    return new Promise.resolve(true);
  }

}