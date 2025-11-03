// biome-ignore lint/complexity/noStaticOnlyClass: This class is intentionally static-only to provide utility methods without requiring instantiation
export class Base32 {
  static #KEY_STR = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
  static #KEY_INDEX: Record<string, number> = Object.fromEntries([...Base32.#KEY_STR].map((c, i) => [c, i]))

  static encode(n: number): string {
    if (n < 0) throw new Error('nur positive Zahlen')
    let out = ''
    do {
      out = Base32.#KEY_STR[n % 32] + out
      n = Math.floor(n / 32)
    } while (n > 0)
    return out
  }

  static decode(s: string): number {
    let n = 0
    for (const ch of s.trim().toUpperCase()) {
      const v = Base32.#KEY_INDEX[ch]
      if (v === undefined) throw new Error(`ungültiges Zeichen: ${ch}`)
      n = n * 32 + v
    }
    return n
  }
}

// biome-ignore lint/complexity/noStaticOnlyClass: This class is intentionally static-only to provide utility methods without requiring instantiation
export class Base64 {
  static #keyStr = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='

  static encode(input: string): string {
    let output = ''
    let chr1: number
    let chr2: number
    let chr3: number
    let enc1: number
    let enc2: number
    let enc3: number
    let enc4: number
    let i = 0

    const inputUTF8Save = Base64.#utf8_encode(input)

    while (i < inputUTF8Save.length) {
      chr1 = inputUTF8Save.charCodeAt(i++)
      chr2 = inputUTF8Save.charCodeAt(i++)
      chr3 = inputUTF8Save.charCodeAt(i++)

      enc1 = chr1 >> 2
      enc2 = ((chr1 & 3) << 4) | (chr2 >> 4)
      enc3 = ((chr2 & 15) << 2) | (chr3 >> 6)
      enc4 = chr3 & 63

      if (Number.isNaN(chr2)) {
        enc3 = enc4 = 64
      } else if (Number.isNaN(chr3)) {
        enc4 = 64
      }

      output =
        output + Base64.#keyStr.charAt(enc1) + Base64.#keyStr.charAt(enc2) + Base64.#keyStr.charAt(enc3) + Base64.#keyStr.charAt(enc4)
    }

    return output
  }

  static decode(input: string): string {
    let output = ''
    let chr1: number
    let chr2: number
    let chr3: number
    let enc1: number
    let enc2: number
    let enc3: number
    let enc4: number
    let i = 0

    const validBase64Input = input.replace(/[^A-Za-z0-9+/=]/g, '')

    while (i < validBase64Input.length) {
      enc1 = Base64.#keyStr.indexOf(validBase64Input.charAt(i++))
      enc2 = Base64.#keyStr.indexOf(validBase64Input.charAt(i++))
      enc3 = Base64.#keyStr.indexOf(validBase64Input.charAt(i++))
      enc4 = Base64.#keyStr.indexOf(validBase64Input.charAt(i++))

      chr1 = (enc1 << 2) | (enc2 >> 4)
      chr2 = ((enc2 & 15) << 4) | (enc3 >> 2)
      chr3 = ((enc3 & 3) << 6) | enc4

      output = output + String.fromCharCode(chr1)

      if (enc3 !== 64) {
        output = output + String.fromCharCode(chr2)
      }
      if (enc4 !== 64) {
        output = output + String.fromCharCode(chr3)
      }
    }

    output = Base64.#utf8_decode(output)

    return output
  }

  static #utf8_encode(string: string): string {
    const stringLineBreakCleaned = string.replace(/\r\n/g, '\n')
    let utftext = ''

    for (let n = 0; n < stringLineBreakCleaned.length; n++) {
      const c = stringLineBreakCleaned.charCodeAt(n)

      if (c < 128) {
        utftext += String.fromCharCode(c)
      } else if (c > 127 && c < 2048) {
        utftext += String.fromCharCode((c >> 6) | 192)
        utftext += String.fromCharCode((c & 63) | 128)
      } else {
        utftext += String.fromCharCode((c >> 12) | 224)
        utftext += String.fromCharCode(((c >> 6) & 63) | 128)
        utftext += String.fromCharCode((c & 63) | 128)
      }
    }

    return utftext
  }

  static #utf8_decode(utftext: string): string {
    let string = ''
    let i = 0
    let c: number
    let c2: number
    let c3 = 0

    while (i < utftext.length) {
      c = utftext.charCodeAt(i)

      if (c < 128) {
        string += String.fromCharCode(c)
        i++
      } else if (c > 191 && c < 224) {
        c2 = utftext.charCodeAt(i + 1)
        string += String.fromCharCode(((c & 31) << 6) | (c2 & 63))
        i += 2
      } else {
        c2 = utftext.charCodeAt(i + 1)
        c3 = utftext.charCodeAt(i + 2)
        string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63))
        i += 3
      }
    }

    return string
  }
}
