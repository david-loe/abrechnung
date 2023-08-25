import User from '../models/user.js'
import Travel from '../models/travel.js'

async function getTestTravel() {
  const testUser = await User.findOne({}).lean()

  return new Travel({
    name: 'Test',
    traveler: testUser,
    state: 'appliedFor',
    editor: testUser,
    reason: 'reason',
    destinationPlace: { place: 'place', country: 'DE' },
    travelInsideOfEU: false,
    startDate: new Date(),
    endDate: new Date(new Date().valueOf() + 7 * 24 * 60 * 60 * 1000),
    advance: {
      amount: 100,
      currency: 'EUR'
    },
    claimOvernightLumpSum: true,
    stages: [
      {
        departure: new Date(),
        arrival: new Date(new Date().valueOf() + 3 * 60 * 60 * 1000),
        transport: 'airplane',
        startLocation: {
          country: 'DE',
          place: 'München'
        },
        endLocation: {
          country: 'SE',
          place: 'Malmö'
        }
      }
    ]
  })
}

export async function testHistory(t: any) {
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

export async function testLumpSumCalc(t: any) {
  const travel = await getTestTravel()
}