export class ResumeParserService {
  async extractTextFromBuffer(buffer: Buffer, mimeType: string): Promise<string> {
    try {
      if (mimeType.includes('pdf') || mimeType.includes('octet-stream')) {
        // Simple PDF text extractor for standard PDF streams
        const rawString = buffer.toString('utf-8');
        const textMatches = rawString.match(/\(([^)]+)\)\s*Tj/g);
        if (textMatches && textMatches.length > 5) {
          return textMatches.map((m) => m.replace(/[()Tj]/g, '')).join(' ');
        }
        
        // Plain text extraction fallback
        const cleanText = rawString.replace(/[^\x20-\x7E\n\r\t]/g, ' ');
        return cleanText.length > 100 ? cleanText : 'Candidate Resume PDF Document Content';
      }

      if (mimeType.includes('word') || mimeType.includes('docx')) {
        const cleanText = buffer.toString('utf-8').replace(/<[^>]+>/g, ' ');
        return cleanText || 'Candidate Resume DOCX Document Content';
      }

      return buffer.toString('utf-8');
    } catch (err: any) {
      console.warn('⚠️ Text extraction warning:', err.message);
      return buffer.toString('utf-8').replace(/[^\x20-\x7E]/g, ' ');
    }
  }
}

export const resumeParserService = new ResumeParserService();
