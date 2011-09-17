// coux is a tiny couch client, there are implementations for server side and client side
// this implementation is for Zepto or jQuery.
function coux(opts, body) {
    if (typeof opts === 'string' || $.isArray(opts)) { 
        opts = {url:opts};
    }
    var cb = arguments[arguments.length -1];
    if (arguments.length == 3) {
        opts.data = JSON.stringify(body);
    }
    opts.url = opts.url || opts.uri;
    if ($.isArray(opts.url)) {
        opts.url.unshift("");
        opts.url = (opts.url.map(function(path) {
            return encodeURIComponent(path);
        })).join('/');
    }
    var req = {
        type: 'GET',
        dataType: 'json',
        contentType: 'application/json',
        success: function(doc) {
            cb(false, doc)
        },
        error: function(e) {
            cb(e)
        }
    };
    for (var x in opts) {
        if (opts.hasOwnProperty(x)){
            req[x] = opts[x];
        }
    }
    console.log(req.type, req.url);
    $.ajax(req);
};

