// Use PhoneGap polling because of cross-origin&speed problem when loading from couchDB
PhoneGap.UsePolling = true;

var selectedPictureId = null;

var mypath = document.location.pathname.split('/')
    mydb = mypath[1];
    mydesign = mypath[3];

console.log("mydb")
console.log(mydb)
// prompt = console.log

// Helper Methods


function addComment(commentDoc) {
  $('#comments').prepend('<span>'+commentDoc.comment+'</span><br/>')
                .prepend('<span class="author">'+commentDoc.author+' wrote:</span> ');
}

function clearPhotoView() {
  $('#comments').html('');
  $('#photoview-image').attr('src', '');
}

function toggleButton() {
  var capture = $('#capturePhoto');
  if(capture.attr('disabled')) {
    capture.removeAttr('disabled');
  } else {
    capture.attr('disabled', true);
  }
}

function setMessage(message) {
  $('#message').html(message);
}

// Capture

function onCaptureSuccess(imageData) {
  console.log("onCaptureSuccess");
  var onSaveSuccess = function(imageDoc) {
    setMessage('');
  };
  var onSaveFailure = function(xhr, type) {
    alert("onSaveFailure "+type + ' ' + xhr.responseText);
  };
  setMessage('Saving image...');
  var imageDoc = {
    type: "photo",
    created_at: new Date(),
    _attachments: {
      "original.jpg": {
        content_type: "image/jpeg",
        data: imageData
      }
  }};
  $.ajax({
    type: 'POST',
    url: '/'+mydb,
    data: JSON.stringify(imageDoc),
    dataType: 'json',
    contentType: 'application/json',
    success: onSaveSuccess,
    error: onSaveFailure
  });
}

function onCaptureFailure(message) {
  alert('onCaptureFailure ' + message);
}

function capturePhoto() {
  console.log("capturePhoto");
  navigator.camera.getPicture(onCaptureSuccess, onCaptureFailure, { quality: 10 });
}

function connectChanges(dbname, onDBChange) {
    var since = 0;
    function changesCallback(opts) {
      since = opts.last_seq || since;
      if (opts.results) {onDBChange(opts);}
      $.ajax({
        type: 'GET',
        url: '/'+dbname+'/_changes?include_docs=true&feed=longpoll&since='+since,
        dataType: 'json',
        success: changesCallback,
        error: function() {
          setTimeout(function() {
            console.log("error changes");
            console.log(opts);
            changesCallback({last_seq : since});
          }, 250)
        }
      });
    }
    changesCallback({last_seq : 0});
};


function listPictures() {
    console.log("listPictures")
    coux('_view/allpics', function(err, view) {
        $('#pictures').empty()
        var row, nowKey, choice, choices = [];
        for (var i=0; i < view.rows.length; i++) {
            row = view.rows[i];
            if (nowKey && nowKey != row.key) {
                choice = choices[choices.length-1]
                listPic(choice)
                choices = [row]
            } else {                
                choices.push(row)
            }
            nowKey = row.key
        };
        choice = choices[choices.length-1]
        listPic(choice)
    })
}

function listPic(row) {
    if (!row) {return;}
    var newImg = $("<img></img>")
                 .addClass('thumbnail')
                 // .error(function() {
                 //   $(this).hide();
                 // });
    if (row.value == 'original.jpg') {
        // we are only original
        newImg.attr({
                src: '/'+mydb+'/'+row.id+'/original.jpg'
               });
    } else {
        // we are thumbnail
        newImg.attr({
                id : row.key,
                src: '/'+mydb+'/'+row.id+'/thumbnail.jpg'
               });
    }
    newImg.click(onImageClick);
    $('#pictures').prepend(newImg);
}


function sendComment() {
    var commentDoc = {
      "type": "comment",
      "photo": selectedPictureId,
      "created_at" : new Date(),
      "author": $('#comment-author').val(),
      "comment": $('#comment-text').val()
    };

    var onCommentSuccess = function(response) {
      addComment(commentDoc);
    };

    var onCommentFailure = function(xhr, type) {
      alert(type + ' ' + xhr.responseText);
    };

    CouchDbPlugin.save(commentDoc, onCommentSuccess, onCommentFailure);
}

