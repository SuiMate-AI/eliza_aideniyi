import { Client, IAgentRuntime } from "@elizaos/core";
import { PrismaClient } from "@prisma/client";
import { addMinutes, subMinutes } from "date-fns";
import sheetHandler from "../../utils/sheetHandler.ts";
import { parseQuestionRow } from "../../utils/questions.ts";
import { Scraper } from "agent-twitter-client";
import { getRepliesToTweet } from "../../utils/getRepliesToTweet.ts";
const prisma = new PrismaClient();

export class TweetPostClient implements Client {
  // Start client connection
  private runtime: IAgentRuntime;
  private twitterClient: Scraper;
  private questionIdToRepliesCountMapping: Record<string, number> = {};
  async start(runtime: IAgentRuntime) {
    console.log("[TweetPostClient] Starting...");

    setTimeout(async () => {
      this.runtime = runtime;
      this.twitterClient = runtime.clients[0].client.twitterClient;
    }, 2000);

    // 每 60 秒執行一次
    setInterval(async () => {
      console.log("[TweetPostClient] Checking for TwitterQuestions...");
      await this.postTweets();
    }, 10 * 1000);

    setInterval(async () => {
      console.log("[TweetPostClient] Checking for TwitterQuestions...");
      await this.checkAnswers();
    }, parseInt(process.env.TWITTER_CHECK_ANSWERS_INTERVAL || "50") * 1000);
  }

  // Stop client connection
  async stop(runtime: IAgentRuntime) {
    console.log("[TweetPostClient] Stopping...");
  }

  async checkAnswers() {
    try {
      const unAnsweredQuestions = await prisma.twitterQuestion.findMany({
        where: {
          winnerAnnouncementUrl: null,
        },
      });

      console.log(
        `[TweetPostClient] Checking ${unAnsweredQuestions.length} unAnsweredQuestions`
      );

      for (const question of unAnsweredQuestions) {
        console.log(`Checking question ${question.id}: ${question.question}`);
        let questionPost;
        try {
          questionPost = await this.twitterClient.getTweet(
            question.questionPostId
          );
        } catch (e) {
          console.log(e);
          continue;
        }

        if (
          this.questionIdToRepliesCountMapping[questionPost.id] ==
          questionPost.replies
        ) {
          continue;
        } else {
          this.questionIdToRepliesCountMapping[questionPost.id] =
            questionPost.replies;
        }

        const replies = await getRepliesToTweet(
          this.twitterClient,
          question.questionPostId
        );
        console.log(`Get ${replies.length} replies`);
        replies.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        let haveWinner = false;
        for (const reply of replies) {
          const exist = await prisma.twitterAnswer.findFirst({
            where: {
              postId: reply.id,
            },
          });
          if (exist) continue;
          if (haveWinner) break;
          await this.twitterClient.likeTweet(reply.id);
          let isWinner = false;
          let passEvaluation = false;
          let evaluationLog = "";
          try {
            const replyText = reply.text;
            console.log(replyText);
            if (!replyText) throw new Error("Reply text is empty");
            if (replyText.includes("Yes")) {
              passEvaluation = true;
              isWinner = true;
              haveWinner = true;
              await this.tweet(
                `${question.question}\n\nCongratulations ${
                  reply.username
                } for answering the question correctly and winning ${
                  question.totalAward / 10 ** 9
                } $${question.awardTokenType.split("::")[2]}!\n\n` +
                  `@SuiTipper please send the token to @${reply.username}`,
                reply.id
              );
              evaluationLog = `Hard Coded Winner`;
            }
          } catch (e) {
            evaluationLog = JSON.stringify({ error: e.message });
            console.log(e);
          } finally {
            prisma.twitterAnswer.create({
              data: {
                postId: reply.id,
                postUrl: `https://x.com/${reply.username}/status/${reply.id}`,
                postContent: reply.text || "",
                createdByUsername: reply.username,
                createdByUserId: reply.userId,
                isWinner,
                passEvaluation,
                evaluationLog,
                twitterQuestionId: question.id,
                twitterQuestionPostId: question.questionPostId,
              },
            });
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  // 檢查更新的邏輯
  async postTweets() {
    try {
      const thirtyMinutesBefore = subMinutes(new Date(), 30);

      // 查詢 TwitterQuestion
      const recentQuestions = await prisma.twitterQuestion.findFirst({
        orderBy: {
          createdAt: "desc",
        },
      });
      console.log({
        questionPostTime: recentQuestions.questionPostTime,
        thirtyMinutesBefore,
      });

      if (
        !recentQuestions ||
        recentQuestions.questionPostTime < thirtyMinutesBefore
      ) {
        console.log(
          "[TweetPostClient] No TwitterQuestions found or last post is older than 30 minutes."
        );
        const questions = await sheetHandler.getSheetAsJson();
        const questionToPost = parseQuestionRow(questions[0]);
        console.log({ questionToPost });

        // do something with questions
        const tweetId = await this.tweet(questionToPost.question);
        const twitterUser = await this.twitterClient.me();
        await prisma.twitterQuestion.create({
          data: {
            question: questionToPost.question,
            metadata: JSON.stringify(questionToPost),
            totalAward: 0.1 * 10 ** 9,
            awardTokenType: "0x2::sui::SUI",
            numberOfReceivers: 1,
            questionPostId: tweetId,
            createdByUsername: twitterUser.username,
            createdByUserId: twitterUser.userId,
            questionPostUrl: `https://x.com/${twitterUser.username}/status/${tweetId}`,
          },
        });
        await sheetHandler.removeSecondRow();
      } else {
        // 觸發某個 Action 或其他操作
      }
    } catch (error) {
      console.error("[TweetPostClient] Error while checking updates:", error);
    }
  }

  // 模擬獲取更新
  async fetchUpdates() {
    // 這裡可以換成 API 請求，例如：
    // return await fetch("https://api.example.com/updates").then(res => res.json());
    return []; // 假設目前沒有更新
  }

  async tweet(replyText: string, tweetId?: string) {
    try {
      let response;
      if (replyText.length < 280) {
        response = await this.twitterClient.sendTweet(replyText, tweetId);
      } else {
        response = await this.twitterClient.sendNoteTweet(replyText, tweetId);
      }

      const body = await response.json();

      const resultTweetId = body.data.create_tweet.tweet_results.result
        .rest_id as string;
      console.log(
        `[TweetPostClient] Successfully replied to tweet ${resultTweetId}`
      );
      return resultTweetId;
    } catch (error) {
      throw error;
    }
  }
}
