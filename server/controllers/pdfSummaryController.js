import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { 
  processPDFAndSummarize, 
  extractTextFromPDFFile, 
  generateSummary,
  saveTextToFile 
} from '../services/pdfSummaryService.js';

// Configure multer for PDF uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = './uploads/temp';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `pdf-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

/**
 * Upload PDF and generate summary
 */
export const uploadAndSummarizePDF = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No PDF file uploaded' });
    }

    const { 
      max_length = 800, 
      min_length = 400,
      save_text = false,
      use_academic_model = false,
      detailed = true,
      academic_format = true
    } = req.body;

    console.log('Processing PDF:', req.file.filename);

    // Process PDF and generate summary
    const result = await processPDFAndSummarize(req.file.path, {
      max_length: parseInt(max_length),
      min_length: parseInt(min_length),
      use_academic_model: use_academic_model === 'true' || use_academic_model === true,
      detailed: detailed === 'true' || detailed === true,
      academic_format: academic_format === 'true' || academic_format === true
    });

    // Save extracted text to file if requested
    let textFilePath = null;
    if (save_text === 'true' || save_text === true) {
      const textFilename = `${path.parse(req.file.filename).name}.txt`;
      textFilePath = await saveTextToFile(
        result.extractedText, 
        textFilename,
        './uploads/extracted-text'
      );
    }

    // Clean up temporary PDF file
    try {
      fs.unlinkSync(req.file.path);
    } catch (cleanupError) {
      console.warn('Could not delete temporary file:', cleanupError);
    }

    res.json({
      success: true,
      data: {
        originalFilename: req.file.originalname,
        summary: result.summary,
        extractedText: result.extractedText, // Always return extracted text for suggestions
        textFilePath,
        stats: {
          textLength: result.textLength,
          summaryLength: result.summaryLength,
          compressionRatio: (result.summaryLength / result.textLength * 100).toFixed(2) + '%'
        }
      }
    });

  } catch (error) {
    console.error('Error in uploadAndSummarizePDF:', error);

    // Clean up temporary file on error
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.warn('Could not delete temporary file after error:', cleanupError);
      }
    }

    res.status(500).json({ 
      success: false,
      message: error.message || 'Failed to process PDF'
    });
  }
};

/**
 * Summarize existing thesis/paper file
 */
export const summarizeExistingFile = async (req, res) => {
  try {
    const { filePath, max_length = 800, min_length = 400, use_academic_model = false, detailed = true, academic_format = true } = req.body;

    if (!filePath) {
      return res.status(400).json({ message: 'File path is required' });
    }

    // Construct full path
    const fullPath = path.join('./uploads', filePath);
    
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ message: 'File not found' });
    }

    console.log('Summarizing existing file:', fullPath);

    const result = await processPDFAndSummarize(fullPath, {
      max_length: parseInt(max_length),
      min_length: parseInt(min_length),
      use_academic_model,
      detailed,
      academic_format
    });

    res.json({
      success: true,
      data: {
        filePath,
        summary: result.summary,
        extractedText: result.extractedText, // Always return extracted text for suggestions
        stats: {
          textLength: result.textLength,
          summaryLength: result.summaryLength,
          compressionRatio: (result.summaryLength / result.textLength * 100).toFixed(2) + '%'
        }
      }
    });

  } catch (error) {
    console.error('Error in summarizeExistingFile:', error);
    res.status(500).json({ 
      success: false,
      message: error.message || 'Failed to summarize file'
    });
  }
};

/**
 * Extract text from PDF without summarization
 */
export const extractTextOnly = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No PDF file uploaded' });
    }

    console.log('Extracting text from PDF:', req.file.filename);

    const extractedText = await extractTextFromPDFFile(req.file.path);

    // Save extracted text to file
    const textFilename = `${path.parse(req.file.filename).name}.txt`;
    const textFilePath = await saveTextToFile(
      extractedText, 
      textFilename,
      './uploads/extracted-text'
    );

    // Clean up temporary PDF file
    try {
      fs.unlinkSync(req.file.path);
    } catch (cleanupError) {
      console.warn('Could not delete temporary file:', cleanupError);
    }

    res.json({
      success: true,
      data: {
        originalFilename: req.file.originalname,
        extractedText,
        textFilePath,
        textLength: extractedText.length
      }
    });

  } catch (error) {
    console.error('Error in extractTextOnly:', error);

    // Clean up temporary file on error
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.warn('Could not delete temporary file after error:', cleanupError);
      }
    }

    res.status(500).json({ 
      success: false,
      message: error.message || 'Failed to extract text from PDF'
    });
  }
};

/**
 * Generate summary from provided text
 */
