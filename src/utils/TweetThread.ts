import { User } from "rettiwt-api";

export interface TweetThread {
  tweetId: string;
  tweetFullText: string | undefined;
  tweetReplyTo: string | undefined;
  tweetBy: User;
  createdAt_str: string | undefined;
  createdAt: Date | undefined;
}
