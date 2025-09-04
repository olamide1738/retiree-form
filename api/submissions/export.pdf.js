import pkg from 'pg'
const { Pool } = pkg
import PDFDocument from 'pdfkit'

let pool

const initDB = async () => {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres.kkuwgmttbekyxsvpmrrw:Midebobo123%@aws-1-eu-west-2.pooler.supabase.com:5432/postgres',
      ssl: {
        rejectUnauthorized: false
      },
      max: 1, // Limit connections for serverless
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    })
  }
  return pool
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    await initDB()
    
    const submissionsResult = await pool.query('SELECT * FROM submissions ORDER BY id DESC')
    const filesResult = await pool.query('SELECT * FROM files')
    const submissions = submissionsResult.rows
    const files = filesResult.rows
    
    const filesBySubmission = {}
    files.forEach(f => {
      if (!filesBySubmission[f.submission_id]) filesBySubmission[f.submission_id] = []
      filesBySubmission[f.submission_id].push(f)
    })

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename="submissions.pdf"')

    const doc = new PDFDocument({ margin: 40, size: 'A4' })
    doc.pipe(res)

    doc.fontSize(16).text('Submissions Report', { align: 'center' })
    doc.moveDown()

    submissions.forEach((row, index) => {
      const data = JSON.parse(row.data_json || '{}')
      doc.fontSize(12).text(`Submission #${row.id} — ${row.created_at}`)
      const entries = Object.entries(data)
      entries.forEach(([k, v]) => {
        doc.fontSize(10).text(`${k}: ${v ?? ''}`)
      })

      const submissionFiles = filesBySubmission[row.id] || []
      if (submissionFiles.length) {
        doc.moveDown(0.25)
        doc.fontSize(11).text('Files:', { underline: true })
        submissionFiles.forEach(f => {
          const url = `${req.headers.host}/api/files/${f.id}`
          doc.fontSize(10).text(`- ${f.field_name}: ${f.original_name}`)
          doc.fontSize(9).fillColor('#1565c0').text(url)
          doc.fillColor('black')
        })
      }

      if (index < submissions.length - 1) {
        doc.moveDown()
        doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke()
        doc.moveDown()
      }
    })

    doc.end()
  } catch (error) {
    console.error('Error exporting to PDF:', error)
    res.status(500).json({ error: 'Failed to export to PDF' })
  }
}
