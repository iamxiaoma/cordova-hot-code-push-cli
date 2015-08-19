(function(){
  var path = require('path'),
      prompt = require('prompt'),
      fs = require('fs-extra'),
      async = require('async'),
      crypto = require('crypto'),
      Q = require('q'),
      _ = require('lodash'),
      replaceStream = require('replacestream'),
      createHash = require('crypto').createHash,
      recursive = require('recursive-readdir'),
      sourceDirectory = path.join(process.cwd(), 'www'),
      configFile = path.join(process.cwd(), 'cordova-hcp.json'),
      ignoreFile = path.join(process.cwd(), '.chcpignore');

  module.exports = {
    execute: execute
  };

  function execute(argv) {
    var executeDfd = Q.defer(),
        config,
        projectIgnore = '',
        ignore = [
          'node_modules',
          'chcp.json',
          '.chcp*',
          '.gitignore',
          'package.json',
          '.git'
        ];

    if(!argv) {
      argv = {};
    }

    try {
      config = fs.readFileSync(configFile, {encoding: 'utf-8'});
      config = JSON.parse(config);
      config.release = process.env.VERSION || calculateTimestamp();
      if(argv.content_url) {
        config.content_url = argv.content_url;
      }
      console.log('Config', config);
    } catch(e) {
      console.log('Cannot parse cordova-hcp.json. Did you run cordova-hcp init?');
      process.exit(0);
    }

    try {
      projectIgnore = fs.readFileSync(ignoreFile, {encoding: 'utf-8'});
    } catch(e) {
      console.log('Warning: .chcpignore does not exist.');
    }

    if(projectIgnore.length > 0) {
      _.assign(ignore, _.trim(projectIgnore).split(/\n/));
    }

    recursive(sourceDirectory, ignore, function (err, files) {
      var hashQueue = [];
      for(var i in files) {
        var file = files[i];
        hashQueue.push(hashFile.bind(null, file));
      }

      async.parallelLimit(hashQueue, 10, function(err, result) {
        var json = JSON.stringify(result, null, 2);
        var manifestFile = sourceDirectory + '/chcp.manifest';

        fs.writeFile(manifestFile, json, function(err) {
          if(err) {
            return console.log(err);
          }

          if(argv.localdev) {
            config.update = 'now';
          }
          var json = JSON.stringify(config, null, 2);
          fs.writeFile(sourceDirectory + '/chcp.json', json, function(err) {
            if(err) {
              return console.log(err);
            }
            console.log('Build '+config.release+' created in '+sourceDirectory);
            executeDfd.resolve(config);
          });
        });
      });
    });

    return executeDfd.promise;
  }

  function hashFile(filename, callback){
    var hash = crypto.createHash('md5'),
        stream = fs.createReadStream(filename);

    //stream.pipe(writeStream);
    //console.log('Hashing: ', filename);
    stream.on('data', function (data) {
      hash.update(data, 'utf8');
    });

    stream.on('end', function () {
      var result = hash.digest('hex'),
          file = filename.replace(sourceDirectory+'/', '');

      callback(null, {file: file, hash: result});
    });
  }

  function calculateTimestamp() {
    var currentdate = new Date();
    return currentdate.getFullYear() + '.' +
      (((currentdate.getMonth() + 1) < 10) ? '0' + (currentdate.getMonth() + 1) : (currentdate.getMonth() + 1)) + '.' +
      ((currentdate.getDate() < 10) ? '0' + currentdate.getDate() : currentdate.getDate()) + '-' +
      ((currentdate.getHours() < 10) ? '0' + currentdate.getHours() : currentdate.getHours()) + '.' +
      ((currentdate.getMinutes() < 10) ? '0' + currentdate.getMinutes() : currentdate.getMinutes()) + '.' +
      ((currentdate.getSeconds() < 10) ? '0' + currentdate.getSeconds() : currentdate.getSeconds());
  }
})();
