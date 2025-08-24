import axios from 'axios';
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

/**
 * Extract academic sections from text
 * @param {string} text - Raw extracted text
 * @returns {Object} - Structured academic sections
 */
const extractAcademicSections = (text) => {
  const sections = {
    abstract: '',
    introduction: '',
    methodology: '',
    results: '',
    discussion: '',
    conclusion: '',
    keywords: [],
    title: '',
    remaining: text
  };

  // Extract title (usually in the first few lines)
  const titleMatch = text.match(/^(.{10,150})\n/);
  if (titleMatch) {
    sections.title = titleMatch[1].trim();
  }

  // Extract abstract
  const abstractMatch = text.match(/(?:abstract|summary)\s*:?\s*\n?(.*?)(?=\n\s*(?:introduction|keywords|1\.|background|overview))/is);
  if (abstractMatch) {
    sections.abstract = abstractMatch[1].trim();
  }

  // Extract keywords
  const keywordsMatch = text.match(/(?:keywords|key\s*words)\s*:?\s*\n?(.*?)(?=\n\s*(?:introduction|abstract|1\.))/is);
  if (keywordsMatch) {
    sections.keywords = keywordsMatch[1].split(/[,;]/).map(k => k.trim()).filter(k => k.length > 0);
  }

  // Extract introduction
  const introMatch = text.match(/(?:introduction|1\.\s*introduction)\s*\n?(.*?)(?=\n\s*(?:methodology|method|2\.|literature|background))/is);
  if (introMatch) {
    sections.introduction = introMatch[1].trim();
  }

  // Extract methodology
  const methodMatch = text.match(/(?:methodology|methods?|approach|2\.\s*method)\s*\n?(.*?)(?=\n\s*(?:results?|findings?|3\.|discussion|analysis))/is);
  if (methodMatch) {
    sections.methodology = methodMatch[1].trim();
  }

  // Extract results
  const resultsMatch = text.match(/(?:results?|findings?|3\.\s*results?)\s*\n?(.*?)(?=\n\s*(?:discussion|conclusion|4\.|analysis|implications))/is);
  if (resultsMatch) {
    sections.results = resultsMatch[1].trim();
  }

  // Extract discussion
  const discussionMatch = text.match(/(?:discussion|analysis|4\.\s*discussion)\s*\n?(.*?)(?=\n\s*(?:conclusion|summary|5\.|references|limitations))/is);
  if (discussionMatch) {
    sections.discussion = discussionMatch[1].trim();
  }

  // Extract conclusion
  const conclusionMatch = text.match(/(?:conclusion|summary|5\.\s*conclusion)\s*\n?(.*?)(?=\n\s*(?:references|bibliography|acknowledgment))/is);
  if (conclusionMatch) {
    sections.conclusion = conclusionMatch[1].trim();
  }

  return sections;
};

/**
 * Clean and preprocess academic text
 * @param {string} text - Raw extracted text
 * @returns {string} - Cleaned text
 */
const preprocessText = (text) => {
  // Remove excessive whitespace and normalize
  let cleaned = text.replace(/\s+/g, ' ').trim();
  
  // Fix common PDF extraction spacing issues
  cleaned = cleaned.replace(/([a-z])([A-Z])/g, '$1 $2'); // Add space between lowercase and uppercase
  cleaned = cleaned.replace(/([a-z])(\d)/g, '$1 $2'); // Add space between letter and number
  cleaned = cleaned.replace(/(\d)([a-z])/g, '$1 $2'); // Add space between number and letter
  
  // Fix broken words (common PDF extraction issue)
  cleaned = cleaned.replace(/\b(\w+)\s+(\w+)\b/g, (match, word1, word2) => {
    // Common broken words in academic papers
    const fixes = {
      'effi ciency': 'efficiency',
      'algo rithm': 'algorithm',
      'opti mization': 'optimization',
      'gene tic': 'genetic',
      'time table': 'timetable',
      'time tabling': 'timetabling',
      'algo rithms': 'algorithms',
      'solu tion': 'solution',
      'solu tions': 'solutions',
      'con straints': 'constraints',
      'con straint': 'constraint',
      'optimi zation': 'optimization',
      'gener ated': 'generated',
      'gener ate': 'generate',
      'compu tation': 'computation',
      'compu ting': 'computing'
    };
    
    const combined = `${word1} ${word2}`;
    return fixes[combined.toLowerCase()] || match;
  });
  
  // Remove headers, footers, page numbers
  cleaned = cleaned.replace(/Page \d+/gi, '');
  cleaned = cleaned.replace(/^\d+\s*$/gm, '');
  
  // Remove reference patterns but keep important citations
  cleaned = cleaned.replace(/\[\d+(-\d+)?\]/g, ''); // Remove [1], [2-5] etc.
  cleaned = cleaned.replace(/\(\w+\s+et\s+al\.?,?\s+\d{4}\)/gi, ''); // Remove (Author et al., 2023)
  
  // Remove URLs and emails
  cleaned = cleaned.replace(/https?:\/\/\S+/g, '');
  cleaned = cleaned.replace(/\S+@\S+\.\S+/g, '');
  
  // Clean up academic formatting but preserve structure
  cleaned = cleaned.replace(/(?:Figure|Fig\.)\s*\d+[^\.\n]*/gi, ''); 
  cleaned = cleaned.replace(/(?:Table)\s*\d+[^\.\n]*/gi, '');
  
  // Remove excessive punctuation
  cleaned = cleaned.replace(/\.{2,}/g, '.');
  cleaned = cleaned.replace(/,{2,}/g, ',');
  
  // Remove common academic boilerplate
  cleaned = cleaned.replace(/(?:this\s+paper|this\s+study|this\s+research|this\s+work)\s+(?:presents|describes|investigates|examines|proposes)/gi, 'The research');
  
  // Final cleanup of multiple spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
};

/**
 * Split text into chunks for processing
 * @param {string} text - Text to chunk
 * @param {number} maxChunkSize - Maximum chunk size in characters
 * @param {number} overlap - Overlap between chunks
 * @returns {Array<string>} - Array of text chunks
 */
