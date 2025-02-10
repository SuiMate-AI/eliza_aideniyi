import { google } from "googleapis";
import { JWT } from "google-auth-library";

// Load credentials from service account JSON key
const credentials = JSON.parse(process.env.GOOGLE_SHEET_CREDENTIALS || "{}");

class GoogleSheetHandler {
  private auth: JWT;
  private sheets: any;
  private sheetId: string;
  private range: string;

  constructor(sheetId: string, range: string) {
    this.auth = new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    this.sheets = google.sheets({ version: "v4", auth: this.auth });
    this.sheetId = sheetId;
    this.range = range;
  }

  async getSheetAsJson() {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.sheetId,
      range: this.range,
    });

    const rows = response.data.values;

    if (!rows) {
      throw new Error("No data found.");
    }

    const headers = rows[0];
    const jsonList = rows
      .slice(1)
      .map((row) =>
        Object.fromEntries(
          headers.map((header, index) => [header, row[index] || ""])
        )
      );

    return jsonList;
  }

  async removeSecondRow() {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.sheetId,
      range: this.range,
    });

    const rows = response.data.values;

    if (!rows) {
      throw new Error("No data found.");
    }

    if (rows.length > 1) {
      rows.splice(1, 1);
    }

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.sheetId,
      range: this.range,
      valueInputOption: "RAW",
      requestBody: {
        values: rows,
      },
    });

    console.log("Second row removed and sheet updated.");
  }
}

// Example Usage
const SHEET_ID = process.env.GOOGLE_SHEET_ID || "";
const RANGE = `${process.env.GOOGLE_SHEET_NAME}!A1:Z1000`; // Adjust range as needed

const sheetHandler = new GoogleSheetHandler(SHEET_ID, RANGE);
export default sheetHandler;
