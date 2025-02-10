import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { QdrantClient } from "@qdrant/js-client-rest";

export class RAGManager {
  private encoder = new TextEncoder();
  private openai;

  constructor() {
    this.openai = createOpenAI({
      compatibility: "strict",
      baseURL: "https://api.atoma.network/v1",
      apiKey: process.env.ATOMA_API_KEY,
    });
  }

  private async getEmbedding(text: string) {
    const response = await fetch("https://api.atoma.network/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.ATOMA_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: text,
        model: "intfloat/multilingual-e5-large-instruct",
      }),
    });

    const result = await response.json();
    return result.data[0].embedding;
  }

  async handleChatStream(text: string, streamCallback: (text: string) => void) {
    // Stream knowledge points
    streamCallback("<knowledge>");
    let knowledgePoints = await this.streamKnowledgePoints(
      text,
      streamCallback
    );
    streamCallback("</knowledge>");
    if (knowledgePoints.includes("</think>")) {
      knowledgePoints = knowledgePoints.split("</think>")[1];
    }

    // Get search results
    const searchResults = await this.getSearchResults(knowledgePoints);
    streamCallback(
      "<searchResults>" +
        JSON.stringify(
          searchResults.map((result) => ({
            url: result.url,
            title: result.title,
            score: result.score,
          }))
        ) +
        "</searchResults>"
    );

    // Stream final response
    await this.streamFinalResponse(text, searchResults, streamCallback);
  }

  private async streamKnowledgePoints(
    text: string,
    streamCallback: (text: string) => void
  ) {
    let knowledgePoints = "";
    const { textStream: knowledgeStream } = await streamText({
      model: this.openai("meta-llama/Llama-3.3-70B-Instruct"),
      messages: [
        {
          role: "system",
          content:
            "You are a professional blockchain consultant with extensive knowledge of everything related to Sui Blockchain. When someone asks a question, you need to determine how the question relates to Sui, identify the relevant knowledge points needed to answer the question, and list them as a text string. You should prioritize information that is specifically related to Sui.",
        },
        {
          role: "user",
          content: text,
        },
      ],
    });

    for await (const chunk of knowledgeStream) {
      knowledgePoints += chunk;
      streamCallback(chunk);
    }

    return knowledgePoints;
  }

  private async getSearchResults(knowledgePoints: string) {
    const embedding = await this.getEmbedding(knowledgePoints);
    const qdrantClient = new QdrantClient({
      url: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_API_KEY,
    });

    return (
      await qdrantClient.search(
        process.env.QDRANT_SCRAPED_COLLECTION_NAME || "",
        {
          vector: {
            name: "content",
            vector: embedding,
          },
          limit: 7,
          filter: {
            should: [
              {
                key: "duplicated",
                match: {
                  value: false,
                },
              },
            ],
          },
        }
      )
    ).map((result) => ({
      url: result.payload?.url,
      score: result.score,
      content: result.payload?.content,
      title: result.payload?.title || "No title",
    }));
  }

  private async streamFinalResponse(
    text: string,
    searchResults: any[],
    streamCallback: (text: string) => void
  ) {
    const { textStream } = await streamText({
      model: this.openai("deepseek-ai/DeepSeek-R1"),
      messages: [
        {
          role: "system",
          content:
            "You are a professional blockchain consultant with extensive knowledge of everything related to Sui Blockchain. When you reply, you should include the url as markdown link.  Output should be in the form of a twitter tweet, do not use any markdown for bold or italic text like **, *. Do not use url like [url_name](url), just use the url directly, and can include emojis. Instead of using # as title or **title** as title, use the title directly with emoji like {emoji} {title}. There is no length restrictions, your output can be very long up to 25000 characters, with several paragraphs. Use three line breaks to separate paragraphs.",
        },
        {
          role: "system",
          content:
            "Here are some relevant search results about the user's question: " +
            JSON.stringify(
              searchResults.map((result) => ({
                url: result.url,
                content: result.content,
              }))
            ),
        },
        { role: "user", content: text },
      ],
    });

    for await (const textPart of textStream) {
      streamCallback(textPart);
    }
  }
}
