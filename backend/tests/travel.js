const User = require('../models/user')
const Travel = require('../models/travel')

async function getTestTravel() {
  const testUser = await User.findOne({})

  return new Travel({
    name: 'Test',
    traveler: testUser,
    state: 'appliedFor',
    editor: testUser,
    reason: 'reason',
    destinationPlace: { place: 'place', country: 'DE' },
    travelInsideOfEU: false,
    startDate: new Date(),
    endDate: new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000),
    advance: {
      amount: 100,
      currency: 'EUR',
    },
    claimOvernightLumpSum: true,
    records: [{
      type: 'stay',
      startDate: new Date(),
      endDate: new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000),
    }]
  })
}


async function testHistory(t) {
  const travel = await (await getTestTravel()).save()

  await travel.saveToHistory()
  travel.name = 'New Name'
  travel.advance.amount = 110
  travel.state = 'approved'
  const travelWithHistory = await travel.save()

  t.is(travelWithHistory.history.length, 1)
  t.true(travelWithHistory._id.equals(travel._id))
  t.false(travelWithHistory._id.equals(travelWithHistory.history[0]._id))
  travelWithHistory.deleteOne()
}

async function testLumpSumCalc(t) {
  const travel = await getTestTravel()
}

module.exports = {
  testHistory,
  testLumpSumCalc
}