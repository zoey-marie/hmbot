/**
 * Creates a promise which resolves in x ms - should never reject.
 */
module.exports.delay = function( x ) {
  return new Promise( resolve => {
    setTimeout( resolve, x )
  } )
}
