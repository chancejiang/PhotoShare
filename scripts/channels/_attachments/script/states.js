$(function() {
    var db = location.pathname.split('/')[1];
    console.log("states")
    coux("_view/states", function(err, view) {
        var ul = $("ul#states"),
            template = '<li><span class="type"></span> <span class="state"></span> <a target="new" class="link"></a></li>';
        view.rows.forEach(function(row) {
            var li = $(template);
            li.find(".type").text(row.key[0]);
            li.find(".state").text(row.key[1]).addClass(row.key[1]);
            li.find("a").attr({"href" : "/_utils/document.html?"+db+"/"+row.id}).text(row.id);
            ul.append(li)
        });
    });
})