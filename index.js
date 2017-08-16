const config = require( "./config.json" )
const bot = require( "./lib/hmbot.js" )
const npc_corps = require( "./data/npc-corps.json" )

/**
 * crackT1s command.
 * @param {Array} locs - an array of T1 NPC locs to send to the T1 cracker script
 * @return {Promise} - resolves with the number of locs cracked when the bot channel gets a "return t1cracker <num cracked>" message
 */
bot.addCommand(
  "crackT1s",
  function( locs ) {
    let args = {}

    locs.forEach( (loc, index) => args[ index ] = loc ) // Turn the array of locs into an object

    return bot.game.runScript( "t1cracker", args )
  }
)

bot.addCommand(
  "breakT1",
  async function() {
    try {
      // For every T1 corp...
      for( let corp_script in npc_corps.tier1 ) {
        // ...run kittymeowface.testtest on that corp, and wait for it to send "return testtest <loc list>" to the bot channel...
        let loc_string = await bot.runCommand( "scrapeT1", corp_script )

        // ...then split up that loc list into an array.
        let corp_locs = loc_string.split( "," )

        // While there are still locs left in that array...
        while( corp_locs.length ) {
          // ...determine how many we should try to crack at once...
          let num_to_crack = Math.min( 10, corp_locs.length )

          // ...then attempt to crack that number of locs from the loc array with one cracker call.
          // Wait for the cracker to fire off a "return t1cracker <number cracked>" message
          let num_cracked = await bot.runCommand( "crackT1s", corp_locs.slice( 0, num_to_crack ) )

          // Cull the locs which were cracked successfully from the loc array.
          if( num_cracked )
            corp_locs.splice( 0, num_cracked )
        }
      }
    } catch( err ) {
      console.error( "breakT1 command encountered an error:" )
      console.log( err )
    }
  }
)

/**
 * scrapeT1 command
 * @param {String} corp_script - the T1 NPC corporation to scrape for locs
 * @return {Promise} - resolves with an array of T1 NPC locs when the bot channel receives a "return scrape <loc1> <loc2> <locN...>" message
 */
bot.addCommand(
  "scrapeT1",
  function( corp_script ) {
    return bot.game.runScript( "scrape", {target: "#s." + corp_script} )
  }
)

bot.addCommand(
  "stop",
  function() {
    bot.stop()
  }
)

bot.init( config ).then( bot.start() )
