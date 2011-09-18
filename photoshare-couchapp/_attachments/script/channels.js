// channels.js is for connecting your client to a Couchbase sync server
// requires coux
// 
function e(fun) {
    return function(err, data) {
        if (err) {
            console.log(err)
        } else {
            fun && fun.apply(null, arguments)
        }
    };
};

var Channels = function(opts) {
    console.log(opts)
    var deviceDb = opts.device || "control";

    if (!(opts.waitForContinue && opts.getEmail)) {
        throw("opts.waitForContinue && opts.getEmail are required")
    }
    
    setupControl();
    // entry point for device registration and sync / backup config
    function setupControl() {
        console.log("setupControl")
        coux({type : "PUT", uri : [deviceDb]}, function() {
            coux([deviceDb,"_local/device"], function(err, doc) {
                if (!err && doc.device_id) {
                    haveDeviceId(doc.device_id)
                } else {
                    setDeviceId(haveDeviceId);
                }
            });
        });
    }

    function setDeviceId(cb) {
        console.log("setDeviceId")
        
        coux("/_uuids?count=1", e(function(err, resp) {
            var uuids = resp.uuids;
            coux({type : "PUT", uri : [deviceDb,"_local/device"]}, {
                device_id : uuids[0]
            }, e(function(err, resp) {
                cb(uuids[0])
            }));
        }));
    }

    function haveDeviceId(device_id) {
        console.log("haveDeviceId")
        var designPath = [deviceDb, "_design", "channels-device"];
        coux(designPath, function(err, doc) {
            if (err) { // no design doc
                makeDesignDoc(designPath, e(function(err, ok) {
                    haveDesignDoc(device_id)
                }));
            } else {
                haveDesignDoc(device_id)
            }
        });
    }

    function makeDesignDoc(designPath, cb) {
        var designDoc = {
            views : {
                subscriptions : {
                    map : function(doc) {
                        if (doc.type == "subscription") {
                            emit(doc.device_id, null)
                        }
                    }.toString()
                }
            }
        };
        coux({type : "PUT", url : designPath}, designDoc, cb);
    }

    function haveDesignDoc(device_id) {
        console.log("haveDesignDoc")
        coux([deviceDb, device_id], function(err, doc) {
            if (err) { // no device doc
                console.log("getEmail")
                opts.getEmail(e(function(err, email, gotEmail) {
                    // get email address via form
                    makeDeviceDoc(device_id, email, e(function(err, deviceDoc) {
                        gotEmail()
                        haveDeviceDoc(deviceDoc)
                    }));
                }));
            } else {
                haveDeviceDoc(doc)
            }
        });
    }
    

    // why is this one turning into a controller?
    function haveDeviceDoc(deviceDoc) {
        console.log("haveDeviceDoc")
        
        if (deviceDoc.state == "active") {
            console.log("deviceDoc.connected")
            syncSubscriptions();
            connectReplication(deviceDoc, e(function() {
                opts.connected(false, deviceDoc);
            }));
        } else {
            pushDeviceDoc();
            opts.waitForContinue(deviceDoc, e(function(err, closeContinue) {
                syncSubscriptions();
                connectReplication(deviceDoc, e(function(err, resp) {
                    if (!err) {
                        closeContinue();
                        deviceDoc.connected = true;
                        coux({type : "PUT", uri : [deviceDb,deviceDoc._id]}, 
                            deviceDoc, e(function() {
                                opts.connected(false, deviceDoc);
                        }));
                    }
                }));
            }));
        }
    };

    function makeDeviceDoc(device_id, email, cb) {
        console.log("makeDeviceDoc")
        
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
            coux({type : "PUT", uri : [deviceDb,deviceDoc._id]}, deviceDoc, e(function(err, resp) {
                deviceDoc._rev = resp.rev;
                cb(false, deviceDoc);
            }));
        }));
    }

    function pushDeviceDoc() {
        console.log("pushDeviceDoc")
        coux({type : "POST", uri : "/_replicate"}, {
            target : opts.cloud,
            source : deviceDb,
            continous : true
        }, e());
    }

    function connectReplication(deviceDoc, cb) {
        console.log("connectReplication");
        
        var syncPoint = {
            url : opts.cloud,
            auth: {
                oauth: deviceDoc.oauth_creds
            }
        };
        syncPoint = opts.cloud;
        // todo this should be filtered so I don't get noise I don't care about
        coux({type : "POST", uri : "/_replicate"}, {
            source : syncPoint,
            target : deviceDb,
            continous : true
        }, e(function() {
            coux({type : "POST", uri : "/_replicate"}, {
                target : syncPoint,
                source : deviceDb,
                continous : true
            }, cb)
        }));
    }

    // here we connect to the state machine and do stuff in reaction to events on subscription documents or whatever...
    function syncSubscriptions() {
        // now it is time to configure all subscription replications
        // what about databases without subscriptions?
        // (eg: My Photos) Do we have a generic approach to all renegade new database
        // creation on the client or do we expect to be the sole manager of database
        // state?
        // first, build the map of databases we should have (based on a view)
        console.log("syncSubscriptions")
        coux([deviceDb,"_design","channels-device","_view","subscriptions"], e(function(err, view) {
            var subs = {};
            console.log("subs",view.rows)
            coux(["_all_dbs"], function(err, dbs) {
                console.log(dbs)
            });
        }));
        // now, look at the real dbs, and check them off the list one by one
        // any database without changes, we want to create subscriptions for right away
        // connect to changes
        // anytime a db is created or a subscription is updated, repeat
    };
    
};
