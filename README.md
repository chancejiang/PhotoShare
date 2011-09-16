## Get Started

CD into the cross platform HTML5 couchapp codebase and push the couchapp to your device's Couchbase instance.

    cd photoshare
    couchapp push . http://mycouch.example.com/photoshare

Start an instance of the Cloud manager on your server.

    node cloud/run/photoshare.js 

Visit your Couchapp and try making a new channel. All your channels should be mirrored on the cloud device.

## Configuration

photoshare/config.json should look like this for local testing (where you laptop is your device and your cloud):

{
    "cloud" : "http://127.0.0.1:5984/photoshare-control-cloud",
    "device" : "photoshare-control-device"
}

Or it could look like this if you are deploying to Iris Couch:

{
    "cloud" : "http://couchbase.ic.ht/photoshare-control",
    "device" : "photoshare-control-device"
}

