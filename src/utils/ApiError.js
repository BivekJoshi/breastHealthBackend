/**
 * Errors the client is allowed to see. The handler renders these as
 * { error, details } — the exact shape the frontend's toFormError() reads.
 */
class ApiError extends Error {
  constructor(status, message, details = undefined) {
    super(message);
    this.status = status;
    this.details = details;
  }

  static badRequest(message, details) {
    return new ApiError(400, message, details);
  }

  static unauthorized(message = "Your session has expired. Please sign in again.") {
    return new ApiError(401, message);
  }

  static forbidden(message = "You do not have access to this.") {
    return new ApiError(403, message);
  }

  static notFound(message = "Not found.") {
    return new ApiError(404, message);
  }

  static conflict(message = "That value is already in use.", details) {
    return new ApiError(409, message, details);
  }
}

module.exports = { ApiError };
