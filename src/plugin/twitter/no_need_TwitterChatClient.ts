import {
  EResourceType,
  FetcherService,
  IUserNotificationsResponse,
  Rettiwt,
  User,
} from "rettiwt-api";
import { Client, IAgentRuntime, settings } from "@elizaos/core";
import readline from "readline";
import { sleep } from "../../utils/sleep.ts";
import { SearchMode } from "agent-twitter-client";
interface TweetThread {
  tweetId: string;
  tweetFullText: string | undefined;
  tweetReplyTo: string | undefined;
  tweetBy: User;
  createdAt_str: string | undefined;
  createdAt: Date | undefined;
}

export class TwitterChatClient implements Client {
  private handledTweetIds: string[] = [];
  private rettiwt: Rettiwt;
  private fetcher: FetcherService;
  private rl: readline.Interface;
  private lastNotificationTime: number = 0;

  constructor() {
    this.rettiwt = new Rettiwt({ apiKey: process.env["TWITTER_COOKIES"] });
    this.fetcher = new FetcherService({
      apiKey: process.env["TWITTER_COOKIES"],
    });
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  async start(runtime: IAgentRuntime) {
    console.log("[TwitterChatClient] Starting...");

    this.rl.on("SIGINT", () => {
      this.rl.close();
      process.exit(0);
    });

    setTimeout(async () => {
      await this.startMentionCandidatesStream(runtime);
    }, 2000);
  }

  async startMentionCandidatesStream(runtime: IAgentRuntime) {
    const twitterClient = await runtime.clients[0];
    const mentionCandidates =
      await twitterClient.interaction.getMentionCandidates();
    console.log(`Found ${mentionCandidates.length} mention candidates`);

    this.handleNewTweets(
      mentionCandidates.map((mentionCandidate) => mentionCandidate.id),
      runtime,
      true
    );

    setInterval(async () => {
      console.log("Checking for mention candidates");
      const twitterClient = await runtime.clients[0];
      const mentionCandidates =
        await twitterClient.interaction.getMentionCandidates();

      console.log(`Found ${mentionCandidates.length} mention candidates`);

      this.handleNewTweets(
        mentionCandidates.map((mentionCandidate) => mentionCandidate.id),
        runtime
      );
    }, parseInt(process.env.TWITTER_POLL_INTERVAL || "2") * 1000);
  }

  async stop(runtime: IAgentRuntime) {
    console.log("[TwitterChatClient] Stopping...");
    this.rl.close();
  }

  private async startNotificationStream(runtime: IAgentRuntime) {
    try {
      const initialResponse =
        await this.fetcher.request<IUserNotificationsResponse>(
          EResourceType.USER_NOTIFICATIONS,
          {}
        );
      await this.handleNewTweets(
        (initialResponse.globalObjects as any).tweets,
        runtime,
        true
      );

      for await (const notification of this.rettiwt.user.notifications(10000)) {
        const currentTime = Date.now();
        if (currentTime - this.lastNotificationTime >= 10000) {
          console.log("[TwitterChatClient] New notification");
          await this.handleNotification(runtime);
          this.lastNotificationTime = currentTime;
        }
      }
    } catch (error) {
      console.error("Error in notification stream:", error);
      this.startNotificationStream(runtime);
    }
  }

  async handleNotification(runtime: IAgentRuntime) {
    const response = await this.fetcher.request<IUserNotificationsResponse>(
      EResourceType.USER_NOTIFICATIONS,
      {}
    );
    await this.handleNewTweets((response.globalObjects as any).tweets, runtime);
  }

  private async getFullThread(tweetId: string): Promise<TweetThread[]> {
    const thread: TweetThread[] = [];

    const collectReplies = async (id: string) => {
      const tweet = await this.rettiwt.tweet.details(id);
      if (!tweet) return;

      thread.push({
        tweetId: id,
        tweetFullText: tweet.fullText,
        createdAt_str: tweet.createdAt,
        createdAt: new Date(tweet.createdAt),
        tweetReplyTo: tweet.replyTo,
        tweetBy: tweet.tweetBy,
      });

      if (tweet.replyTo) {
        await collectReplies(tweet.replyTo);
      }
    };

    await collectReplies(tweetId);
    thread.sort((a, b) => {
      if (!a.createdAt || !b.createdAt) return 0;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
    return thread;
  }

  private async handleNewTweets(
    tweets: string[],
    runtime: IAgentRuntime,
    is_initial: boolean = false
  ) {
    for (const targetTweetId of tweets) {
      if (this.handledTweetIds.includes(targetTweetId)) continue;
      this.handledTweetIds.push(targetTweetId);
      if (is_initial) continue;

      const thread = await this.getFullThread(targetTweetId);
      const lastTweet = thread[thread.length - 1];
      // this.rettiwt.tweet.details("");

      if (lastTweet.tweetBy.userName === process.env.TWITTER_USERNAME) {
        console.log("Skipping reply to self");
        continue;
      }

      let conversation = "";
      for (const tweet of thread) {
        conversation += `${tweet.tweetBy.fullName} (@${tweet.tweetBy.userName}): ${tweet.tweetFullText}\n`;
      }

      const serverPort = parseInt(settings.SERVER_PORT || "3000");
      const agentId = runtime.character.name ?? "Agent";

      const response = await fetch(
        `http://localhost:${serverPort}/${agentId}/message`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: conversation,
            userId: lastTweet.tweetBy.fullName,
            userName: lastTweet.tweetBy.fullName,
          }),
        }
      );

      const data = await response.json();
      console.log({ data });

      const twitterClient = await runtime.clients[0];

      const chunkedData = data.flatMap((message) => {
        if (message.text.length <= 280) {
          return [message];
        }

        const chunks = [];
        let remainingText = message.text;

        while (remainingText.length > 0) {
          let chunk = remainingText.slice(0, 280);

          if (chunk.length === 280) {
            // Try to find last sentence break within 280 chars
            const lastPeriod = chunk.lastIndexOf(".");
            const lastQuestion = chunk.lastIndexOf("?");
            const lastExclamation = chunk.lastIndexOf("!");

            const lastBreak = Math.max(
              lastPeriod,
              lastQuestion,
              lastExclamation
            );

            if (lastBreak > 0) {
              chunk = remainingText.slice(0, lastBreak + 1);
            }
          }

          chunks.push({
            ...message,
            text: chunk.trim(),
          });

          remainingText = remainingText.slice(chunk.length).trim();
        }

        return chunks;
      });

      let tweetId = lastTweet.tweetId;
      for (const message of data) {
        try {
          try {
            tweetId = await twitterClient.post.quickReply(
              tweetId,
              message.text
            );
            console.log({ tweetId });
          } catch (e) {
            console.log("Error in quick reply:", JSON.stringify(e));
            tweetId = await this.rettiwt.tweet.post({
              replyTo: tweetId,
              text: message.text,
            });
          }
          await sleep(1000, 3000);
        } catch (error) {
          console.error("Error in quick reply:", error, JSON.stringify(error));
        }
      }

      setTimeout(async () => {
        await twitterClient.post.likeTweet(lastTweet.tweetId);
      }, 1000 + Math.floor(Math.random() * 10000));
    }
  }
}
