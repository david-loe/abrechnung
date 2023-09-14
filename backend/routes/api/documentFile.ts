import express from 'express'
const router = express.Router()
import { deleter } from '../../helper.js'
import DocumentFile from '../../models/documentFile.js'
import { mongo } from 'mongoose'

router.get('/', async (req, res) => {
  const file = await DocumentFile.findOne({ _id: req.query.id }).lean()
  if (file && req.user!._id.equals(file.owner._id)) {
    res.setHeader('Content-Type', file.type)
    res.setHeader('Content-Length', (file.data as any as mongo.Binary).length())
    return res.send((file.data as any as mongo.Binary).buffer)
  } else {
    return res.sendStatus(403)
  }
})

router.delete('/', deleter(DocumentFile, 'owner'))

export default router
