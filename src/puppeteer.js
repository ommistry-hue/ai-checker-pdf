import puppeteer from 'puppeteer'

/**
 * Renders HTML to a PDF buffer using Puppeteer.
 * AC: #4 — required launch flags for containerised/Linux environment
 * AC: #5 — browser.close() in finally block (NFR23)
 *
 * @param {string} html
 * @returns {Promise<Buffer>}
 */
export async function generatePdf(html) {
  let browser = null

  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        '--no-sandbox',              // Required in Docker/Render
        '--disable-setuid-sandbox',  // Required in Docker/Render
        '--disable-dev-shm-usage',   // Prevent /dev/shm OOM crashes
        '--disable-gpu',             // Not needed in headless server
      ],
    })

    const page = await browser.newPage()

    // waitUntil: 'networkidle0' ensures fonts/images are fully loaded
    await page.setContent(html, { waitUntil: 'networkidle0' })

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,  // Preserve background colours from templates
      margin: {
        top: '0',
        right: '0',
        bottom: '0',
        left: '0',
      },
    })

    return pdf
  } finally {
    // AC: #5 (NFR23) — ALWAYS close browser, even if generation throws
    if (browser) {
      await browser.close()
    }
  }
}
