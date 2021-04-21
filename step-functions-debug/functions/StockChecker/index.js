/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * This module is the bootstrap entrypoint. It establishes the top-level event
 * listeners and loads the user's code.
 */

"use strict";

const RAPIDClient = require("./RAPIDClient.js");
const Runtime = require("./Runtime.js");
const UserFunction = require("./UserFunction.js");
const Errors = require("./Errors.js");
const BeforeExitListener = require("./BeforeExitListener.js");

require("./LogPatch").patchConsole();

const client = new RAPIDClient(process.env.AWS_LAMBDA_RUNTIME_API);

let errorCallbacks = {
  uncaughtException: error => {
    client.postInitError(error, () => process.exit(129));
  },
  unhandledRejection: error => {
    client.postInitError(error, () => process.exit(128));
  }
};

process.on("uncaughtException", error => {
  console.error("Uncaught Exception", Errors.toFormatted(error));
  errorCallbacks.uncaughtException(error);
});

process.on("unhandledRejection", (reason, promise) => {
  let error = new Errors.UnhandledPromiseRejection(reason, promise);
  console.error("Unhandled Promise Rejection", Errors.toFormatted(error));
  errorCallbacks.unhandledRejection(error);
});

BeforeExitListener.reset();
process.on("beforeExit", BeforeExitListener.invoke);

const handler = UserFunction.load(
  process.env.LAMBDA_TASK_ROOT,
  process.env._HANDLER
);

new Runtime(client, handler, errorCallbacks).scheduleIteration();
