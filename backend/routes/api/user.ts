import express from 'express'
const router = express.Router()
import multer from 'multer'
const fileHandler = multer({ limits: { fileSize: 16000000 } })
import Token from '../../models/token.js'
import DocumentFile from '../../models/documentFile.js'
import i18n from '../../i18n.js'

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

router.post('/vehicleRegistration', fileHandler.any(), async (req, res) => {
  if (req.body.vehicleRegistration && req.files) {
    for (var i = 0; i < req.body.vehicleRegistration.length; i++) {
      var buffer = null
      for (const file of req.files as Express.Multer.File[]) {
        if (file.fieldname == 'vehicleRegistration[' + i + '][data]') {
          buffer = file.buffer
          break
        }
      }
      if (buffer) {
        req.body.vehicleRegistration[i].owner = req.user!._id
        req.body.vehicleRegistration[i].data = buffer
      }
    }
    for (var i = 0; i < req.body.vehicleRegistration.length; i++) {
      if (req.body.vehicleRegistration[i]._id) {
        var foundReceipt = false
        if (req.user!.vehicleRegistration) {
          for (const oldReceipt of req.user!.vehicleRegistration) {
            if (oldReceipt._id!.equals(req.body.vehicleRegistration[i]._id)) {
              foundReceipt = true
            }
          }
        }

        if (!foundReceipt) {
          break
        }
        await DocumentFile.findOneAndUpdate({ _id: req.body.vehicleRegistration[i]._id }, req.body.vehicleRegistration[i])
      } else {
        try {
          var result = await new DocumentFile(req.body.vehicleRegistration[i]).save()
          req.body.vehicleRegistration[i] = result._id
        } catch (error) {
          return res.status(400).send({ message: i18n.t('alerts.errorSaving'), error: error })
        }
      }
    }
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
})

export default router
