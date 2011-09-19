// channels.js is for connecting your client to a Couchbase sync server
// requires coux
// 
function e(fun) {
    return function(err, data) {
        if (err) {
            console.log(err)
        } else {
            fun && fun.apply(this, arguments)
        }
    };
};

// todo move owner, locChannels, and deviceId to `this`
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
            coux({type : "PUT", uri : [deviceDb,"_local/device"]}, {
                device_id : resp.uuids[0]
            }, e(function() {
                cb(resp.uuids[0])
            }));
        }));
    }
    var deviceId;
    function haveDeviceId(device_id) {
        deviceId = device_id;
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

    // VIEW DEFINITIONS ARE HERE
    function makeDesignDoc(designPath, cb) {
        var designDoc = {
            views : {
                subscriptions : {
                    map : function(doc) {
                        if (doc.type == "subscription") {
                            emit(doc.owner, doc.channel_name)
                        }
                    }.toString()
                },
                replicas : {
                    map : function(doc) {
                        if (doc.type == "replica") {
                            emit([doc.device_id, doc.subscription_id], doc.local_db)
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
    var owner;
    function haveDeviceDoc(deviceDoc) {
        console.log("haveDeviceDoc")
        owner = deviceDoc.owner;
        
        if (deviceDoc.state == "active") {
            console.log("deviceDoc active")
            normalizeSubscriptions();
            syncControlDB(deviceDoc, e(function() {
                opts.connected(false, deviceDoc);
            }));
        } else {
            pushDeviceDoc();
            opts.waitForContinue(deviceDoc, e(function(err, closeContinue) {
                normalizeSubscriptions();
                syncControlDB(deviceDoc, e(function(err, resp) {
                    if (!err) {
                        closeContinue();
                        opts.connected(false, deviceDoc);
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
            source : deviceDb
        }, e());
    }

    function syncControlDB(deviceDoc, cb) {
        console.log("syncControlDB");
        
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
                continuous : true
            }, cb)
        }));
    }
    function syncReplicas(cb) {
        console.log('syncReplicas')
        coux([deviceDb,"_design","channels-device","_view","replicas"
        , {startkey : [deviceId], endkey : [deviceId, {}]}], e(function(err, reps) {
            var chid, repObj = {};
            var channel_ids = reps.rows.map(function(rep) {
                chid =  rep.key[1].split('-')[0];
                repObj[chid] = rep.value;
                return chid;
            });
            coux.post([deviceDb,"_all_docs",{include_docs:true}],{keys:channel_ids}, e(function(err, chans) {
                var chan_w_local_links = [];
                var rep_defs = chans.rows.map(function(ch) {
                    var chid, replica_for_chan;
                    for (chid in repObj) {
                        if (ch.doc && chid == ch.id) {
                            var remote = ch.doc.syncpoint
                                , local = repObj[chid];
                            if (local && remote) {
                                ch.doc.local_db = local;
                                delete ch.doc._rev;
                                chan_w_local_links.push(ch.doc);
                                var defs =  [{
                                    source : remote, // todo this should use deviceDoc.oauth creds
                                    target : local,
                                    continuous : true
                                },{
                                    source : local,
                                    target : remote,
                                    continuous : true
                                }];
                                if (opts.downstreamFilter) {
                                    defs[0].filter = opts.downstreamFilter;
                                }
                                return defs;
                            }
                        }
                    }
                });
                rep_defs = rep_defs.reduce(function(prev, curr){  
                  return prev.concat(curr);  
                }).filter(function(r) {return r});
                function makeReps(rep_defs) {
                    var repd;
                    if (repd = rep_defs.pop()) {
                        console.log("repd",repd)
                        coux.post(["_replicate"], repd, e(function(err, ok) {
                        }))
                        setTimeout(function() {
                            makeReps(rep_defs)                                
                        },100);
                    } else {
                        cb(chan_w_local_links)
                    }
                }
                makeReps(rep_defs)
            }));
        }));
    }
    

    // here we connect to the state machine and do stuff in reaction to events on subscription documents or whatever...
    var locChannels;
    function normalizeSubscriptions() {
        console.log("normalizeSubscriptions")
        subsWithoutReplicas(function(err, subs) {
            makeReplicas(subs, function(err) {
                replicasWithoutDatabases(function(err, reps) {
                    makeDatabasesForReps(reps, function(err) {
                        databasesWithoutReplicas(function(err, dbs) {
                            setupChannels(dbs, function(err) {
                                syncReplicas(function(lchans) {
                                    locChannels = lchans;
                                });
                            })
                        })
                    })
                });
            });
        });
        
    }
    function subsWithoutReplicas(cb) {
        coux([deviceDb,"_design","channels-device","_view","subscriptions"
        , {key : owner}], e(function(err, subs) {
            coux([deviceDb,"_design","channels-device","_view","replicas"
            , {startkey : [deviceId], endkey : [deviceId, {}]}], e(function(err, reps) {
                var subIdsWithReplicas = reps.rows.map(function(rep) {
                    return rep.key[1];
                });
                console.log(subs)
                var subsNewOnThisDevice = subs.rows.filter(function(sub) {
                    return (subIdsWithReplicas.indexOf(sub.id) == -1)
                });
                console.log('subsNewOnThisDevice', subsNewOnThisDevice)
                cb(false, subsNewOnThisDevice);
            }));
        }));
    }
    function makeReplicas(subs, cb) {
        if (subs.length > 0) {
            coux('/_uuids?count='+subs.length, function(err, data) {
                var reps = subs.map(function(sub) {
                    return {
                        type : "replica",
                        state : "new",
                        device_id : deviceId,
                        local_db : 'db-'+data.uuids.pop(),
                        subscription_id : sub.id
                    }
                });
                coux({type : "POST", url :[deviceDb,"_bulk_docs"]}, {docs:reps}, e(cb));
            });
        } else {
            cb()
        }
    }
    function replicasWithoutDatabases(cb) {
        coux([deviceDb,"_design","channels-device","_view","replicas"
        , {startkey : [deviceId], endkey : [deviceId, {}], include_docs : true}], e(function(err, reps) {
            var local_rep_dbs = {};
            reps.rows.forEach(function(rep) {
                local_rep_dbs[rep.doc.local_db] = rep.doc;
            });
            coux('/_all_dbs', e(function(err, dbs) {
                var db_name, needs_db = [];
                for (db_name in local_rep_dbs) {
                    if (dbs.indexOf(db_name) == -1) {
                        needs_db.push(local_rep_dbs[db_name])
                    }
                }
                cb(false, needs_db)
            }))
        }))
    }
    function makeDatabasesForReps(reps, cb) {
        function makeDb(reps) {
            var rep;
            if (rep = reps.pop()) {
                coux.put([rep.local_db], e(function(err, ok) {
                    rep.state = "ready";
                    coux.put([deviceDb, rep._id], rep, e(function(err, ok) {
                        makeDb(reps)                        
                    }))
                }))
            } else {
                cb()
            }
        }
        makeDb(reps)
    }
    function databasesWithoutReplicas(cb) {
        coux([deviceDb,"_design","channels-device","_view","replicas"
        , {startkey : [deviceId], endkey : [deviceId, {}]}], e(function(err, reps) {
            var local_rep_dbs = reps.rows.map(function(rep) {
                return rep.value;
            });
            coux('/_all_dbs', e(function(err, dbs) {
                var db, needs_rep = [];
                console.log('needs_rep?',dbs)
                dbs.forEach(function(db) {
                    if (db !== deviceDb && db.indexOf("_") !== 0 && local_rep_dbs.indexOf(db) == -1) {
                        needs_rep.push(db)
                    }                    
                });
                cb(false, needs_rep)
            }))
        }))
    }
    // setup any local dbs which are not replicated on the server yet
    function setupChannels(dbs, cb) {
        console.log("setupChannels for dbs", dbs)
        if (dbs.length > 0) {
            coux('/_uuids?count='+dbs.length, e(function(err, data) {
                var channels = dbs.map(function(db) {
                    return {
                        _id : data.uuids.pop(),
                        owner : owner,
                        name : db,
                        type : "channel",
                        state : "new"
                    }
                });
                var subs = channels.map(function(ch) {
                    return {
                        _id : ch._id + "-sub-" + owner,
                        type : "subscription",
                        state : 'active',
                        owner : owner,
                        channel_name :ch.name,
                        channel_id : ch._id
                    }
                });
                var localReplicas = subs.map(function(s) {
                    return {
                        type : "replica",
                        state : "ready",
                        device_id : deviceId,
                        // in this case we know channel_name is a legal Couch database name
                        local_db : s.channel_name,
                        subscription_id : s._id
                    }
                });
                var bulk = channels.concat(subs).concat(localReplicas);
                coux({type : "POST", url :[deviceDb,"_bulk_docs"]}, {docs:bulk}, e(cb));
            }));
        } else {
            cb()
        }
    }
    
    var exports = {
        localizedChannels : function(cb) {
            if (locChannels) {
                cb(false, locChannels);                
            } else {
                setTimeout(function() {
                    exports.localizedChannels(cb)
                }, 100);
            }
        },
        createChannel : function(name, cb) {
            coux.post([deviceDb], {
                owner : owner,
                name : name,
                type : "channel",
                state : "new"
            }, e(function(err, ok) {
                coux.post([deviceDb], {
                    _id : ok.id + "-sub-" + owner,
                    type : "subscription",
                    state : 'active',
                    owner : owner,
                    channel_name :name,
                    channel_id : ok._id
                }, cb);
            }));
        }
    }
    return exports;
};
