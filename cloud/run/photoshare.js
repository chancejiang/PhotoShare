// for testing against the photoshare example
var db_host = "http://jchrisa:jchrisa@127.0.0.1:5984"
    , db_name = "photoshare-control-device"
    , cloud = require("../cloud")
    , fs = require("fs")
    ;

var config = JSON.parse(fs.readFileSync('photoshare/config.json'))
    , cloudparts = config.cloud.split('/');
cloudparts.pop();
    
cloud.start(config);

