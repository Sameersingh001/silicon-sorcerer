const XLSX = require('xlsx');

const REQUIRED_COLUMNS = [
  'round_number',
  'question',
  'correct_answer',
];

/**
 * Parse and validate an Excel or CSV file buffer.
 * Supports: round_number, question, option_a, option_b, option_c, option_d,
 * correct_answer, accepted_answers, points, time_limit_seconds, category
 * Returns { questions, errors }
 */
const parseQuestionSheet = (buffer, mimetype) => {
  const errors = [];
  const questions = [];

  let workbook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer' });
  } catch {
    return { questions: [], errors: ['Unable to parse file. Make sure it is a valid .xlsx, .xls, or .csv file.'] };
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (!rows.length) {
    return { questions: [], errors: ['The spreadsheet is empty.'] };
  }

  // Normalize all row object keys (lowercase, trim, replace spaces with underscores)
  const normalizedRows = rows.map((rawRow) => {
    const norm = {};
    for (const [k, v] of Object.entries(rawRow)) {
      norm[k.trim().toLowerCase().replace(/\s+/g, '_')] = v;
    }
    return norm;
  });

  // Check required columns
  const headers = Object.keys(normalizedRows[0] || {});
  const missingCols = REQUIRED_COLUMNS.filter((col) => !headers.includes(col));
  if (missingCols.length) {
    return {
      questions: [],
      errors: [`Missing required columns: ${missingCols.join(', ')}`],
    };
  }

  const seenRounds = new Set();

  normalizedRows.forEach((row, idx) => {
    const rowNum = idx + 2; // 1-indexed with header
    const rowErrors = [];

    const roundNumber = parseInt(row.round_number);
    const questionText = String(row.question || '').trim();
    const correctAnswer = String(row.correct_answer || '').trim();
    const acceptedRaw = String(row.accepted_answers || '').trim();
    const points = parseInt(row.points) || 10;
    const timeLimitSeconds = parseInt(row.time_limit_seconds) || 20;
    const category = String(row.category || 'General').trim();

    // Check for 4 options
    let options = [];
    const optA = String(row.option_a || row.option_1 || row.a || '').trim();
    const optB = String(row.option_b || row.option_2 || row.b || '').trim();
    const optC = String(row.option_c || row.option_3 || row.c || '').trim();
    const optD = String(row.option_d || row.option_4 || row.d || '').trim();

    if (optA || optB || optC || optD) {
      options = [optA, optB, optC, optD].filter(Boolean);
    } else if (row.options) {
      options = String(row.options)
        .split(/[;,]/)
        .map((o) => o.trim())
        .filter(Boolean);
    }

    const questionType = options.length >= 2 ? 'mcq' : 'text';

    if (!roundNumber || isNaN(roundNumber) || roundNumber < 1) {
      rowErrors.push(`Row ${rowNum}: Invalid or missing round_number.`);
    }
    if (!questionText) {
      rowErrors.push(`Row ${rowNum}: Missing question text.`);
    }
    if (!correctAnswer) {
      rowErrors.push(`Row ${rowNum}: Missing correct_answer.`);
    }
    if (seenRounds.has(roundNumber)) {
      rowErrors.push(`Row ${rowNum}: Duplicate round_number ${roundNumber}.`);
    }

    if (rowErrors.length) {
      errors.push(...rowErrors);
      return;
    }

    seenRounds.add(roundNumber);

    // Parse accepted_answers by semicolons
    const acceptedAnswers = acceptedRaw
      ? acceptedRaw.split(';').map((a) => a.trim()).filter(Boolean)
      : [];

    // If MCQ and correctAnswer is an option letter (e.g. "A", "B", "C", "D"),
    // add both the letter and the corresponding option text to accepted answers
    if (questionType === 'mcq' && options.length > 0) {
      const letterIndex = { a: 0, b: 1, c: 2, d: 3 }[correctAnswer.toLowerCase()];
      if (letterIndex !== undefined && options[letterIndex]) {
        acceptedAnswers.push(options[letterIndex]);
      }
      // Also if correctAnswer is option text, add the letter (A, B, C, D)
      const matchedIdx = options.findIndex((opt) => opt.toLowerCase() === correctAnswer.toLowerCase());
      if (matchedIdx !== -1) {
        const letters = ['A', 'B', 'C', 'D'];
        acceptedAnswers.push(letters[matchedIdx]);
      }
    }

    questions.push({
      roundNumber,
      questionText,
      options,
      questionType,
      correctAnswer,
      acceptedAnswers,
      points,
      timeLimitSeconds,
      category,
    });
  });

  // Sort by round number
  questions.sort((a, b) => a.roundNumber - b.roundNumber);

  return { questions, errors };
};

module.exports = { parseQuestionSheet, REQUIRED_COLUMNS };
