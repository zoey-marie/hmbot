const robot = require( 'robotjs' )
const processWindows = require( 'node-process-windows' )

const { delay } = require( './util.js')

const game = {
  active_script: null,
  hardline_timeout: null,
  hardline_started: null,

  /**
   * Activate hardline. Returns a promise which resolves when hardline has activated
   */
  activateHardline: async function() {
    // If hardline already seems to be activated, just resolve
    if( this.isHardlineActive() )
      return

    await this.runString( 'kernel.hardline' ) // Run kernel.hardline
    await delay( 10000 ) // Wait 10 seconds for the IP-thingy to start accepting input
    await this.runString( '0123456789'.repeat( 12 ) ) // Send every digit enough times to unlock any IP-thingy, eventually
    await delay( 10000 ) // Wait another 10 seconds for hardline to activate and start accepting input

    // Mark the time at which we consider hardline to have activated
    this.hardline_started = Date.now()

    // Set a timeout for approximately the duration of hardline time left (100 seconds just to be sure?)
    this.hardline_timeout = setTimeout(() => {
      this.hardline_timeout = null
    }, 100000 )

    return // Resolve the promise to consider hardline "activated"
  },

  deactivateHardline: async function() {
    if( !this.isHardlineActive() )
      return

    await this.runString( 'kernel.hardline {dc: true}' )
    await delay( 5000 )

    return
  },

  /**
   * Do we appear to be hardline?
   * @return {boolean}
   */
  isHardlineActive: function() {
    return this.hardline_timeout != null
  },

  /**
   * Get the amount of hardline time remaining, in ms
   * @return {Number}
   */
  hardlineTimeRemaining: function() {
    if( this.isHardlineActive() )
      return Date.now() - this.hardline_started
    else
      return 0
  },

  getActiveScriptName: function() {
    return this.active_script && this.active_script.name
  },

  completeActiveScript: function( name, ret_val ) {
    if( !this.active_script ) {
      console.log( 'Unhandled response from script ' + name + ':' )
      console.log( ret_val )
      return
    }

    if( this.active_script.name !== name )
      throw new Error( 'Unexpected response from ' + name + ', was expecting response from ' + this.active_script.name )

    if( this.active_script.onReturn )
      this.active_script.onReturn( ret_val )

    this.active_script = null
  },

  /**
   * Send a string to the hackmud client
   */
  runString: function( input ) {
    if( this.active_script )
      throw new Error( 'Cannot send input "' + input + '" right now - waiting for ' + this.active_script.name + ' to finish.' )

    processWindows.focusWindow( "hackmud_win" )
    robot.typeString( input )

    return Promise.resolve()
  },

  /**
   * Run a script in hackmud. Returns a promise which resolves if the script sends
   * a "return <script name> <return value>" message to the bot channel, rejects
   * after a timeout (15 seconds by default) if the script never sends the "return"
   * message.
   *
   * @param  {String} name            The name of the script to execute, e.g. "kitty.crackt1"
   * @param  {*} args                 An object of arguments to execute the script with
   * @param  {Number} [timeout=15000] The amount of time in ms after which to consider the script failed, if it does not send a "return" command to the bot channel
   * @return {Promise}                A promise which resolves with the script's "return value" taken from a "return <script name>" chat command, or rejects after timeout ms
   */
  runScript: function( name, args, timeout = 15000 ) {
    if( this.active_script )
      throw new Error( 'Cannot run ' + name + ' right now - waiting for ' + this.active_script.name + ' to finish.' )

    return new Promise( ( resolve, reject ) => {
      // Set the "active script" to this one, and add a callback which will resolve this promise when the "return" chat command is received
      this.active_script = {
        name: name,
        onReturn: resolve
      }

      // Set up a timeout to reject this promise if it takes an unlikely amount of time to complete
      delay( timeout ).then(() => {
        this.active_script = null
        reject( 'Script ' + name + ' did not respond within the alloted ' + (timeout / 1000) + ' seconds' )
      })

      // Send the command to execute this script to hackmud
      this.runString( name + this.stringifyScriptArgs( args ) )
    })
  },

  /**
   * Turn anything into a string suitable for sending as script arguments to the
   * hackmud client. The only wonky bit is that scriptor arguments should be
   * specified as strings, e.g. hackmud.stringifyScriptArgs( { target: '#s.aon.public' } )
   * @param  {*} args  An object of script arguments to stringify
   * @return {String}  An arguments string suitable for sending to hackmud
   */
  stringifyScriptArgs: function( args ) {
    if( !args )
      return ''

    if( args instanceof Array )
      return '[' + args.map( el => this.stringifyScriptArgs( el ) ).join( ',' ) + ']'

    if( 'object' === typeof args ) {
      let stringifiedPairs = Object.keys( args ).map( key => key + ':' + this.stringifyScriptArgs( args[ key ] ) )

      return '{' + stringifiedPairs.join( ',' ) + '}'
    }

    switch( typeof args ) {
      case 'string':
        if( args.indexOf( '#s.' ) === 0 )
          return args

        return '"' + args + '"'

      case 'boolean':
      case 'number':
        return args

      default:
        return ''
    }
  }
}

module.exports = game
