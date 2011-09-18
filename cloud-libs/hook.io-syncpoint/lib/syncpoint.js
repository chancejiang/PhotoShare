//
// SyncPoint hook - application to handle registring devices with your server
// this is the cloud hook to run against the server replica, it does stuff like
// send confirmation emails and stuff
//
var Hook = require('hook.io').Hook,
    util = require('util');

var SyncPoint = exports.SyncPoint = function(options){

  var self = this;

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
        'feed-db' : options.config.cloud,
        'feed-since' : 0,
        config : options.config
    }
    self.spawn([registration, follow]);
  });

};

// CouchHook inherits from Hookf
util.inherits(SyncPoint, Hook);
