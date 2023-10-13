import express, { Request, Response } from 'express'
const router = express.Router()
import multer from 'multer'
const fileHandler = multer({ limits: { fileSize: 16000000 } })
import Token from '../../models/token.js'
import i18n from '../../i18n.js'
import { documentFileHandler } from '../../helper.js'

router.get('/', async (req, res) => {
  res.send({ data: req.user! })
})

router.get('/token', async (req, res) => {
  res.send({ data: req.user!.token })
})

router.delete('/token', async (req, res) => {
  req.user!.token = undefined
  await req.user!.save()
  res.send({ message: i18n.t('alerts.successDeleting') })
})

router.post('/token', async (req, res) => {
  const token = await new Token().save()
  req.user!.token = token as unknown as any
  req.user!.save()
  res.send({ message: i18n.t('alerts.successSaving'), result: token })
})

router.post('/settings', async (req, res) => {
  Object.assign(req.user!.settings, req.body)
  req.user!.markModified('settings')
  try {
    const result = await req.user!.save()
    res.send({ message: i18n.t('alerts.successSaving'), result: result.settings })
  } catch (error) {
    res.status(400).send({ message: i18n.t('alerts.errorSaving'), error: error })
  }
})

router.post(
  '/vehicleRegistration',
  [fileHandler.any(), documentFileHandler(['vehicleRegistration'], true)],
  async (req: Request, res: Response) => {
    if (req.body.vehicleRegistration && req.files) {
      req.user!.vehicleRegistration = req.body.vehicleRegistration
      req.user!.markModified('vehicleRegistration')
      try {
        const result = await req.user!.save()
        return res.send({ message: i18n.t('alerts.successSaving'), result: result })
      } catch (error) {
        return res.status(400).send({ message: i18n.t('alerts.errorSaving'), error: error })
      }
    }
    return res.sendStatus(403)
  }
)

export default router
