export function generatePixPayload(
  key: string,
  amount: number,
  name: string,
  city: string,
  txid: string,
  description: string,
) {
  const formatLength = (id: string, value: string) => {
    const len = value.length.toString().padStart(2, '0')
    return `${id}${len}${value}`
  }

  let payload = ''
  payload += formatLength('00', '01')

  let accountInfo = ''
  accountInfo += formatLength('00', 'br.gov.bcb.pix')
  accountInfo += formatLength('01', key)
  if (description) {
    accountInfo += formatLength('02', description.substring(0, 40))
  }
  payload += formatLength('26', accountInfo)

  payload += formatLength('52', '0000')
  payload += formatLength('53', '986')

  if (amount > 0) {
    payload += formatLength('54', amount.toFixed(2))
  }

  payload += formatLength('58', 'BR')
  payload += formatLength('59', name.substring(0, 25).trim() || 'Merchant')
  payload += formatLength('60', city.substring(0, 15).trim() || 'City')

  let additionalData = ''
  additionalData += formatLength('05', txid.substring(0, 25) || '***')
  payload += formatLength('62', additionalData)

  payload += '6304'

  let crc = 0xffff
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) > 0) {
        crc = (crc << 1) ^ 0x1021
      } else {
        crc = crc << 1
      }
    }
    crc &= 0xffff
  }

  return payload + crc.toString(16).toUpperCase().padStart(4, '0')
}
