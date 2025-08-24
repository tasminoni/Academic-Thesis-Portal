import express from 'express';
import { auth } from '../middleware/auth.js';
import {
  upload,
  uploadAndSummarizePDF,
  summarizeExistingFile,
  extractTextOnly,
  summarizeText,
  generateSuggestions,
  generateSuggestionsFromUpload,
  testHuggingFaceAPI
} from '../controllers/pdfSummaryController.js';

const router = express.Router();

// Upload PDF and generate summary
router.post('/upload-and-summarize', auth, upload.single('pdf'), uploadAndSummarizePDF);

// Extract text only from uploaded PDF
router.post('/extract-text', auth, upload.single('pdf'), extractTextOnly);

// Summarize existing file (thesis/paper)
router.post('/summarize-file', auth, summarizeExistingFile);

// Generate summary from provided text
router.post('/summarize-text', auth, summarizeText);

// Generate suggestions for improving paper quality
router.post('/generate-suggestions', auth, generateSuggestions);

// Generate suggestions directly from uploaded PDF file
router.post('/generate-suggestions-upload', auth, upload.single('pdf'), generateSuggestionsFromUpload);

// Test Hugging Face API connection
router.get('/test-hf-api', auth, testHuggingFaceAPI);

export default router;
