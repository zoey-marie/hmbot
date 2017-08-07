var { Account } = require( 'hackmud_chat_web/js/chat.js')
var MongoClient = require('mongodb').MongoClient;
//var robot = require ("robotjs") // ???
//var processWindows = require("node-process-windows");
var t1corps = require("./t1corps.json")
const game = require("./game.js")
const chat = require("./chat.js")
const config = require("../config.json")


var uri = "config.mongo_uri"
var chat_token = "config.chat_token"
var act = new Account( Date.now() / 1000)
var polling_interval_id
var processed_msg_ids = []
var processed_cmd_msgs = []
var db
var npc_locs = {}

function connectToDB( uri ) {
  // Return a promise that represents the process of establishing a database connection
  return new Promise( ( resolve, reject ) => {
    MongoClient.connect(uri, function(err, db_obj) {
      // If an error occured - make the promise fail
      if( err )
      return reject( err )

      console.log ("Connected correctly to the server");
      // Consider this promise successfully fulfilled. Pass the db_obj on to any functions .then()-chained to, or awaiting this promise
      return resolve( db_obj )
    } )
  } )
}

function logInToChatAPI( token ) {
  // act.update already returns a promise which resolves if the token was accepted, and rejects if it was denied or a network error occured
  return act.update( token );
}

async function init( chat_token, db_uri ) {
  try {
    db = await connectToDB( db_uri )
    await logInToChatAPI( chat_token )
  }
  catch( err ) {
    console.log( "Bot initialization failed:" );
    console.error( err );
    process.exit();
  }

  try {
    startPollingForMessages()
  }
  catch( err ) {
    console.log( 'chats.js error - could not start polling for messages:' )
    console.log( err )
  }
}

// Start everything up!
init( chat_token, uri )

function crackT1s( locs ) {
  let args = {}

  locs.forEach( (loc, index) => args[ index ] = loc ) // Turn the array of locs into an object

  return game.runScript( 't1cracker', args )
}

chat.addCommand( 'omnom-t1', async function() {
  try {
    // For every T1 corp...
    for( let corp_script in t1corps ) {
      // ...run kittymeowface.testtest on that corp, and wait for it to send "return testtest <loc list>" to the bot channel...
      let loc_string = await game.runScript( 'scrape', {target: '#s.' + corp_script} )

      // ...then split up that loc list into an array.
      let corp_locs = loc_string.split(',')

      // While there are still locs left in that array...
      while( corp_locs.length ) {
        // ...determine how many we should try to crack at once...
        let num_to_crack = Math.min( 10, corp_locs.length )

        // ...then attempt to crack that number of locs from the loc array with one cracker call.
        // Wait for the cracker to fire off a "return t1cracker <number cracked>" message
        let num_cracked = await crackT1s( corp_locs.slice( 0, num_to_crack ) )

        // Cull the locs which were cracked successfully from the loc array.
        if( num_cracked )
          corp_locs.splice( 0, num_cracked )
      }
    }
  } catch( err ) {
    console.error( 'omnom-t1 failed!' )
    console.log( err )
  }
} )


function startPollingForMessages() {
  if( polling_interval_id )
  throw new Error( 'Cannot start polling for messages: already polling' )

  polling_interval_id = setInterval(
    () => {
      act.poll( { after: 'last' } ).then( handleIncomingMessages )
      .catch( err => console.log( err ) )
    },
    1000
  )
}


function stopPollingForMessages() {
  if( !polling_interval_id )
  throw new Error( 'Cannot stop message polling: not polling for messages' )

  clearInterval( polling_interval_id )
  polling_interval_id = null
}

function handleIncomingMessages( data ) {
  // here, you'd look up within the data if the relevant channel for the relevant user has new messages, and do stuff with them
  for ( var msg of data.chats[config.authorized_users[0]]) {
    if( msg.channel != config.bot_channel )
    {
      continue
    }
    if (processed_msg_ids.includes( msg.id ))
    {
      continue
    }
    if ( !config.authorized_users.includes( msg.from_user ) )
    {
      continue
    }

    processed_msg_ids.push( msg.id )
    processed_cmd_msgs.push ( msg.msg )
    // var re0 = /^\s*([a-z]\w+\.[a-z]\w+)\s*$/
    // ar.map((s,i)=>i+":#s."+s).join(",")
    // ...

       var msg_parts = msg.msg.split(' ')
//       var advance_task_queue = false

       if( msg_parts[0] === 'nexttask' ) {
//         advance_task_queue = true
         msg_parts.shift() // throw away "nexttask"
       }

       var cmd = msg_parts.shift() // remove the first element from the msg_parts array and store it in "cmd"

    switch ( cmd )
    {
      case 'stop':
      console.log(msg.msg)
        stopPollingForMessages ()
        db.collection(config.DBcmdName).insertOne({
          msg: msg.msg,
          from: msg.from_user
        })
        db.close()
        break

      case 'Bust-t1s':
//        scrapeAndCrackT1()
        break

      // handle "addlocs <loc type> <comma seperated loc list>" messages
      case 'addlocs':
        var type = msg_parts[0] // take the next space-seperated word to be the "type of loc", like "tier1"

        // If we don't have an array to store this type of loc yet, add one to the npc_locs object
        if( !npc_locs[ type ] )
        npc_locs[ type ] = []

        // Break up the comma-seperated list of locs into an array
        var locs = msg_parts[1].split(',')

        // Add the incoming locs to the array
        npc_locs[ type ] = npc_locs[ type ].concat( locs )
        break

      case 'crackedT1s':
        var num = msg_parts[0]
        npc_locs.tier1 = npc_locs.tier1.slice( num - 1 ) // cull the cracked locs from the list - I'm probably doing this wrong

         break
      default:
        console.log( 'Unknown command: ' + cmd )
        db.collection(config.DBchatName).insertOne({
          msg: msg.msg,
          from: msg.from_user
        })
        break
    }
  }
}
