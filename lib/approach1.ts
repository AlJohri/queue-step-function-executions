import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';

export class Approach1Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const queue = new sqs.Queue(this, "Queue");

    // making the rest of the logic just a wait state for 5 minutes
    const actualLogic = new sfn.Wait(this, "Rest of the Logic", {
      time: sfn.WaitTime.duration(cdk.Duration.minutes(5)),
    });

    const machine = new sfn.StateMachine(this, "Approach1Machine", {
      definitionBody: sfn.ChainDefinitionBody.fromChainable(actualLogic),
    });

    const queuePoller = new nodejs.NodejsFunction(this, "queue-poller", {
      initialPolicy: [
        new iam.PolicyStatement({
          actions: [
            "states:StartExecution",
            "states:ListExecutions",
            "sqs:ReceiveMessage",
            "sqs:DeleteMessage",
          ],
          resources: ["*"],
        }),
      ],
      environment: {
        QUEUE_URL: queue.queueUrl,
        STATE_MACHINE_ARN: machine.stateMachineArn
      }
    });

    const rule = new events.Rule(this, 'Schedule Rule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(1)),
    });
    rule.addTarget(new targets.LambdaFunction(queuePoller));

  }
}
