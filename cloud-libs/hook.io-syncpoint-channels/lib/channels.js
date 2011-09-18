
function handleChannels(hook, control, db, server) {
    control.safe("channel", "new", function(doc) {
        var db_name = "db-"+doc._id;
        if (doc["public"]) {
            errLog("PDI","please implement public databases")
        } else {
            server.db.create(db_name, function(err, resp) {
                if (err && err.code != 412) {
                    // 412 means the db already exists
                    doc.state = "error";
                    doc.error = "db_name exists: "+db_name;
                    db.insert(doc, errLog);
                    errLog(err, resp);
                } else {
                    // only set up creds the first time
                    coux([db_name, "_security"],function(err, sec) {
                        if (err) {sec = {members:{names:[],roles:[]}}}
                        sec.members.names.push(doc.owner)
                    });
                    doc.state = "ready";
                    doc.syncpoint = PUBLIC_HOST_URL + db_name;
                    db.insert(doc, errLog);
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
