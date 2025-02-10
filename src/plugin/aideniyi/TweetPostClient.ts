import { Client, IAgentRuntime } from "@elizaos/core";

export class TweetPostClient implements Client {
  // Start client connection
  async start(runtime: IAgentRuntime) {
    console.log("[TweetPostClient] Starting...");

    // // 每 10 秒執行一次
    // setInterval(async () => {
    //   console.log("[TweetPostClient] Posting tweets...");
    //   await this.postTweets();
    // }, 10 * 1000);
  }

  // Stop client connection
  async stop(runtime: IAgentRuntime) {
    console.log("[TweetPostClient] Stopping...");
  }

  // 檢查更新的邏輯
  async postTweets() {
    try {
      // 這裡可以替換成你的邏輯，例如請求 API 或檢查數據庫
      const updates = await this.fetchUpdates();

      if (updates.length > 0) {
        console.log(`[TweetPostClient] Found ${updates.length} updates.`);
        // 觸發某個 Action 或其他操作
      } else {
        console.log("[TweetPostClient] No new updates.");
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
}
