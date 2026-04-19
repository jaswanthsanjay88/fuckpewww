const axios = require('axios');
const CryptoJS = require('crypto-js');
const fs = require('fs');

// --- 1. Configuration & Credentials ---
const SECRET_KEY = "sdm8Yy6OCCH5Du/IxBC3yJ17gkEECG3VEUwnQgGFyNKs0OyvdCtNi2AxTzUcQE94"; 

// The JWT Token (Update this if you start getting 401 Unauthorized errors)
const AUTH_TOKEN = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6IjI0MDMwMzE0NjA5NDVAcGFydWx1bml2ZXJzaXR5LmFjLmluIiwiX2lkIjoiNjc4MGNjZjRkZjE5N2ViNWM5N2NjMGJhIiwiaWF0IjoxNzc2NTkxNjgxLCJleHAiOjE3NzY2NzgwODF9.qzTwF_NyZ8nM8WcIaHyetmsvFrELGfp1jMFHRX6TJX6AsnJjLckeJ06mtop0Fo-uEQ8Fw01ifaMp4xg1LH9WNV1k3fTq9paOTeFNrGo6V6vya9FqM1Q0DbbIiBpiPu6pnqsBLlkBez3EngkBSwsaQZBGEZVkE39sgPuNfPstOMQ"; 

const API_URL = "https://api.paruluniversity.ac.in/api/assets/signed-url?url=https%3A%2F%2Fstorage.googleapis.com%2Fparul-local-important%2F8e2a9301-e70f-42aa-81dd-200bada983aa-se-ch.1-ppt.pdf";
const OUTPUT_FILE = "se-ch.1-ppt.pdf";

async function downloadEncryptedPDF() {
    try {
        console.log("1. Hitting the API for the encrypted payload...");
        
        const apiResponse = await axios.get(API_URL, {
            headers: {
                'AuthorizationToken': AUTH_TOKEN,
                'Accept': 'application/json, text/plain, */*',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        const encryptedData = apiResponse.data.response;
        console.log("Encrypted data received:", encryptedData.substring(0, 30) + "...");

        console.log("2. Decrypting payload using extracted secret key...");
        
        const bytes = CryptoJS.AES.decrypt(encryptedData, SECRET_KEY);
        const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
        
        if (!decryptedString) {
            throw new Error("Decryption failed. The resulting string is empty.");
        }

        let finalUrl = decryptedString;

        // Strip literal quotation marks if present
        if (finalUrl.startsWith('"') && finalUrl.endsWith('"')) {
            finalUrl = finalUrl.slice(1, -1);
        }

        // --- THE FIX IS HERE ---
        // Parse the JSON and explicitly grab the 'signedUrl' property
        if (finalUrl.startsWith('{')) {
            const parsedData = JSON.parse(finalUrl);
            finalUrl = parsedData.signedUrl || parsedData.url || parsedData.link || finalUrl; 
        }

        if (finalUrl.startsWith('[')) {
            finalUrl = JSON.parse(finalUrl)[0];
        }

        finalUrl = finalUrl.trim();

        console.log("Decryption successful! Cleaned URL ready for download.");
        console.log("Downloading from:", finalUrl.substring(0, 50) + "...");

        console.log("3. Downloading the actual PDF...");
        
        const pdfResponse = await axios({
            method: 'GET',
            url: finalUrl,
            responseType: 'stream'
        });

        const writer = fs.createWriteStream(OUTPUT_FILE);
        pdfResponse.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => {
                console.log(`\n✅ Success! File downloaded completely and saved as: ${OUTPUT_FILE}`);
                resolve();
            });
            writer.on('error', reject);
        });

    } catch (error) {
        console.error("\n❌ Error in automation flow:");
        if (error.response) {
            if (error.response.status === 401) {
                 console.error("HTTP 401 Unauthorized: Your AUTH_TOKEN has expired. Please grab a new one from your browser's Network tab and update the script.");
            } else {
                 console.error(`Status: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
            }
        } else {
            console.error(error.message);
        }
    }
}

downloadEncryptedPDF();