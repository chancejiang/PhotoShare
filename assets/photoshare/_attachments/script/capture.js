// Use PhoneGap polling because of cross-origin&speed problem when loading from couchDB
PhoneGap.UsePolling = true;

var selectedPictureId = null;

// prompt = console.log

// Helper Methods

function addThumbnail(thumbnailId, originalId) {
    var newImg = $("<img></img>")
                 .addClass('thumbnail')
                 .css('float', 'left')
                 .css('padding', '2px')
                 .error(function() {
                   $(this).hide();
                 })
                 .attr({id: originalId,
                        src: '/photoshare/'+thumbnailId+'/thumbnail.jpg'
                       });
    newImg.click(onImageClick);
    $('#pictures').prepend(newImg);
}

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

// Syncpoint

function setupSync() {
    var syncpoint = "http://couchbase.ic.ht/photoshare";
    $.ajax({
      type: 'POST',
      url: '/_replicate',
      data: JSON.stringify({
          source : syncpoint,
          target : "photoshare",
          filter : "photoshare/thumbnail"
      }),
      dataType: 'json',
      contentType: 'application/json'
    });
    $.ajax({
      type: 'POST',
      url: '/_replicate',
      data: JSON.stringify({
          target : syncpoint,
          source : "photoshare"
      }),
      dataType: 'json',
      contentType: 'application/json'
    });
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
    url: '/photoshare',
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


function listPictures(data) {
    for (var i = 0; i < data.results.length; i++) {
        if(!data.results[i].deleted && data.results[i].doc.original_id) {
            addThumbnail(data.results[i].id, data.results[i].doc.original_id);
        }
    }
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
      $('#photoview-image').attr('src', '/photoshare/'+selectedPictureId+'/original.jpg')
  }
  
  // switch to the hi res if we have it
  $.ajax({
   type: 'GET',
   url:'/photoshare/'+selectedPictureId,
   dataType: 'json',
   contentType: 'application/json',
   success: showBigPhoto,
   error: function() {
       // trigger replication, on success, update photo
       console.log("no big photo")
       $.ajax({
         type: 'POST',
         url: '/_replicate',
         data: JSON.stringify({
             source : "http://couchbase.ic.ht/photoshare",
             target : "photoshare",
             doc_ids : [""+selectedPictureId]
         }),
         dataType: 'json',
         contentType: 'application/json',
         success: showBigPhoto
       });       
   }
   });
   
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
   url: '/photoshare/_design/photoshare/_view/comments?startkey=["'+selectedPictureId+'"]&endkey=["'+selectedPictureId+'",{}]',
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
    // setup listing of pictures and auto refresh
    connectChanges("photoshare", listPictures);
    setupSync();
    setupControl()
}

var started = false;
function startApp() {
    if (started) return;
    started = true;
    start();
};

document.addEventListener("deviceready", startCamera, true);
$('body').ready(startApp);

function coux(opts, body) {
    if (typeof opts === 'string') opts = {url:opts};
    var cb = arguments[arguments.length -1];
    if (arguments.length == 3) {
        opts.data = JSON.stringify(body);
    }
    opts.url = opts.url || opts.uri;
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
    $.ajax(req);
};

var reg, device_code;
function setupControl(changes) {
    coux({type : "PUT", uri : "/control"}, function() {
        coux('/control/_all_docs?include_docs=true&limit=2', function(err, view) {
            if (!err && view.rows.length == 0) {
                reg = "needed";
                // we need to register the device
            } else if (!err && view.rows.length == 1) {
                reg = "waiting";
                device_code = view.rows[0].doc.device_code;
                // we are in the middle of registering
            } else {
                // we are normal
                // connectChanges("control", controlHandler);
                console.log(err, view)
            }
        });
    });
}

function showRegister() {
    $('#register').show();
    $('#register').css("-webkit-transform","translate(0,0)");
    $('#register').find("form").submit(function(e) {
        e.preventDefault();
        var email = $(this).find("input").val();
        coux("/_uuids?count=4", function(err, resp) {
            var uuids = resp.uuids;
            device_code = Math.random().toString().substr(2,4)
            var deviceDoc = {
                owner : email,
                type : "device",
                state : "new",
                device_code : device_code,
                oauth_creds : { // we need better entropy
                  consumer_key: uuids[0],
                  consumer_secret: uuids[1],
                  token_secret: uuids[2],
                  token: uuids[3]
                }
            };
            coux({type : "POST", uri : "/control"}, deviceDoc, function(err, resp) {
                if (err) {
                    console.log(err)
                } else {
                    $('#register').hide();
                    showWaiting();
                }
            });
        });
    });
};

function showWaiting(args) {
    $('#waiting').show();
    $('#waiting').css("-webkit-transform","translate(0,0)");
    $('#waiting').find("strong").text(device_code);
}


function configSync() {
    // if we have the user email address
    if (reg == "waiting") {
        showWaiting();
    } else {
        showRegister();
    }

}
