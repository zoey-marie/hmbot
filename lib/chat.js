const { Account } = require( 'hackmud_chat_web/js/chat.js' )

const chat = {
  account:             new Account( Date.now() / 1000 ),
  message_handlers:    {
    "*": {
      "*": []
    }
  },
  polling_interval_id: null,
  polling_interval:    1000,
  processed_msg_ids:   [],

  logIn: function( token ) {
    return this.account.update( token )
  },

  /**
   * Processes incoming messages by executing all relevant handlers.
   * NOTE: the current processed_msg_ids implementation will only execute handlers
   * for a message once. If there are handlers subscribed to different users which
   * receive the same message, only one user's handlers will execute.
   * @param  {Object} data
   */
  handleIncomingMessages: function( data ) {
    for( let user of data.chats ) {
      for( let msg of data.chats[user] ) {
        if( this.processed_msg_ids.includes( msg.id ) )
          continue

        let channel = msg.channel || "PM" // Get the channel of the message, or use "PM" if it's a chats.tell

        // Now build an array of message handler callbacks which should execute for this message
        let handlers = this.message_handlers["*"]["*"] // Start with the array of global message handlers (received by any user on any channel)

        // If any handlers are set up to deal with messages received by this specific user...
        if( this.message_handlers[user] ) {
          // ...add the handlers for any channel for this user.
          handlers = handlers.concat( this.message_handlers[user]["*"] )

          // If there are handlers specifically for this channel and this user, add those too
          if( this.message_handlers[user][channel] )
            handlers = handlers.concat( this.message_handlers[user][channel] )
        }

        // If any handlers are set up to deal with messages on this channel received by any user, also add those
        if( this.message_handlers["*"][channel] )
          handlers = handlers.concat( this.message_handlers["*"][channel] )

        // Execute every handler that should receive this message
        for( let callback in handlers )
          callback( msg )

        // Consider this message processed
        this.processed_msg_ids.push( msg.id )
      }
    }
  },

  /**
   * Add a message handler callback to process incoming messages, optionally only
   * for messages received by a specific user/channel
   * @param  {Function} callback      The callback to execute on a message - receives the msg object as the first argument
   * @param  {String}   [user="*"]    Which user to listen on, or "*" for all users
   * @param  {String}   [channel="*"] Which channel to listen on, or "*" for all channels
   */
  onMessage: function( callback, user = "*", channel = "*" ) {
    if( !this.message_handlers[ user ] )
      this.message_handlers[ user ] = {"*": []}

    if( !this.message_handlers[ user ][ channel ] )
      this.message_handlers[ user ][ channel ] = []

    this.message_handlers[ user ][ channel ].push( callback )
  },

  startPolling: function() {
    if( this.polling_interval_id )
      throw new Error( 'Cannot start polling for messages: already polling' )

    this.polling_interval_id = setInterval(
      () => {
        this.account
          .poll( { after: 'last' } )
          .then( data => this.handleIncomingMessages( data ) )
          .catch( err => console.log( err ) )
      },
      this.polling_interval
    )
  },

  stopPolling() {
    if( !this.polling_interval_id )
      throw new Error( 'Cannot stop message polling: not polling for messages' )

    clearInterval( this.polling_interval_id )
    this.polling_interval_id = null
  }
}

module.exports = chat
