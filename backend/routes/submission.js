const express = require('express');
const { processAnswerSubmission } = require('../utils/submissionEngine');

const router = express.Router();

// POST /api/submissions - Submit answer (ultra-fast processing for high concurrency)
router.post('/', async (req, res) => {
  try {
    const { sessionToken, submittedAnswer } = req.body;
    const io = req.app.get('io');

    const result = await processAnswerSubmission({
      sessionToken,
      submittedAnswer,
      io,
    });

    return res.status(result.status || 200).json(result);
  } catch (error) {
    console.error('Submission error:', error);
    return res.status(500).json({ success: false, message: 'Submission failed. Please try again.' });
  }
});

module.exports = router;
