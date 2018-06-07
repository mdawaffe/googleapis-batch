const {google} = require( 'googleapis' )
const Batch = require( '.' )

const clientCredentials = require( './.client-secret.json' )
const credentials = require( './.credentials.json' )

const client = new google.auth.OAuth2(
	( clientCredentials.web || clientCredentials.installed ).client_id,
	( clientCredentials.web || clientCredentials.installed ).client_secret
)

client.setCredentials( {
	access_token: 'noop',
	refresh_token: credentials.refresh_token,
	expiry_date: Date.now() - 3600000 * 24 * 7,
} )

const gmail = google.gmail( {
	version: 'v1'
} )

/*
*/
gmail.users.messages.list( { userId: 'me', auth: client, maxResults: 1 }, ( err, response ) => {
	console.log( "NORMAL", err, response.data )
} )

/*
*/
const batch = new Batch( client )

gmail.users.messages.list( { userId: 'me', auth: batch, maxResults: 1 }, ( err, response ) => {
	console.log( "ONE", err, response.data )
} )

gmail.users.messages.list( { userId: 'me', auth: batch, maxResults: 2 }, ( err, response ) => {
	console.log( "TWO", err, response.data, response )
} )

batch.exec()
