const { MongoClient } = require("mongodb")

const game = require("./game.js")
const chat = require("./chat.js")

const bot = {
  commands: {
    "return": ( name, return_value ) => {
      let active_script = this.game.active_script

      if( !active_script ) {
        console.log( 'Unhandled response from script ' + name + ':' )
        console.log( return_value )
        return
      }

      if( active_script.name !== name )
        throw new Error( 'Unexpected response from ' + name + ', was expecting response from ' + active_script.name )

      active_script.onReturn( return_value )
      this.game.active_script = null
    }
  },
  chat:     chat,
  config:   null,
  db:       null,
  game:     game,

  addCommand: function( name, callback ) {
    this.commands[ name ] = callback
  },

  connectToDB: function( uri ) {
    // Return a promise that represents the process of establishing a database connection
    return new Promise( ( resolve, reject ) => {
      MongoClient.connect( uri, function(err, db_obj) {
        // If an error occured - make the promise fail
        if( err )
          return reject( err )

        console.log ("Connected correctly to the server");
        // Consider this promise successfully fulfilled. Pass the db_obj on to any functions .then()-chained to, or awaiting this promise
        return resolve( db_obj )
      } )
    } )
  },

  handleBotChannelMessage: function( msg ) {
    if( !config.authorized_users.includes( msg.from_user ) )
      return

    console.log( "Bot command received on control channel: " + msg.msg )

    let msg_parts = msg.msg.split(' ')
    let cmd = msg_parts.shift() // remove the first element from the msg_parts array and store it in "cmd"

    this.runCommand( cmd, ...msg_parts )
  },

  init: async function( config ) {
    this.config = config

    try {
      this.db = await this.connectToDB( config.mongo_uri )
      await this.chat.logIn( config.chat_token )
    }
    catch( err ) {
      console.log( "Bot failed to initialize:" );
      console.error( err );
      process.exit();
    }

    for( let user of config.authorized_users )
      this.chat.onMessage( msg => this.handleBotChannelMessage( msg ), user, config.bot_channel )
  },

  runCommand: function( name, ...args ) {
    if( !this.commands[ name ] )
      throw new Error( "Unkown command '" + name + "'" )

    console.log( "Running command '" + name + "'" )

    return this.commands[ name ]( ...args )
  },

  start: function() {
    try {
      this.chat.startPolling( 1000 )
    }
    catch( err ) {
      console.log( "Bot failed to start:" )
      console.log( err )
    }
  },

  stop: function() {
    this.chat.stopPolling()
    this.db.close()
  }
}

module.exports = bot
