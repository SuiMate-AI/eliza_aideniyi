export interface Question {
  question: string;
  type: string;
  example_answer_1: string;
  example_answer_2: string;
  example_answer_3: string;
  incorrect_answer_1: string;
  incorrect_answer_1_reason: string;
  incorrect_answer_2: string;
  incorrect_answer_2_reason: string;
  incorrect_answer_3: string;
  incorrect_answer_3_reason: string;
  context: string;
  difficulty: number;
}

export const parseQuestionRow = (row: any): Question => {
  return {
    question: row.question || "",
    type: row.type || "",
    example_answer_1: row.example_answer_1 || "",
    example_answer_2: row.example_answer_2 || "",
    example_answer_3: row.example_answer_3 || "",
    incorrect_answer_1: row.incorrect_answer_1 || "",
    incorrect_answer_1_reason: row.incorrect_answer_1_reason || "",
    incorrect_answer_2: row.incorrect_answer_2 || "",
    incorrect_answer_2_reason: row.incorrect_answer_2_reason || "",
    incorrect_answer_3: row.incorrect_answer_3 || "",
    incorrect_answer_3_reason: row.incorrect_answer_3_reason || "",
    context: row.context || "",
    difficulty: Number(row.difficulty) || 1,
  };
};

export const validateQuestion = (question: Question): boolean => {
  return (
    question.question !== "" &&
    question.type !== "" &&
    question.example_answer_1 !== "" &&
    question.example_answer_2 !== "" &&
    question.example_answer_3 !== "" &&
    question.incorrect_answer_1 !== "" &&
    question.incorrect_answer_1_reason !== "" &&
    question.incorrect_answer_2 !== "" &&
    question.incorrect_answer_2_reason !== "" &&
    question.incorrect_answer_3 !== "" &&
    question.incorrect_answer_3_reason !== "" &&
    question.context !== "" &&
    question.difficulty >= 1 &&
    question.difficulty <= 5
  );
};
