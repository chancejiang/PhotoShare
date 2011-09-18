var colors = require("colors");

exports.errLog = function errLog(cb) {
    return function() {
        if (arguments[0]) {
            console.error("err".red, arguments[0])
            console.error(arguments)
        } else {
            cb.apply(null, arguments)
        }
    };
};
