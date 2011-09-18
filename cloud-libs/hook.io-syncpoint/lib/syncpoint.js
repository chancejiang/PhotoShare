//
// SyncPoint hook - application to handle registring devices with your server
// this is the cloud hook to run against the server replica, it does stuff like
// send confirmation emails and stuff
//
var Hook = require('hook.io').Hook,
    util = require('util'),
    couch = require('hook.io-couch')
    ;

var SyncPoint = exports.SyncPoint = function(options){
  var self = this;
  var config = JSON.parse(options.config);
  Hook.call(self, options);

  self.on('hook::ready', function(){
    var registration = {
        name : 'registration',
        type : 'syncpoint-registration',
        debug : true,
        config : options.config
    }, follow = {
        name : "control-db",
        type : "couch",
        debug : true,
        'feed-db' : config.cloud,
        'feed-since' : 0
    }
    self.spawn([registration, follow], function(e) {
        if (e) {
            console.log(e.message, e.stack)
        }
    });
  });

};

// CouchHook inherits from Hookf
util.inherits(SyncPoint, Hook);
