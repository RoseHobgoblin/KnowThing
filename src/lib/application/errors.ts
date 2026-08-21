export type ApplicationErrorKind =
	| 'validation'
	| 'unauthenticated'
	| 'forbidden'
	| 'missing'
	| 'conflict'
	| 'rate-limit'
	| 'unexpected'

export type ApplicationErrorOptions = {
	cause?: unknown
	details?: unknown
}

export class ApplicationError extends Error {
	readonly kind: ApplicationErrorKind
	readonly code: string
	readonly details?: unknown

	constructor(kind: ApplicationErrorKind, code: string, message: string, options: ApplicationErrorOptions = {}) {
		super(message, { cause: options.cause })
		this.name = 'ApplicationError'
		this.kind = kind
		this.code = code
		this.details = options.details
	}
}

export function isApplicationError(value: unknown): value is ApplicationError {
	return value instanceof ApplicationError
}

export function validationError(code: string, message: string, details?: unknown) {
	return new ApplicationError('validation', code, message, { details })
}

export function missingError(code: string, message: string) {
	return new ApplicationError('missing', code, message)
}

export function conflictError(code: string, message: string, details?: unknown) {
	return new ApplicationError('conflict', code, message, { details })
}
