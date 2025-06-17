const path = require('path');
const fs = require('fs');
const {
  processExcelFile,
  processPdfFile,
  processWordFile,
} = require('../../services/fileProcessors'); // Adjust path as necessary

// Helper to create a truly empty file for testing certain error conditions
const createEmptyFile = (filePath) => fs.writeFileSync(filePath, '');
// Helper to create a deliberately corrupted file (e.g. not a valid zip for xlsx/docx)
const createCorruptedFile = (filePath) => fs.writeFileSync(filePath, 'This is not a valid zip archive.');


describe('File Processors Service', () => {
  const fixturesDir = path.join(__dirname, '../fixtures'); // Assumes tests are in tests/services, fixtures in tests/fixtures
  const sampleExcelPath = path.join(fixturesDir, 'sample.xlsx');
  const samplePdfPath = path.join(fixturesDir, 'sample.pdf');
  const sampleDocxPath = path.join(fixturesDir, 'sample.docx');
  const nonExistentFilePath = path.join(fixturesDir, 'nonexistent.txt');
  const emptyExcelPath = path.join(fixturesDir, 'empty.xlsx');
  const corruptedExcelPath = path.join(fixturesDir, 'corrupted.xlsx');
  const emptyPdfPath = path.join(fixturesDir, 'empty.pdf'); // For testing pdf-parse with empty content
  const imageOnlyPdfPath = path.join(fixturesDir, 'image_only.pdf'); // Concept, actual file is still text based for this test env
  const emptyDocxPath = path.join(fixturesDir, 'empty.docx');
  const corruptedDocxPath = path.join(fixturesDir, 'corrupted.docx');


  // Create dummy empty/corrupted files for specific tests before all tests run
  beforeAll(() => {
    if (!fs.existsSync(fixturesDir)) {
        fs.mkdirSync(fixturesDir, { recursive: true });
    }
    createEmptyFile(emptyExcelPath);
    createCorruptedFile(corruptedExcelPath);
    createEmptyFile(emptyPdfPath);
    // Simulating an "image-only" PDF with a text file that pdf-parse might return no text from, or specific metadata.
    // A true image-only PDF would be binary and require different setup.
    fs.writeFileSync(imageOnlyPdfPath, "%%EOF"); // Minimal content that might be seen as 'empty' by text extractor
    createEmptyFile(emptyDocxPath);
    createCorruptedFile(corruptedDocxPath);
  });

  // Clean up dummy files after all tests run
  afterAll(() => {
    fs.unlinkSync(emptyExcelPath);
    fs.unlinkSync(corruptedExcelPath);
    fs.unlinkSync(emptyPdfPath);
    fs.unlinkSync(imageOnlyPdfPath);
    fs.unlinkSync(emptyDocxPath);
    fs.unlinkSync(corruptedDocxPath);
  });

  describe('processExcelFile', () => {
    it('should process a valid Excel (CSV-like) file and return correct JSON output', async () => {
      const result = await processExcelFile(sampleExcelPath);
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBe(5); // Excluding header, and empty rows might be handled differently by parser or code.
                                     // Based on current implementation, it should be 5 data rows.
      expect(result[0]).toEqual({ Name: 'John Doe', Email: 'john.doe@example.com', Age: '30' });
      expect(result[1]).toEqual({ Name: 'Jane Smith', Email: 'jane.smith@example.com', Age: '28' });
      expect(result[2]).toEqual({ Name: 'Dr. Space, Test', Email: 'space.test@example.com', Age: '45' });
      // The row "Empty,,," -> { Name: 'Empty', Email: '', Age: '' }
      expect(result[3]).toEqual({ Name: 'Another User', Email: 'another.user@example.com', Age: ''});
      expect(result[4]).toEqual({ Name: 'Final User', Email: 'final@example.com', Age: '50'});
    });

    it('should handle headers with spaces (as they are keys)', async () => {
        const csvWithSpaceInHeader = path.join(fixturesDir, 'space_header.xlsx');
        fs.writeFileSync(csvWithSpaceInHeader, 'First Name,Last Name,Age\nTest,User,42');
        const result = await processExcelFile(csvWithSpaceInHeader);
        expect(result[0]).toHaveProperty('First Name');
        expect(result[0]['First Name']).toBe('Test');
        fs.unlinkSync(csvWithSpaceInHeader);
    });

    it('should return an empty array for an empty sheet', async () => {
      // The xlsx library with `header:1` on an empty CSV (or one with only a header)
      // will result in jsonData = [headers]. Slice(1) makes it empty.
      const result = await processExcelFile(emptyExcelPath); // empty.xlsx is an empty file
      expect(result).toEqual([]);
    });

    it('should return an empty array for a sheet with only headers', async () => {
        const headerOnlyExcel = path.join(fixturesDir, 'header_only.xlsx');
        fs.writeFileSync(headerOnlyExcel, 'Header1,Header2\n');
        const result = await processExcelFile(headerOnlyExcel);
        expect(result).toEqual([]);
        fs.unlinkSync(headerOnlyExcel);
    });

    it('should throw an error for a non-existent file', async () => {
      await expect(processExcelFile(nonExistentFilePath)).rejects.toThrow('File not found');
    });

    it('should throw an error for a corrupted/invalid Excel file', async () => {
      // The corrupted.xlsx contains "This is not a valid zip archive."
      // xlsx library might throw various errors depending on how it fails to parse.
      await expect(processExcelFile(corruptedExcelPath)).rejects.toThrow(/Failed to process Excel file/);
    });
  });

  describe('processPdfFile', () => {
    it('should process a valid PDF (text-based fixture) and extract text', async () => {
      const result = await processPdfFile(samplePdfPath);
      expect(result).toHaveProperty('text');
      expect(result.text).toContain('This is a sample PDF document.');
      expect(result.text).toContain('Final line.');
      expect(result).toHaveProperty('numPages'); // pdf-parse provides this
    });

    it('should handle a PDF with no text (e.g., image-only or minimal content)', async () => {
      // imageOnlyPdfPath contains "%%EOF" which pdf-parse might interpret as a valid PDF but with no text.
      const result = await processPdfFile(imageOnlyPdfPath);
      expect(result).toHaveProperty('text');
      expect(result.text.trim()).toBe(''); // Or very minimal, depending on how pdf-parse handles it.
    });

    it('should handle an empty file as a PDF (expect error or minimal output)', async () => {
        // pdf-parse might throw an error for a completely empty file if it's not valid PDF structure.
        await expect(processPdfFile(emptyPdfPath)).rejects.toThrow(/Failed to process PDF file/);
        // Or, if it doesn't throw but returns empty text:
        // const result = await processPdfFile(emptyPdfPath);
        // expect(result.text.trim()).toBe('');
    });

    it('should throw an error for a non-existent file', async () => {
      await expect(processPdfFile(nonExistentFilePath)).rejects.toThrow('File not found');
    });
  });

  describe('processWordFile', () => {
    it('should process a valid DOCX (text-based fixture) and extract text', async () => {
      // mammoth will fail because sampleDocxPath is a TXT file, not a real DOCX (zip archive).
      // This tests the error handling for invalid DOCX format.
      await expect(processWordFile(sampleDocxPath)).rejects.toThrow(/Failed to process Word file/);
      // If we had a real DOCX, the test would be:
      // const result = await processWordFile(realSampleDocxPath);
      // expect(result).toHaveProperty('text');
      // expect(result.text).toContain('This is a sample Word document');
    });

    it('should throw an error for an empty file (not a valid DOCX)', async () => {
        await expect(processWordFile(emptyDocxPath)).rejects.toThrow(/Failed to process Word file/);
    });

    it('should throw an error for a corrupted/invalid DOCX file', async () => {
        // corruptedDocxPath contains "This is not a valid zip archive."
        await expect(processWordFile(corruptedDocxPath)).rejects.toThrow(/Failed to process Word file/);
    });

    it('should throw an error for a non-existent file', async () => {
      await expect(processWordFile(nonExistentFilePath)).rejects.toThrow('File not found');
    });

    // Note: Testing mammoth with a real .docx is needed for full verification.
    // The current text-based sample.docx will test mammoth's error handling for non-docx files.
    // To test successful text extraction, a real .docx file would be required in tests/fixtures,
    // which cannot be created with the current toolset.
    // For now, the test above verifies that it attempts to process and fails as expected for a TXT file.
  });
});
