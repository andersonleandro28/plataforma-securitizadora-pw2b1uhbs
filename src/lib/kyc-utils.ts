export const getKycCompletion = (profile: any) => {
  if (!profile) return { percentage: 0, missingCount: 0, totalCount: 0, missingFields: [] }

  const isPj = profile.entity_type === 'pj'
  const requiredFields = isPj
    ? [
        'pj_company_name',
        'document_number',
        'phone',
        'address_zip',
        'address_street',
        'address_number',
        'address_neighborhood',
        'address_city',
        'address_state',
        'pj_rep_name',
        'pj_rep_cpf',
      ]
    : [
        'full_name',
        'document_number',
        'phone',
        'address_zip',
        'address_street',
        'address_number',
        'address_neighborhood',
        'address_city',
        'address_state',
        'pf_rg',
        'pf_nationality',
        'pf_birth_city',
      ]

  let filled = 0
  const missingFields: string[] = []

  requiredFields.forEach((field) => {
    if (
      profile[field] !== null &&
      profile[field] !== undefined &&
      String(profile[field]).trim() !== ''
    ) {
      filled++
    } else {
      missingFields.push(field)
    }
  })

  return {
    percentage: Math.round((filled / requiredFields.length) * 100),
    missingCount: requiredFields.length - filled,
    totalCount: requiredFields.length,
    missingFields,
  }
}

export const exportCsv = (filename: string, rows: any[]) => {
  if (!rows || !rows.length) return
  const separator = ','
  const keys = Object.keys(rows[0])
  const csvContent =
    keys.join(separator) +
    '\n' +
    rows
      .map((row) => {
        return keys
          .map((k) => {
            let cell = row[k] === null || row[k] === undefined ? '' : row[k]
            cell =
              cell instanceof Date
                ? cell.toLocaleString('pt-BR')
                : cell.toString().replace(/"/g, '""')
            if (cell.search(/("|,|\n)/g) >= 0) cell = `"${cell}"`
            return cell
          })
          .join(separator)
      })
      .join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
}
