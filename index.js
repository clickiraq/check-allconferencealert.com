const puppeteer = require("puppeteer");
const sqlite3 = require('sqlite3').verbose();
const { create, Client } = require("venom-bot");

// Define Venom options
const venomOptions = {}; // Add your Venom options here

// Initialize Venom client
let venomClient = null;

const startVenom = async () => {
  try {
    venomClient = await create({
      session: "session-name",
    });
    scrapeConferenceData();
    setInterval(scrapeConferenceData,( 60 * 1000 * 60 * 8));
  } catch (error) {
    console.log(error);
  }
};

// Call startVenom to create the session when the server starts
sendTextMessage = async (message, number) => {
    try {
      if (venomClient) {
        await venomClient.sendText(number || "9647701516261@c.us", message);
      }
    } catch (error) {
      res.json({ success: false, message: "Failed to send message" });
    }
  };
async function scrapeConferenceData() {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium-browser',
  });
  const page = await browser.newPage();

  // Navigate to the conference page
  await page.goto("https://www.allconferencealert.com/iraq.html");

  try {
    // Wait for the table containing the conference data to load
    await page.waitForSelector('tbody tr', { timeout: 10000 }); // Refine selector to target rows within tbody

    // Extract data from rows
    const rows = await page.evaluate(() => {
        const rowData = [];
        // Accessing the DOM elements within page.evaluate()
        const rows = document.querySelectorAll("tbody tr");
        for (let i = rows.length - 1; i >= 0; i--) {
          const row = rows[i];
          const columns = row.querySelectorAll("td");
          if (columns.length >= 3) {
            const link = columns[0].querySelector('a').href;
            const rowDataItem = {
              date: columns[0].innerText.trim(),
              conference: columns[1].innerText.trim(),
              location: columns[2].innerText.trim(),
              link: link,
            };
            rowData.push(rowDataItem);
          }
        }
        return rowData;
      });      

    // Store data in SQLite database
    const db = new sqlite3.Database('conferences.db');

    // Create table if not exists
    db.serialize(() => {
      db.run("CREATE TABLE IF NOT EXISTS conferences (date TEXT, conference TEXT, location TEXT, link TEXT)");
    });

    // Prepare statement for inserting data
    const insertStmt = db.prepare("INSERT INTO conferences (date, conference, location, link) VALUES (?, ?, ?, ?)");

    for (const row of rows) {
      // Check if link already exists
      const existingLink = await new Promise((resolve, reject) => {
        db.get("SELECT link FROM conferences WHERE link = ?", [row.link], (err, result) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(result);
        });
      });

      if (!existingLink) {
        // Link does not exist, insert row
        insertStmt.run(row.date, row.conference, row.location, row.link);
        // Send message to WhatsApp
        sendTextMessage(`${row.date} - ${row.conference} - ${row.location} - ${row.link}`);
      } else {
        console.log(`Link ${row.link} already exists, skipping insertion.`);
      }
    }

    console.log("Data inserted into SQLite database.");

    // Finalize insert statement
    insertStmt.finalize();
    
    // Close database connection
    db.close();

  } catch (error) {
    console.error("Error extracting conference data:", error);
    // Handle the error as needed
  }

  await browser.close();
}

startVenom();


