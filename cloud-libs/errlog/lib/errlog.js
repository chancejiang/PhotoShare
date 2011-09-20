var colors = require("colors");

exports.e = function(fun) {
    return function(err) {
        if (err) {
            console.log("error :".red, err);
            if (err.stack) {
                console.log(err.stack);
            }
        } else {
            fun && fun.apply(this, arguments)
        }
    };
};
exports.e;

exports.o = function(fun) {
    return function(err) {
        if (err) {
            console.log("error :".red, err);
            if (err.stack) {
                console.log(err.stack);
            }
        }
        fun && fun.apply(this, arguments)
    };
};