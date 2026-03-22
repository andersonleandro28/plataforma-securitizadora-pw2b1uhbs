import { useState, useCallback, useRef } from 'react'
import { UploadCloud, X, File as FileIcon, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'

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
  const inputRef = useRef<HTMLInputElement>(null)

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
      return `Formato não permitido: ${ext}. Use: ${allowedTypes.join(', ')}`
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
      // Create a clean new array to trigger re-renders properly
      setFiles((prev) => [...prev, ...validFiles])
    }

    // Reset input value so the same file can be selected again if removed
    if (inputRef.current) inputRef.current.value = ''
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    setError(null)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files))
    }
  }, [])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
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
        onClick={() => inputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center transition-all cursor-pointer text-center relative overflow-hidden group',
          isDragging
            ? 'border-primary bg-primary/10 scale-[1.02]'
            : 'border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          onChange={handleFileInput}
          className="hidden"
          accept={allowedTypes.join(',')}
        />
        <div
          className={cn(
            'w-14 h-14 rounded-full flex items-center justify-center mb-4 transition-colors',
            isDragging
              ? 'bg-primary text-primary-foreground'
              : 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground',
          )}
        >
          <UploadCloud className="h-7 w-7" />
        </div>
        <p className="text-base font-semibold">Clique para buscar ou arraste os arquivos aqui</p>
        <p className="text-xs text-muted-foreground mt-2">
          Suporta {allowedTypes.join(', ')} (Máx. {maxSizeMB}MB)
        </p>
      </div>

      {error && (
        <div className="text-sm text-destructive flex items-center gap-2 bg-destructive/10 p-3 rounded-md border border-destructive/20 animate-in fade-in">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
          {files.map((file, idx) => (
            <div
              key={`${file.name}-${idx}`}
              className="flex items-center justify-between p-3 border rounded-md bg-background shadow-sm hover:shadow transition-shadow animate-in slide-in-from-bottom-2"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="bg-muted p-2 rounded shrink-0">
                  <FileIcon className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" title={file.name}>
                    {file.name}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  removeFile(idx)
                }}
                className="p-2 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-md transition-colors shrink-0"
                title="Remover arquivo"
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
