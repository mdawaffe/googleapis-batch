Google API Batch Requests
=========================

```
const Google = require( 'googleapis' )
const Batch = require( 'googleapis-batch' )

// Create the OAuth2 client
const client = new Google.auth.OAuth2(
	process.env.GOOGLE_CLIENT_ID,
	process.env.GOOGLE_CLIENT_SECRET
)

// Or however you obtain credentials
client.setCredentials( ... )

const batch = new Batch( client )

const gmail = Google.gmail( {
	version: 'v1'
} )

// To make a non-batched request, just call googleapis as normal
gmail.users.messages.list( {
	userId: 'me',
	maxResults: 1,
	auth: client,
}, ( err, body, response ) => {
	console.log( "NORMAL", err, body )
} )

// To batch requests together, pass a batch object as the auth parameter...
gmail.users.messages.list( {
	userId: 'me',
	maxResults: 1,
	auth: batch,
}, ( err, body, response ) => {
	// body is the body of just this one sub-request
	// in the larger batch request

	// response is the response object for just this
	// one sub-request:
	// {
	//   version: { major: 1, minor: 1 },
	//   statusCode: 200,
	//   statusMessage: 'OK',
	//   headers: { name: value, ... }
	// }
	console.log( "ONE", err, body )
} )

gmail.users.messages.list( {
	userId: 'me',
	maxResults: 2,
	auth: batch,
}, ( err, body, response ) => {
	console.log( "TWO", err, body )
} )

// ... and then call batch.exec( callback )
batch.exec( ( err, body, response ) => {
	// body and response are from the whole batch request
} )

// OR

// ... and then call batch.exec() without a callback,
// but then you can't trap errors with the batch request
// as a whole.
batch.exec()
```
