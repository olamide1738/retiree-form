import { useState } from 'react'

export default function FileInput({ name, accept, multiple, required, onChange }) {
  const [selectedFiles, setSelectedFiles] = useState([])

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
    if (selectedFiles.length === 0) {
      return 'No file selected.'
    }
    
    if (multiple) {
      if (selectedFiles.length === 1) {
        return truncateFileName(selectedFiles[0].name)
      } else {
        return `${selectedFiles.length} files selected`
      }
    } else {
      return truncateFileName(selectedFiles[0].name)
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
        required={required}
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
