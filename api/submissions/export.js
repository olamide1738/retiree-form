import pkg from 'pg'
const { Pool } = pkg
import ExcelJS from 'exceljs'

let pool

const initDB = async () => {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres.kkuwgmttbekyxsvpmrrw:Midebobo123%@aws-1-eu-west-2.pooler.supabase.com:5432/postgres',
      ssl: {
        rejectUnauthorized: false
      },
      // Minimal settings for Vercel
      max: 1,
      min: 0,
      idleTimeoutMillis: 0,
      connectionTimeoutMillis: 0, // No timeout
      acquireTimeoutMillis: 0, // No timeout
      allowExitOnIdle: true,
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

    submissions.forEach((row) => {
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
}
