import { useState, useCallback } from 'react'
import { UploadCloud, X, File as FileIcon, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileUploadProps {
  files: File[]
  setFiles: React.Dispatch<React.SetStateAction<File[]>>
  maxSizeMB?: number
  allowedTypes?: string[]
}

export function FileUpload({
  files,
  setFiles,
  maxSizeMB = 50,
  allowedTypes = ['.pdf', '.xml', '.xls', '.xlsx', '.jpg', '.jpeg', '.png', '.doc', '.docx'],
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const validateFile = (file: File) => {
    if (file.size > maxSizeMB * 1024 * 1024) {
      return `Arquivo ${file.name} excede o limite de ${maxSizeMB}MB.`
    }
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!allowedTypes.includes(ext)) {
      return `Formato não permitido: ${ext}`
    }
    return null
  }

  const handleFiles = (newFiles: File[]) => {
    let err = null
    const validFiles = newFiles.filter((f) => {
      const vErr = validateFile(f)
      if (vErr) err = vErr
      return !vErr
    })

    if (err) setError(err)
    if (validFiles.length > 0) {
      setFiles((prev) => [...prev, ...validFiles])
    }
  }

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      setError(null)
      const droppedFiles = Array.from(e.dataTransfer.files)
      handleFiles(droppedFiles)
    },
    [files],
  )

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setError(null)
      handleFiles(Array.from(e.target.files))
    }
  }

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          'border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center transition-colors cursor-pointer text-center relative',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/30 hover:bg-muted/30',
        )}
      >
        <input
          type="file"
          multiple
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          accept={allowedTypes.join(',')}
        />
        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-3">
          <UploadCloud className="h-6 w-6 text-primary" />
        </div>
        <p className="text-sm font-medium">Clique para buscar ou arraste os arquivos</p>
        <p className="text-xs text-muted-foreground mt-1">
          Suporta {allowedTypes.join(', ')} (Máx. {maxSizeMB}MB)
        </p>
      </div>

      {error && (
        <div className="text-xs text-destructive flex items-center gap-1 bg-destructive/10 p-2 rounded">
          <AlertCircle className="h-3.5 w-3.5" /> {error}
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
          {files.map((file, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-3 border rounded-md bg-background shadow-sm"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <FileIcon className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeFile(idx)}
                className="p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded transition-colors shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
