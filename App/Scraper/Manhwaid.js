require('dotenv').config();
const puppeteer = require("puppeteer");
const fs = require('fs-extra');
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
    fs.emptyDirSync(process.env.DOWNLOAD_LOCAL_PATH);
    await this.goto(url);
    await this.page.waitForSelector('li.wp-manga-chapter');

    const results = await this.page.evaluate(() => {
      const title = document.querySelector('.post-title h1').innerText.trim();
      const sinopsys = document.querySelector('.summary__content p').innerText.trim();

      let cover = document.querySelector('.summary_image a img').src;
      let coverPath = null;

      const alternative = document.querySelector('.alternative') ? document.querySelector('.alternative').innerText.trim(): '';
      const score = document.querySelector('span.score').innerText.trim();
      const tables = document.querySelectorAll('.post-content_item');

      let [type,
        status,
        published,
        author,
        artist] = Array(5).fill('');
      for (const table of tables) {
        const innerText = table.innerText;
        if (innerText.includes('Type')) {
          type = innerText.replace('Type', '').trim();
        }
        if (innerText.includes('Status')) {
          status = innerText.replace('Status', '').trim();
        }
        if (innerText.includes('Release')) {
          published = innerText.replace('Release', '').trim();
        }
        if (innerText.includes('Author')) {
          author = innerText.replace('Author', '').trim();
        }
        if (innerText.includes('Artist')) {
          artist = innerText.replace('Artist', '').trim();
        }
      }


      const genres = [];
      const genreTabs = document.querySelectorAll('.genres-content a');
      for (const genre of genreTabs) {
        genres.push(genre.innerText.trim());
      }
      const chapters = [];
      const chapterlist = document.querySelectorAll('li.wp-manga-chapter');
      for (const chapter of chapterlist) {
        console.log(chapter.innerHTML);
        chapters.push({
          chapter: chapter.querySelector('a').innerText.replace('Chapter ', '').trim(),
          url: chapter.querySelector('a').href
        });
      }

      return new Promise((resolve, reject) => {
        resolve({
          title,
          sinopsys,
          cover,
          coverPath,
          score,
          alternative,
          type,
          status,
          author,
          artist,
          published,
          genres,
          chapters: chapters.reverse()
        });
      });
    });

    if (downloadCover) {
      const time = functions.getTime();
      const filename = time.day + time.hour + time.minute + time.seconds + ".jpg";
      const filepath = process.env.DOWNLOAD_LOCAL_PATH + filename;
      await functions.downloadImage(results.9cover, filepath);
      results.coverPath = filepath;
    }

    return Promise.resolve(results);
  }
  
  async getChapter(url, downloadImage = true, options) {
    
  }

  async getFeed() {
    await this.goto(MAIN_URL);
    const results = await this.page.evaluate(() => {
      const mangas = document.querySelectorAll('.page-listing-item .manga');

      const results = [];
      for (const manga of mangas) {
        results.push({
          title: manga.querySelector('a').getAttribute('title'),
          url: manga.querySelector('a').href
        })
      }

      return results;
    });
    return Promise.resolve(results);
  }

  async goto(url) {
    await this.page.goto(url,
      {
        waitUntil: 'networkidle0'
      });
    return Promise.resolve(true);
  }

  async end() {
    await this.browser.close();
    return Promise.resolve(true);
  }

}

module.exports = new Scraper();