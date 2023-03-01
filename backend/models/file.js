const mongoose = require('mongoose')

const fileSchema = new mongoose.Schema({
  data: {type: Buffer},
  type: {type: String, enum: ['jpg', 'png', 'pdf']}
})


module.exports = mongoose.model('File', fileSchema)
