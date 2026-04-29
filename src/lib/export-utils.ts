export function exportToCSV(data: any[], filename: string) {
  if (!data || data.length === 0) return

  const headers = Object.keys(data[0])
  const csvRows = data.map((row) =>
    headers
      .map((fieldName) => {
        let val = row[fieldName]
        if (val === null || val === undefined) val = ''
        const str = String(val).replace(/"/g, '""')
        return `"${str}"`
      })
      .join(','),
  )

  csvRows.unshift(headers.map((h) => `"${h}"`).join(','))
  const csvString = csvRows.join('\r\n')

  const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
