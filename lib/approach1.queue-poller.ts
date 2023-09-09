import { Context } from "aws-lambda";
import {
    SQSClient,
    ReceiveMessageCommand,
    DeleteMessageCommand,
} from "@aws-sdk/client-sqs";
import {
    SFNClient,
    StartExecutionCommand,
    ListExecutionsCommand,
    ExecutionStatus,
} from "@aws-sdk/client-sfn";


export async function recieveMessage(queueUrl: string) {
    /**
     * Docs: https://docs.aws.amazon.com/AWSSimpleQueueService/latest/APIReference/API_ReceiveMessage.html
     */
    const client = new SQSClient();
    const command = new ReceiveMessageCommand({ QueueUrl: queueUrl, MaxNumberOfMessages: 1 });
    const response = await client.send(command);

    if (response.Messages && response.Messages.length == 1) {
        return response.Messages[0];
    } else {
        return null;
    }
}

export async function deleteMessage(queueUrl: string, receiptHandle: string) {
    /**
     * Docs: https://docs.aws.amazon.com/AWSSimpleQueueService/latest/APIReference/API_DeleteMessage.html
     */
    const client = new SQSClient();
    const command = new DeleteMessageCommand({ QueueUrl: queueUrl, ReceiptHandle: receiptHandle });
    const response = await client.send(command);
    return response;
}

export async function getRunningExecutions(stateMachineId: string) {
    /**
     * Docs: https://docs.aws.amazon.com/step-functions/latest/apireference/API_ListExecutions.html
     */
    const client = new SFNClient();
    const command = new ListExecutionsCommand({
        stateMachineArn: stateMachineId,
        statusFilter: ExecutionStatus.RUNNING,
        // assuming we will not have more than 1000 "pending" executions in the queue at a given time
        maxResults: 1000,
    });

    const { executions } = await client.send(command);

    if (!executions) {
        throw new Error("sfn list executions api call was empty");
    }

    return executions;
}

export async function startExecution(stateMachineId: string, input?: string, name?: string) {
    /**
     * Docs: https://docs.aws.amazon.com/step-functions/latest/apireference/API_ListExecutions.html
     */

    const client = new SFNClient();
    const command = new StartExecutionCommand({
        stateMachineArn: stateMachineId,
        name,
        input
    });

    const response = await client.send(command);

    return response.executionArn;
}

const raise = (err: string): never => {
    throw new Error(err);
}

export async function handler(event: any, context: Context) {
    const queueUrl = process.env.QUEUE_URL ?? raise("missing QUEUE_URL env var");
    const stateMachineArn = process.env.STATE_MACHINE_ARN ?? raise("missing STATE_MACHINE_ARN env var");

    const message = await recieveMessage(queueUrl);
    if (!message) return;
    const executions = await getRunningExecutions(stateMachineArn);
    if (executions.length > 0) return;
    await startExecution(stateMachineArn, message.Body, message.Attributes?.Name);
    await deleteMessage(queueUrl, message.ReceiptHandle!);
}
