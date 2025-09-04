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

    const doc = new PDFDocument({ 
      margin: 50, 
      size: 'A4',
      info: {
        Title: 'Retiree Verification Form - Submissions Report',
        Author: 'Lagos State Government',
        Subject: 'Retiree Verification Submissions',
        Creator: 'Retiree Verification System'
      }
    })
    doc.pipe(res)

    // Header
    doc.rect(50, 50, 495, 80)
      .fillColor('#B8860B')
      .fill()
    
    doc.fillColor('white')
      .fontSize(24)
      .font('Helvetica-Bold')
      .text('LAGOS STATE GOVERNMENT', 60, 70, { align: 'center', width: 475 })
    
    doc.fontSize(16)
      .text('Retiree Verification Form - Submissions Report', 60, 100, { align: 'center', width: 475 })
    
    doc.fillColor('black')
    doc.moveDown(3)

    // Summary
    doc.fontSize(14)
      .font('Helvetica-Bold')
      .text(`Total Submissions: ${submissions.length}`, { align: 'center' })
    
    doc.fontSize(10)
      .font('Helvetica')
      .text(`Generated on: ${new Date().toLocaleDateString('en-GB')} at ${new Date().toLocaleTimeString('en-GB')}`, { align: 'center' })
    
    doc.moveDown(2)

    submissions.forEach((row, index) => {
      const data = JSON.parse(row.data_json || '{}')
      
      // Submission header
      doc.rect(50, doc.y, 495, 25)
        .fillColor('#F5F5F5')
        .fill()
      
      doc.fillColor('black')
        .fontSize(12)
        .font('Helvetica-Bold')
        .text(`Submission #${row.id}`, 60, doc.y - 20)
      
      doc.fontSize(10)
        .font('Helvetica')
        .text(`Submitted: ${new Date(row.created_at).toLocaleDateString('en-GB')} at ${new Date(row.created_at).toLocaleTimeString('en-GB')}`, 200, doc.y - 20)
      
      doc.moveDown(1.5)

      // Personal Information Section
      if (data.fullName || data.dateOfBirth || data.gender || data.nationality) {
        doc.fontSize(11)
          .font('Helvetica-Bold')
          .fillColor('#B8860B')
          .text('PERSONAL INFORMATION', { underline: true })
        
        doc.fillColor('black')
        doc.fontSize(9)
        doc.font('Helvetica')
        
        const personalFields = [
          { key: 'fullName', label: 'Full Name' },
          { key: 'dateOfBirth', label: 'Date of Birth' },
          { key: 'gender', label: 'Gender' },
          { key: 'nationality', label: 'Nationality' },
          { key: 'residentialAddress', label: 'Residential Address' },
          { key: 'phoneNumber', label: 'Phone Number' },
          { key: 'emailAddress', label: 'Email Address' }
        ]
        
        personalFields.forEach(field => {
          if (data[field.key]) {
            doc.text(`${field.label}: ${data[field.key]}`, { indent: 20 })
          }
        })
        doc.moveDown(0.5)
      }

      // Employment Information Section
      if (data.organization || data.jobTitle || data.department) {
        doc.fontSize(11)
          .font('Helvetica-Bold')
          .fillColor('#B8860B')
          .text('EMPLOYMENT INFORMATION', { underline: true })
        
        doc.fillColor('black')
        doc.fontSize(9)
        doc.font('Helvetica')
        
        const employmentFields = [
          { key: 'organization', label: 'Organization' },
          { key: 'jobTitle', label: 'Job Title' },
          { key: 'department', label: 'Department' },
          { key: 'dateOfEmployment', label: 'Date of Employment' },
          { key: 'dateOfRetirement', label: 'Date of Retirement' },
          { key: 'retirementReason', label: 'Retirement Reason' },
          { key: 'lastSalaryOrGrade', label: 'Last Salary/Grade' }
        ]
        
        employmentFields.forEach(field => {
          if (data[field.key]) {
            doc.text(`${field.label}: ${data[field.key]}`, { indent: 20 })
          }
        })
        doc.moveDown(0.5)
      }

      // Pension Information Section
      if (data.pensionNumber || data.bankName || data.accountNumber) {
        doc.fontSize(11)
          .font('Helvetica-Bold')
          .fillColor('#B8860B')
          .text('PENSION INFORMATION', { underline: true })
        
        doc.fillColor('black')
        doc.fontSize(9)
        doc.font('Helvetica')
        
        const pensionFields = [
          { key: 'pensionNumber', label: 'Pension Number' },
          { key: 'bankName', label: 'Bank Name' },
          { key: 'accountNumber', label: 'Account Number' },
          { key: 'pensionPaymentMode', label: 'Payment Mode' },
          { key: 'bvn', label: 'BVN' }
        ]
        
        pensionFields.forEach(field => {
          if (data[field.key]) {
            doc.text(`${field.label}: ${data[field.key]}`, { indent: 20 })
          }
        })
        doc.moveDown(0.5)
      }

      // Next of Kin Section
      if (data.nextOfKinName || data.nextOfKinPhone) {
        doc.fontSize(11)
          .font('Helvetica-Bold')
          .fillColor('#B8860B')
          .text('NEXT OF KIN', { underline: true })
        
        doc.fillColor('black')
        doc.fontSize(9)
        doc.font('Helvetica')
        
        if (data.nextOfKinName) {
          doc.text(`Name: ${data.nextOfKinName}`, { indent: 20 })
        }
        if (data.nextOfKinPhone) {
          doc.text(`Phone: ${data.nextOfKinPhone}`, { indent: 20 })
        }
        doc.moveDown(0.5)
      }

      // Files Section
      const submissionFiles = filesBySubmission[row.id] || []
      if (submissionFiles.length) {
        doc.fontSize(11)
          .font('Helvetica-Bold')
          .fillColor('#B8860B')
          .text('ATTACHED DOCUMENTS', { underline: true })
        
        doc.fillColor('black')
        doc.fontSize(9)
        doc.font('Helvetica')
        
        submissionFiles.forEach(f => {
          doc.text(`• ${f.field_name}: ${f.original_name}`, { indent: 20 })
        })
        doc.moveDown(0.5)
      }

      // Additional Information
      if (data.preferredCommunication || data.healthStatus || data.additionalComments) {
        doc.fontSize(11)
          .font('Helvetica-Bold')
          .fillColor('#B8860B')
          .text('ADDITIONAL INFORMATION', { underline: true })
        
        doc.fillColor('black')
        doc.fontSize(9)
        doc.font('Helvetica')
        
        if (data.preferredCommunication) {
          doc.text(`Preferred Communication: ${data.preferredCommunication}`, { indent: 20 })
        }
        if (data.healthStatus) {
          doc.text(`Health Status: ${data.healthStatus}`, { indent: 20 })
        }
        if (data.additionalComments) {
          doc.text(`Additional Comments: ${data.additionalComments}`, { indent: 20 })
        }
        doc.moveDown(0.5)
      }

      // Page break between submissions (except for the last one)
      if (index < submissions.length - 1) {
        doc.addPage()
      }
    })

    doc.end()
  } catch (error) {
    console.error('Error exporting to PDF:', error)
    res.status(500).json({ error: 'Failed to export to PDF' })
  }
}
