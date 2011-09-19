function(doc, req) {
  if(doc.type == "photo") {
    return false;
  } else {
    return true;
  }
}
