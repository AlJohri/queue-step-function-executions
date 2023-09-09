#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { Approach1Stack } from "../lib/approach1";
import { Approach2Stack } from "../lib/approach2";

const app = new cdk.App();
new Approach1Stack(app, "Approach1Stack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});

new Approach2Stack(app, "Approach2Stack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
