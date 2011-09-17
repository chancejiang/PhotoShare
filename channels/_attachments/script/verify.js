$(function() {
    var hash = location.hash.substr(1).split('-')
    ,  db = location.pathname.split('/')[1]
    , confirm_code = hash[0]
    , owner = hash[1];
    $('strong').text(owner);
    $("form").submit(function(ev) {
        ev.preventDefault();
        var device_code = $(this).find("input.code").val();
        coux({type : "POST", url: [db]}, {
            type : "confirm",
            state : "clicked",
            device_code : device_code, 
            confirm_code :confirm_code}, function(err, ok) {
                $("h1").text("thank you "+owner+", please continue on your device");
                $("form").hide()
            });
    });
});