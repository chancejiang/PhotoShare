//
// registration hook - application to handle registring devices with your server
// this is the cloud hook to run against the server replica, it does stuff like
// send confirmation emails and stuff
//
var Hook = require('hook.io').Hook
    , util = require('util')
    , docstate = require("docstate")
    , coux = require("coux").coux
    , errLog = require("errlog").errLog
    ;

var Channels = exports.Channels = function(options){
    var self = this;
    var config = JSON.parse(options.config);

    Hook.call(self, options);

    self.on('hook::ready', function(){
        console.log("starting new Channel hook for ", config.cloud);

        var control = self.setupControl(config);
        control.start();
        self.emit("ready")
        self.on('*::change', function(change) {
            console.log(change.doc.type, change.doc.state, change.doc._id)
            control.handle(change.doc)
        });
    });
};

util.inherits(Channels, Hook);

Channels.prototype.setupControl = function(config){
    var controlDb = config.cloud
    , d = controlDb.split('/');
    d.pop();
    var serverUrl = d.join('/');
    var self = this;  
    var control = docstate.control(config.cloud)

    control.safe("channel", "new", function(doc) {
        var db_name = "db-"+doc._id;
        if (doc["public"]) {
            errLog("PDI","please implement public databases")
        } else {
            coux.put([serverUrl, db_name], function(err, resp) {
                if (err) {
                    console.error(err)
                    // 412 means the db already exists
                    doc.state = "error "+err.code;
                    doc.error = "db_name exists: "+db_name;
                    db.insert(doc, errLog);
                    errLog(err, resp);
                } else {
                    // only set up creds the first time
                    coux([db_name, "_security"],function(err, sec) {
                        if (err) {sec = {members:{names:[],roles:[]}}}
                        if (sec.members.names.indexOf(doc.owner) == -1) {
                            sec.members.names.push(doc.owner);
                            coux.put([db_name, "_security"], function(err, sec) {
                                doc.state = "ready";
                                doc.syncpoint = PUBLIC_HOST_URL + db_name;
                                db.insert(doc, errLog);
                                
                            });
                        }
                            
                    });

                }
            });
        }
    });

    control.safe("channel", "ready", function(doc) {
        var channel_db = urlDb(doc.syncpoint);
        channel_db.insert({
            _id : 'description',
            name : doc.name
        }, errLog);
    });
};
