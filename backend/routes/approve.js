const helper = require('../helper')
const Travel = require('../models/travel')
const User = require('../models/user')
const router = require('express').Router()

router.get('/travel', async (req, res) => {
    const sortFn = (a, b) => a.startDate - b.startDate
    return helper.getter(Travel, 'travel', 20, { state: 'appliedFor', historic: false }, { history: 0, records: 0, days: 0 }, sortFn)(req, res)
})

router.get('/travel/approved', async (req, res) => {
    const sortFn = (a, b) => a.startDate - b.startDate
    return helper.getter(Travel, 'travel', 20, { state: 'approved', historic: false }, { history: 0, records: 0, days: 0 }, sortFn)(req, res)
})

function approve(state) {
    return async (req, res) => {
        const user = await User.findOne({ uid: req.user[process.env.LDAP_UID_ATTRIBUTE] })
        req.body = {
            state: state,
            editor: user._id,
            comment: req.body.comment,
            _id: req.body._id
        }
        const check = async (oldObject) => {
            if (oldObject.state === 'appliedFor') {
                if(state === 'approved'){
                    await oldObject.saveToHistory()
                    await oldObject.save()
                }
                return true
            } else {
                return false
            }
        }
        return helper.setter(Travel, '', false, check)(req, res)
    }
}
router.post('/travel/approved', approve('approved'))
router.post('/travel/rejected', approve('rejected'))

module.exports = router