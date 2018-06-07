Google API Batch Requests
=========================

Make batched HTTP requests using the standard `googleapis` library.

Each "sub-request" has its own callback, so you can decide to batch
requests without refactoring much code.

Example
-------

```js
const {google} = require( 'googleapis' )
const Batch = require( 'googleapis-batch' )

// Create the OAuth2 client
const client = new google.auth.OAuth2(
	process.env.GOOGLE_CLIENT_ID,
	process.env.GOOGLE_CLIENT_SECRET
)

// Or however you obtain credentials
client.setCredentials( ... )

const gmail = google.gmail( {
	version: 'v1'
} )

// To make a non-batched request, just call googleapis as normal
gmail.users.messages.list( {
	userId: 'me',
	maxResults: 1,
	auth: client,
}, ( err, response ) => {
	console.log( "NORMAL", err, response.data )
} )


// To batch requests together, pass a batch object as the auth parameter ...

const batch = new Batch( client )

gmail.users.messages.list( {
	userId: 'me',
	maxResults: 1,
	auth: batch,
}, ( err, response ) => {
	// response is the "response" of just this one sub-request
	// in the larger batch request
	// {
	//   status: 200,
	//   statusText: 'OK',
	//   headers: { name: value, ... },
	//   data: ...,
	//   ...
	// }
	console.log( "ONE", err, response )
} )

// ... you can have up to 100 requests in one batch ...
gmail.users.messages.list( {
	userId: 'me',
	maxResults: 2,
	auth: batch,
}, ( err, response ) => {
	console.log( "TWO", err, response )
} )

// ... and then call batch.exec( callback )
batch.exec( ( err, response ) => {
	// response is from the whole batch request

	// This callback is mostly useful to
	// catch errors coming from the batch request
	// as a whole.
} )
