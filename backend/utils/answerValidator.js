/**
 * Normalize an answer for case-insensitive comparison.
 * Trims whitespace, lowercases, collapses internal spaces,
 * and strips common MCQ prefixes like "Option A" or "A)".
 */
const normalizeAnswer = (answer) => {
  if (!answer) return '';
  return String(answer)
    .trim()
    .toLowerCase()
    .replace(/^(option\s*|choice\s*)/i, '')
    .replace(/^([a-d])[\).\s-]+/i, '$1')
    .replace(/\s+/g, ' ');
};

/**
 * Validate an answer against correct answer and accepted_answers list.
 * @param {string} submittedAnswer - Raw answer from participant
 * @param {string} correctAnswer - The correct answer
 * @param {string[]} acceptedAnswers - Array of accepted alternate answers
 * @returns {boolean}
 */
const validateAnswer = (submittedAnswer, correctAnswer, acceptedAnswers = []) => {
  const normalized = normalizeAnswer(submittedAnswer);
  if (!normalized) return false;

  const correctNorm = normalizeAnswer(correctAnswer);
  if (normalized === correctNorm) return true;

  return acceptedAnswers.some((accepted) => normalizeAnswer(accepted) === normalized);
};

module.exports = { normalizeAnswer, validateAnswer };
