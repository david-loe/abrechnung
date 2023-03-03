const User = require('./models/user')
const Travel = require('./models/travel')
const Currency = require('./models/currency')

async function test(){
  const user = await User.findOne({})
  const euro = await Currency.findOne({code: 'EUR'})
  if(euro){
    const advance = {
      amount: 100,
      currency: euro,
    }
  
    var travel = new Travel({
      name: 'Test',
      traveler: user,
      state: 'appliedFor',
      editor: user,
      reason: 'reason',
      startDate: new Date(),
      endDate: new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000),
      advance: advance,
      claimOvernightLumpSum: true
    })
    await travel.save()
  
    travel = await Travel.findOne({_id: travel._id}) 
    console.log(travel)
  
    await travel.saveToHistory()
    travel.name = 'New Name'
    travel.advance.amount = 110
    await travel.save()
  
    travel = await Travel.findOne({_id: travel._id})
    console.log(travel)

    const oldTravel = await Travel.findOne({_id: travel.history[0]._id})
    console.log(oldTravel)
  }
  
}

test()