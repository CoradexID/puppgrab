require('dotenv').config();
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

const Database = require(process.env.HOME_DIR + 'App/Database/' + process.env.MAIN_THEME + '.js');
const scraper = require(process.env.HOME_DIR + 'App/Scraper/' + process.env.MAIN_TARGET + '.js');


async function run() {
  const db = new Database();

  await scraper.start();
  await db.connectDatabase();
  await db.connectStorage();

  try {
    const feeds = await scraper.getFeed();
    for (const feed of feeds) {
      console.log(feed);
      // MANGA CHECKER
      const manga = await db.mangaCheck(feed);
      console.log(manga.status, manga.message);

      if (manga.status == 1) {
        const mangaData = await scraper.getManga(feed.url);
        mangaData.title = feed.title;
        console.log('Posting Manga', mangaData.title);
        const insertedManga = await db.insertManga(mangaData);
        console.log(insertedManga.post_title);
        for (const chapter of mangaData.chapters) {
          const chapterData = await scraper.getChapter(chapter.url);
          chapterData.chapter = chapter.chapter;
          chapterData.title = mangaData.title + ' Chapter ' + chapterData.chapter;
          console.log('Posting Chapter', chapterData.chapter);
          const insertedChapter = await db.insertChapter(insertedManga.ID, chapterData);
          console.log(insertedChapter.post_title);
        }
      }

      if (manga.status == 0) {
        const mangaData = await scraper.getManga(feed.url);
        const chapters = await db.chapterCheck(manga.data.ID, mangaData);
        console.log(chapters.length, 'Chapter Not Exist');
        for (const chapter of chapters) {
          const chapterData = await scraper.getChapter(chapter.url);
          chapterData.chapter = chapter.chapter;
          chapterData.title = mangaData.title + ' Chapter ' + chapterData.chapter;
          console.log('Posting Chapter', chapterData.chapter);
          const insertedChapter = await db.insertChapter(manga.data.ID, chapterData);
          console.log(insertedChapter.post_title);
        }
      }
    }
  } catch (e) {
    console.log(e.message);
  }

  await scraper.end();
  await db.closeDatabase();
  await db.closeStorage();

  return Promise.resolve(true);
}

(async () => {
  while (true) {
    await run();
    console.log('REST 10 MINUTES');
    await new Promise(resolve => setTimeout(resolve, (60000 * 10)));
  }
})();