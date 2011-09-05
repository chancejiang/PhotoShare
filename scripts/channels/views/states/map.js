function(doc) {
    if (doc.type && doc.state) {
        emit([doc.typ, doc.state], null)
    }
};