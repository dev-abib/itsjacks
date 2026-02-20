// external dependencies

// internal dependencies
const { apiError } = require("./api.error");

const asyncHandler = (fun = () => {}) => {
  return async (req, res, next) => {
    try {
      await fun(req, res, next);
    } catch (error) {
      let errorMessage = error.message || errorMessage;
      let errorDetails = error.stack || null;

      console.log(error);
      return new apiError(500, errorMessage, errorDetails, false);
    }
  };
};

module.exports = {
  asyncHandler,
};
