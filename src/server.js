import 'dotenv/config'
import express from 'express'
import puppeteer from 'puppeteer'
import { generatePdf } from './puppeteer.js'

const app = express()
app.use(express.json({ limit: '10mb' }))

const PORT = process.env.PORT || 3001
const PDF_SERVICE_SECRET = process.env.PDF_SERVICE_SECRET

if (!PDF_SERVICE_SECRET) {
  console.error('FATAL: PDF_SERVICE_SECRET env var is not set')
  process.exit(1)
}

// AC: #2 — health check (also used for warm-up cron / UptimeRobot ping)
app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

// AC: #3 — PDF generation endpoint
app.post('/pdf', async (req, res) => {
  // AC: #6 — authenticate via shared secret header
  const apiKey = req.headers['x-api-key']
  if (apiKey !== PDF_SERVICE_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { html } = req.body
  if (!html || typeof html !== 'string') {
    return res.status(422).json({ error: 'html field is required' })
  }

  try {
    const pdfBuffer = await generatePdf(html)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename="resume.pdf"')
    res.send(pdfBuffer)
  } catch (err) {
    console.error('PDF generation failed:', err)
    res.status(500).json({ error: 'PDF generation failed' })
  }
})

// POST /scrape — scrape a public URL and return page text (Story 3.3)
app.post('/scrape', async (req, res) => {
  // Authenticate via shared secret
  const apiKey = req.headers['x-api-key']
  if (apiKey !== PDF_SERVICE_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { url } = req.body
  if (!url || typeof url !== 'string') {
    return res.status(422).json({ error: 'url field is required' })
  }

  // Basic URL validation
  let parsedUrl
  try {
    parsedUrl = new URL(url)
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Invalid protocol')
    }
  } catch {
    return res.status(422).json({ error: 'Invalid URL — must be a public http or https URL' })
  }

  let browser = null
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    })

    const page = await browser.newPage()

    // Set a realistic user agent to avoid bot-blocking
    await page.setUserAgent(
      'Mozilla/5.0 (compatible; AI-checker-bot/1.0; +https://ai-checker.app)'
    )

    // NFR25: 30-second navigation timeout
    await page.goto(parsedUrl.href, {
      waitUntil: 'networkidle2',
      timeout: 30_000,
    })

    // Extract readable text content (not raw HTML — cleaner for Gemini)
    const text = await page.evaluate(() => document.body.innerText)

    res.json({ text: text.slice(0, 12_000) }) // cap at 12k chars for Gemini token limit

  } catch (err) {
    console.error('Scrape error:', err.message)

    if (err.name === 'TimeoutError' || err.message.includes('timeout')) {
      return res.status(408).json({ error: 'Page took too long to load. Try a different URL.' })
    }
    if (err.message.includes('net::ERR')) {
      return res.status(422).json({ error: 'Could not reach that URL. Check it is publicly accessible.' })
    }

    res.status(500).json({ error: 'Failed to fetch page content' })
  } finally {
    // NFR23 — always close browser
    if (browser) await browser.close()
  }
})

app.listen(PORT, () => {
  console.log(`ai-checker-pdf listening on port ${PORT}`)
})
