# queue-step-function-executions

This repository implements two approaches for queueing step functions as described in [this blogpost](https://theburningmonk.com/2018/07/step-functions-how-to-implement-semaphores-for-state-machines/):

- Approach 1: Control the number of concurrent executions (SQS + Lambda Poller)
![](https://theburningmonk.com/wp-content/uploads/2018/07/img_5b538493995f6-1024x657.png)
- Approach 2: Block execution using semaphores (Step Function itself is the Queue)
![](https://theburningmonk.com/wp-content/uploads/2018/07/img_5b5384b0e751a-1024x678.png)

## Quickstart

```
npm install
npx cdk deploy --require-approval never --all
```
