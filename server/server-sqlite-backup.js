import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import pkg from 'pg'
import ExcelJS from 'exceljs'
import PDFDocument from 'pdfkit'

const { Pool } = pkg
const app = express()
app.use(cors())
app.use(express.json())

// Serve uploaded files statically
app.use('/uploads', express.static(path.resolve('./uploads')))

// Ensure upload dir exists
const uploadsDir = path.resolve('./uploads')
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

// Multer storage config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir)
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9)
    const ext = path.extname(file.originalname)
    const safeField = String(file.fieldname).replace(/[^a-zA-Z0-9_-]/g, '_')
    cb(null, `${safeField}-${unique}${ext}`)
  }
})
const upload = multer({ storage })

// PostgreSQL connection
let pool
const initDB = async () => {
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || process.env.DB_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    })

    // Test connection
    const client = await pool.connect()
    console.log('Connected to PostgreSQL database')
    
    // Create tables if they don't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS submissions (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        data_json TEXT NOT NULL
      )
    `)
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS files (
        id SERIAL PRIMARY KEY,
        submission_id INTEGER NOT NULL,
        field_name VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        stored_path TEXT NOT NULL,
        FOREIGN KEY(submission_id) REFERENCES submissions(id) ON DELETE CASCADE
      )
    `)
    
    client.release()
    console.log('Database tables created/verified')
  } catch (error) {
    console.error('Database connection failed:', error)
    process.exit(1)
  }
}

// Health check
app.get('/api/health', (_req, res) => res.json({ ok: true }))

