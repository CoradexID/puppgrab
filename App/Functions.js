require('dotenv').config();
const fs = require('fs');
const client = require('https');
const serializer = require('php-serialize');

class Functions {

  toSlug(string) {
    return string
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  }

  downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
      client.get(url, (res) => {
        if (res.statusCode === 200) {
          res.pipe(fs.createWriteStream(filepath))
          .on('error', (err) => reject(new Error('error when save image')))
          .once('close', () => resolve(filepath));
        } else {
          // Consume response data to free up memory
          res.resume();
          reject(new Error(`Request Failed With a Status Code: ${res.statusCode}`));
        }
      })
      .on('error', (err) => {
        console.log(err);
        reject(new Error('Error when scrape image'));
      });
    });
  }
  
  getTime() {
    const d_t = new Date();
    let year = d_t.getFullYear();
    let month = ("0" + (d_t.getMonth() + 1)).slice(-2);
    let day = ("0" + d_t.getDate()).slice(-2);
    let hour = ("0" + d_t.getHours()).slice(-2);
    let minute = ("0" + d_t.getMinutes()).slice(-2);
    let seconds = ("0" + d_t.getSeconds()).slice(-2);
    
    return { year, month, day, hour, minute, seconds  }
  }
  
  getTimestamps() {
    const time = this.getTime();
    return time.year + "-" + time.month + "-" + time.day + " " + time.hour + ":" + time.minute + ":" + time.seconds;
  }
  
  dateToSeconds(date) {
    const data = new Date(date);
    return Math.floor(data.getTime() / 1000);
  }
  
  serialize(obj) {
    return serializer.serialize(obj);
  }
  
  replaceDomain(url, domain) {
    const result = url.split('/');
    result[2] = domain;
    return result.join('/');
  }

}

module.exports = new Functions();