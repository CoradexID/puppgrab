require('dotenv').config();

const Database = require(process.env.HOME_DIR + 'App/Database/' + process.env.MAIN_THEME + '.js');

(async () => {
  const db = new Database();
  await db.connectDatabase();
  
  for (var i = 0; i < 20; i++) {
    const data = {
      title: 'Testo '+i,
      chapter: i,
      content: 'okebang',
      contentPath: [],
      sources: []
    }
    const chapter = await db.postChapter(145, data, false);
    console.log(chapter.post_title);
  }
  
  await db.closeDatabase();
})();