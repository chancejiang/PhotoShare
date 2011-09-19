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

    var welcome = ' \
     ______                  __    __                   \n\
     / ____/____  __  _______/ /_  / /_  ____ _________  \n\
    / /    / __ \\/ / / / ___/ __ \\/ __ \\/ __ `/ ___/ _ \ \n\
   / /___ / /_/ / /_/ / /__/ / / / /_/ / /_/ (__  )  __/ \n\
   \\____/ \\____/\\__,_/\\___/_/ /_/_.___/\\__,_/____/\\___/  \n\
\n\
\n\
      _____                     ____        _        __  \n\
     / ___/__  ______  _____   / __ \\____  (_)____  / /_ \n\
     \\__ \\/ / / / __ \\/ ___/  / /_/ / __ \\/ // __ \\/ __/ \n\
    ___/ / /_/ / / / / /__   / ____/ /_/ / // / / / /_   \n\
   /____/\\__, /_/ /_/\\___/  /_/    \\____/_//_/ /_/\\__/   \n\
        /____/                                           \n\
\n\
              MULTI USER CLOUD BACKUP AND SYNC MANAGER \n\
              relaxing since 2011 \n\
';
    if (welcome.rainbow) {
        console.log(welcome.rainbow);
    } else {
        console.log(welcome);
    }
    var cloudControl = config['cloud-control'];
    // , cloudDesign = config['cloud-design'];
    self.on('hook::ready', function(){
        var registration = {
            name : 'registration',
            type : 'syncpoint-registration',
            debug : true,
            config : options.config
        }, channels = {
            name : 'channels',
            type : 'syncpoint-channels',
            debug : true,
            config : options.config
        }, mailer = {
            name : 'sync-mailer' ,
            type : 'mailer',
            "mailer": {
                "host": "localhost",
                "username": "foo@bar.com",
                "password": "1234",
                "domain": "localhost"
            },
            debug : true
        }, follow = {
            name : "control-db",
            type : "couch",
            debug : true,
            'feed-db' : cloudControl,
            'feed-since' : 0
        }
        self.spawn([registration], function(e) {
            if (e) {
                console.log("sp", e.stack)
            }
        });
        self.spawn([channels], function(e) {
            if (e) {
                console.log("sp", e.stack)
            }
        });
        var children = [], spawned = false;
        self.on('*::ready', function() {
            children.push(this.event);
            maybeSpawnFollow()
        });

        function maybeSpawnFollow(args) {
            if (!spawned && children.indexOf("registration::ready") !== -1 && children.indexOf("channels::ready") !== -1) {
                spawned = true
                self.spawn([follow])
            }
        }

    });


};

// CouchHook inherits from Hookf
util.inherits(SyncPoint, Hook);