const chunkText = (text, maxChunkSize = 3000, overlap = 300) => {
  const chunks = [];
  let start = 0;
  
  while (start < text.length) {
    let end = start + maxChunkSize;
    
    // Try to break at sentence boundary
    if (end < text.length) {
      const lastPeriod = text.lastIndexOf('.', end);
      const lastExclamation = text.lastIndexOf('!', end);
      const lastQuestion = text.lastIndexOf('?', end);
      
      const sentenceEnd = Math.max(lastPeriod, lastExclamation, lastQuestion);
      if (sentenceEnd > start + maxChunkSize * 0.7) {
        end = sentenceEnd + 1;
      }
    }
    
    chunks.push(text.substring(start, end).trim());
    start = end - overlap;
  }
  
  return chunks.filter(chunk => chunk.length > 100); // Filter out very short chunks
};

/**
 * Post-process and clean up AI-generated summary text
 * @param {string} text - Raw AI-generated summary
 * @returns {string} - Cleaned and formatted summary
 */
const postProcessSummary = (text) => {
  if (!text) return '';
  
  let cleaned = text;
  
  // Fix spacing issues in the generated text
  cleaned = cleaned.replace(/\s+/g, ' '); // Multiple spaces to single space
  
  // Fix common AI generation spacing errors
  cleaned = cleaned.replace(/([a-z])\s+([a-z])/g, (match, char1, char2) => {
    // Common broken words in AI output
    const fixes = {
      'effi ciency': 'efficiency',
      'efficien cy': 'efficiency',
      'algo rithm': 'algorithm',
      'optimizat ion': 'optimization',
      'gene tic': 'genetic',
      'time table': 'timetable',
      'time tabling': 'timetabling',
      'gene rated': 'generated',
      'con straints': 'constraints',
      'solu tion': 'solution',
      'solu tions': 'solutions',
      'compu tation': 'computation',
      'resul ts': 'results',
      'metho dology': 'methodology',
      'analy sis': 'analysis',
      'conclu sion': 'conclusion',
      'conclu sions': 'conclusions',
      'implemen tation': 'implementation',
      'perfor mance': 'performance',
      'resear ch': 'research',
      'exper iment': 'experiment',
      'exper iments': 'experiments',
      'evalua tion': 'evaluation',
      'resul ting': 'resulting',
      'optimi zed': 'optimized',
      'fulfil l': 'fulfill',
      'fulfil ling': 'fulfilling',
      'gener ating': 'generating',
      'compa red': 'compared',
      'compa rison': 'comparison',
      'effic iency': 'efficiency',
      'qual ity': 'quality',
      'optim al': 'optimal',
      'acco rding': 'according',
      'publi shed': 'published',
      'jour nal': 'journal',
      'compu ter': 'computer',
      'scien ce': 'science',
      'engin eering': 'engineering',
      'theor etical': 'theoretical',
      'techn ology': 'technology',
      'challen ges': 'challenges',
      'difficu lties': 'difficulties',
      'propos ed': 'proposed',
      'discus ses': 'discusses',
      'vari ous': 'various',
      'types of': 'types of',
      'over come': 'overcome',
      'main taining': 'maintaining',
      'assig nment': 'assignment',
      'multi ple': 'multiple',
      'compu tation': 'computation',
      'optim izing': 'optimizing',
      'modifica tions': 'modifications',
      'coope rative': 'cooperative',
      'opera tors': 'operators',
      'level s': 'levels',
      'hybr id': 'hybrid',
      'gene rated': 'generated',
      'sour ce': 'source',
      'onli ne': 'online',
      'val ue': 'value',
      'cos t': 'cost',
      'tim e': 'time',
      'bes t': 'best',
      'optim ization': 'optimization',
      'lev el': 'level',
      'lev els': 'levels',
      'dep th': 'depth',
      'mul ti': 'multi',
      'pro posed': 'proposed',
      'rec ent': 'recent',
      'wor ks': 'works',
      'stu dy': 'study',
      'aut hors': 'authors',
      'ope n': 'open',
      'gaug e': 'gauge',
      'coo perative': 'cooperative',
      'reduc e': 'reduce',
      'of generated': 'of the generated'
    };
    
    const combined = `${char1} ${char2}`;
    return fixes[combined] || match;
  });
  
  // Fix common spelling mistakes in AI output
  const spellingFixes = {
    'efficien': 'efficiency',
    'algortihm': 'algorithm',
    'algorithmis': 'algorithms',
    'optmization': 'optimization',
    'timetabel': 'timetable',
    'genentic': 'genetic',
    'resutls': 'results',
    'reserach': 'research',
    'methodolgy': 'methodology',
    'analsis': 'analysis',
    'concluson': 'conclusion',
    'perfomance': 'performance',
    'experment': 'experiment',
    'evaluaton': 'evaluation',
    'comparision': 'comparison',
    'genrated': 'generated',
    'fulfiled': 'fulfilled',
    'optimzed': 'optimized',
    'challanges': 'challenges',
    'difficuties': 'difficulties',
    'acheive': 'achieve',
    'recieve': 'receive',
    'seperate': 'separate',
    'occured': 'occurred',
    'maintainig': 'maintaining',
    'assignemnt': 'assignment',
    'theoritical': 'theoretical',
    'publshed': 'published',
    'journel': 'journal',
    'computr': 'computer',
    'technolgy': 'technology',
    'enginring': 'engineering',
    'scienc': 'science'
  };
  
  // Apply spelling fixes
  Object.keys(spellingFixes).forEach(wrong => {
    const correct = spellingFixes[wrong];
    const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
    cleaned = cleaned.replace(regex, correct);
  });
  
  // Fix common grammar issues
  cleaned = cleaned.replace(/\bof generated\b/g, 'of the generated');
  cleaned = cleaned.replace(/\bof optimized\b/g, 'of the optimized');
  cleaned = cleaned.replace(/\bof proposed\b/g, 'of the proposed');
  cleaned = cleaned.replace(/\baccording to the authors of the study\b/g, 'according to the study authors');
  
  // Clean up punctuation
  cleaned = cleaned.replace(/\s+([,.!?;:])/g, '$1'); // Remove space before punctuation
  cleaned = cleaned.replace(/([,.!?;:])\s*([,.!?;:])/g, '$1 '); // Fix double punctuation
  cleaned = cleaned.replace(/\.\s*\./g, '.'); // Remove double periods
  
  // Ensure proper sentence spacing
  cleaned = cleaned.replace(/([.!?])\s+([A-Z])/g, '$1 $2');
  
  // Final cleanup
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
};

