//
// registration hook - application to handle registring devices with your server
// this is the cloud hook to run against the server replica, it does stuff like
// send confirmation emails and stuff
//
var Hook = require('hook.io').Hook
    , util = require('util')
    , docstate = require("docstate")
    , coux = require("coux").coux
    , errLog = require("errlog")
    , e = errLog.e
    , o = errLog.o
    ;

var Registration = exports.Registration = function(options){
    var self = this;
    var config = JSON.parse(options.config);

    Hook.call(self, options);

    self.on('hook::ready', function(){
        console.log("starting new Registration hook for ", config['cloud-control']);
        console.log("                            Design ", config['cloud-design']);

        var control = self.setupControl(config);
        control.start();
        self.emit("ready")
        self.on('*::change', function(change) {
            console.log(change.doc.type, change.doc.state, change.doc._id)
            control.handle(change.doc)
        });
    });
};

util.inherits(Registration, Hook);

Registration.prototype.setupControl = function(config){
    var cloudControl = config['cloud-control']
        , cloudDesign = config['cloud-design']
        , d = cloudControl.split('/')
        , serverUrl;
    d.pop();
    serverUrl = d.join('/');
            
    var self = this;  
    var control = docstate.control(cloudControl)
    
    control.safe("confirm","clicked", function(doc) {
        var confirm_code = doc.confirm_code;
        var device_code = doc.device_code;
        // load the device doc with confirm_code == code
        // TODO use a real view
        coux([cloudControl, "_all_docs", {include_docs : true}], e(function(err, view) {
            var deviceDoc;
            view.rows.forEach(function(row) {
               if (row.doc.confirm_code && row.doc.confirm_code == confirm_code &&
                   row.doc.device_code && row.doc.device_code == device_code &&
                   row.doc.type && row.doc.type == "device") {
                   deviceDoc = row.doc;
               }
            });
            if (deviceDoc) {
                deviceDoc.state = "confirmed";
                coux.put([cloudControl, deviceDoc._id], deviceDoc, e(function(err, ok) {
                    doc.state = "used";
                    coux.put([cloudControl, doc._id], doc, e());
                }));
            } else {
                doc.state = "error";
                doc.error = "no matching device";
                coux.put([cloudControl, doc._id], doc, e());
            }
        }));
    });

    control.safe("device", "confirmed", function(deviceDoc) {   
        // ensure the user exists and make sure the device has a delegate on it
        // move device_creds to user document, so the device can use them to auth as the user
        ensureUserDoc(serverUrl, deviceDoc.owner, function(err, userDoc) {
            console.log("ensuredUserDoc")
            userDoc = applyOAuth(userDoc, deviceDoc, serverUrl, o(function(err, userDoc) {
                if (err && err.error != 'modification_not_allowed') { // iris couch oauth workaround
                    deviceDoc.state = "error";
                    deviceDoc.error = err;
                    coux.put([cloudControl, deviceDoc._id], deviceDoc, e());
                } else {
                    if (userDoc) {
                        coux.put([serverUrl, "_users", userDoc._id], userDoc, e(function(err) {
                            deviceDoc.state = "active";
                            coux.put([cloudControl, deviceDoc._id], deviceDoc, e());
                        }))                    
                    } else {
                        console.log("activateDeviceDoc")
                        deviceDoc.state = "active"; // security if it allows trival reuse of discarded deviceDocs to access accounts...?
                        coux.put([cloudControl, deviceDoc._id], deviceDoc, e());
                    } // else we are done, applyOAuth had no work to do
                }
            }));
        });
    });


    control.unsafe("device", "new", function(doc) {
        var confirm_code = Math.random().toString().split('.').pop(); // todo better entropy
        var link = cloudControl + "/_design/channels/verify.html#" + confirm_code;
        sendEmail(self, doc.owner, confirm_code, e(function() {
            doc.state = "confirming";
            doc.confirm_code = confirm_code;
            coux.put([cloudControl, doc._id], doc, e());          
        }));
    });
    
    return control;
}


function sendEmail(hook, address, link, cb) {
    var email = {
        to : address,
        from : "jchris@couchbase.com",
        subject : 'Confirm Sync',
        body : 'To sync your phone with the sharing server, click this link:\n\n' 
        + link
    };
    hook.emit("sendEmail", email)
// how do we get an ack that that email was delivered?
    cb(false);
}


function ensureUserDoc(serverUrl, name, fun) {
    var user_doc_id = "org.couchdb.user:"+name;
    coux([serverUrl, "_users", user_doc_id], function(err, userDoc) {
        if (err && err.error == 'not_found') {
            fun(false, {
                _id : user_doc_id,
                type : "user",
                name : name,
                roles : []
            });
        } else if (err) {
            console.log("ensureUserDoc Err", err.stack)
        } else {
            fun(false, userDoc);
        }
    });
}

function applyOAuth(u, deviceDoc, serverUrl, cb) {   
     
    var userDoc = u;
    var creds = deviceDoc.oauth_creds, id = deviceDoc._id;
    if (!userDoc) {
        userDoc = {};
    }
    if (!userDoc.oauth) {
        userDoc.oauth = {
            consumer_keys : {},
            tokens : {}
        };        
    }
    if (!userDoc.oauth['devices']) {
        userDoc.oauth['devices'] =  {};
    }
    if (userDoc.oauth.consumer_keys[creds.consumer_key] || userDoc.oauth.tokens[creds.token]) {
        if (userDoc.oauth.consumer_keys[creds.consumer_key] == creds.consumer_secret &&
            userDoc.oauth.tokens[creds.token] == creds.token_secret &&
            userDoc.oauth.devices[id][0] == creds.consumer_key &&
            userDoc.oauth.devices[id][1] == creds.token) {
                // no op, no problem
                cb(false)
        } else {
            cb({error : "token_used", message : "device_id "+id})            
        }
    }
    userDoc.oauth.devices[id] = [creds.consumer_key, creds.token];
    userDoc.oauth.consumer_keys[creds.consumer_key] = creds.consumer_secret;
    userDoc.oauth.tokens[creds.token] = creds.token_secret;
    // set the config that we need with oauth user doc capability
    setOAuthConfig(userDoc, id, creds, serverUrl, cb);
};

// assuming we are still running on a version of couch that doesn't have 
// https://issues.apache.org/jira/browse/COUCHDB-1238 fixed
function setOAuthConfig(userDoc, id, creds, serverUrl, cb) {
    var rc = 0, ops = [
        ["oauth_consumer_secrets", creds.consumer_key, creds.consumer_secret],
        ["oauth_token_users", creds.token, userDoc.name],
        ["oauth_token_secrets", creds.token, creds.token_secret]
    ];
    for (var i=0; i < ops.length; i++) {
        var op = ops[i];
        coux.put([serverUrl, "_config", op[0], op[1]], op[2], function(err) {
            if (err) {
                cb(err)
            } else {
                rc += 1;
                if (rc == ops.length) {
                    cb(false)
                }
            }
        });
    };
}