function onImageClick() {
  // FIXME: maybe use a hidden field instead?
  var selectedPictureId = this.id;
  var tmpImgSrc = this.src;
  $('#photoview-image').attr('src', tmpImgSrc).css('width', '100%');
  $('#photoview').css("-webkit-transform","translate(0,0)");
  
  function showBigPhoto() {
      console.log("showBigPhoto")
      $('#photoview-image').attr('src', '/'+mydb+'/'+selectedPictureId+'/original.jpg')
  }
  
  // switch to the hi res if we have it
  function testBigPhoto(go) {
      $.ajax({
       type: 'GET',
       url:'/'+mydb+'/'+selectedPictureId,
       dataType: 'json',
       contentType: 'application/json',
       success: showBigPhoto,
       error: function() {
           // trigger replication, on success, update photo
           console.log("no big photo")
           myChannels.pullDocs(mydb, [""+selectedPictureId], function(err, ok) {
               if (err)  {
                   console.log(err);
               } else {
                   if (go) testBigPhoto(go - 1)
               }
           });    
       }
       });
  }
  if (selectedPictureId)
    testBigPhoto(1)
  

   
  var renderComments = function(response) {
    // console.log(JSON.stringify(response));
    for(var i = 0 , j = response.rows.length ; i < j ; i++) {
      addComment(response.rows[i].value);
    }
    $('#photoview').show();
    $('#main').hide();
    $('#send-comment').click(sendComment);
    document.addEventListener('backbutton', backKeyDown, true);
  };

  var onFetchFailure = function(xhr, type) {
    console.log(type + ' ' + xhr.responseText);
  }
  $.ajax({
   type: 'GET',
   url: '/'+mydb+'/_design/photoshare/_view/comments?startkey=["'+selectedPictureId+'"]&endkey=["'+selectedPictureId+'",{}]',
   dataType: 'json',
   contentType: 'application/json',
   success: renderComments,
   error: onFetchFailure
  });
}

function backKeyDown() {
  document.removeEventListener('backbutton', backKeyDown, true);
  $('#send-comment').unbind('click');
  $('#photoview').css("-webkit-transform","translate(100%,0)");
  $('#photoview').hide();
  clearPhotoView();
  $('#main').show();
}

function startCamera() {
  var capture = $('#capturePhoto');
  capture.removeAttr('disabled');
}


function start() {
    // document.addEventListener("deviceready", startCamera, true);
    connectChanges(mydb, listPictures);
    // setup listing of pictures and auto refresh
    // setupSync();
    // startControl()
    setTimeout(startControl, 1000)
}

var started = false;
function startApp() {
    if (started) return;
    started = true;
    start();
};

$('body').ready(startApp);

var myChannels;
function startControl() {
    coux([mydb, "_design", mydesign], function(err, doc) {
        var config = doc.config;
        // called by app to kick off Couchbase Channels
        myChannels = Channels({
            getEmail : setupEmailForm,
            waitForContinue : waitForContinue,
            connected : connected,
            downstreamFilter : "photoshare/thumbnail",
            "cloud-control" : config["cloud-control"],
            "device-control" : config["device-control"],
            "device-design" : config["device-design"]
        });
    });
}


function configSync() {
    console.log("config sync")
    $("#configSync").show()
    $('#configSync').css("-webkit-transform","translate(0,0)");
    // todo back button (Can we use a path framework?)
}


// these are app pluggable
function waitForContinue(doc, cb) {
    console.log("waitForContinue")
    $('#waiting').show().find("strong").text(doc.device_code);
    $("#waiting").find("input").click(function() {
        cb(false, e(function() {
            $('#waiting').hide();
        }))
    });
}

function setupEmailForm(cb) {
    $("#register").show().find("form").submit(function(ev) {
        ev.preventDefault();
        var email = $(this).find("input").val().replace(new RegExp('\^[\\s]+|[\\s]+$', 'g'), '');
        cb(false, email, e(function() {
            $("#register").hide();
        }));
    });
}

function connected(err, doc) {
    console.log("connected")
    $('#status').show().find("strong").text(doc.owner);
    var pparts = document.location.pathname.split('/');
    myChannels.localizedChannels(function(err, channels) {
        channels.forEach(function(c) {
            var li = $('<li><a class="device"></a> by <span></span> (<a class="cloud">cloud</a>)</li>');
            pparts[1] = encodeURIComponent(c.local_db);
            li.find('.device').text(c.name).attr({href:pparts.join('/')});                
            li.find('.cloud').attr({href:c.syncpoint});
            li.find('span').text(c.owner);
            $('#status ul').append(li);
        });
    });
    $('#status form').submit(function(e) {
        e.preventDefault();
        $("#status").hide();
        $("#new_channel").show();
        $("#new_channel").find('form').submit(function(e) {
            e.preventDefault();
            var name = $(this).find('input[type=text]').val();
            myChannels.createChannel(name, function(err, ok) {
                $("#new_channel").hide();
            });
        });
        
        // get a list of all channels, 
        // figure out which ones I'm already subscribed to
        return false;
    })
}

