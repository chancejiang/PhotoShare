Workflows

first launch
    create private user database (channel)
    do work
    (optional) register device

create private user database
    local 'photoshare' db is users default.

register device
    user enters email address on device
    device sends email address and device_code to cloud
    cloud emails secret-link to user
    user clicks link, device shows device_code to user, user enters code into cloud
    if they match (user entered and what device provided to the confirm bot are the same)
        activate the device credentials
            today:

    we want to store basically this on the device doc. its what you need
    to trigger replication as a user:
    oauth_creds : {
      consumer_key: "key",
      consumer_secret: consumerSecret,
      token_secret: tokenSecret,
      token: "foo"
    }
    
    copy token stuff from device doc to user doc (in future format -- merge w/ existing tokens?)
    
    "oauth": {
        "devices" : {
          device_uuid : ["key", "foo"]
          }
        },
        "consumer_keys": {
            "key": "key1Secret",
            "baz": "key2Secret"
        },
        "tokens": {
            "foo": "token1Secret",
            "blah": "token2Secret"
        }
    }


    
    also config the config system for the oauth keys to work
    update the device doc
            
            someday we wont have to config any more:
