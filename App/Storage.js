const ftp = require('basic-ftp');
require('dotenv').config();

const functions = require('./Functions.js');

class Storage {

  constructor(config) {
    this.client = new ftp.Client();
    this.config = config;
  }

  async connectFTP() {
    await this.client.access({
      host: this.config.host,
      user: this.config.user,
      password: this.config.password,
      port: this.config.port,
    });
    
    return Promise.resolve(true);
  }
  
  async checkConnection() {
    if (this.client.closed) {
      await this.connectFTP();
      return Promise.resolve('Closed & Successfully Reconnected');
    }
    console.log('Storage Closed Status:', this.client.closed);
    return Promise.resolve('Not Closed');
  }
  
  closeFTP() {
    this.client.close();
    
    return new Promise((resolve) => {
      const wait = setInterval(() => {
        if (this.client.closed) {
          resolve(true);
          clearInterval(wait);
        }
      }, 100)
    });
  }

  async uploadSingle(imagePath, path) {
    let folders = path.split('/');
    folders.pop();
    folders = folders.join('/');

    await this.client.ensureDir(folders);
    await this.client.cd('/');

    await this.client.uploadFrom(imagePath, path);

    return Promise.resolve(true);
  }

  async uploadMultiple(paths, destination) {
    await this.client.ensureDir(destination);
    await this.client.cd('/');

    for (const path of paths) {
      try {
        const filename = path.split('/').pop();
        const filepath = destination + filename;
        
        await this.client.uploadFrom(path, filepath);
      } catch (e) {
        console.log(e.message);
      }
    }
    
    return Promise.resolve(true);
  }

}

module.exports = Storage;