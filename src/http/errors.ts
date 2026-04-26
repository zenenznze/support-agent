export interface JsonErrorBody {
  ok: false
  error: {
    code: string
    message: string
  }
}

export class HttpError extends Error {
  readonly statusCode: number
  readonly code: string

  constructor(statusCode: number, code: string, message: string) {
    super(message)
    this.name = 'HttpError'
    this.statusCode = statusCode
    this.code = code
  }
}

export function toErrorBody(error: HttpError): JsonErrorBody {
  return {
    ok: false,
    error: {
      code: error.code,
      message: error.message
    }
  }
}
