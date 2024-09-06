const axios = require('axios');
const XLSX = require('xlsx');
const path = require('path');

// Path to your Excel file
const excelFilePath = path.join(__dirname, '../uploads/OTC file3.xlsx');

const startRow = 32542;

async function processAndUploadFile() {
    try {
        // Read the Excel file
        const workbook = XLSX.readFile(excelFilePath);
        const sheetNames = workbook.SheetNames;
        const sheet = workbook.Sheets[sheetNames[0]];

        // Convert the sheet to JSON
        const data = XLSX.utils.sheet_to_json(sheet);

        if (data.length === 0) {
            throw new Error('No data found in the Excel file');
        }

        // API URLs
        const subCategoryApiUrl = 'http://localhost:5000/subcategory/create';
        const subCategoryCheckUrl = 'http://localhost:5000/subcategory/check'; // Endpoint to check if subcategory exists

        // Process and upload each row
        for (const row of data) {
            const categoryName = row.category || '';
            const subCategoryName = row.sub_category || '';

            // Skip if either category or subcategory is missing
            if (!categoryName || !subCategoryName) {
                console.warn('Skipping row due to missing category or subcategory:', row.Id);
                continue;
            }

            // Check if subcategory already exists
            const subCategoryExists = await axios.post(subCategoryCheckUrl, { name: subCategoryName });
            if (subCategoryExists.data.exists) {
                console.log(`SubCategory '${subCategoryName}' already exists. Skipping upload.`);
                continue;
            }

            // Prepare JSON object for subcategory
            const subCategoryData = {
                name: subCategoryName,
                mainCategory: categoryName,
                // img: '', // Add the image data if needed
            };

            // Upload the subcategory
            try {
                const subCategoryResponse = await axios.post(subCategoryApiUrl, subCategoryData, {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                console.log('SubCategory upload successful:', subCategoryResponse.data);
            } catch (subCategoryError) {
                console.error('Error uploading subcategory:', subCategoryError.message);
            }
        }

    } catch (error) {
        console.error('Error processing and uploading file:', error.message);
    }
}

processAndUploadFile();
