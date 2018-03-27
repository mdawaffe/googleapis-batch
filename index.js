const httpHeaders = require( 'http-headers' )

const DefaultTransporter = require( 'google-auth-library/lib/transporters.js' )
const Querystring = require( 'request/lib/querystring' ).Querystring

const GOOGLE_API_BASE = 'https://www.googleapis.com'

const BOUNDARY_REGEXP = /^multipart\/mixed;\s*boundary=(?:"([^"]+)"|(.+)$)/i

const { URL } = 'URL' in global ? global : require( 'url' )

class Batch {
	constructor( auth ) {
		this.auth = auth

		this.apiPath = ''
		this.requests = []
		this.callbacks = new Map;

		this.request = this.request.bind( this )
	}

	static build( request, index ) {
		request = { headers: {}, ...request }

		let url = request.uri || request.url

		if ( request.qs ) {
			let qs = new Querystring
			qs.init( request )
			url += '?' + qs.stringify( request.qs )
		}

		if ( request.json ) {
			request.headers['Content-Type'] = 'application/json'
			if ( 'object' === typeof request.json ) {
				request.body = JSON.stringify( request.json )
			}
		}

		let path = 0 === url.indexOf( GOOGLE_API_BASE + '/' )
			? url.slice( GOOGLE_API_BASE.length )
			: ( () => { throw new Error( 'Invalid URL' ) } )()

		let body = `${request.method} ${path}
${Object.entries( request.headers ).map( ( [ name, value ] ) => `${name}: ${value}` ).join( '\n' )}

${request.body ? request.body : '' }`

		return {
			'Content-Type': 'application/http',
			'Content-ID': request.id,
			body,
		}
	}

	request( options, callback ) {
		options.id = options.id || `request-${this.requests.length}`
		this.callbacks.set( options.id, callback )

		const { pathname } = new URL( options.url )
		const apiPath = pathname.split( '/' ).slice( 0, 3 ).join( '/' )

		if ( ! this.apiPath ) {
			this.apiPath = apiPath
		} else if ( this.apiPath !== apiPath ) {
			throw new Error( 'Requests must all go to the same API. Use separate Batch instances for separate APIs.' )
		}

		this.requests.push( DefaultTransporter.prototype.configure( options ) )
	}

	exec( callback ) {
		const random = ( Math.random() * 10000000000000000 + 1000000000000000 ).toString().slice( 0, 16 )
		const boundary = `batch_${random}`

		return this.auth.request( {
			url: `${GOOGLE_API_BASE}/batch${this.apiPath}`,
			method: 'POST',
			headers: {
				'Content-Type': `multipart/mixed; boundary=${boundary}`
			},
			multipart: {
				chunked: false,
				data: this.requests.map( Batch.build )
			}
		}, ( err, body, response ) => this.response( err, body, response, callback ) )
	}

	response( err, multiBody, multiResponse, multiCallback ) {
		if ( ! multiCallback ) {
			multiCallback = err => err ? console.error( err ) : null
		}

		if ( err ) {
			return multiCallback( err )
		}

		const { headers: { 'content-type': ContentType } } = multiResponse

		let boundary = BOUNDARY_REGEXP.exec( ContentType )
		if ( ! boundary ) {
			return multiCallback( new Error( 'No multipart boundary found' ) )
		}

		boundary = boundary[1] || boundary[2]

		const parts = `\r\n${multiBody}`.split( `\r\n--${boundary}--` )[0].split( `\r\n--${boundary}\r\n` ).slice( 1 )

		for ( let part of parts ) {
			let [ meta, headers, body ] = part.split( '\r\n\r\n' )

			const metaHeaders = httpHeaders( meta, true )

			// ( err, body, response )
			let callback = metaHeaders['content-id'] && this.callbacks.get( metaHeaders['content-id'].replace( 'response-', '' ) )

			if ( ! callback ) {
				throw new Error( 'Unknown Batch Response Item' )
			}

			// ( err, response, body )
			callback = DefaultTransporter.prototype.wrapCallback_( callback )

			if ( 'application/http' !== metaHeaders['content-type'] ) {
				return callback( new Error( 'Unknown Batch Response Item Format' ) )
			}

			const responseItem = httpHeaders( headers )

			callback( null, responseItem, body )
		}

		multiCallback( null, multiBody, multiResponse )
	}
}

module.exports = Batch
