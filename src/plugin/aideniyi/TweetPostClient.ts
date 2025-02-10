import { Client, IAgentRuntime } from "@elizaos/core";
import { PrismaClient } from "@prisma/client";

import sheetHandler from "../../utils/sheetHandler.ts";
import { parseQuestionRow } from "../../utils/questions.ts";
import { Scraper } from "agent-twitter-client";
import { getRepliesToTweet } from "../../utils/getRepliesToTweet.ts";
const prisma = new PrismaClient();

export class TweetPostClient implements Client {
  constructor(private runtime: IAgentRuntime) {}

  async start() {
    console.log("TweetPostClient started");
  }

  async stop() {
    console.log("TweetPostClient stopped");
  }
}
