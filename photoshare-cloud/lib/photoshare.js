
var Hook = require('hook.io').Hook,
    util = require('util');

var PhotoShare = exports.PhotoShare = function(options) {
  var self = this;

  Hook.call(self, options);

  self.on('hook::ready', function(){
      var syncPoint = {
          name : 'syncpoint',
          type : 'syncpoint',
          debug : true,
          config : options.config
      }
      self.spawn([syncPoint], function(e) {
          if (e) {
              console.log(e.message, e.stack)
          }
      });
  });
};

util.inherits(PhotoShare, Hook);