// List submissions with files metadata
app.get('/api/submissions', async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.id, s.created_at, s.data_json,
             COALESCE(
               (SELECT JSON_AGG(
                 JSON_BUILD_OBJECT(
                   'id', f.id,
                   'field', f.field_name,
                   'original', f.original_name,
                   'path', f.stored_path
                 )
               )
               FROM files f WHERE f.submission_id = s.id),
               '[]'::json
             ) AS files
      FROM submissions s 
      ORDER BY s.id DESC
    `)
    
    const submissions = result.rows.map(r => ({
      id: r.id,
      createdAt: r.created_at,
      data: JSON.parse(r.data_json || '{}'),
      files: r.files || []
    }))
    
    res.json(submissions)
  } catch (error) {
    console.error('Error fetching submissions:', error)
    res.status(500).json({ error: 'Failed to load submissions' })
  }
})

// Download a specific uploaded file
app.get('/api/files/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT original_name, stored_path FROM files WHERE id = $1',
      [req.params.id]
    )
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' })
    }
    
    const file = result.rows[0]
    const absolutePath = path.resolve(file.stored_path)
    
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ error: 'File missing on disk' })
    }
    
    res.download(absolutePath, file.original_name)
  } catch (error) {
    console.error('Error downloading file:', error)
    res.status(500).json({ error: 'Failed to download file' })
  }
})

// Delete a specific submission and its files
app.delete('/api/submissions/:id', async (req, res) => {
  try {
    const submissionId = req.params.id
    
    // Get files to delete from disk
    const filesResult = await pool.query(
      'SELECT stored_path FROM files WHERE submission_id = $1',
      [submissionId]
    )
    
    // Delete physical files
    filesResult.rows.forEach(file => {
      const absolutePath = path.resolve(file.stored_path)
      if (fs.existsSync(absolutePath)) {
        try {
          fs.unlinkSync(absolutePath)
        } catch (unlinkErr) {
          console.error('Failed to delete file:', absolutePath, unlinkErr)
        }
      }
    })
    
    // Delete from database (files will be deleted due to foreign key constraint)
    const result = await pool.query(
      'DELETE FROM submissions WHERE id = $1',
      [submissionId]
    )
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Submission not found' })
    }
    
    res.json({ success: true, deletedId: submissionId })
  } catch (error) {
    console.error('Error deleting submission:', error)
    res.status(500).json({ error: 'Failed to delete submission' })
  }
})

// Clear all submissions and their files
app.delete('/api/submissions', async (req, res) => {
  try {
    // Get all files to delete from disk
    const filesResult = await pool.query('SELECT stored_path FROM files')
    
    // Delete all physical files
    filesResult.rows.forEach(file => {
      const absolutePath = path.resolve(file.stored_path)
      if (fs.existsSync(absolutePath)) {
        try {
          fs.unlinkSync(absolutePath)
        } catch (unlinkErr) {
          console.error('Failed to delete file:', absolutePath, unlinkErr)
        }
      }
    })
    
    // Clear database tables
    await pool.query('DELETE FROM files')
    await pool.query('DELETE FROM submissions')
    
    res.json({ success: true, message: 'All submissions cleared' })
  } catch (error) {
    console.error('Error clearing submissions:', error)
    res.status(500).json({ error: 'Failed to clear submissions' })
  }
})

// Save submission - handle many possible files
const fileFields = [
  { name: 'retirementLetter', maxCount: 1 },
  { name: 'birthCertOrId', maxCount: 1 },
  { name: 'passportPhoto', maxCount: 1 },
  { name: 'otherDocuments', maxCount: 20 },
  { name: 'declarantSignature', maxCount: 1 },
  { name: 'witnessSignature', maxCount: 1 },
]

app.post('/api/submissions', upload.fields(fileFields), async (req, res) => {
  try {
    const body = req.body || {}
    const createdAt = new Date().toISOString()

    // Insert submission
    const result = await pool.query(
      'INSERT INTO submissions (created_at, data_json) VALUES ($1, $2) RETURNING id',
      [createdAt, JSON.stringify(body)]
    )
    
    const submissionId = result.rows[0].id

    // Insert files metadata
    const files = req.files || {}
    const fileInserts = []
    
    Object.keys(files).forEach((field) => {
      files[field].forEach((f) => {
        fileInserts.push([submissionId, field, f.originalname, f.path])
      })
    })

    if (fileInserts.length > 0) {
      const placeholders = fileInserts.map((_, i) => 
        `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`
      ).join(',')
      const flat = fileInserts.flat()
      
      await pool.query(
        `INSERT INTO files (submission_id, field_name, original_name, stored_path) VALUES ${placeholders}`,
        flat
      )
    }

    res.json({ id: submissionId })
  } catch (error) {
    console.error('Error saving submission:', error)
    res.status(500).json({ error: 'Failed to save submission' })
  }
})

// Export to Excel
app.get('/api/submissions/export', async (_req, res) => {
  try {
    const submissionsResult = await pool.query('SELECT * FROM submissions ORDER BY id DESC')
    const filesResult = await pool.query('SELECT * FROM files')
    
    const filesBySubmission = {}
    filesResult.rows.forEach(f => {
      if (!filesBySubmission[f.submission_id]) filesBySubmission[f.submission_id] = []
      filesBySubmission[f.submission_id].push(f)
    })

    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Submissions')

    const headers = [
      ['ID', 'id'],
      ['Created At', 'created_at'],
      ['Full Name', 'fullName'],
      ['Date of Birth', 'dateOfBirth'],
      ['Gender', 'gender'],
      ['Nationality', 'nationality'],
      ['Residential Address', 'residentialAddress'],
      ['Phone Number', 'phoneNumber'],
      ['Email Address', 'emailAddress'],
      ['Next of Kin Name', 'nextOfKinName'],
      ['Next of Kin Phone', 'nextOfKinPhone'],
      ['Organization', 'organization'],
      ['Job Title', 'jobTitle'],
      ['Department', 'department'],
      ['Date of Employment', 'dateOfEmployment'],
      ['Date of Retirement', 'dateOfRetirement'],
      ['Retirement Reason', 'retirementReason'],
      ['Last Salary / Grade', 'lastSalaryOrGrade'],
      ['Pension Number', 'pensionNumber'],
      ['Bank Name', 'bankName'],
      ['Account Number', 'accountNumber'],
      ['Payment Mode', 'pensionPaymentMode'],
      ['BVN', 'bvn'],
      ['Confirm Accuracy', 'confirmAccuracy'],
      ['Declaration Date', 'declarationDate'],
      ['Witness Name', 'witnessName'],
      ['Witness Date', 'witnessDate'],
      ['Preferred Communication', 'preferredCommunication'],
      ['Health Status', 'healthStatus'],
      ['Additional Comments', 'additionalComments']
    ]
    
    const fileHeaders = [
      ['Retirement Letter (file)', 'retirementLetter'],
      ['Birth Cert / ID (file)', 'birthCertOrId'],
      ['Passport Photo (file)', 'passportPhoto'],
      ['Other Documents (files)', 'otherDocuments'],
      ['Declarant Signature (file)', 'declarantSignature'],
      ['Witness Signature (file)', 'witnessSignature']
    ]
    
    const allHeaders = [...headers, ...fileHeaders]
    sheet.columns = allHeaders.map(([header, key]) => ({ 
      header, 
      key, 
      width: Math.max(18, header.length + 2) 
    }))

    submissionsResult.rows.forEach((row) => {
      const data = JSON.parse(row.data_json || '{}')
      const record = { id: row.id, created_at: row.created_at }
      headers.slice(2).forEach(([, key]) => { 
        record[key] = data[key] || '' 
      })

      const submissionFiles = filesBySubmission[row.id] || []
      const byField = submissionFiles.reduce((acc, f) => {
        if (!acc[f.field_name]) acc[f.field_name] = []
        acc[f.field_name].push(f)
        return acc
      }, {})
      
      record.retirementLetter = (byField.retirementLetter?.[0]?.original_name) || ''
      record.birthCertOrId = (byField.birthCertOrId?.[0]?.original_name) || ''
      record.passportPhoto = (byField.passportPhoto?.[0]?.original_name) || ''
      record.declarantSignature = (byField.declarantSignature?.[0]?.original_name) || ''
      record.witnessSignature = (byField.witnessSignature?.[0]?.original_name) || ''
      record.otherDocuments = (byField.otherDocuments ? 
        byField.otherDocuments.map(f => f.original_name).join(', ') : '')

      sheet.addRow(record)
    })

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename="submissions.xlsx"')
    await workbook.xlsx.write(res)
    res.end()
  } catch (error) {
    console.error('Error exporting to Excel:', error)
    res.status(500).json({ error: 'Failed to export to Excel' })
  }
})

// Export to PDF
app.get('/api/submissions/export.pdf', async (_req, res) => {
  try {
    const submissionsResult = await pool.query('SELECT * FROM submissions ORDER BY id DESC')
    const filesResult = await pool.query('SELECT * FROM files')
    
    const filesBySubmission = {}
    filesResult.rows.forEach(f => {
      if (!filesBySubmission[f.submission_id]) filesBySubmission[f.submission_id] = []
      filesBySubmission[f.submission_id].push(f)
    })

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename="submissions.pdf"')

    const doc = new PDFDocument({ margin: 40, size: 'A4' })
    doc.pipe(res)

    doc.fontSize(16).text('Submissions Report', { align: 'center' })
    doc.moveDown()

    submissionsResult.rows.forEach((row, index) => {
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
          const url = `${req.protocol}://${req.get('host')}/api/files/${f.id}`
          doc.fontSize(10).text(`- ${f.field_name}: ${f.original_name}`)
          doc.fontSize(9).fillColor('#1565c0').text(url)
          doc.fillColor('black')
        })
      }

      if (index < submissionsResult.rows.length - 1) {
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
})

// Initialize database and start server
const PORT = process.env.PORT || 4000
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`)
  })
})
