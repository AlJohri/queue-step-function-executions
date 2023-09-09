import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as iam from "aws-cdk-lib/aws-iam";

export class Approach2Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const canProceedLambda = new nodejs.NodejsFunction(this, "can-proceed", {
      initialPolicy: [
        new iam.PolicyStatement({
          actions: ["states:ListExecutions"],
          resources: ["*"],
        }),
      ],
    });

    const poll = new tasks.LambdaInvoke(this, "Check for pending executions", {
      lambdaFunction: canProceedLambda,
      payload: sfn.TaskInput.fromObject({
        stateMachineId: sfn.JsonPath.stateMachineId,
        executionId: sfn.JsonPath.executionId,
      }),
      resultPath: "$.output",
      payloadResponseOnly: true,
    }).addRetry({ maxAttempts: 3, backoffRate: 2 });

    const wait = new sfn.Wait(this, "No. Waiting...", {
      time: sfn.WaitTime.duration(cdk.Duration.minutes(1)),
    });

    // making the rest of the logic just a wait state for 5 minutes
    const actualLogic = new sfn.Wait(this, "Rest of the Logic", {
      time: sfn.WaitTime.duration(cdk.Duration.minutes(5)),
    });

    const choice = new sfn.Choice(this, "Can Proceed?")
      .when(
        sfn.Condition.booleanEquals("$.output.canProceed", true),
        new sfn.Pass(this, "Yes. Proceeding...").next(actualLogic),
      )
      .otherwise(wait);

    poll.next(choice);
    wait.next(poll);

    const machine = new sfn.StateMachine(this, "Approach2Machine", {
      definitionBody: sfn.ChainDefinitionBody.fromChainable(poll),
    });
  }
}
