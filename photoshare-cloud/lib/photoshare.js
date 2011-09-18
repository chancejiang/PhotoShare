
var Hook = require('hook.io').Hook,
    util = require('util');

var PhotoShare = exports.PhotoShare = function(options) {

  var self = this;

  Hook.call(self, options);

  self.on('hook::ready', function(){
      // var controlCouch = {
      //     name : 'control', 
      //     type : 'couch', 
      //     'feed-db' : options.config.cloud,
      //     'feed-since' : 0
      // };
      var syncPoint = {
          name : 'syncpoint',
          type : 'syncpoint',
          config : options.config
      }
      self.spawn([syncPoint]);
  });
};

util.inherits(PhotoShare, Hook);
