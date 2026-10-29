const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const Question = require('../models/Question');
const Event = require('../models/Event');
const { authMiddleware } = require('../middleware/auth');
const { parseQuestionSheet } = require('../utils/sheetParser');
const { getOrCreateEvent } = require('./event');

const router = express.Router();

// Multer memory storage (we process buffer directly)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/csv',
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls|csv)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel (.xlsx, .xls) or CSV files are allowed'));
    }
  },
});

// POST /api/questions/upload - Admin uploads question sheet
router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const { questions, errors } = parseQuestionSheet(req.file.buffer, req.file.mimetype);

    if (errors.length && !questions.length) {
      return res.status(400).json({ success: false, errors, message: 'File validation failed' });
    }

    const event = await getOrCreateEvent();

    if (event.status !== 'draft' && event.status !== 'ready') {
      return res.status(400).json({
        success: false,
        message: 'Cannot upload questions while game is live or completed',
      });
    }

    // Replace existing questions
    await Question.deleteMany({ eventId: event._id });

    const questionDocs = questions.map((q) => ({ ...q, eventId: event._id }));
    await Question.insertMany(questionDocs);

    event.totalRounds = questions.length;
    event.status = 'ready';
    event.currentRoundNumber = 0;
    await event.save();

    res.json({
      success: true,
      message: `${questions.length} questions imported successfully`,
      count: questions.length,
      warnings: errors,
      preview: questions.slice(0, 5),
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, message: error.message || 'Upload failed' });
  }
});

// GET /api/questions - Get all questions (answers hidden for security & clean flow)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const event = await getOrCreateEvent();
    const questions = await Question.find({ eventId: event._id })
      .select('-correctAnswer -acceptedAnswers')
      .sort({ roundNumber: 1 });
    res.json({ success: true, questions });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PATCH /api/questions/:id/difficulty - Update difficulty of a question
router.patch('/:id/difficulty', authMiddleware, async (req, res) => {
  try {
    const { difficulty } = req.body;
    const valid = ['introduction', 'beginner', 'intermediate', 'advanced'];
    if (!valid.includes(difficulty)) {
      return res.status(400).json({ success: false, message: 'Invalid difficulty level' });
    }

    const question = await Question.findById(req.params.id);
    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }

    question.difficulty = difficulty;
    if (difficulty === 'introduction') {
      question.points = 0;
    } else if (!question.points || question.points === 0) {
      question.points = difficulty === 'intermediate' ? 15 : (difficulty === 'advanced' ? 20 : 10);
    }
    await question.save();

    // Check if this question is currently active in the event
    const event = await getOrCreateEvent();
    if (event.currentQuestionId && event.currentQuestionId.toString() === question._id.toString()) {
      const { updateActiveRoundDifficulty } = require('../utils/submissionEngine');
      updateActiveRoundDifficulty(difficulty, question.points);
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('question:difficulty_updated', {
        questionId: question._id,
        roundNumber: question.roundNumber,
        difficulty: question.difficulty,
        points: question.points,
      });
    }

    res.json({
      success: true,
      message: `Difficulty updated to ${difficulty}`,
      question,
    });
  } catch (error) {
    console.error('Update difficulty error:', error);
    res.status(500).json({ success: false, message: 'Failed to update difficulty' });
  }
});

// GET /api/questions/template - Download sample template with difficulty levels
router.get('/template', (req, res) => {
  const sampleData = [
    {
      round_number: 1,
      difficulty: 'introduction',
      question: 'What does CPU stand for?',
      question_image: '',
      option_a: 'Central Processing Unit',
      option_b: 'Computer Personal Unit',
      option_c: 'Central Power Unit',
      option_d: 'Core Processing Unit',
      correct_answer: 'A',
      points: 0,
      time_limit_seconds: 30,
      category: 'Introduction',
    },
    {
      round_number: 2,
      difficulty: 'beginner',
      question: 'Which protocol is used to secure browsing on the World Wide Web?',
      question_image: '',
      option_a: 'HTTP',
      option_b: 'HTTPS',
      option_c: 'FTP',
      option_d: 'SSH',
      correct_answer: 'HTTPS',
      points: 10,
      time_limit_seconds: 20,
      category: 'Cyber Security',
    },
    {
      round_number: 3,
      difficulty: 'beginner',
      question: 'Identify the logo of the popular programming language shown below:',
      question_image: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&auto=format&fit=crop&q=80',
      option_a: 'Python',
      option_b: 'Java',
      option_c: 'JavaScript',
      option_d: 'C++',
      correct_answer: 'Python',
      points: 10,
      time_limit_seconds: 20,
      category: 'Programming',
    },
    {
      round_number: 4,
      difficulty: 'intermediate',
      question: 'Which of the following is the official mascot or logo of Linux?',
      question_image: '',
      option_a: 'https://upload.wikimedia.org/wikipedia/commons/3/35/Tux.svg',
      option_b: 'https://upload.wikimedia.org/wikipedia/commons/d/d9/Node.js_logo.svg',
      option_c: 'https://upload.wikimedia.org/wikipedia/commons/a/a7/React-icon.svg',
      option_d: 'https://upload.wikimedia.org/wikipedia/commons/0/05/Ethereum_logo_2014.svg',
      correct_answer: 'A',
      points: 15,
      time_limit_seconds: 20,
      category: 'Operating Systems',
    },
    {
      round_number: 5,
      difficulty: 'advanced',
      question: 'What is the binary representation of the decimal number 10?',
      question_image: '',
      option_a: '1001',
      option_b: '1010',
      option_c: '1100',
      option_d: '1110',
      correct_answer: '1010',
      points: 20,
      time_limit_seconds: 20,
      category: 'Computer Science',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Questions');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Disposition', 'attachment; filename=silicon-sorcerer-mcq-template.xlsx');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});

module.exports = router;
