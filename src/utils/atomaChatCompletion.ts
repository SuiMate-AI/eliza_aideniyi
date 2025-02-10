interface ChatMessage {
  role: string;
  content: string;
}

interface AtomaResponse {
  choices: {
    finish_reason: string;
    index: number;
    logprobs: any;
    message: {
      content: string;
      name: string;
      role: string;
    };
  }[];
  created: number;
  id: string;
  model: string;
  system_fingerprint: string;
  usage: null;
}

export async function atomaChatCompletion(messages: ChatMessage[]): Promise<{
  text: string;
  model: string;
  created: number;
  id: string;
  system_fingerprint: string;
  usage: null;
  input_messages: ChatMessage[];
  output_text: string;
}> {
  const options = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.ATOMA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: messages,
      model: "meta-llama/Llama-3.3-70B-Instruct",
    }),
  };
  let data: AtomaResponse;
  try {
    const response = await fetch(
      "https://api.atoma.network/v1/chat/completions",
      options
    );
    data = (await response.json()) as AtomaResponse;
    return {
      text: data.choices[0].message.content,
      model: data.model,
      created: data.created,
      id: data.id,
      system_fingerprint: data.system_fingerprint,
      usage: data.usage,
      input_messages: messages,
      output_text: data.choices[0].message.content,
    };
  } catch (err) {
    console.error(
      "Error getting Atoma fingerprint:",
      err,
      JSON.stringify(data, null, 2)
    );
    throw err;
  }
}
