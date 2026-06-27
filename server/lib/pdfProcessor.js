const axios = require('axios');
const pdf = require('pdf-parse');

class PDFProcessor {
  constructor() {
    this.chunkSize = 1000;
    this.overlap = 200;
  }

  async extractTextFromPDF(pdfUrl) {
    try {
      console.log(`📥 Downloading PDF from: ${pdfUrl}`);

      const response = await axios.get(pdfUrl, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(response.data);

      console.log(`Downloaded PDF buffer size: ${buffer.length} bytes`);

      const pdfData = await pdf(buffer);
      console.log(`Extracted text length: ${pdfData.text.length} characters`);
      console.log(`Number of pages: ${pdfData.numpages}`);

      return {
        text: pdfData.text,
        numPages: pdfData.numpages,
        info: pdfData.info,
        metadata: pdfData.metadata
      };
    } catch (error) {
      console.error('❌ Error extracting text from PDF:', error.message);
      throw error;
    }
  }

  async processPDFByPages(pdfUrl) {
    try {
      console.log(`⚙️ Processing PDF by pages: ${pdfUrl}`);

      const response = await axios.get(pdfUrl, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(response.data);
      const pdfData = await pdf(buffer);

      return {
        fullText: pdfData.text,
        numPages: pdfData.numpages,
        info: pdfData.info,
        metadata: pdfData.metadata
      };
    } catch (error) {
      console.error('❌ Error processing PDF by pages:', error.message);
      throw error;
    }
  }

  chunkText(text, chunkSize = 1000, overlap = 200) {
    const chunks = [];
    const sentences = text.split(/[.!?]+/).filter(sentence => sentence.trim().length > 0);

    let currentChunk = '';
    let currentSize = 0;

    for (const sentence of sentences) {
      const sentenceLength = sentence.trim().length;

      if (currentSize + sentenceLength > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());

        const words = currentChunk.split(' ');
        const overlapWords = words.slice(-Math.floor(overlap / 10));
        currentChunk = overlapWords.join(' ') + ' ' + sentence.trim();
        currentSize = currentChunk.length;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence.trim();
        currentSize = currentChunk.length;
      }
    }

    if (currentChunk.trim().length > 0) chunks.push(currentChunk.trim());

    return chunks.filter(chunk => chunk.length > 50);
  }

  async processPDFAndCreateChunks(pdfUrl, billId, title) {
    try {
      console.log(`📄 Starting PDF processing for bill: ${billId}`);

      const pdfData = await this.processPDFByPages(pdfUrl);
      const fullText = pdfData.fullText;

      if (!fullText || fullText.trim().length === 0) {
        throw new Error('No text content extracted from PDF');
      }

      console.log(`Extracted ${fullText.length} characters from ${pdfData.numPages} pages`);

      const cleanedText = this.cleanText(fullText);
      const chunks = this.chunkText(cleanedText, this.chunkSize, this.overlap);

      console.log(`Created ${chunks.length} chunks from PDF content`);

      const structuredChunks = chunks.map((chunk, index) => ({
        id: `${billId}-chunk-${index}`,
        billId,
        title,
        content: chunk,
        chunkIndex: index,
        totalChunks: chunks.length,
        metadata: {
          source: 'pdf',
          pdfUrl,
          numPages: pdfData.numPages,
          extractedAt: new Date().toISOString(),
          chunkSize: chunk.length,
          chunkMethod: 'sentence-based-overlap'
        }
      }));

      return {
        chunks: structuredChunks,
        totalChunks: chunks.length,
        originalLength: fullText.length,
        cleanedLength: cleanedText.length,
        pdfMetadata: {
          numPages: pdfData.numPages,
          info: pdfData.info,
          metadata: pdfData.metadata
        }
      };
    } catch (error) {
      console.error('❌ Error processing PDF and creating chunks:', error.message);
      throw error;
    }
  }

  cleanText(text) {
    return text
      .replace(/\s+/g, ' ')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
      .replace(/\r\n/g, ' ')
      .replace(/\r/g, ' ')
      .replace(/\n/g, ' ')
      .replace(/ +/g, ' ')
      .trim();
  }

  extractBillSections(text) {
    const sections = { title: '', preamble: '', provisions: [], schedules: [], definitions: '' };

    try {
      const titleMatch = text.match(/^([A-Z\s,]+(?:BILL|ACT))/i);
      if (titleMatch) sections.title = titleMatch[1].trim();

      const preambleMatch = text.match(/^(.*?)(?:SECTION\s+1|1\.\s)/is);
      if (preambleMatch) sections.preamble = preambleMatch[1].replace(sections.title, '').trim();

      const sectionMatches = text.match(/(?:SECTION|Section)\s+\d+[^]*?(?=(?:SECTION|Section)\s+\d+|\n\n|$)/gi);
      if (sectionMatches) sections.provisions = sectionMatches.map(section => section.trim());

      const definitionsMatch = text.match(/(?:DEFINITIONS?|Definitions?)[^]*?(?=(?:SECTION|Section|\n\n))/i);
      if (definitionsMatch) sections.definitions = definitionsMatch[0].trim();
    } catch (error) {
      console.log('⚠️ Error extracting bill sections:', error.message);
    }

    return sections;
  }

  async analyzePDFContent(pdfUrl, billId, title) {
    try {
      const pdfData = await this.processPDFByPages(pdfUrl);
      const cleanedText = this.cleanText(pdfData.fullText);
      const sections = this.extractBillSections(cleanedText);

      return {
        analysis: {
          billId,
          title,
          totalLength: cleanedText.length,
          numPages: pdfData.numPages,
          sections,
          extractedAt: new Date().toISOString()
        },
        fullText: cleanedText,
        metadata: pdfData
      };
    } catch (error) {
      console.error('❌ Error analyzing PDF content:', error.message);
      throw error;
    }
  }
}

const pdfProcessor = new PDFProcessor();
module.exports = { pdfProcessor };
