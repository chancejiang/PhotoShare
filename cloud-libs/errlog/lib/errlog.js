var colors = require("colors");

exports.errLog = function errLog(cb) {
    return function() {
        if (arguments[0]) {
            console.error("err".red, arguments[0])
            console.error(arguments)
        } else {
            cb && cb.apply(null, arguments)
        }
    };
};

exports.e = function(fun) {
    return function(err) {
        if (err) {
            console.log("error:".red, err);
            if (err.stack) {
                console.log(err.stack);
            }
        } else {
            fun && fun.apply(this, arguments)
        }
    };
};
