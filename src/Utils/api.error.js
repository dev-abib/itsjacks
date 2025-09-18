// this is the api error utils file and this file will control all error response format

class apiError {
  constructor(
    status = 400,
    message = "unknow error occured",
    data = null,
    success = false
  ) {
    (this.status = status),
      (this.message = message),
      (this.data = data),
      (this.success = success);
  }
}

module.exports = {
  apiError,
};
