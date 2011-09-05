$(function() {
    var confirm_code = location.hash.substr(1);
    var db = location.pathname.split('/')[1];
    $("form").submit(function(ev) {
        ev.preventDefault();
        var device_code = $(this).find("input.code").val();
        coux({type : "POST", url: [db]}, {
            type : "confirm",
            state : "clicked",
            device_code : device_code, 
            confirm_code :confirm_code}, function(err, ok) {
                $("h1").text("thank you, please continue on your device");
                $("form").hide()
            });
    });
});