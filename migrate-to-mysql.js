#!/usr/bin/env node

/**
 * Migration script to move data from SQLite to MySQL
 * Run this after setting up your PlanetScale database
 */

import sqlite3 from 'sqlite3'
import mysql from 'mysql2/promise'
import fs from 'fs'
import path from 'path'

// Configuration
const SQLITE_DB = './server/data.sqlite'
const MYSQL_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'retiree_form',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
}

async function migrateData() {
  console.log('Starting migration from SQLite to MySQL...')
  
  // Connect to MySQL
  const mysqlConnection = await mysql.createConnection(MYSQL_CONFIG)
  console.log('Connected to MySQL database')
  
  // Connect to SQLite
  const sqliteDb = new sqlite3.Database(SQLITE_DB)
  console.log('Connected to SQLite database')
  
  try {
    // Migrate submissions
    console.log('Migrating submissions...')
    const submissions = await new Promise((resolve, reject) => {
      sqliteDb.all('SELECT * FROM submissions', (err, rows) => {
        if (err) reject(err)
        else resolve(rows)
      })
    })
    
    for (const submission of submissions) {
      await mysqlConnection.execute(
        'INSERT INTO submissions (id, created_at, data_json) VALUES (?, ?, ?)',
        [submission.id, submission.created_at, submission.data_json]
      )
    }
    console.log(`Migrated ${submissions.length} submissions`)
    
    // Migrate files
    console.log('Migrating files...')
    const files = await new Promise((resolve, reject) => {
      sqliteDb.all('SELECT * FROM files', (err, rows) => {
        if (err) reject(err)
        else resolve(rows)
      })
    })
    
    for (const file of files) {
      await mysqlConnection.execute(
        'INSERT INTO files (id, submission_id, field_name, original_name, stored_path) VALUES (?, ?, ?, ?, ?)',
        [file.id, file.submission_id, file.field_name, file.original_name, file.stored_path]
      )
    }
    console.log(`Migrated ${files.length} files`)
    
    console.log('Migration completed successfully!')
    
  } catch (error) {
    console.error('Migration failed:', error)
  } finally {
    sqliteDb.close()
    await mysqlConnection.end()
  }
}

// Run migration if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateData()
}

export { migrateData }
