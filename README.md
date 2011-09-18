## Get Started

CD into the cross platform HTML5 couchapp codebase and push the couchapp to your device's Couchbase instance.

    cd photoshare
    couchapp push . http://mycouch.example.com/photoshare

Start an instance of the Cloud manager on your server.

    ./photoshare-cloud/bin/photoshare

Visit your Couchapp and try making a new channel. All your channels should be mirrored on the cloud device.

Also there is the `channels` management CouchApp you can install here:

    http://localhost:5984/photoshare-control-cloud/_design/channels/index.html

## Configuration

photoshare/config.json should look like this for local testing (where you laptop is your device and your cloud):

{
    "cloud" : "http://localhost:5984/photoshare-control-cloud",
    "device" : "photoshare-control-device"
}

Or it could look like this if you are deploying to Iris Couch:

{
    "cloud" : "http://couchbase.ic.ht/photoshare-control",
    "device" : "photoshare-control-device"
}


Welcome to PhotoShare!

To visit a your local copy of the app, visit: config.device
To see your data in the cloud, visit: config.cloud
To adminster the cloud, visit: admin app url

