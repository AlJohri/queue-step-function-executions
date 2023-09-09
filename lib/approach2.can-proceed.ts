import { Context } from "aws-lambda";
import {
    SFNClient,
    ListExecutionsCommand,
    ExecutionStatus,
    ExecutionListItem,
} from "@aws-sdk/client-sfn";

interface Event {
    stateMachineId: string;
    executionId: string;
}

export async function getRunningExecutions(stateMachineId: string) {
    /**
     * Docs: https://docs.aws.amazon.com/step-functions/latest/apireference/API_ListExecutions.html
     */
    const client = new SFNClient({});
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

export function filterCurrentExecution(
    currentExecutionId: string,
    executions: ExecutionListItem[],
): ExecutionListItem {
    const currentExecution = executions.find(
        (x) => x.executionArn == currentExecutionId,
    );

    if (!currentExecution) {
        throw new Error(
            `current execution (${currentExecutionId}) was unable to be found in list executions`,
        );
    }

    return currentExecution;
}

export function filterPendingExecutions(
    currentExecution: ExecutionListItem,
    executions: ExecutionListItem[],
): ExecutionListItem[] {
    // NOTE: we are not doing any special handling for **exactly** concurrent executions
    // as step function start dates are at the millisecond resolution
    // and we do not expect two step functions to start at the same millisecond
    return executions.filter(
        (x) =>
            x.executionArn != currentExecution.executionArn &&
            x.startDate! <= currentExecution.startDate!,
    );
}

export async function handler(event: Event, context: Context) {
    // Note that this API is eventually consistent and is not designed to handle a high throughput
    // of executions. Testing this on my account I find this isn't a big issue in practice, especially
    // if the step function is a long running operation (~minutes to hours).
    //
    // From ListExecutions API Docs:
    //     "This operation is eventually consistent. The results are best effort and may not
    //      reflect very recent updates and changes."

    const executions = await getRunningExecutions(event.stateMachineId);

    // While the API results are already sorted, we sort it again (in reverse order).
    //
    // From ListExecutions API Docs:
    //   "Results are sorted by time, with the most recent execution first."
    //
    // We sort it by to oldest execution first.
    executions.sort((a, b) =>
        a.startDate! < b.startDate! ? -1 : a.startDate! > b.startDate! ? 1 : 0,
    );

    // The step function can proceed if the current execution is the oldest execution
    // in the list of running executions.
    let canProceed = false;
    const oldestExecution = executions[0];
    if (oldestExecution.executionArn === event.executionId) {
        canProceed = true;
    }

    // filter list of executions to get the current execution along with its start date
    const currentExecution = filterCurrentExecution(
        event.executionId,
        executions,
    );

    // get number of pending executions based on the current execution's start date
    const pendingExecutions = filterPendingExecutions(
        currentExecution,
        executions,
    );

    // sanity check pending executions is empty if we can proceed
    // NOTE: if by chance we somehow ended up with exactly concurrent executions (down to the millisecond)
    // then we would have > 0 pending executions and explicitly fail the step function execution
    if (canProceed !== (pendingExecutions.length === 0)) {
        console.error(`if canProceed is true, number of pending executions must be 0.
    current execution: ${JSON.stringify(currentExecution)}
    pending executions: ${JSON.stringify(pendingExecutions)}`);
        throw new Error(
            "sanity check to ensure pending executions is empty failed",
        );
    }

    return {
        canProceed,
        currentExecution: {
            executionArn: currentExecution.executionArn,
            startDate: currentExecution.startDate,
        },
        pendingExecutions: pendingExecutions.map((x) => ({
            executionArn: x.executionArn,
            startDate: x.startDate,
        })),
    };
}
