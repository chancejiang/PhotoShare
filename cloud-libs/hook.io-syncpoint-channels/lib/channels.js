//
// registration hook - application to handle registring devices with your server
// this is the cloud hook to run against the server replica, it does stuff like
// send confirmation emails and stuff
//
var Hook = require('hook.io').Hook
    , util = require('util')
    , docstate = require("docstate")
    , coux = require("coux").coux
    , e = require("errlog").e
    ;

var Channels = exports.Channels = function(options){
    var self = this;
    var config = JSON.parse(options.config);

    Hook.call(self, options);

    self.on('hook::ready', function(){
        console.log("starting new Channel hook for ", config['cloud-control']);

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
    var cloudControl = config['cloud-control']
        , cloudDesign = config['cloud-design']
        , d = cloudControl.split('/');
    d.pop();
    var serverUrl = d.join('/');
    var self = this;  
    var control = docstate.control(cloudControl)

    control.safe("channel", "new", function(doc) {
        var db_name = "db-"+doc._id;
        if (doc["public"]) {
            console.log("PDI","please implement public databases")
        } else {
            coux.put([serverUrl, db_name], function(err, resp) {
                if (err) {
                    // 412 means the db already exists
                    doc.state = "error "+err.code;
                    doc.error = "db_name exists: "+db_name;
                    coux.put([cloudControl, doc._id], doc, function(err, ok) {
                        if (err) console.error(err);
                    })
                    console.log(err, resp);
                } else {
                    // only set up creds the first time
                    coux([serverUrl, db_name, "_security"],function(err, sec) {
                        if (err) {sec = {members:{names:[],roles:[]}}}
                        if (sec.members.names.indexOf(doc.owner) == -1) {
                            sec.members.names.push(doc.owner);
                            coux.put([serverUrl, db_name, "_security"], sec, e(function(err, sec) {
                                // replicate the design docs to the new db
                                coux.post([serverUrl, "_replicate"], {
                                    source : cloudDesign,
                                    target : db_name
                                }, e(function(err, ok) {
                                    doc.state = "ready";
                                    doc.syncpoint = serverUrl + '/' + db_name;
                                    coux.put([cloudControl, doc._id], doc, function(err, ok) {
                                        if (err) console.error(err);
                                    })
                                }))
                            }));
                        }
                            
                    });

                }
            });
        }
    });
    return control;
};
