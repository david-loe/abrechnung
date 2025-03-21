import { scrypt as _scrypt, randomBytes, timingSafeEqual } from 'crypto'
import { Types } from 'mongoose'
import { Strategy as BearerStrategy } from 'passport-http-bearer'
import User from '../models/user.js'

const SALT_LENGTH = 16
const KEY_LENGTH = 64

/**
 * Erstellt ein sicheres Bearer Token mit User-ID
 * @param userId Die User-ID
 * @param length Anzahl der zufälligen Bytes für den Token (Standard: 48 → 64 Zeichen in Base64)
 * @returns Ein Token im Format `<UserID>:<Base64-Token>`
 */
export function generateBearerToken(userId: string | Types.ObjectId, length: number = 48) {
  const randomToken = randomBytes(length).toString('base64')
  return `${userId}:${randomToken}` // User-ID im Token speichern
}

/**
 * Hasht den zufälligen Teil eines Tokens mit Scrypt
 * @param token Der vollständige Token (`<UserID>:<RandomToken>`)
 * @returns Das gehashte Token mit Salt (Format: `salt:hash`)
 */
export function hashToken(token: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const [userId, rawToken] = token.split(':') // UserID & Token trennen
    if (!rawToken) return reject(new Error('Ungültiges Token-Format'))

    const salt = randomBytes(SALT_LENGTH).toString('base64')
    _scrypt(rawToken, salt, KEY_LENGTH, (err, derivedKey) => {
      if (err) reject(err)
      else resolve(`${salt}:${derivedKey.toString('base64')}`)
    })
  })
}

/**
 * Überprüft, ob ein Passwort mit einem gespeicherten Hash übereinstimmt
 * @param storedHash Der gespeicherte Hash
 * @param password Das zu überprüfende Passwort
 * @returns true, wenn das Passwort gültig ist, sonst false
 */
function verifyToken(token: string, storedHash: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const [userId, rawToken] = token.split(':') // UserID extrahieren
    if (!rawToken) return reject(new Error('Ungültiges Token-Format'))

    const [salt, hash] = storedHash.split(':')
    _scrypt(rawToken, salt, KEY_LENGTH, (err, derivedKey) => {
      if (err) reject(err)
      else {
        const storedBuffer = Buffer.from(hash, 'base64')
        resolve(storedBuffer.length === derivedKey.length && timingSafeEqual(storedBuffer, derivedKey))
      }
    })
  })
}

// Bearer Strategy für Passport.js
export default new BearerStrategy(async function (token, done) {
  try {
    const [userId, rawToken] = token.split(':') // UserID aus dem Token extrahieren
    if (!userId || !rawToken) return done(null, false)

    const user = await User.findOne({ _id: userId, 'fk.httpBearer': { $exists: true } })
    if (!user) return done(null, false)

    const isValid = await verifyToken(token, user.fk.httpBearer!)
    if (isValid) done(null, user)
    else done(null, false)
  } catch (error) {
    done(error)
  }
})
