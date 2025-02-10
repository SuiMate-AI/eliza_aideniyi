import { Scraper, SearchMode, Tweet } from "agent-twitter-client";

export async function getRepliesToTweet(scraper: Scraper, tweetId: string) {
  // Fetch the tweet to get the conversation ID
  const tweet = await scraper.getTweet(tweetId);
  if (!tweet || !tweet.conversationId) {
    console.log("Tweet not found or not part of a conversation.");
    return [];
  }

  // Fetch all tweets in the conversation
  const conversationId = tweet.conversationId;
  const query = `conversation_id:${conversationId}`;
  const maxTweets = 5; // Adjust as needed
  const searchMode = SearchMode.Latest; // Fetch latest tweets in the conversation

  const tweets: Tweet[] = [];
  for await (const tweet of scraper.searchTweets(
    query,
    maxTweets,
    searchMode
  )) {
    if (tweet.inReplyToStatusId === tweetId) {
      tweets.push(tweet);
    }
  }

  return tweets;
}