export const summarizeText = async (req, res) => {
  try {
    const { text, max_length = 800, min_length = 400, use_academic_model = false, detailed = true, academic_format = true } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ message: 'Text is required' });
    }

    console.log('Generating summary for provided text');

    const summary = await generateSummary(text, {
      max_length: parseInt(max_length),
      min_length: parseInt(min_length),
      use_academic_model,
      detailed,
      academic_format
    });

    res.json({
      success: true,
      data: {
        summary,
        stats: {
          textLength: text.length,
          summaryLength: summary.length,
          compressionRatio: (summary.length / text.length * 100).toFixed(2) + '%'
        }
      }
    });

  } catch (error) {
    console.error('Error in summarizeText:', error);
    res.status(500).json({ 
      success: false,
      message: error.message || 'Failed to generate summary'
    });
  }
};

/**
 * Generate suggestions for improving paper quality
 */
export const generateSuggestions = async (req, res) => {
  try {
    const { text, filePath } = req.body;
    
    if (!text && !filePath) {
      return res.status(400).json({ 
        success: false, 
        message: 'Either text or filePath must be provided' 
      });
    }
    
    let extractedText = text;
    
    // If filePath is provided, extract text from the file
    if (filePath && !text) {
      try {
        extractedText = await extractTextFromPDFFile(filePath);
      } catch (extractError) {
        return res.status(400).json({ 
          success: false, 
          message: 'Failed to extract text from file' 
        });
      }
    }
    
    if (!extractedText || extractedText.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No text content found to analyze' 
      });
    }
    
    // Import the suggestions function
    const { generatePaperSuggestions } = await import('../services/pdfSummaryService.js');
    
    // Generate suggestions
    const suggestions = await generatePaperSuggestions(extractedText);
    
    res.json({
      success: true,
      data: {
        suggestions: suggestions.suggestions,
        analysis: suggestions.analysis,
        model: suggestions.model,
        timestamp: suggestions.timestamp,
        error: suggestions.error
      }
    });
    
  } catch (error) {
    console.error('Error generating suggestions:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to generate suggestions. Please try again.' 
    });
  }
};

/**
 * Generate suggestions directly from uploaded PDF file
 */
export const generateSuggestionsFromUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No PDF file uploaded' 
      });
    }

    console.log('Generating suggestions from uploaded PDF:', req.file.filename);

    // Extract text from the uploaded PDF
    const extractedText = await extractTextFromPDFFile(req.file.path);
    
    if (!extractedText || extractedText.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No text content found in the PDF' 
      });
    }

    // Import the suggestions function
    const { generatePaperSuggestions } = await import('../services/pdfSummaryService.js');
    
    // Generate suggestions
    const suggestions = await generatePaperSuggestions(extractedText);
    
    // Clean up temporary PDF file
    try {
      fs.unlinkSync(req.file.path);
    } catch (cleanupError) {
      console.warn('Could not delete temporary file:', cleanupError);
    }

    res.json({
      success: true,
      data: {
        suggestions: suggestions.suggestions,
        analysis: suggestions.analysis,
        model: suggestions.model,
        timestamp: suggestions.timestamp,
        error: suggestions.error
      }
    });
    
  } catch (error) {
    console.error('Error generating suggestions from upload:', error);
    
    // Clean up temporary file on error
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.warn('Could not delete temporary file after error:', cleanupError);
      }
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Failed to generate suggestions. Please try again.' 
    });
  }
};

/**
 * Test Hugging Face API connection
 */
export const testHuggingFaceAPI = async (req, res) => {
  try {
    // Import Hugging Face inference dynamically
    const { HfInference } = await import('@huggingface/inference');
    
    // Initialize Hugging Face inference
    const hf = new HfInference(process.env.HF_TOKEN);
    
    console.log('Testing Hugging Face API with token:', process.env.HF_TOKEN ? 'Token exists' : 'No token');
    
    // Try a simple text generation test
    const response = await hf.textGeneration({
      model: 'microsoft/DialoGPT-medium',
      inputs: 'Hello, this is a test.',
      parameters: {
        max_new_tokens: 10,
        temperature: 0.7,
        do_sample: true,
        return_full_text: false
      }
    });
    
    console.log('Hugging Face API test successful:', response);
    
    res.json({
      success: true,
      message: 'Hugging Face API is working',
      model: 'microsoft/DialoGPT-medium',
      testResponse: response.generated_text,
      tokenStatus: process.env.HF_TOKEN ? 'Token configured' : 'No token found'
    });
    
  } catch (error) {
    console.error('Hugging Face API test failed:', error);
    
    res.status(500).json({ 
      success: false, 
      message: 'Hugging Face API test failed',
      error: error.message,
      tokenStatus: process.env.HF_TOKEN ? 'Token configured' : 'No token found',
      suggestion: 'Check your HF_TOKEN in .env file and ensure it has proper permissions'
    });
  }
};