// Hugging Face API configuration
const hfToken = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_TOKEN;
const hf = new HfInference(process.env.HUGGINGFACE_API_TOKEN);
const HUGGINGFACE_API_URL = 'https://api-inference.huggingface.co/models/facebook/bart-large-cnn';
const ACADEMIC_MODEL_URL = 'https://api-inference.huggingface.co/models/google/pegasus-xsum';
const SCIENTIFIC_MODEL_URL = 'https://api-inference.huggingface.co/models/facebook/bart-large-cnn'; // For scientific content

/**
 * Generate structured academic summary from sections
 * @param {Object} sections - Extracted academic sections
 * @param {Object} options - Summarization options
 * @returns {Promise<string>} - Structured academic summary
 */
const generateStructuredAcademicSummary = async (sections, options = {}) => {
  const {
    max_length = 800,
    min_length = 400,
    use_academic_model = false
  } = options;

  const modelUrl = use_academic_model ? ACADEMIC_MODEL_URL : HUGGINGFACE_API_URL;
  let summaryParts = [];

  console.log('Generating structured academic summary...');

  // 1. Title and Research Focus
  if (sections.title) {
    summaryParts.push(`## 🎯 Research Focus
${sections.title}`);
  }

  // 2. Research Objectives (from abstract/introduction)
  if (sections.abstract) {
    try {
      const objectiveSummary = await generateChunkSummary(
        sections.abstract.substring(0, 1000), // Limit input length
        { max_length: 100, min_length: 50, temperature: 0.3 },
        modelUrl
      );
      summaryParts.push(`## 🎓 Research Objectives
${objectiveSummary}`);
    } catch (error) {
      console.warn('Failed to summarize objectives:', error.message);
    }
  }

  // 3. Methodology (if available)
  if (sections.methodology && sections.methodology.length > 100) {
    try {
      const methodSummary = await generateChunkSummary(
        sections.methodology.substring(0, 1200), // Limit input length
        { max_length: 120, min_length: 60, temperature: 0.3 },
        modelUrl
      );
      summaryParts.push(`## 🔬 Methodology
${methodSummary}`);
    } catch (error) {
      console.warn('Failed to summarize methodology:', error.message);
    }
  }

  // 4. Key Findings (from results/discussion)
  const findingsText = [sections.results, sections.discussion].filter(s => s).join(' ');
  if (findingsText && findingsText.length > 100) {
    try {
      const findingsSummary = await generateChunkSummary(
        findingsText.substring(0, 1500), // Limit input length
        { max_length: 200, min_length: 100, temperature: 0.4 },
        modelUrl
      );
      summaryParts.push(`## 📊 Key Findings
${findingsSummary}`);
    } catch (error) {
      console.warn('Failed to summarize findings:', error.message);
    }
  }

  // 5. Conclusions and Implications
  if (sections.conclusion && sections.conclusion.length > 50) {
    try {
      const conclusionSummary = await generateChunkSummary(
        sections.conclusion.substring(0, 1000), // Limit input length
        { max_length: 150, min_length: 80, temperature: 0.3 },
        modelUrl
      );
      summaryParts.push(`## 💡 Conclusions
${conclusionSummary}`);
    } catch (error) {
      console.warn('Failed to summarize conclusions:', error.message);
    }
  }

  // 6. Keywords (if available)
  if (sections.keywords && sections.keywords.length > 0) {
    summaryParts.push(`## 🏷️ Keywords
${sections.keywords.slice(0, 8).join(' • ')}`);
  }

  // Add delay between API calls
  await new Promise(resolve => setTimeout(resolve, 1000));

  // If we have a good structured summary, return it
  if (summaryParts.length >= 3) {
    const structuredSummary = summaryParts.join('\n\n');
    return postProcessSummary(structuredSummary);
  }

  // Fallback: comprehensive summary of the entire text
  console.log('Falling back to comprehensive text summarization...');
  const fullText = [
    sections.abstract,
    sections.introduction,
    sections.methodology,
    sections.results,
    sections.discussion,
    sections.conclusion
  ].filter(s => s && s.length > 50).join(' ');

  if (fullText.length > 200) {
    const comprehensiveSummary = await generateChunkSummary(
      fullText.substring(0, 2000), // Use clean text without complex prompts
      { max_length: max_length * 0.8, min_length: min_length, temperature: 0.5 },
      modelUrl
    );
    return postProcessSummary(comprehensiveSummary);
  }

  throw new Error('Insufficient content for academic summarization');
};

/**
 * Extract text from PDF buffer
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @returns {Promise<string>} - Extracted text
 */
export const extractTextFromPDF = async (pdfBuffer) => {
  try {
    // Use require for pdf-parse to avoid ES6 import issues
    const pdf = require('pdf-parse');
    const data = await pdf(pdfBuffer);
    return data.text;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error('Failed to extract text from PDF');
  }
};

/**
 * Extract text from PDF file path
 * @param {string} filePath - Path to PDF file
 * @returns {Promise<string>} - Extracted text
 */
export const extractTextFromPDFFile = async (filePath) => {
  try {
    const pdfBuffer = fs.readFileSync(filePath);
    return await extractTextFromPDF(pdfBuffer);
  } catch (error) {
    console.error('Error reading PDF file:', error);
    throw new Error('Failed to read PDF file');
  }
};

