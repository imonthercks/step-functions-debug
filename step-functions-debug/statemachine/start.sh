#!/bin/bash
exdir=$(dirname "$0")

echo 'Starting StepFunctions Process...'

docker stop stepfunctions
docker rm stepfunctions
docker run -p 8083:8083 -d --name stepfunctions --env-file ${exdir}/stepfunctions_credentials.txt amazon/aws-stepfunctions-local

export StockCheckerFunctionArn=arn:aws:lambda:us-east-1:012345678901:function:StockCheckerFunction
export StockBuyerFunctionArn=arn:aws:lambda:us-east-1:012345678901:function:StockBuyerFunction
export StockSellerFunctionArn=arn:aws:lambda:us-east-1:012345678901:function:StockSellerFunction

statemachine=$(envsubst < ${exdir}/stock_trader.asl.json)

sleep 2

aws stepfunctions --endpoint http://localhost:8083 create-state-machine --definition "$statemachine" --name stock-trader --role-arn "arn:aws:iam::012345678901:role/DummyRole"
UUID=uuidgen
aws stepfunctions --endpoint http://localhost:8083 start-execution --state-machine arn:aws:states:us-east-1:012345678901:stateMachine:stock-trader --name debug_$UUID