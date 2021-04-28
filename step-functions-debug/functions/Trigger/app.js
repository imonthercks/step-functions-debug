const AWS = require('aws-sdk');
const process = require("process");
const { v4: uuidv4 } = require("uuid");

/**
 * Sample Lambda function which mocks the operation of buying a random number of shares for a stock.
 * For demonstration purposes, this Lambda function does not actually perform any  actual transactions. It simply returns a mocked result.
 * 
 * @param {Object} event - Input event to the Lambda function
 * @param {Object} context - Lambda Context runtime methods and attributes
 *
 * @returns {Object} object - Object containing details of the stock buying transaction
 * 
 */
exports.lambdaHandler = async (event, context) => {
    const stateMachineArn = process.env.STATE_MACHINE_ARN;
    const stepfunctions = new AWS.StepFunctions();
    var params = {
        stateMachineArn: stateMachineArn, /* required */
        input: '{}',
        name: 'ex_' + uuidv4()
      };
      stepfunctions.startExecution(params, function(err, data) {
        if (err) return { 'error': err } // an error occurred
        else     return { 'data': data }          // successful response
      });
    
};
