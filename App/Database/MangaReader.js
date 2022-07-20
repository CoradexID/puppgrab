require('dotenv').config();
process.env.TZ = 'Etc/Universal';
const mysql = require('mysql');
const util = require('util');
const fs = require('fs-extra');

const functions = require('../Functions.js');
const Storage = require('../Storage.js');

class Database {

  constructor() {
    this.connection = mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME
    });
    this.query = util.promisify(this.connection.query).bind(this.connection);
    
    if (process.env.WP_FTP_HOST != '') {
      this.wp = new Storage({
        host: process.env.WP_FTP_HOST,
        port: process.env.WP_FTP_PORT,
        user: process.env.WP_FTP_USER,
        password: process.env.WP_FTP_PASS,
      });
    }
    if (process.env.STORAGE_FTP_HOST != '') {
      this.storage = new Storage({
        host: process.env.STORAGE_FTP_HOST,
        port: process.env.STORAGE_FTP_PORT,
        user: process.env.STORAGE_FTP_USER,
        password: process.env.STORAGE_FTP_PASS,
      });
    }
  }
  
  async connectStorage() {
    if (this.wp) await this.wp.connectFTP();
    if (this.storage) await this.storage.connectFTP();
    return Promise.resolve(true);
  }
  
  async closeStorage() {
    if (this.wp) await this.wp.closeFTP();
    if (this.storage) await this.storage.closeFTP();
    return Promise.resolve(true);
  }
    
  async connectDatabase() {
    return new Promise((resolve, reject) => {
      this.connection.connect((err) => {
        err ? reject(err) : resolve(true);
      });
    });
  }

  closeDatabase() {
    return new Promise((resolve, reject) => {
      this.connection.end((err) => {
        err ? reject(err) : resolve(true);
      });
    });
  }
  
  async insertManga(data, setFeaturedImage = true) {
    if (this.wp) await this.wp.checkConnection();
    // DECLARING VARIABLES
    const query = this.query;
    const nowtime = functions.getTimestamps();
    
    const postData = {
        post_author: process.env.WP_AUTHOR_ID,
        post_date: nowtime,
        post_date_gmt: nowtime,
        post_content: data.sinopsys,
        post_title: data.title,
        post_excerpt: '',
        post_status: 'publish',
        comment_status: 'open',
        ping_status: 'closed',
        post_password: '',
        post_name: functions.toSlug(data.title),
        to_ping: '',
        pinged: '',
        post_modified: nowtime,
        post_modified_gmt: nowtime,
        post_content_filtered: '',
        post_parent: 0,
        guid: '',
        menu_order: 0,
        post_type: 'manga',
        post_mime_type: '',
        comment_count: 0
      };
    const post = await query('INSERT INTO wp_posts SET ?', postData);
    
    const createSerie = new Promise(async (resolve, reject) => {
      try {
        const guid = process.env.HOME_URL + '?post_type=manga&#038;p=' + post.insertId;
        await query('UPDATE wp_posts SET guid = ? WHERE id = ?', [guid, post.insertId]);
        const term_data = { name: data.title, slug: functions.toSlug(data.title) };
        const term = await query('INSERT INTO wp_terms SET ?', term_data);
        const taxonomy_data = {
          term_id: term.insertId,
          taxonomy: 'category',
          description: '',
          count: 0
        }
        const taxonomy = await query('INSERT INTO wp_term_taxonomy SET ?', taxonomy_data);
        const relationships_data = {
          object_id: post.insertId,
          term_taxonomy_id: taxonomy.insertId
        }
        await query('INSERT INTO wp_term_relationships SET ?', relationships_data);
        resolve(true);
      } catch (e) {
        reject(e);
      }
    });
    
    const createMeta = new Promise(async (resolve, reject) => {
      try {
        // ONLY MangaReader
        let cover = data.cover;
        
        if (setFeaturedImage) {
          const image = await this.uploadImage(data.coverPath, post.insertId);
          await this.setFeaturedImage(post.insertId, image.ID);
          // ONLY MangaReader
          cover = image.guid;
        }
        
        const metas_data = [
          [post.insertId, 'ero_image', cover],
          [post.insertId, 'ero_japanese', data.alternative],
          [post.insertId, 'ero_type', data.type],
          [post.insertId, 'ero_status', data.status],
          [post.insertId, 'ero_author', data.author],
          [post.insertId, 'ero_artist', data.artist],
          [post.insertId, 'ero_published', data.published],
          [post.insertId, 'ero_score', data.score],
          [post.insertId, 'ero_project', '0'],
          [post.insertId, 'ero_hot', '0'],
        ]
        
        await query('INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES ?', [metas_data]);
        resolve(true);
      } catch (e) {
        reject(e);
      }
    }); 
    
    const createCategory = new Promise(async (resolve, reject) => {
      try {
        if (!data.genres[0]) {
          resolve(true);
          return;
        }
        
        const terms = data.genres.map(genre => genre);
        
        const categoryExist = await query('SELECT * FROM wp_terms WHERE name IN (?)', [terms]);
        const categoryCheck = categoryExist.map(value => value.name);
        const categoryNotExist = terms.filter(value => !categoryCheck.includes(value));
        
        for (const category of categoryExist) {
          const taxonomy = await query('SELECT * FROM wp_term_taxonomy WHERE term_id = ?', [category.term_id]);
          const relationships_data = {
            object_id: post.insertId,
            term_taxonomy_id: taxonomy[0].term_taxonomy_id
          }
          const relationships = await query('INSERT INTO wp_term_relationships SET ?', [relationships_data]);
          await query('UPDATE wp_term_taxonomy SET count = ? WHERE term_id = ?', [(taxonomy[0].count + 1), taxonomy[0].term_id]);
        }
        
        for (const category of categoryNotExist) {
          const term_data = { name: category, slug: functions.toSlug(category) };
          const term = await query('INSERT INTO wp_terms SET ?', term_data);
          const taxonomy_data = {
            term_id: term.insertId,
            taxonomy: 'genres',
            description: '',
            count: 1
          }
          const taxonomy = await query('INSERT INTO wp_term_taxonomy SET ?', taxonomy_data);
          const relationships_data = {
            object_id: post.insertId,
            term_taxonomy_id: taxonomy.insertId
          }
          await query('INSERT INTO wp_term_relationships SET ?', relationships_data);
        }
        
        resolve(true);
      } catch (e) {
        reject(e);
      }
    }); 

    await Promise.all([createSerie,createMeta, createCategory]);
    
    const result = await query('SELECT * FROM wp_posts WHERE ID = ?', [post.insertId]);
    return Promise.resolve(result[0]);
  }

  async insertChapter(mangaId, data, uploadContent = true) {
    if (this.storage) await this.storage.checkConnection();
    // DECLARING VARIABLES
    const query = this.query;
    const nowtime = functions.getTimestamps();
    let content = data.content;
    
    const serie = await query('SELECT * FROM wp_posts WHERE id = ?', [mangaId]);
    
    if (uploadContent) {
      const slug = serie[0].post_name;
      const ch_slug = functions.toSlug(data.chapter);
      const alphabet = slug[0];
      const destination = alphabet + '/' + slug + '/' + ch_slug + '/'; 
      
      let contents = data.contentPath.map((path) => {
        const filename = path.split('/').pop();
        const filepath = destination + filename;
        const src = process.env.STORAGE_URL + filepath;
        return '<img src="' + src + '"/>';
      });
      contents = contents.join('');
      content = contents;
      
      await this.storage.uploadMultiple(data.contentPath, destination);
    }

    // INSERT TO wp_posts
    const post_data = {
      post_author: process.env.WP_AUTHOR_ID,
      post_date: nowtime,
      post_date_gmt: nowtime,
      post_content: content,
      post_title: data.title,
      post_excerpt: '',
      post_status: 'publish',
      comment_status: 'open',
      ping_status: 'open',
      post_password: '',
      post_name: functions.toSlug(data.title),
      to_ping: '',
      pinged: '',
      post_modified: nowtime,
      post_modified_gmt: nowtime,
      post_content_filtered: '',
      post_parent: 0,
      guid: '',
      menu_order: 0,
      post_type: 'post',
      post_mime_type: '',
      comment_count: 0
    }
    const post = await query('INSERT INTO wp_posts SET ?', post_data);
    
    const createGuid = new Promise(async (resolve, reject) => {
      const guid = process.env.HOME_URL + '?p=' + post.insertId;
      await query('UPDATE wp_posts SET guid = ? WHERE id = ?', [guid, post.insertId]);
      resolve(true);
    });
    
    const createMeta = new Promise(async (resolve, reject) => {
      const metas_data = [
        [post.insertId, 'ero_chapter', data.chapter],
        [post.insertId, 'ero_seri', mangaId],
      ]
      
      await query('INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES ?', [metas_data]);
      
      // ONLY MANGAREADER
      const chapters = await this.getChapters(mangaId, 3);
      const last_chapters = chapters.map((item) => {
        return {
          id: item.ID,
          chapter: item.meta_value,
          permalink: item.post_name,
          time: functions.dateToSeconds(item.post_modified)
        }
      });
      
      const latest_data = {
        post_id: mangaId,
        meta_key: 'ero_latest',
        meta_value: functions.serialize(last_chapters)
      }
      
      const latest = await query('SELECT * FROM wp_postmeta WHERE post_id = ? AND meta_key = ?', [mangaId, 'ero_latest']);
      if (!latest[0]) {
        await query('INSERT INTO wp_postmeta SET ?', [latest_data]);
      } else {
        await query('UPDATE wp_postmeta SET meta_value = ? WHERE meta_id = ?', [latest_data.meta_value, latest[0].meta_id])
      }
      ////////////////////////
      
      resolve(true);
    }); 
    
    const createChapter = new Promise(async (resolve, reject) => {
      const serie_term = await query('SELECT * FROM wp_terms WHERE slug = ?', [serie[0].post_name]);
      const serie_taxonomy = await query('SELECT * FROM wp_term_taxonomy WHERE term_id = ?', [serie_term[0].term_id]);
      const relationships_data = {
        object_id: post.insertId,
        term_taxonomy_id: serie_taxonomy[0].term_taxonomy_id
      }
      await query('INSERT INTO wp_term_relationships SET ?', [relationships_data]);
      await Promise.all([
        query('UPDATE wp_term_taxonomy SET count = ? WHERE term_taxonomy_id = ?', [(serie_taxonomy[0].count + 1), serie_taxonomy[0].term_taxonomy_id]),
        query('UPDATE wp_posts SET post_modified = ?, post_modified_gmt = ? WHERE id = ?', [nowtime, nowtime, serie[0].ID])
      ]);
      resolve(true);
    });
    
    await Promise.all([createGuid, createMeta, createChapter]);
    const result = await query('SELECT * FROM wp_posts WHERE ID = ?', [post.insertId]);
    return Promise.resolve(result[0]);
  }
  
  async insertChapterPuppeteer(page, mangaId, data, uploadContent = true) {
    if (this.storage) await this.storage.checkConnection();
    // DECLARING VARIABLES
    const query = this.query;
    const nowtime = functions.getTimestamps();
    let content = data.content;
    
    const serie = await query('SELECT * FROM wp_posts WHERE id = ?', [mangaId]);
    
    await page.goto(process.env.HOME_URL + 'wp-admin/post-new.php?post_type=post&ts_add_chapter='+mangaId, {waitUntil: 'networkidle0'});
    
    if (uploadContent) {
      const slug = serie[0].post_name;
      const ch_slug = functions.toSlug(data.chapter);
      const alphabet = slug[0];
      const destination = alphabet + '/' + slug + '/' + ch_slug + '/'; 
      
      let contents = data.contentPath.map((path) => {
        const filename = path.split('/').pop();
        const filepath = destination + filename;
        const src = process.env.STORAGE_URL + filepath;
        return '<img src="' + src + '"/>';
      });
      contents = contents.join('');
      content = contents;
      
      await this.storage.uploadMultiple(data.contentPath, destination);
    }
    
    await page.evaluate((data, content) => {
      document.querySelector('#title').value = data.title;
      document.querySelector('#content').innerHTML = content;
      document.querySelector('#ero_chapter').value = data.chapter;
    },  data, content);
    await Promise.all([
      await page.click('#publish'),
      await page.waitForNavigation({
        waitUntil: 'networkidle2'
      })
    ]);
    
    const postID = await page.url().split('?post=')[1].split('&action=')[0];
    const result = await query('SELECT * FROM wp_posts WHERE ID = ?', [postID]);
    return Promise.resolve(result[0]);
    
  }

  async PJCheck(data) {
    const slug = data.url.split('/')[4];

    let post = await this.query('SELECT * FROM wp_posts p JOIN wp_postmeta m ON p.ID = m.post_id WHERE post_title = ? AND meta_key = ?', [data.title, 'ero_project']);

    if (!post[0]) {
      post = await this.query('SELECT * FROM wp_posts p JOIN wp_postmeta m ON p.ID = m.post_id WHERE post_name = ? AND meta_key = ?', [slug, 'ero_project']);
      if (!post[0]) return Promise.resolve(false);
      return Promise.resolve(post[0].meta_value == '1' ? true: false);
    }

    return Promise.resolve(post[0].meta_value == '1' ? true: false);
  }

  async mangaCheck(data) {
    const slug = data.url.split('/')[4];

    let post = await this.query('SELECT * FROM wp_posts WHERE post_title = ?', [data.title]);

    // IF DUPLICATE
    if (post[1]) return Promise.resolve({ status: 2, message: 'Duplicate' });

    // IF PROJECT
    const project = await this.PJCheck(data);
    if (project) return Promise.resolve({ status: 3, message: 'Project' });

    if (!post[0]) {
      post = await this.query('SELECT * FROM wp_posts WHERE post_name = ?', [slug]);
      if (!post[0]) return Promise.resolve({ status: 1, message: 'Not Exist' });
    }

    return Promise.resolve({ status: 0, message: 'Exist', data: post[0] });
  }

  async chapterCheck(id, data) {

    let posts = await this.query('SELECT post_id FROM wp_postmeta WHERE meta_key = ? AND meta_value = ?', ['ero_seri', id]);

    if (!posts[0]) return Promise.resolve(data.chapters);
    const result_array = posts.map((item) => item.post_id);
    
    posts = await this.query('SELECT meta_value FROM wp_postmeta WHERE post_id IN (?) AND meta_key = ?', [result_array, 'ero_chapter']);

    const chapters = posts.map((item) => item.meta_value);

    const results = [];
    for (const chapter of data.chapters) {
      if (!chapters.includes(chapter.chapter)) {
        results.push(chapter);
      }
    }

    return Promise.resolve(results);
  }
  
  async uploadImage(imagePath, postParent = 0) {
    const time = functions.getTime();
    const nowtime = functions.getTimestamps();
    
    const filename = 'i' + time.day + time.hour + time.minute + time.seconds;
    const path = time.year + '/' + time.month + '/' + filename + '.jpg';
    const filepath = path;
    await this.wp.uploadSingle(imagePath, filepath);
    
    const post_data = {
      post_author: process.env.WP_AUTHOR_ID,
      post_date: nowtime,
      post_date_gmt: nowtime,
      post_content: '',
      post_title: filename,
      post_excerpt: '',
      post_status: 'inherit',
      comment_status: 'open',
      ping_status: 'closed',
      post_password: '',
      post_name: filename,
      to_ping: '',
      pinged: '',
      post_modified: nowtime,
      post_modified_gmt: nowtime,
      post_content_filtered: '',
      post_parent: postParent,
      guid: process.env.HOME_URL + 'wp-content/uploads/' + path,
      menu_order: 0,
      post_type: 'attachment',
      post_mime_type: 'image/jpeg',
      comment_count: 0
    }
    const post = await this.query('INSERT INTO wp_posts SET ?', [post_data]);
    const meta_data = {post_id: post.insertId, meta_key: '_wp_attached_file', meta_value: path}
    await this.query('INSERT INTO wp_postmeta SET ?', [meta_data])
    
    const result = await this.query('SELECT * FROM wp_posts WHERE id = ?', [post.insertId]); 
    return Promise.resolve(result[0]);
  }
  
  async setFeaturedImage(post_id, image_id) {
    const meta_data = {post_id, meta_key: '_thumbnail_id', meta_value: image_id}
    await this.query('INSERT INTO wp_postmeta SET ?', [meta_data])
    return Promise.resolve(true);
  }
  
  async getChapters(mangaId, limit = null) {
    let posts = '';
    if (limit == null) {
      posts = await this.query('SELECT * FROM wp_posts p JOIN wp_postmeta m ON p.ID = m.post_id WHERE meta_key = ? AND meta_value = ?  ORDER BY post_id DESC', ['ero_seri', mangaId]);
    } else {
      posts = await this.query('SELECT * FROM wp_posts p JOIN wp_postmeta m ON p.ID = m.post_id WHERE meta_key = ? AND meta_value = ? ORDER BY post_id DESC LIMIT ?', ['ero_seri', mangaId, limit]);
    }
    if (!posts[0]) return Promise.resolve([]);
    const result_array = posts.map((item) => item.post_id);
    
    const chapters = await this.query('SELECT * FROM wp_posts p JOIN wp_postmeta m ON p.ID = m.post_id WHERE post_id IN (?) AND meta_key = ? ORDER BY post_id DESC', [result_array, 'ero_chapter']);
    
    
    return Promise.resolve(chapters);
  }

}

module.exports = Database;

