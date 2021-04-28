const app = require("express")();
const http = require("http").Server(app);

const { readFileSync } = require("fs");
const process = require("process");
const { dockerCommand } = require("docker-cli-js");
const { spawnSync, spawn } = require("child_process");

const AWS = require("aws-sdk");
const axios = require("axios");

const { v4: uuidv4 } = require("uuid");

const compose = require('docker-compose');
const { port, down } = require('docker-compose');
const pathToCompose = `${process.env.PWD}/debug`;

const { env } = require("string-env-interpolation");

const myArgs = process.argv.slice(2);
const functionName = myArgs[0];

const options = {
  machineName: null, // uses local docker
  currentWorkingDirectory: null, // uses current working directory
  echo: false, // echo command output to stdout/stderr
};

process.env.StockCheckerFunctionArn =
  "arn:aws:lambda:us-east-1:012345678901:function:StockCheckerFunction";
process.env.StockBuyerFunctionArn =
  "arn:aws:lambda:us-east-1:012345678901:function:StockBuyerFunction";
process.env.StockSellerFunctionArn =
  "arn:aws:lambda:us-east-1:012345678901:function:StockSellerFunction";

const sleep = (ms) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

const cleanupContainers = async (containerPrefix) => {
  const containers = await dockerCommand(
    `ps -a | awk '$2 ~ "${containerPrefix}" { print $1 }'`
  );
  console.log("running containers: " + JSON.stringify(containers));
  if (containers.raw !== "") {
    const stoppedContainers = await dockerCommand(
      `stop ${containers.raw.replace(/\n/g, " ")}`,
      options
    );
    console.log("stopped containers: " + JSON.stringify(stoppedContainers));
    await dockerCommand(
      `rm ${stoppedContainers.raw.replace(/\n/g, " ")}`,
      options
    );
  }
};

const pollUntilSuccessful = async (url) => {
  while (true) {
    try {
      const response = await axios.get(url);
    } catch (error) {
      if (error.response && error.response.status === 404) return;
      await sleep(1000);
    }
  }
};


app.get("/", function (req, res) {
  res.sendFile(__dirname + "/index.html");
});

app.get("/executionhistory/:name", async function (req, res) {
  console.log(req);
  const name = req.params.name;
  client.getExecutionHistory(
    {
      executionArn: `arn:aws:states:us-east-1:012345678901:execution:stock-trader:${name}`,
    },
    function (err, data) {
      console.log(data);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(data));
    }
  );
});

console.log("Cleaning up leftover containers...");
cleanupContainers("amazon/aws-sam-cli-emulation").then(() => {
  cleanupContainers("samcli/lambda:").then( async () => {

    compose.upAll({ cwd: pathToCompose, log: true}).then( async (result) => {
      console.log("success: " + JSON.stringify(result));
      const stepFunctionsPort = await port("step-functions", "8083", { cwd: pathToCompose, log: true});
      console.log(JSON.stringify(stepFunctionsPort));

      const config = { endpoint: "http://localhost:" + stepFunctionsPort.data.port, region: "us-east-1" };

      const client = new AWS.StepFunctions(config);

      const content = env(
        readFileSync("./statemachine/stock_trader.asl.json", "utf-8")
      );
      await sleep(2000);

      console.log("Creating State Machine...");
      client.createStateMachine(
        {
          definition: content,
          name: "stock-trader",
          roleArn: "arn:aws:iam::012345678901:role/DummyRole",
          type: "EXPRESS",
        },
        function (err, data) {
          if (err) console.log(err, err.stack);
          // an error occurred
          else {
            console.log(`State Machine ${data.stateMachineArn} created.`);
            console.log(`Starting up a Stock Trader execution...`);
            client.startExecution(
              {
                stateMachineArn: data.stateMachineArn,
                name: "debug" + uuidv4(),
              },
              async function (err, data) {
                if (err) console.log(err, err.stack);
                // an error occurred
                else {
                  console.log("Building SAM App...");
                  spawnSync("sam", ["build"]);
                  console.log("SAM App Build Complete.");

                  const samStart = spawn("sam", [
                    "local",
                    "start-lambda",
                    "-d",
                    "5890",
                    "--profile",
                    "cjdev",
                    "--shutdown",
                    "--debug-function",
                    functionName
                  ]);
                  
                  samStart.stdout.on("data", (data) => {
                    console.log(`${data}`);
                  });

                  samStart.stderr.on("data", (data) => {
                    console.error(`${data}`);
                  });

                  process.on("SIGINT", async function () {
                    console.log("Killing SAM...");
                    console.log("Kill status: " + samStart.kill("SIGTERM"));

                    await down({ cwd: pathToCompose, log: true});
                    process.exit();
                    // remove incomplete output files because user interrupted the script with CTRL+C
                  });

                  await pollUntilSuccessful("http://127.0.0.1:3001");

                  http.listen(8084, "localhost", function () {
                    console.log("listening on *:8084");
                  });
                }
              }
            );
          }
        }
      );
    }, (error) => {
      console.log("error: " + JSON.stringify(error));
    });
  });
});