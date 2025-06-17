const xlsx = require('xlsx');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const fs = require('fs');

/**
 * Processes an Excel file (.xlsx, .xls) and converts the first sheet to an array of JSON objects.
 * Keys for the JSON objects are derived from the header row of the sheet.
 * @param {string} filePath - Path to the Excel file.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of JSON objects representing rows.
 * @throws {Error} If there's an issue reading or processing the file.
 */
async function processExcelFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    const workbook = xlsx.readFile(filePath);
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      // Handle empty workbook or workbook with no sheets
      return [];
    }
    const worksheet = workbook.Sheets[firstSheetName];
    // Convert sheet to JSON. `header: 1` ensures first row is treated as headers.
    // `defval: ''` ensures empty cells are converted to empty strings.
    const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    if (jsonData.length === 0) {
      // Handle empty sheet
      return [];
    }

    const headers = jsonData[0];
    const dataRows = jsonData.slice(1);

    // Sanitize headers to be valid JavaScript identifiers if needed,
    // or handle them as they are if direct mapping is okay.
    // For simplicity, we'll use them as is for now.
    // Consider a sanitization step for headers if they might contain spaces or special chars
    // that are awkward as object keys e.g. header.replace(/\s+/g, '_')

    return dataRows.map(row => {
      const rowObject = {};
      headers.forEach((header, index) => {
        rowObject[String(header)] = row[index];
      });
      return rowObject;
    });

  } catch (error) {
    console.error(`Error processing Excel file "${filePath}":`, error);
    // Check for specific xlsx errors if possible, or rethrow generic
    if (error.message.includes('File not found')) {
        throw error;
    }
    throw new Error(`Failed to process Excel file "${filePath}". Details: ${error.message}`);
  }
}

/**
 * Processes a PDF file and extracts its text content.
 * @param {string} filePath - Path to the PDF file.
 * @returns {Promise<Object>} A promise that resolves to an object like { text: "extracted content" }.
 * @throws {Error} If there's an issue reading or processing the file.
 */
async function processPdfFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return {
      text: data.text,
      numPages: data.numpages,
      numRender: data.numrender,
      info: data.info, // PDF metadata
      version: data.version,
    };
  } catch (error) {
    console.error(`Error processing PDF file "${filePath}":`, error);
    if (error.message.includes('File not found')) {
        throw error;
    }
    throw new Error(`Failed to process PDF file "${filePath}". Details: ${error.message}`);
  }
}

/**
 * Processes a Word file (.docx) and extracts its text content.
 * Note: This primarily supports .docx files. Older .doc formats might not be supported.
 * @param {string} filePath - Path to the Word file.
 * @returns {Promise<Object>} A promise that resolves to an object like { text: "extracted content" }.
 * @throws {Error} If there's an issue reading or processing the file.
 */
async function processWordFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    // mammoth.extractRawText returns a promise
    const result = await mammoth.extractRawText({ path: filePath });
    return {
      text: result.value, // The raw text
      messages: result.messages, // Any messages, e.g., warnings during parsing
    };
  } catch (error) {
    console.error(`Error processing Word file "${filePath}":`, error);
    if (error.message.includes('File not found')) {
        throw error;
    }
    // Add specific check for mammoth errors if identifiable, e.g. unsupported format
    throw new Error(`Failed to process Word file "${filePath}". It might be an unsupported format (e.g. .doc instead of .docx) or corrupted. Details: ${error.message}`);
  }
}

module.exports = {
  processExcelFile,
  processPdfFile,
  processWordFile,
};
