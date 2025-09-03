import express from 'express'
import cors from 'cors'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import sqlite3 from 'sqlite3'
import ExcelJS from 'exceljs'
import PDFDocument from 'pdfkit'

const app = express()
app.use(cors())
// Serve uploaded files statically (for direct links if needed)
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

// SQLite setup
const dbFile = path.resolve('./data.sqlite')
const db = new sqlite3.Database(dbFile)
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    data_json TEXT NOT NULL
  )`)
  db.run(`CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    submission_id INTEGER NOT NULL,
    field_name TEXT NOT NULL,
    original_name TEXT NOT NULL,
    stored_path TEXT NOT NULL,
    FOREIGN KEY(submission_id) REFERENCES submissions(id)
  )`)
})

// Health
app.get('/api/health', (_req, res) => res.json({ ok: true }))

// List submissions (parsed) with files metadata
app.get('/api/submissions', (_req, res) => {
  db.all(
    `SELECT s.id, s.created_at, s.data_json,
            (SELECT json_group_array(json_object('id', f.id, 'field', f.field_name, 'original', f.original_name, 'path', f.stored_path))
             FROM files f WHERE f.submission_id = s.id) AS files
     FROM submissions s ORDER BY s.id DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'DB read failed' })
      const result = rows.map(r => ({
        id: r.id,
        createdAt: r.created_at,
        data: JSON.parse(r.data_json || '{}'),
        files: r.files ? JSON.parse(r.files) : []
      }))
      res.json(result)
    }
  )
})

// Download a specific uploaded file by its database id
app.get('/api/files/:id', (req, res) => {
  const fileId = req.params.id
  db.get(`SELECT original_name, stored_path FROM files WHERE id = ?`, [fileId], (err, row) => {
    if (err) return res.status(500).json({ error: 'DB read failed' })
    if (!row) return res.status(404).json({ error: 'File not found' })
    const absolutePath = path.resolve(row.stored_path)
    if (!fs.existsSync(absolutePath)) return res.status(404).json({ error: 'File missing on disk' })
    res.download(absolutePath, row.original_name)
  })
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

app.post('/api/submissions', upload.fields(fileFields), (req, res) => {
  // Extract text fields
  const body = req.body || {}
  const createdAt = new Date().toISOString()

  // Persist JSON of all text fields
  db.run(
    `INSERT INTO submissions (created_at, data_json) VALUES (?, ?)`,
    [createdAt, JSON.stringify(body)],
    function (err) {
      if (err) return res.status(500).json({ error: 'DB insert failed' })
      const submissionId = this.lastID

      // Persist files metadata
      const filesToInsert = []
      const files = req.files || {}
      Object.keys(files).forEach((field) => {
        files[field].forEach((f) => {
          filesToInsert.push([
            submissionId,
            field,
            f.originalname,
            f.path
          ])
        })
      })

      if (filesToInsert.length === 0) {
        return res.json({ id: submissionId })
      }

      const placeholders = filesToInsert.map(() => '(?, ?, ?, ?)').join(',')
      const flat = filesToInsert.flat()
      db.run(
        `INSERT INTO files (submission_id, field_name, original_name, stored_path) VALUES ${placeholders}`,
        flat,
        (fileErr) => {
          if (fileErr) return res.status(500).json({ error: 'DB file insert failed' })
          res.json({ id: submissionId })
        }
      )
    }
  )
})

// Export to Excel
app.get('/api/submissions/export', (_req, res) => {
  db.all(`SELECT * FROM submissions ORDER BY id DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB read failed' })
    db.all(`SELECT * FROM files`, [], async (fErr, fRows) => {
      const filesBySubmission = {}
      if (!fErr && Array.isArray(fRows)) {
        fRows.forEach(f => {
          if (!filesBySubmission[f.submission_id]) filesBySubmission[f.submission_id] = []
          filesBySubmission[f.submission_id].push(f)
        })
      }

      const workbook = new ExcelJS.Workbook()
      const sheet = workbook.addWorksheet('Submissions')

      // Build columns from known fields and add file columns
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
      sheet.columns = allHeaders.map(([header, key]) => ({ header, key, width: Math.max(18, header.length + 2) }))

      rows.forEach((row) => {
        const data = JSON.parse(row.data_json || '{}')
        const record = { id: row.id, created_at: row.created_at }
        headers.slice(2).forEach(([, key]) => { record[key] = data[key] || '' })

        const files = filesBySubmission[row.id] || []
        const byField = files.reduce((acc, f) => {
          if (!acc[f.field_name]) acc[f.field_name] = []
          acc[f.field_name].push(f)
          return acc
        }, {})
        record.retirementLetter = (byField.retirementLetter?.[0]?.original_name) || ''
        record.birthCertOrId = (byField.birthCertOrId?.[0]?.original_name) || ''
        record.passportPhoto = (byField.passportPhoto?.[0]?.original_name) || ''
        record.declarantSignature = (byField.declarantSignature?.[0]?.original_name) || ''
        record.witnessSignature = (byField.witnessSignature?.[0]?.original_name) || ''
        record.otherDocuments = (byField.otherDocuments ? byField.otherDocuments.map(f => f.original_name).join(', ') : '')

        sheet.addRow(record)
      })

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', 'attachment; filename="submissions.xlsx"')
      await workbook.xlsx.write(res)
      res.end()
    })
  })
})

// Export to PDF
app.get('/api/submissions/export.pdf', (_req, res) => {
  db.all(`SELECT * FROM submissions ORDER BY id DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB read failed' })
    db.all(`SELECT * FROM files`, [], (fErr, fRows) => {
      const filesBySubmission = {}
      if (!fErr && Array.isArray(fRows)) {
        fRows.forEach(f => {
          if (!filesBySubmission[f.submission_id]) filesBySubmission[f.submission_id] = []
          filesBySubmission[f.submission_id].push(f)
        })
      }

      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', 'attachment; filename="submissions.pdf"')

      const doc = new PDFDocument({ margin: 40, size: 'A4' })
      doc.pipe(res)

      doc.fontSize(16).text('Submissions Report', { align: 'center' })
      doc.moveDown()

      rows.forEach((row, index) => {
        const data = JSON.parse(row.data_json || '{}')
        doc.fontSize(12).text(`Submission #${row.id} — ${row.created_at}`)
        const entries = Object.entries(data)
        entries.forEach(([k, v]) => {
          doc.fontSize(10).text(`${k}: ${v ?? ''}`)
        })

        const files = filesBySubmission[row.id] || []
        if (files.length) {
          doc.moveDown(0.25)
          doc.fontSize(11).text('Files:', { underline: true })
          files.forEach(f => {
            const url = `http://localhost:4000/api/files/${f.id}`
            doc.fontSize(10).text(`- ${f.field_name}: ${f.original_name}`)
            doc.fontSize(9).fillColor('#1565c0').text(url)
            doc.fillColor('black')
          })
        }

        if (index < rows.length - 1) {
          doc.moveDown()
          doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke()
          doc.moveDown()
        }
      })

      doc.end()
    })
  })
})

const PORT = process.env.PORT || 4000
app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`))


