const Google = require( 'googleapis' )
const Batch = require( '.' )

const clientCredentials = require( './.client-secret.json' )
const credentials = require( './.credentials.json' )

const client = new Google.auth.OAuth2(
	( clientCredentials.web || client.credentials.installed ).client_id,
	( clientCredentials.web || client.credentials.installed ).client_secret
)

client.setCredentials( {
	access_token: 'noop',
	refresh_token: credentials.refresh_token,
	expiry_date: Date.now() - 3600000 * 24 * 7,
} )

const gmail = Google.gmail( {
	version: 'v1'
} )

gmail.users.messages.list( { userId: 'me', auth: client, maxResults: 1 }, ( err, body, response ) => {
	console.log( "NORMAL", err, body )
} )

const batch = new Batch( client )

gmail.users.messages.list( { userId: 'me', auth: batch, maxResults: 1 }, ( err, body, response ) => {
	console.log( "ONE", err, body )
} )

gmail.users.messages.list( { userId: 'me', auth: batch, maxResults: 2 }, ( err, body, response ) => {
	console.log( "TWO", err, body )
	console.log( response )
} )

batch.exec()
