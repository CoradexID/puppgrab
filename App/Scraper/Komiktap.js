require('dotenv').config();
const puppeteer = require("puppeteer");
const fs = require('fs-extra');
const functions = require('../Functions.js');

const MAIN_URL = 'https://194.233.66.232/';

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

    const results = await this.page.evaluate(() => {
      const title = document.querySelector('.entry-title').innerText.trim();
      const sinopsys = document.querySelector('div[itemprop="description"] p').innerText.trim();

      let cover = document.querySelector('.thumb img').src;
      let coverPath = null;

      const alternative = document.querySelector('.seriestualt') ? document.querySelector('.seriestualt').innerText.trim(): '';
      const score = document.querySelector('div[itemprop="ratingValue"]').innerText.trim();
      const tables = document.querySelectorAll('.infotable tr');

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
        if (innerText.includes('Released')) {
          published = innerText.replace('Released', '').trim();
        }
        if (innerText.includes('Author')) {
          author = innerText.replace('Author', '').trim();
        }
        if (innerText.includes('Artist')) {
          artist = innerText.replace('Artist', '').trim();
        }
      }


      const genres = [];
      const genreTabs = document.querySelectorAll('.seriestugenre a');
      for (const genre of genreTabs) {
        genres.push(genre.innerText.trim());
      }
      const chapters = [];
      const chapterlist = document.querySelectorAll('#chapterlist ul li');
      for (const chapter of chapterlist) {
        console.log(chapter.innerHTML);
        chapters.push({
          chapter: chapter.querySelector('a .chapternum').innerText.trim(),
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
      await functions.downloadImage(results.cover, filepath);
      results.coverPath = filepath;
    }

    return Promise.resolve(results);
  }

  async getChapter(url, downloadContent = true, options = {}) {
    await this.goto(url);
    await this.page.waitForSelector('#readerarea img');
    const results = await this.page.evaluate((functions, options) => {
      const title = document.querySelector('.headpost h1').innerText.trim();

      let content = '';
      const sources = [];
      const contentPath = [];

      const images = document.querySelectorAll('#readerarea img');
      for (const image of images) {
        let src = image.src;
        sources.push(src);
        if (options.replaceImageDomain) {
          src = functions.replaceDomain(src, options.replaceImageDomain);
        }
        content = content + '<img src="' + src + '"/>';
      }

      return {
        title,
        content,
        contentPath,
        sources
      }
    }, functions, options);

    if (downloadContent) {
      const promises = [];
      for (let i = 0; i < results.sources.length; i++) {
        const src = results.sources[i];
        const filename = (i + 1) + '.jpg';
        const path = process.env.DOWNLOAD_LOCAL_PATH + filename;
        results.contentPath.push(path);
        const promise = new Promise((resolve, reject) => {
          functions.downloadImage(src, path)
          .then(resolve)
          .catch((e) => {
            console.log(e);
            resolve();
          });
        });
        promises.push(promise);
      }
      await Promise.all(promises);
    }

    return Promise.resolve(results);

  }

  async getFeed() {
    await this.goto(MAIN_URL);
    const results = await this.page.evaluate(() => {
      const upd = document.querySelectorAll('.listupd')[2];
      const mangas = upd.querySelectorAll('.utao .imgu a.series');
      const results = [];
      for (const manga of mangas) {
        results.push({
          title : manga.getAttribute('title'),
          url : manga.href 
        });
      }

      return results;
    });
    return Promise.resolve(results);
  }
  
  async getAZ() {
    await this.goto('https://194.233.66.232/manga/list-mode');
    const results = await this.page.evaluate(() => {
      const lists = document.querySelectorAll('a.series');
      const results = [];
      
      for(const list of lists) {
        results.push({
          title: list.innerText.trim(),
          url: list.href
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