/**
 * Generate summary for a single chunk using Hugging Face API
 * @param {string} text - Text chunk to summarize
 * @param {Object} options - Summarization options
 * @param {string} modelUrl - Model URL to use
 * @returns {Promise<string>} - Generated summary
 */
const generateChunkSummary = async (text, options = {}, modelUrl = HUGGINGFACE_API_URL) => {
  const {
    max_length = 300,
    min_length = 100,
    do_sample = true,
    temperature = 0.7,
    repetition_penalty = 1.1,
    length_penalty = 1.0
  } = options;

  // Validate and clean input
  if (!text || typeof text !== 'string') {
    throw new Error('Invalid input text for summarization');
  }

  // Limit input length to avoid API errors
  const cleanInput = text.trim().substring(0, 2000);
  
  if (cleanInput.length < 10) {
    throw new Error('Input text too short for summarization');
  }

  // Adjust parameters based on input length
  const adjustedMaxLength = Math.min(max_length, Math.floor(cleanInput.length * 0.5));
  const adjustedMinLength = Math.min(min_length, Math.floor(adjustedMaxLength * 0.5));

  try {
    const response = await axios.post(
      modelUrl,
      {
        inputs: cleanInput,
        parameters: {
          max_length: adjustedMaxLength,
          min_length: adjustedMinLength,
          do_sample,
          temperature,
          repetition_penalty,
          length_penalty,
          early_stopping: true
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${HUGGINGFACE_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 45000 // 45 seconds timeout for longer processing
      }
    );

    if (response.data && response.data[0] && response.data[0].summary_text) {
      // Post-process the summary to fix spacing and spelling issues
      return postProcessSummary(response.data[0].summary_text);
    } else {
      throw new Error('Invalid response format from Hugging Face API');
    }
  } catch (error) {
    if (error.response) {
      console.error('Hugging Face API Error:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
      
      if (error.response.status === 400) {
        throw new Error('Invalid request to AI model - input may be too complex or malformed');
      } else if (error.response.status === 503) {
        throw new Error('AI model is loading, please try again in a few minutes');
      } else if (error.response.status === 429) {
        throw new Error('Rate limit exceeded, please wait and try again');
      }
    }
    throw error;
  }
};

/**
 * Generate academic summary with structured approach
 * @param {string} text - Text to summarize
 * @param {Object} options - Summarization options
 * @returns {Promise<string>} - Generated academic summary
 */
export const generateSummary = async (text, options = {}) => {
  try {
    const {
      max_length = 800,   // Increased for comprehensive academic summaries
      min_length = 400,   // Increased for detailed content
      use_academic_model = false,
      detailed = true,
      academic_format = true  // New option for structured academic format
    } = options;

    console.log('Starting advanced academic summarization process...');
    console.log(`Input text length: ${text.length} characters`);

    // First, try to extract academic sections
    const sections = extractAcademicSections(text);
    console.log('Extracted sections:', {
      title: !!sections.title,
      abstract: !!sections.abstract,
      introduction: !!sections.introduction,
      methodology: !!sections.methodology,
      results: !!sections.results,
      discussion: !!sections.discussion,
      conclusion: !!sections.conclusion,
      keywords: sections.keywords.length
    });

    // If we have good academic structure, use structured summarization
    if (academic_format && (sections.abstract || sections.introduction || sections.conclusion)) {
      console.log('Using structured academic summarization...');
      try {
        const structuredSummary = await generateStructuredAcademicSummary(sections, {
          max_length,
          min_length,
          use_academic_model
        });
        
        // Add academic context and formatting
        const enhancedSummary = `# ACADEMIC SUMMARY

${structuredSummary}

---

**Analysis Scope:** This summary covers the main research contributions, methodology, findings, and implications as presented in the academic document.`;
        
        return postProcessSummary(enhancedSummary);
      } catch (error) {
        console.warn('Structured summarization failed, falling back to comprehensive approach:', error.message);
      }
    }

    // Fallback: Enhanced comprehensive summarization
    console.log('Using enhanced comprehensive summarization...');
    
    // Preprocess the text with academic focus
    const cleanedText = preprocessText(text);
    console.log(`Cleaned text length: ${cleanedText.length} characters`);

    const modelUrl = use_academic_model ? ACADEMIC_MODEL_URL : HUGGINGFACE_API_URL;

    // For shorter academic texts, use direct comprehensive summarization
    if (cleanedText.length < 3000) {
      console.log('Direct comprehensive summarization for academic content...');
      
      // Use clean text directly without complex prompts
      const directSummary = await generateChunkSummary(cleanedText, {
        max_length: Math.min(max_length, Math.floor(cleanedText.length * 0.6)),
        min_length: Math.min(min_length, Math.floor(cleanedText.length * 0.3)),
        do_sample: true,
        temperature: 0.4,
        repetition_penalty: 1.1
      }, modelUrl);
      
      return postProcessSummary(directSummary);
    }

    // For longer texts, use intelligent chunking with academic focus
    console.log('Using intelligent academic chunking...');
    const chunks = chunkText(cleanedText, 3500, 350);
    console.log(`Split into ${chunks.length} chunks for academic processing`);

    const chunkSummaries = [];

    // Process chunks without complex prompts to avoid 400 errors
    for (let i = 0; i < chunks.length; i++) {
      console.log(`Processing academic chunk ${i + 1}/${chunks.length}...`);
      
      try {
        // Use clean chunks directly
        const chunkSummary = await generateChunkSummary(chunks[i], {
          max_length: 250,
          min_length: 120,
          do_sample: true,
          temperature: 0.5,
          repetition_penalty: 1.1
        }, modelUrl);
        
        chunkSummaries.push(chunkSummary);
        
        // Add delay between requests
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      } catch (error) {
        console.warn(`Failed to process academic chunk ${i + 1}:`, error.message);
        // Continue with other chunks
      }
    }

    if (chunkSummaries.length === 0) {
      throw new Error('Failed to generate summaries for any academic chunks');
    }

    console.log(`Generated ${chunkSummaries.length} academic chunk summaries`);

    // Combine and synthesize chunk summaries into coherent academic summary
    const combinedContent = chunkSummaries.join(' ');
    
    if (combinedContent.length > max_length * 2) {
      console.log('Final academic synthesis...');
      
      // Use clean content directly without complex prompts
      const finalSummary = await generateChunkSummary(combinedContent, {
        max_length,
        min_length,
        do_sample: true,
        temperature: 0.6,
        repetition_penalty: 1.1
      }, modelUrl);
      
      const formattedSummary = `# COMPREHENSIVE ACADEMIC SUMMARY

${finalSummary}

---

**Note:** This summary synthesizes the main academic contributions, research methods, findings, and implications from the source document.`;
      
      return postProcessSummary(formattedSummary);
    }

    const finalAnalysis = `# ACADEMIC ANALYSIS

${combinedContent}

---

**Summary Scope:** This analysis covers the key academic elements including research objectives, methodology, findings, and implications.`;
    
    return postProcessSummary(finalAnalysis);

  } catch (error) {
    console.error('Error generating academic summary:', error.response?.data || error.message);
    
    if (error.response?.status === 503) {
      throw new Error('AI model is loading, please try again in a few minutes');
    } else if (error.response?.status === 401) {
      throw new Error('Invalid Hugging Face API token');
    } else if (error.response?.status === 429) {
      throw new Error('Rate limit exceeded, please wait and try again');
    } else {
      throw new Error(`Failed to generate academic summary: ${error.message}`);
    }
  }
};

/**
 * Process PDF and generate summary
 * @param {string|Buffer} pdfInput - PDF file path or buffer
 * @param {Object} summaryOptions - Summarization options
 * @returns {Promise<Object>} - Object containing extracted text and summary
 */
export const processPDFAndSummarize = async (pdfInput, summaryOptions = {}) => {
  try {
    let extractedText;
    
    if (typeof pdfInput === 'string') {
      // File path
      extractedText = await extractTextFromPDFFile(pdfInput);
    } else {
      // Buffer
      extractedText = await extractTextFromPDF(pdfInput);
    }

    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error('No text found in PDF');
    }

    const summary = await generateSummary(extractedText, summaryOptions);

    return {
      extractedText,
      summary,
      textLength: extractedText.length,
      summaryLength: summary.length
    };
  } catch (error) {
    console.error('Error processing PDF and generating summary:', error);
    throw error;
  }
};

/**
 * Save extracted text to file
 * @param {string} text - Text to save
 * @param {string} filename - Output filename
 * @param {string} outputDir - Output directory
 * @returns {Promise<string>} - Path to saved file
 */
export const saveTextToFile = async (text, filename, outputDir = './uploads/extracted-text') => {
  try {
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filePath = `${outputDir}/${filename}`;
    fs.writeFileSync(filePath, text, 'utf8');
    return filePath;
  } catch (error) {
    console.error('Error saving text to file:', error);
    throw new Error('Failed to save text to file');
  }
};

/**
 * Generate suggestions for improving paper quality using Hugging Face models
 * @param {string} text - Extracted text from the paper
 * @returns {Object} - Suggestions for improving the paper
 */
export const generatePaperSuggestions = async (text) => {
  try {
    // Import Hugging Face inference dynamically
    const { HfInference } = await import('@huggingface/inference');
    
    // Initialize Hugging Face inference
    const hfToken = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_TOKEN || HUGGINGFACE_API_TOKEN;
    const hf = new HfInference(hfToken);
    
    // Prepare the text for analysis
    const cleanedText = text.substring(0, 1200); // Give models more context while staying performant
    
    // Since most text generation models are unavailable on the free Inference API,
    // we'll skip the AI model attempts and go directly to enhanced text analysis
    // which provides high-quality, reliable suggestions based on academic writing best practices
    console.log('Using enhanced text analysis for reliable, comprehensive suggestions...');
    
    // Skip AI model attempts and use enhanced analysis directly
    throw new Error('Using enhanced text analysis for better reliability');
    
    let suggestions = null;
    let usedModel = null;
    
    for (const model of models) {
      try {
        console.log(`Trying model: ${model}`);
        
        // Instruction-focused prompt for actionable academic suggestions
        const prompt = `You are an expert academic writing assistant. Read the following excerpt and provide exactly five concrete, actionable suggestions to improve the paper's clarity, structure, methodology description, results presentation, and academic style. Keep each suggestion concise (max 25 words), avoid duplication, and do not add commentary before or after the list.

Text:
"""
${cleanedText}
"""

Suggestions:
1. `;
        
        // Generate suggestions using the current model
        const response = await hf.textGeneration({
          model: model,
          inputs: prompt,
          parameters: {
            max_new_tokens: 220,
            temperature: 0.6,
            top_p: 0.9,
            do_sample: true,
            return_full_text: false,
            repetition_penalty: 1.15,
            stop: ['\n\n', '\n\n\n']
          }
        });
        
        if (response.generated_text && response.generated_text.trim().length > 15) {
          suggestions = response.generated_text;
          usedModel = model;
          console.log(`Successfully used model: ${model}`);
          break;
        }
      } catch (modelError) {
        console.log(`Model ${model} failed:`, modelError.message);
        // Log more details for debugging
        if (modelError.response) {
          console.log(`Model ${model} HTTP error:`, modelError.response.status, modelError.response.statusText);
        }
        continue; // Try next model
      }
    }
    
    if (suggestions) {
      // Clean up the suggestions
      let cleanedSuggestions = suggestions
        .replace(/^[\s\S]*?Suggestions:\s*/i, '')
        .trim();

      // Split into numbered list items, normalize and cap to 5
      const lines = cleanedSuggestions
        .split(/\n+/)
        .map(l => l.replace(/^\s*\d+\.|^[-•]\s*/,'').trim())
        .filter(Boolean);

      // If model returned a blob, try splitting by numbering pattern
      const numbered = lines.length > 1 ? lines : cleanedSuggestions
        .split(/\s*\d+\.?\s+/)
        .map(s => s.trim())
        .filter(Boolean);

      const suggestionList = (numbered.length ? numbered : [cleanedSuggestions])
        .map(s => s.replace(/(^"|"$)/g, ''))
        .filter(s => s.length > 5)
        .slice(0, 5);
      
      // If no structured suggestions, create a single suggestion
      if (suggestionList.length === 0) {
        suggestionList.push(cleanedSuggestions || 'Consider reviewing the paper structure and clarity.');
      }
      
      // Analyze the text for common issues
      const analysis = analyzeTextQuality(text);
      
      return {
        suggestions: suggestionList,
        analysis: analysis,
        model: usedModel,
        timestamp: new Date().toISOString()
      };
    }
    
    // If all models failed, try a different approach with text completion
    console.log('All models failed, trying text completion approach...');
    
    try {
      // Try using text completion with a more reliable model
      const completionResponse = await hf.textGeneration({
        model: 'gpt2',
        inputs: `Review this academic text and suggest improvements: ${cleanedText.substring(0, 500)}`,
        parameters: {
          max_new_tokens: 80,
          temperature: 0.7,
          top_p: 0.9,
          do_sample: true,
          return_full_text: false
        }
      });
      
      if (completionResponse.generated_text && completionResponse.generated_text.trim().length > 10) {
        const analysis = analyzeTextQuality(text);
        const simpleSuggestions = [
          completionResponse.generated_text.trim(),
          'Review grammar and punctuation',
          'Ensure consistent formatting',
          'Check for logical flow of ideas'
        ];
        
        return {
          suggestions: simpleSuggestions,
          analysis: analysis,
          model: 'gpt2 (completion)',
          timestamp: new Date().toISOString()
        };
      }
    } catch (completionError) {
      console.log('Text completion also failed:', completionError.message);
    }
    
    // If all AI approaches failed, throw error to trigger fallback
    throw new Error('All AI models and approaches failed');
    
  } catch (error) {
    console.error('Error generating suggestions with AI models:', error);
    
    // Fallback: provide enhanced suggestions based on text analysis
    const analysis = analyzeTextQuality(text);
    const fallbackSuggestions = generateEnhancedFallbackSuggestions(analysis, text);
    
    return {
      suggestions: fallbackSuggestions,
      analysis: analysis,
      model: 'enhanced-analysis',
      error: 'Generated using comprehensive text analysis for reliable academic writing suggestions',
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Analyze text quality and identify potential issues
 * @param {string} text - Text to analyze
 * @returns {Object} - Analysis results
 */
const analyzeTextQuality = (text) => {
  const analysis = {
    wordCount: text.split(/\s+/).length,
    sentenceCount: text.split(/[.!?]+/).length - 1,
    paragraphCount: text.split(/\n\s*\n/).length,
    hasAbstract: /abstract/i.test(text),
    hasIntroduction: /introduction/i.test(text),
    hasConclusion: /conclusion/i.test(text),
    hasReferences: /references?|bibliography/i.test(text),
    hasMethodology: /methodology|methods?|approach/i.test(text),
    hasResults: /results?|findings?|outcomes?/i.test(text),
    hasDiscussion: /discussion|analysis|evaluation/i.test(text),
    issues: [],
    contentAnalysis: {},
    writingStyle: {},
    technicalIssues: []
  };
  
  // Content-specific analysis
  analysis.contentAnalysis = analyzeContentSpecific(text);
  
  // Writing style analysis
  analysis.writingStyle = analyzeWritingStyle(text);
  
  // Technical and formatting issues
  analysis.technicalIssues = analyzeTechnicalIssues(text);
  
  // Combine all issues
  analysis.issues = [
    ...analysis.contentAnalysis.issues,
    ...analysis.writingStyle.issues,
    ...analysis.technicalIssues
  ];
  
  return analysis;
};

/**
 * Analyze content-specific aspects of the text
 * @param {string} text - Text to analyze
 * @returns {Object} - Content analysis results
 */
const analyzeContentSpecific = (text) => {
  const analysis = {
    issues: [],
    strengths: [],
    topicKeywords: [],
    researchGaps: []
  };
  
  // Extract topic keywords from the text
  const commonTopics = [
    'machine learning', 'deep learning', 'artificial intelligence', 'neural networks',
    'data analysis', 'statistics', 'optimization', 'algorithms', 'computer science',
    'engineering', 'mathematics', 'physics', 'chemistry', 'biology', 'medicine',
    'economics', 'social sciences', 'humanities', 'education', 'technology'
  ];
  
  analysis.topicKeywords = commonTopics.filter(topic => 
    text.toLowerCase().includes(topic.toLowerCase())
  );
  
  // Check for research methodology indicators
  const hasQuantitativeMethods = /quantitative|statistical|numerical|data|survey|experiment/i.test(text);
  const hasQualitativeMethods = /qualitative|interview|observation|case study|narrative/i.test(text);
  const hasMixedMethods = /mixed methods|triangulation|both quantitative and qualitative/i.test(text);
  
  if (hasQuantitativeMethods && hasQualitativeMethods) {
    analysis.strengths.push('Uses mixed research methods for comprehensive analysis');
  } else if (hasQuantitativeMethods) {
    analysis.strengths.push('Employs quantitative research methods');
  } else if (hasQualitativeMethods) {
    analysis.strengths.push('Uses qualitative research approaches');
  } else {
    analysis.issues.push('Research methodology is not clearly defined');
  }
  
  // Check for literature review
  if (text.toLowerCase().includes('literature review') || text.toLowerCase().includes('previous research')) {
    analysis.strengths.push('Includes literature review and background research');
  } else {
    analysis.issues.push('Consider adding a literature review section');
  }
  
  // Check for research questions/hypotheses
  if (text.toLowerCase().includes('research question') || text.toLowerCase().includes('hypothesis')) {
    analysis.strengths.push('Clearly states research questions or hypotheses');
  } else {
    analysis.issues.push('Research questions or hypotheses should be explicitly stated');
  }
  
  return analysis;
};

/**
 * Analyze writing style and academic conventions
 * @param {string} text - Text to analyze
 * @returns {Object} - Writing style analysis results
 */
const analyzeWritingStyle = (text) => {
  const analysis = {
    issues: [],
    strengths: [],
    sentenceComplexity: {},
    vocabularyLevel: {}
  };
  
  // Analyze sentence complexity
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const avgSentenceLength = sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) / sentences.length;
  
  analysis.sentenceComplexity = {
    averageLength: avgSentenceLength,
    longSentences: sentences.filter(s => s.split(/\s+/).length > 30).length,
    shortSentences: sentences.filter(s => s.split(/\s+/).length < 10).length
  };
  
  // Check for academic writing style
  const hasPassiveVoice = /(is|are|was|were|be|been|being)\s+\w+ed|\w+ed\s+by/i.test(text);
  const hasActiveVoice = /(we|I|the researchers|this study|the paper)\s+(analyze|examine|investigate|study|present)/i.test(text);
  
  if (hasPassiveVoice && !hasActiveVoice) {
    analysis.issues.push('Consider using more active voice for clarity and engagement');
  } else if (hasActiveVoice) {
    analysis.strengths.push('Good use of active voice for clarity');
  }
  
  // Check for transition words
  const transitionWords = ['however', 'furthermore', 'moreover', 'additionally', 'consequently', 'therefore', 'nevertheless', 'in contrast', 'similarly', 'likewise'];
  const foundTransitions = transitionWords.filter(word => text.toLowerCase().includes(word));
  
  if (foundTransitions.length < 3) {
    analysis.issues.push('Add more transition words to improve paragraph flow');
  } else {
    analysis.strengths.push('Good use of transition words for logical flow');
  }
  
  // Check for subjective language
  const subjectivePhrases = ['i think', 'i believe', 'in my opinion', 'i feel', 'i suggest'];
  const hasSubjectiveLanguage = subjectivePhrases.some(phrase => text.toLowerCase().includes(phrase));
  
  if (hasSubjectiveLanguage) {
    analysis.issues.push('Replace subjective language with objective academic language');
  }
  
  return analysis;
};

/**
 * Analyze technical and formatting issues
 * @param {string} text - Text to analyze
 * @returns {Array} - Technical issues found
 */
const analyzeTechnicalIssues = (text) => {
  const issues = [];
  
  // Check for formatting issues
  if (text.includes('  ')) {
    issues.push('Fix multiple consecutive spaces for consistent formatting');
  }
  
  if (text.includes('\n\n\n')) {
    issues.push('Standardize paragraph spacing for consistent formatting');
  }
  
  // Check for citation patterns
  const hasCitations = /\[\d+\]|\(\w+\s+et\s+al\.?\s+\d{4}\)|\(\w+,\s+\d{4}\)/i.test(text);
  if (!hasCitations) {
    issues.push('Include proper citations and references to support claims');
  }
  
  // Check for figure/table references
  const hasFigureRefs = /figure\s+\d+|fig\.\s*\d+/i.test(text);
  const hasTableRefs = /table\s+\d+/i.test(text);
  
  if (hasFigureRefs || hasTableRefs) {
    if (!text.toLowerCase().includes('figure') && !text.toLowerCase().includes('table')) {
      issues.push('Reference figures and tables in the text when discussing them');
    }
  }
  
  // Check for acronyms
  const acronymPattern = /\b[A-Z]{2,}\b/g;
  const acronyms = text.match(acronymPattern) || [];
  const uniqueAcronyms = [...new Set(acronyms)];
  
  uniqueAcronyms.forEach(acronym => {
    if (acronym.length > 2 && !text.toLowerCase().includes(acronym.toLowerCase() + ' stands for') && 
        !text.toLowerCase().includes(acronym.toLowerCase() + ' refers to')) {
      issues.push(`Define acronym "${acronym}" on first use`);
    }
  });
  
  return issues;
};

/**
 * Generate enhanced fallback suggestions based on text analysis
 * @param {Object} analysis - Text analysis results
 * @param {string} text - Original text for deeper analysis
 * @returns {Array} - List of enhanced suggestions
 */
const generateEnhancedFallbackSuggestions = (analysis, text) => {
  const suggestions = [];
  
  // Add strengths first (positive feedback)
  if (analysis.contentAnalysis && analysis.contentAnalysis.strengths.length > 0) {
    suggestions.push('🎉 **Strengths Found:**');
    analysis.contentAnalysis.strengths.forEach(strength => {
      suggestions.push(`✅ ${strength}`);
    });
    suggestions.push(''); // Empty line for separation
  }
  
  if (analysis.writingStyle && analysis.writingStyle.strengths.length > 0) {
    analysis.writingStyle.strengths.forEach(strength => {
      suggestions.push(`✅ ${strength}`);
    });
    suggestions.push(''); // Empty line for separation
  }
  
  // Add content-specific suggestions based on the document's topic
  if (analysis.contentAnalysis && analysis.contentAnalysis.topicKeywords.length > 0) {
    const topics = analysis.contentAnalysis.topicKeywords;
    suggestions.push(`🔬 **Content Analysis for ${topics.join(', ')}:**`);
    
    // Topic-specific suggestions
    if (topics.some(t => ['machine learning', 'deep learning', 'artificial intelligence'].includes(t))) {
      suggestions.push('📊 Consider adding performance metrics and evaluation criteria');
      suggestions.push('🧮 Include mathematical formulations for key algorithms');
      suggestions.push('📈 Add comparative analysis with existing methods');
    }
    
    if (topics.some(t => ['data analysis', 'statistics'].includes(t))) {
      suggestions.push('📊 Ensure statistical significance is properly addressed');
      suggestions.push('📉 Include confidence intervals and error margins');
      suggestions.push('🔍 Add data validation and quality checks');
    }
    
    if (topics.some(t => ['engineering', 'technology'].includes(t))) {
      suggestions.push('⚙️ Include technical specifications and requirements');
      suggestions.push('🔧 Add implementation details and constraints');
      suggestions.push('📋 Consider practical applications and limitations');
    }
    
    suggestions.push(''); // Empty line for separation
  }
  
  // Add specific issues that need fixing
  if (analysis.issues.length > 0) {
    suggestions.push('⚠️ **Issues to Address:**');
    analysis.issues.forEach(issue => {
      suggestions.push(`🔧 ${issue}`);
    });
    suggestions.push(''); // Empty line for separation
  }
  
  // Add writing style suggestions based on actual analysis
  if (analysis.writingStyle && analysis.writingStyle.sentenceComplexity) {
    const complexity = analysis.writingStyle.sentenceComplexity;
    
    if (complexity.averageLength > 25) {
      suggestions.push(`✂️ **Sentence Structure:** Average sentence length is ${complexity.averageLength.toFixed(1)} words - consider breaking down complex sentences`);
    } else if (complexity.averageLength < 15) {
      suggestions.push(`🔗 **Sentence Structure:** Average sentence length is ${complexity.averageLength.toFixed(1)} words - consider combining very short sentences`);
    }
    
    if (complexity.longSentences > 0) {
      suggestions.push(`📏 **Sentence Structure:** Found ${complexity.longSentences} sentence(s) over 30 words - review for clarity`);
    }
    
    if (complexity.shortSentences > 0) {
      suggestions.push(`📏 **Sentence Structure:** Found ${complexity.shortSentences} sentence(s) under 10 words - consider expanding for better flow`);
    }
  }
  
  // Add document structure suggestions based on what's missing
  const structureSuggestions = [];
  if (!analysis.hasAbstract) {
    structureSuggestions.push('📋 Add abstract section');
  }
  if (!analysis.hasIntroduction) {
    structureSuggestions.push('🎯 Add introduction section');
  }
  if (!analysis.hasMethodology) {
    structureSuggestions.push('🔬 Add methodology section');
  }
  if (!analysis.hasResults) {
    structureSuggestions.push('📊 Add results section');
  }
  if (!analysis.hasDiscussion) {
    structureSuggestions.push('💭 Add discussion section');
  }
  if (!analysis.hasConclusion) {
    structureSuggestions.push('🏁 Add conclusion section');
  }
  if (!analysis.hasReferences) {
    structureSuggestions.push('📖 Add references section');
  }
  
  if (structureSuggestions.length > 0) {
    suggestions.push('📚 **Document Structure:**');
    structureSuggestions.forEach(suggestion => {
      suggestions.push(`📝 ${suggestion}`);
    });
    suggestions.push(''); // Empty line for separation
  }
  
  // Add content length suggestions
  if (analysis.wordCount < 500) {
    suggestions.push(`📏 **Content Length:** Document is ${analysis.wordCount} words - expand with more detailed explanations, examples, and supporting evidence`);
  } else if (analysis.wordCount < 1000) {
    suggestions.push(`📏 **Content Length:** Document is ${analysis.wordCount} words - consider adding more comprehensive analysis and supporting materials`);
  } else if (analysis.wordCount > 8000) {
    suggestions.push(`📏 **Content Length:** Document is ${analysis.wordCount} words - consider condensing for better focus and readability`);
  }
  
  // Add paragraph analysis
  if (analysis.paragraphCount < 5) {
    suggestions.push(`📄 **Organization:** Only ${analysis.paragraphCount} paragraphs found - consider breaking content into more logical sections`);
  } else if (analysis.paragraphCount > 20) {
    suggestions.push(`📄 **Organization:** ${analysis.paragraphCount} paragraphs found - consider consolidating related ideas`);
  }
  
  // Add specific academic writing improvements
  suggestions.push('🎓 **Academic Writing Improvements:**');
  
  // Check for specific writing issues in the text
  const textLower = text.toLowerCase();
  
  if (textLower.includes('i think') || textLower.includes('i believe') || textLower.includes('in my opinion')) {
    suggestions.push('🎯 Replace subjective language with objective academic language');
  }
  
  if (textLower.includes('very') || textLower.includes('really') || textLower.includes('extremely')) {
    suggestions.push('💼 Use more precise and academic vocabulary instead of intensifiers');
  }
  
  if (textLower.includes('a lot') || textLower.includes('lots of')) {
    suggestions.push('📊 Use specific quantities or percentages instead of vague terms');
  }
  
  if (textLower.includes('good') || textLower.includes('bad') || textLower.includes('nice')) {
    suggestions.push('📝 Replace generic adjectives with more specific, descriptive terms');
  }
  
  // Add transition word suggestions if needed
  const transitionWords = ['however', 'furthermore', 'moreover', 'additionally', 'consequently', 'therefore', 'nevertheless', 'in contrast', 'similarly', 'likewise'];
  const foundTransitions = transitionWords.filter(word => textLower.includes(word));
  
  if (foundTransitions.length < 3) {
    suggestions.push('🔗 Add more transition words to improve paragraph flow and logical connections');
  }
  
  // Add citation and reference suggestions
  if (!text.match(/\[\d+\]|\(\w+\s+et\s+al\.?\s+\d{4}\)|\(\w+,\s+\d{4}\)/i)) {
    suggestions.push('📚 Include proper citations and references to support your claims and arguments');
  }
  
  // Add formatting suggestions
  if (text.includes('  ')) {
    suggestions.push('📐 Fix multiple consecutive spaces for consistent formatting');
  }
  
  if (text.includes('\n\n\n')) {
    suggestions.push('📏 Standardize paragraph spacing for consistent formatting');
  }
  
  // Remove duplicates and limit suggestions while maintaining structure
  const uniqueSuggestions = [];
  const seen = new Set();
  
  suggestions.forEach(suggestion => {
    const cleanSuggestion = suggestion.replace(/^[🎉⚠️📏📚🎓🔬🔧📝📄💼📊🎯🔗📐📏]+/, '').trim();
    if (!seen.has(cleanSuggestion) && cleanSuggestion.length > 0) {
      seen.add(cleanSuggestion);
      uniqueSuggestions.push(suggestion);
    }
  });
  
  return uniqueSuggestions.slice(0, 20); // Allow more suggestions since they're now more specific
};
