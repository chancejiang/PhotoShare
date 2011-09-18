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
        if (typeof opts.url[opts.url.length-1] == 'object') {
            var query = [], v, q = opts.url.pop();
            for (var k in q) {
                if (['startkey', 'endkey', 'key'].indexOf(k) !== -1) {
                    v = JSON.stringify(q[k])
                } else {
                    v = q[k];
                }
                query.push(encodeURIComponent(k)+'='+encodeURIComponent(v));
            }
            query.join('&');
        }
        opts.url = ([""].concat(opts.url).map(function(path) {
            return encodeURIComponent(path);
        })).join('/');
        if (query) {
            opts.url = opts.url + "?" + query;
        }
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

