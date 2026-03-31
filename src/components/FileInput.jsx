import { useState } from 'react'

export default function FileInput({ name, accept, multiple, required, onChange, value }) {
  const [selectedFiles, setSelectedFiles] = useState([])

  // Use the value from props if available (it can be a single File, an array of Files, or null)
  const effectiveFiles = value 
    ? (Array.isArray(value) ? value : [value])
    : selectedFiles

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files || [])
    setSelectedFiles(files)
    
    // Create a new event with the same structure
    const syntheticEvent = {
      target: {
        name: event.target.name,
        files: event.target.files
      }
    }
    
    onChange(syntheticEvent)
  }

  const truncateFileName = (fileName, maxLength = 5) => {
    if (!fileName) return 'No file selected.'
    if (fileName.length <= maxLength) return fileName
    
    const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'))
    const extension = fileName.substring(fileName.lastIndexOf('.'))
    
    if (nameWithoutExt.length <= maxLength) {
      return fileName
    }
    
    return nameWithoutExt.substring(0, maxLength) + '...' + extension
  }

  const getDisplayText = () => {
    if (effectiveFiles.length === 0) {
      return 'No file selected.'
    }
    
    if (multiple) {
      if (effectiveFiles.length === 1) {
        return truncateFileName(effectiveFiles[0].name)
      } else {
        return `${effectiveFiles.length} files selected`
      }
    } else {
      return truncateFileName(effectiveFiles[0].name)
    }
  }

  return (
    <div className="file-input-container">
      <input
        type="file"
        name={name}
        accept={accept}
        multiple={multiple}
        onChange={handleFileChange}
        required={required && effectiveFiles.length === 0}
        className="file-input-hidden"
        id={`file-input-${name}`}
      />
      <label htmlFor={`file-input-${name}`} className="file-input-label">
        <span className="file-input-button">Browse...</span>
        <span className="file-input-display">{getDisplayText()}</span>
      </label>
    </div>
  )
}
