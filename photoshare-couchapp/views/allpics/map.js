function(doc) {
  if(doc._attachments && doc._attachments['original.jpg']) {
      emit(doc._id, 'original.jpg');      
  } else if (doc.original_id && doc._attachments && doc._attachments['thumbnail.jpg']) {
      emit(doc.original_id, 'thumbnail.jpg');      
  }
}
