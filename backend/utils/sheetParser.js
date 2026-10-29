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
    // Difficulty: introduction | beginner | intermediate | advanced
    const VALID_DIFFICULTIES = ['introduction', 'beginner', 'intermediate', 'advanced'];
    const userDiff = String(row.difficulty || row.level || '').trim().toLowerCase();
    let difficulty = 'beginner';

    if (VALID_DIFFICULTIES.includes(userDiff)) {
      difficulty = userDiff;
    } else {
      // Smart infer: points or position
      const p = parseInt(row.points);
      const cat = String(row.category || '').toLowerCase();
      const qText = String(row.question || '').toLowerCase();

      if (p === 0 || /intro/i.test(cat) || /intro|welcome/i.test(qText)) {
        difficulty = 'introduction';
      } else if (p >= 20 || /advanced|hard/i.test(cat)) {
        difficulty = 'advanced';
      } else if (p === 15 || /intermediate|medium/i.test(cat)) {
        difficulty = 'intermediate';
      } else if (roundNumber >= 8) {
        difficulty = 'advanced';
      } else if (roundNumber >= 5) {
        difficulty = 'intermediate';
      } else if (roundNumber === 1 && p === 0) {
        difficulty = 'introduction';
      } else {
        difficulty = 'beginner';
      }
    }

    // Points logic aligned with difficulty tiers
    const rawPoints = parseInt(row.points);
    let points = isNaN(rawPoints)
      ? (difficulty === 'introduction' ? 0 : difficulty === 'intermediate' ? 15 : difficulty === 'advanced' ? 20 : 10)
      : rawPoints;
    if (difficulty === 'introduction') points = 0;
    const timeLimitSeconds = parseInt(row.time_limit_seconds) || 20;
    const category = String(row.category || 'General').trim();

    const questionImage = String(
      row.question_image || row.question_img || row.image_url || row.image || row.img || ''
    ).trim();

    // Check for 4 options (support both text and image URLs, or combined columns)
    const buildOption = (text, img) => {
      const t = String(text || '').trim();
      const i = String(img || '').trim();
      if (t && i && t !== i) {
        return `${t} | ${i}`;
      }
      return t || i || '';
    };

    let options = [];
    const optA = buildOption(
      row.option_a || row.option_1 || row.a,
      row.option_a_image || row.option_a_img || row.option_1_image
    );
    const optB = buildOption(
      row.option_b || row.option_2 || row.b,
      row.option_b_image || row.option_b_img || row.option_2_image
    );
    const optC = buildOption(
      row.option_c || row.option_3 || row.c,
      row.option_c_image || row.option_c_img || row.option_3_image
    );
    const optD = buildOption(
      row.option_d || row.option_4 || row.d,
      row.option_d_image || row.option_d_img || row.option_4_image
    );

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
      const cleanLetter = correctAnswer.toLowerCase().replace(/^(option\s*|choice\s*)/i, '').trim();
      const letterIndex = { a: 0, b: 1, c: 2, d: 3 }[cleanLetter];
      const letters = ['A', 'B', 'C', 'D'];

      if (letterIndex !== undefined && options[letterIndex]) {
        acceptedAnswers.push(letters[letterIndex]);
        acceptedAnswers.push(options[letterIndex]);
        // If option contains pipe (text | image), also accept the text and image parts
        if (options[letterIndex].includes('|')) {
          const parts = options[letterIndex].split('|').map((s) => s.trim());
          parts.forEach((p) => {
            if (p) acceptedAnswers.push(p);
          });
        }
      }

      // Also if correctAnswer matches option text or part
      options.forEach((opt, idx) => {
        const parts = opt.split('|').map((s) => s.trim().toLowerCase());
        if (opt.toLowerCase() === correctAnswer.toLowerCase() || parts.includes(correctAnswer.toLowerCase())) {
          acceptedAnswers.push(letters[idx]);
          acceptedAnswers.push(opt);
          parts.forEach((p) => acceptedAnswers.push(p));
        }
      });
    }

    questions.push({
      roundNumber,
      questionText,
      questionImage,
      options,
      questionType,
      correctAnswer,
      acceptedAnswers,
      difficulty,
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
