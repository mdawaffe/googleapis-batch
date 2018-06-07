const httpHeaders = require( 'http-headers' )

const DefaultTransporter = require( 'google-auth-library' ).DefaultTransporter

const buildURL = require( 'axios/lib/helpers/buildURL' )
const transformData = require( 'axios/lib/core/transformData' )
const settle = require( 'axios/lib/core/settle' )

const GOOGLE_API_BASE = 'https://www.googleapis.com'

const BOUNDARY_REGEXP = /^multipart\/mixed;\s*boundary=(?:"([^"]+)"|(.+)$)/i

const { URL } = 'URL' in global ? global : require( 'url' )

class Batch {
	constructor( auth ) {
		this.auth = auth

		this.apiPath = ''
		this.requestCount = 0
		this.requests = {}

		this.transporter = new DefaultTransporter
		this.request = this.request.bind( this )
	}

	static build( request, index ) {
		request = { headers: {}, ...request }

		let url = request.uri || request.url

		if ( request.params ) {
			url = buildURL( url, request.params, request.paramsSerializer )
		}

		let data = transformData(
			request.data,
			request.headers,
			request.transformRequest
		)

		let path = 0 === url.indexOf( GOOGLE_API_BASE + '/' )
			? url.slice( GOOGLE_API_BASE.length )
			: ( () => { throw new Error( 'Invalid URL' ) } )()

		let body = [
			`${request.method} ${path}`,
			`${Object.entries( request.headers ).map( ( [ name, value ] ) => `${name}: ${value}` ).join( '\r\n' )}`,
		]

		if ( data ) {
			body.push( '', data )
		}

		return [
			'Content-Type: application/http',
			`Content-ID: ${request.requestId}`,
			'',
		].concat( body ).join( '\r\n' )
	}

	adapter( config ) {
		return new Promise( ( resolve, reject ) => {
			if ( config.requestId in this.requests ) {
				return reject( new Error( 'googleapis-batch: Duplicate Request ID' ) )
			}

			this.requests[config.requestId] = {
				config,
				resolve,
				reject,
			}
		} )
	}

	request( config, callback ) {
		config.requestId = config.requestId || `request-${this.requestCount++}`

		const { pathname } = new URL( config.url )
		const apiPath = pathname.split( '/' ).slice( 0, 3 ).join( '/' )

		if ( ! this.apiPath ) {
			this.apiPath = apiPath
		} else if ( this.apiPath !== apiPath ) {
			throw new Error( 'Requests must all go to the same API. Use separate Batch instances for separate APIs.' )
		}

		config.adapter = this.adapter.bind( this )

		return this.transporter.request( config, callback )
	}

	exec( callback ) {
		// When making requests, Axios starts by setting up a
		// Promise chain starting with Promise.resolve()
		// https://github.com/axios/axios/blob/0b3db5d87a60a1ad8b0dce9669dbc10483ec33da/lib/core/Axios.js#L39-L53
		// Since this.exec() is almost certainly called on the
		// same tick as this.request(), we need to also start
		// this.exec() with a Promise.resolve() so that it gets
		// appended to the microtask queue. Otherwise, this.exec()
		// will fire before the Promises in this.adapter()
		// are instantiated/added to this.requests()
		return Promise.resolve().then( () => {
			const random = ( Math.random() * 10000000000000000 + 1000000000000000 ).toString().slice( 0, 16 )
			const boundary = `batch_${random}`
			const encapsulation = `\r\n\r\n--${boundary}\r\n`

			return this.auth.request( {
				url: `${GOOGLE_API_BASE}/batch${this.apiPath}`,
				method: 'post',
				headers: {
					'Content-Type': `multipart/mixed; boundary=${boundary}`
				},
				data: [ '' ].concat( Object.values( this.requests ).map( request => Batch.build( request.config ) ) ).join( encapsulation ) + `\r\n\r\n--${boundary}--`,
				responseType: 'text',
			} )
				.then( response => {
					return this.response( response, callback )
				} )
				.catch( err => {
					if ( callback ) {
						return callback( err )
					}

					throw err
				} )
		} )
	}

	response( multiResponse, multiCallback ) {
		const throwCallback = err => {
			if ( multiCallback ) {
				return multiCallback( err )
			}

			throw err
		}

		const { headers: { 'content-type': ContentType } } = multiResponse

		let boundary = BOUNDARY_REGEXP.exec( ContentType )
		if ( ! boundary ) {
			return throwCallback( new Error( 'No multipart boundary found' ) )
		}

		boundary = boundary[1] || boundary[2]

		const parts = `\r\n${multiResponse.data}`.split( `\r\n--${boundary}--` )[0].split( `\r\n--${boundary}\r\n` ).slice( 1 )

		for ( let part of parts ) {
			let [ meta, headers, body ] = part.split( '\r\n\r\n' )

			const metaHeaders = httpHeaders( meta, true )
			const requestId = metaHeaders['content-id'].replace( 'response-', '' )
			const request = this.requests[requestId]
			if ( ! request ) {
				return throwCallback( new Error( 'Unknown Batch Response Item' ) )
			}

			const { config, resolve, reject } = request

			if ( 'application/http' !== metaHeaders['content-type'] ) {
				reject( new Error( 'Unknown Batch Response Item Format' ) )
				break
			}

			const partHeaders = httpHeaders( headers )

			const response = {
				status: partHeaders.statusCode,
				statusText: partHeaders.statusMessage,
				headers: partHeaders.headers,
				config,
				request: 'batch',
				data: body,
			}

			settle(
				resolve,
				reject,
				response
			)
		}

		if ( multiCallback ) {
			multiCallback( null, multiResponse )
		} else {
			return multiResponse
		}
	}
}

module.exports = Batch
