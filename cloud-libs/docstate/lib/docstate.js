var stately = require("stately");

exports.control = function(url) {
    var safeMachine, safeStates = {}
        , cautiousMachine, unsafeStates = {}
        ;

    function logFun(obj, cb) {
        console.log(obj.type, obj.state)
        cb(obj)
    };    

    function makeMachines() {
        if (true) {
            safeStates._before = logFun;
            unsafeStates._before = logFun;
        }
        safeMachine = stately.define(safeStates);
        cautiousMachine = stately.define(unsafeStates);
    };
    
    function handle(doc) {
        safeMachine.handle(doc);
        cautiousMachine.handle(doc);
    };

    function registerSafeCallback(type, state, cb) {
        safeStates[type] = safeStates[type] || {};
        safeStates[type][state] = cb;
    }

    function registerUnsafeCallback(type, state, cb) {
        // todo this needs expiring lock
        unsafeStates[type] = unsafeStates[type] || {};
        unsafeStates[type][state] = cb;
    }

    return {
        start : makeMachines,
        safe : registerSafeCallback,
        unsafe : registerUnsafeCallback,
        handle : handle
    };
};
