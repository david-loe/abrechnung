import { getter, setter } from '../helper.js'
import Travel from '../models/travel.js'
import { sendNotificationMail } from '../mail/mail.js'
import express from 'express'
const router = express.Router()


router.get('/travel', async (req, res) => {
    const sortFn = (a, b) => a.startDate - b.startDate
    return getter(Travel, 'travel', 20, { state: 'appliedFor', historic: false }, { history: 0, stages: 0, expenses: 0, days: 0 }, sortFn)(req, res)
})

router.get('/travel/approved', async (req, res) => {
    const sortFn = (a, b) => a.startDate - b.startDate
    return getter(Travel, 'travel', 20, { state: 'approved', historic: false }, { history: 0, stages: 0, expenses: 0, days: 0 }, sortFn)(req, res)
})

function approve(state) {
    return async (req, res) => {
        req.body = {
            state: state,
            editor: req.user._id,
            comment: req.body.comment,
            _id: req.body._id
        }
        const check = async (oldObject) => {
            if (oldObject.state === 'appliedFor') {
                if (state === 'approved') {
                    await oldObject.saveToHistory()
                    await oldObject.save()
                }
                return true
            } else {
                return false
            }
        }
        return setter(Travel, '', false, check, sendNotificationMail)(req, res)
    }
}
router.post('/travel/approved', approve('approved'))
router.post('/travel/rejected', approve('rejected'))

export default router