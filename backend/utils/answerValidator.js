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

  // Check if correctAnswer has pipe (e.g., text | url)
  if (correctAnswer && String(correctAnswer).includes('|')) {
    const parts = String(correctAnswer).split('|').map((p) => normalizeAnswer(p));
    if (parts.includes(normalized)) return true;
  }

  return acceptedAnswers.some((accepted) => {
    const normAccepted = normalizeAnswer(accepted);
    if (normAccepted === normalized) return true;
    if (accepted && String(accepted).includes('|')) {
      const parts = String(accepted).split('|').map((p) => normalizeAnswer(p));
      return parts.includes(normalized);
    }
    return false;
  });
};

module.exports = { normalizeAnswer, validateAnswer };
