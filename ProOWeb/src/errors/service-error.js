function createServiceError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getServiceErrorStatusCode(error, fallbackStatusCode) {
  if (error && Number.isInteger(error.statusCode)) {
    return error.statusCode;
  }

  return fallbackStatusCode;
}

module.exports = {
  createServiceError,
  getServiceErrorStatusCode,
};
