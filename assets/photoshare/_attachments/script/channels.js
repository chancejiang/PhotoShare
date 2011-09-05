// channels.js is for connecting your client to a Couchbase sync server
// requires coux
// 
function e(fun) {
    return function(err, data) {
        if (err) {
            console.log(err)
        } else {
            fun && fun(err, data)
        }
    };
};

var Channels = function(opts) {
    
    opts.localControl = opts.localControl || "control";

    if (!(opts.waitForContinue && opts.setupEmailForm)) {
        throw("opts.waitForContinue && opts.setupEmailForm are requried")
    }
    
    setupControl();
    // entry point for device registration and sync / backup config
    function setupControl() {
        coux({type : "PUT", uri : [opts.localControl]}, function() {
            coux([opts.localControl,"_local/device"], function(err, doc) {
                if (!err && doc.device_id) {
                    haveDeviceId(doc.device_id)
                } else {
                    setDeviceId(haveDeviceId);
                }
            });
        });
    }

    function setDeviceId(cb) {
        coux("/_uuids?count=1", e(function(err, resp) {
            var uuids = resp.uuids;
            coux({type : "PUT", uri : [opts.localControl,"_local/device"]}, {
                device_id : uuids[0]
            }, e(function(err, resp) {
                cb(uuids[0])
            }));
        }));
    }

    function haveDeviceId(device_id) {
        coux([opts.localControl, device_id], function(err, doc) {
            if (err) { // no device doc
                opts.setupEmailForm(e(function(err, email, cb) {
                    // get email address via form
                    makeDeviceDoc(doc.device_id, email, e(function(err, deviceDoc) {
                        cb()
                        haveDeviceDoc(deviceDoc)
                    }));
                }));
            } else {
                haveDeviceDoc(doc)
            }
        })
    }

    function haveDeviceDoc(deviceDoc) {
        if (deviceDoc.connected) {
            syncInfo();
            connectReplication(deviceDoc, e());
        } else {
            opts.waitForContinue(deviceDoc, e(function(err, cb) {
                syncInfo();
                connectReplication(deviceDoc, e(function(err, resp) {
                    if (!err) {
                        cb();
                        deviceDoc.connected = true;
                        coux({type : "PUT", uri : [opts.localControl,deviceDoc._id]}, deviceDoc, e());
                    }
                }));
            }));
        }
    };

    function makeDeviceDoc(device_id, cb) {
        coux("/_uuids?count=4", e(function(err, resp) {
            var uuids = resp.uuids;
            var deviceDoc = {
                _id : device_id,
                owner : email,
                type : "device",
                state : "new",
                device_code : Math.random().toString().substr(2,4),
                oauth_creds : { // we need better entropy
                  consumer_key: uuids[0],
                  consumer_secret: uuids[1],
                  token_secret: uuids[2],
                  token: uuids[3]
                }
            };
            coux({type : "PUT", uri : [opts.localControl,deviceDoc._id]}, deviceDoc, cb);
        }));
    }

    function connectReplication(deviceDoc, cb) {
        var syncPoint = {
            url : opts.syncControlDB,
            auth: {
                oauth: deviceDoc.oauth_creds
            }
        };
        coux({type : "POST", uri : "/_replicate"}, {
            source : syncPoint,
            target : opts.localControl
        }, e(function() {
            coux({type : "POST", uri : "/_replicate"}, {
                target : syncPoint,
                source : opts.localControl
            }, cb)
        }));
    }
    
});
