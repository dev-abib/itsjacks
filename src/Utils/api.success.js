// this is the api success utils file and this file will control all success response format

class apiSuccess {
  constructor(
    status = 200,
    message = "Succesfully loaded data",
    data = null,
    success = true,
    error = null
  ) {
    (this.status = status),
      (this.message = message),
      (this.data = data),
      (this.success = success);
    this.error = error;
  }
}

module.exports = {
  apiSuccess,
};
