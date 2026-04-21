import { Stage, Travel, TravelExpense, TravelSimple, TravelState, User } from 'abrechnung-common/types.js'
import test from 'ava'
import { shutdown } from '../../app.js'
import { objectToFormFields } from '../../helper.js'
import createAgent, { loginUser } from '../_agent.js'

const agent = await createAgent()
await loginUser(agent, 'user')

let travel: TravelSimple = {
  name: 'Ankara Aug 2023',
  reason: 'Fortbildung',
  destinationPlace: {
    //@ts-expect-error
    country: { _id: 'TR' },
    place: 'Ankara'
  },
  startDate: new Date('2023-08-24T00:00:00.000Z'),
  endDate: new Date('2023-09-02T00:00:00.000Z')
}

let originalVehicleRegistrationSetting: 'required' | 'optional' | 'none' | undefined

async function setVehicleRegistrationRequirement(vehicleRegistrationWhenUsingOwnCar: 'required' | 'optional' | 'none') {
  await loginUser(agent, 'admin')
  const settingsResponse = await agent.get('/travelSettings')
  const settings = settingsResponse.body.data
  originalVehicleRegistrationSetting ??= settings.vehicleRegistrationWhenUsingOwnCar
  await agent.post('/admin/travelSettings').send({ _id: settings._id, vehicleRegistrationWhenUsingOwnCar })
}

test.serial('GET /project', async (t) => {
  const res = await agent.get('/project')
  travel.project = res.body.data[0]
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
    t.fail()
  }
})

test.serial('POST /travel/appliedFor', async (t) => {
  t.plan(2)
  const res = await agent.post('/travel/appliedFor').send(travel)
  travel = res.body.result
  if (res.status === 200) {
    t.pass()
    const user: User = (await agent.get('/user')).body.data
    t.is((res.body.result as Travel).log[0]?.by._id, user._id)
  } else {
    console.log(res.body)
    t.fail()
  }
})

test.serial('GET /travel', async (t) => {
  t.plan(2)
  const res = await agent.get('/travel')
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
    t.fail()
  }
  for (const gotTravel of res.body.data as TravelSimple[]) {
    if (travel._id === gotTravel._id) {
      t.pass()
      break
    }
  }
})

// APPROVE

test.serial('GET /approve/travel', async (t) => {
  await loginUser(agent, 'travel')
  t.plan(2)
  const res = await agent.get('/approve/travel')
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
    t.fail()
  }
  for (const gotTravel of res.body.data as TravelSimple[]) {
    if (travel._id === gotTravel._id) {
      t.pass()
      break
    }
  }
})

test.serial('POST /approve/travel/approved', async (t) => {
  t.plan(5)
  const comment = 'A Comment'
  const res = await agent.post('/approve/travel/approved').send({ _id: travel._id, comment })
  if (res.status === 200) {
    t.pass()
    const user: User = (await agent.get('/user')).body.data
    t.is((res.body.result as Travel).log[10]?.by._id, user._id)
  } else {
    console.log(res.body)
    t.fail()
  }
  t.is((res.body.result as Travel).state, TravelState.APPROVED)
  t.is((res.body.result as Travel).history.length, 1)
  t.like((res.body.result as Travel).comments[0], { text: comment, toState: TravelState.APPROVED })
})

// FILL OUT

const stages: Stage[] = [
  {
    departure: new Date('2023-08-24T14:05:00.000Z'),
    arrival: new Date('2023-08-24T19:30:00.000Z'),
    startLocation: {
      //@ts-expect-error
      country: { _id: 'DE' },
      place: 'Frankfurt'
    },
    endLocation: {
      //@ts-expect-error
      country: { _id: 'TR' },
      place: 'Ankara'
    },
    midnightCountries: [],
    transport: { type: 'airplane' },
    cost: {
      amount: 652, //@ts-ignore
      currency: { _id: 'USD' }, //@ts-ignore
      receipts: [{ name: 'Online Invoice.pdf', type: 'application/pdf', data: 'tests/files/dummy.pdf' }],
      date: new Date('2023-08-04T00:00:00.000Z')
    },
    purpose: 'professional'
  },
  {
    departure: new Date('2023-08-29T11:30:00.000Z'),
    arrival: new Date('2023-08-29T14:05:00.000Z'),
    startLocation: {
      //@ts-expect-error
      country: { _id: 'TR' },
      place: 'Ankara'
    },
    endLocation: {
      //@ts-expect-error
      country: { _id: 'BG' },
      place: 'Sofia'
    },
    midnightCountries: [],
    transport: { type: 'airplane' }, //@ts-ignore
    cost: {
      amount: null, //@ts-ignore
      currency: { _id: 'EUR' }
    },
    purpose: 'professional'
  },
  {
    departure: new Date('2023-09-01T14:05:00.000Z'),
    arrival: new Date('2023-09-01T18:34:00.000Z'),
    startLocation: {
      //@ts-expect-error
      country: { _id: 'BG' },
      place: 'Sofia'
    },
    endLocation: {
      //@ts-expect-error
      country: { _id: 'DE' },
      place: 'Frankfurt'
    },
    midnightCountries: [],
    transport: { type: 'airplane' }, //@ts-ignore
    cost: {
      amount: null, //@ts-ignore
      currency: { _id: 'EUR' }
    },
    purpose: 'professional'
  }
]

test.serial('POST /travel/stage', async (t) => {
  await loginUser(agent, 'user')
  t.plan(stages.length + 0)
  for (const stage of stages) {
    let req = agent.post('/travel/stage').query({ parentId: travel._id.toString() })
    for (const entry of objectToFormFields(stage)) {
      if (entry.field.length > 6 && entry.field.slice(-6) === '[data]') {
        req = req.attach(entry.field, entry.val)
      } else {
        req = req.field(entry.field, entry.val)
      }
    }
    const res = await req
    if (res.status === 200) {
      travel = res.body.result
      t.pass()
    } else {
      console.log(res.body)
      t.fail()
    }
  }
})

const expenses: TravelExpense[] = [
  {
    description: 'Konferenzkosten',
    cost: {
      amount: 82, //@ts-ignore
      currency: { _id: 'TRY' }, //@ts-ignore
      receipts: [{ name: 'Photo.png', type: 'image/png', data: 'tests/files/dummy.png' }],
      date: new Date('2023-08-07T00:00:00.000Z')
    },
    purpose: 'professional'
  }
]

test.serial('POST /travel/expense', async (t) => {
  t.plan(expenses.length + 0)
  for (const expense of expenses) {
    let req = agent.post('/travel/expense').query({ parentId: travel._id.toString() })
    for (const entry of objectToFormFields(expense)) {
      if (entry.field.length > 6 && entry.field.slice(-6) === '[data]') {
        req = req.attach(entry.field, entry.val)
      } else {
        req = req.field(entry.field, entry.val)
      }
    }
    const res = await req
    if (res.status === 200) {
      travel = res.body.result
      t.pass()
    } else {
      console.log(res.body)
      t.fail()
    }
  }
})

test.serial('POST /travel/underExamination', async (t) => {
  t.plan(5)
  const comment = "A quite long comment but this doesn't matter because mongoose has no limit."
  const res = await agent.post('/travel/underExamination').send({ _id: travel._id, comment })
  if (res.status === 200) {
    t.pass()
    const user: User = (await agent.get('/user')).body.data
    t.is((res.body.result as Travel).log[20]?.by._id, user._id)
  } else {
    console.log(res.body)
    t.fail()
  }
  t.is((res.body.result as Travel).state, TravelState.IN_REVIEW)
  t.is((res.body.result as Travel).history.length, 2)
  t.like((res.body.result as Travel).comments[1], { text: comment, toState: TravelState.IN_REVIEW })
})

test.serial('POST /travel/approved AGAIN', async (t) => {
  t.plan(3)
  const res = await agent.post('/travel/approved').send({ _id: travel._id })
  if (res.status === 200) {
    travel = res.body.result
    t.pass()
  } else {
    console.log(res.body)
    t.fail()
  }
  t.is((res.body.result as Travel).state, TravelState.APPROVED)
  t.is((res.body.result as Travel).history.length, 3)
})

test.serial('POST /travel/stage keeps invalid travel saveable in approved state', async (t) => {
  t.plan(4)
  const overlappingStage: Stage = {
    ...(travel as Travel).stages[1],
    departure: new Date('2023-08-24T18:00:00.000Z'),
    arrival: new Date('2023-08-24T22:00:00.000Z')
  }

  let req = agent.post('/travel/stage').query({ parentId: travel._id.toString() })
  for (const entry of objectToFormFields(overlappingStage)) {
    if (entry.field.length > 6 && entry.field.slice(-6) === '[data]') {
      req = req.attach(entry.field, entry.val)
    } else {
      req = req.field(entry.field, entry.val)
    }
  }
  const res = await req
  if (res.status === 200) {
    travel = res.body.result
    t.pass()
  } else {
    console.log(res.body)
    t.fail()
  }
  t.is((res.body.result as Travel).addUp[0].lumpSums.amount, 0)
  t.false(Number.isNaN((res.body.result as Travel).addUp[0].total.amount))
  t.is((res.body.result as Travel).state, TravelState.APPROVED)
})

test.serial('POST /travel/underExamination rejects invalid travel', async (t) => {
  const res = await agent.post('/travel/underExamination').send({ _id: travel._id })
  t.is(res.status, 422)
})

test.serial('POST /travel/stage fixes invalid travel again', async (t) => {
  t.plan(2)
  const fixedStage: Stage = {
    ...(travel as Travel).stages[1],
    departure: new Date('2023-08-29T11:30:00.000Z'),
    arrival: new Date('2023-08-29T14:05:00.000Z')
  }

  let req = agent.post('/travel/stage').query({ parentId: travel._id.toString() })
  for (const entry of objectToFormFields(fixedStage)) {
    if (entry.field.length > 6 && entry.field.slice(-6) === '[data]') {
      req = req.attach(entry.field, entry.val)
    } else {
      req = req.field(entry.field, entry.val)
    }
  }
  const res = await req
  if (res.status === 200) {
    travel = res.body.result
    t.pass()
  } else {
    console.log(res.body)
    t.fail()
  }
  t.false(Number.isNaN((res.body.result as Travel).addUp[0].lumpSums.amount))
})

test.serial('POST /travel/underExamination AGAIN', async (t) => {
  t.plan(3)
  const res = await agent.post('/travel/underExamination').send({ _id: travel._id })
  if (res.status === 200) {
    travel = res.body.result
    t.pass()
  } else {
    console.log(res.body)
    t.fail()
  }
  t.is((res.body.result as Travel).state, TravelState.IN_REVIEW)
  t.is((res.body.result as Travel).history.length, 4)
})

test.serial('POST /travel/underExamination rejects ownCar without owner vehicle registration when required', async (t) => {
  await setVehicleRegistrationRequirement('required')
  await loginUser(agent, 'user')
  await agent.post('/user/vehicleRegistration').field('noop', '1')

  const ownCarTravel: TravelSimple = {
    name: 'Own Car May 2024',
    reason: 'Project meeting',
    destinationPlace: {
      //@ts-expect-error
      country: { _id: 'DE' },
      place: 'Berlin'
    },
    startDate: new Date('2024-05-14T00:00:00.000Z'),
    endDate: new Date('2024-05-14T00:00:00.000Z'),
    project: travel.project
  }

  const createdResponse = await agent.post('/travel/appliedFor').send(ownCarTravel)
  t.is(createdResponse.status, 200)
  const createdTravel = createdResponse.body.result as Travel

  await loginUser(agent, 'travel')
  const approvedResponse = await agent.post('/approve/travel/approved').send({ _id: createdTravel._id })
  t.is(approvedResponse.status, 200)

  await loginUser(agent, 'user')
  const ownCarStage: Stage = {
    departure: new Date('2024-05-14T08:00:00.000Z'),
    arrival: new Date('2024-05-14T18:00:00.000Z'),
    startLocation: {
      //@ts-expect-error
      country: { _id: 'DE' },
      place: 'Hamburg'
    },
    endLocation: {
      //@ts-expect-error
      country: { _id: 'DE' },
      place: 'Berlin'
    },
    midnightCountries: [],
    transport: { type: 'ownCar', distance: 100, distanceRefundType: 'car' },
    cost: {
      amount: 0, //@ts-ignore
      currency: { _id: 'EUR' }, //@ts-ignore
      receipts: [],
      date: new Date('2024-05-14T00:00:00.000Z')
    },
    purpose: 'professional'
  }

  let stageRequest = agent.post('/travel/stage').query({ parentId: createdTravel._id.toString() })
  for (const entry of objectToFormFields(ownCarStage)) {
    stageRequest = stageRequest.field(entry.field, entry.val)
  }
  const stageResponse = await stageRequest
  t.is(stageResponse.status, 200)

  const blockedResponse = await agent.post('/travel/underExamination').send({ _id: createdTravel._id })
  t.is(blockedResponse.status, 422)
  t.true(
    blockedResponse.body.errors.some(
      (error: { path?: string; message: string }) => error.path === 'stages.0.cost.receipts' && error.message === 'requiredForReview'
    )
  )
})

test.serial('POST /travel/underExamination allows ownCar with owner vehicle registration when required', async (t) => {
  await loginUser(agent, 'user')

  let vehicleRegistrationRequest = agent.post('/user/vehicleRegistration')
  for (const entry of objectToFormFields({
    vehicleRegistration: [{ name: 'vehicle-registration.pdf', type: 'application/pdf', data: 'tests/files/dummy.pdf' }]
  })) {
    if (entry.field.length > 6 && entry.field.slice(-6) === '[data]') {
      vehicleRegistrationRequest = vehicleRegistrationRequest.attach(entry.field, entry.val)
    } else {
      vehicleRegistrationRequest = vehicleRegistrationRequest.field(entry.field, entry.val)
    }
  }
  const uploadResponse = await vehicleRegistrationRequest
  t.is(uploadResponse.status, 200)

  const ownCarTravel: TravelSimple = {
    name: 'Own Car June 2024',
    reason: 'Workshop',
    destinationPlace: {
      //@ts-expect-error
      country: { _id: 'DE' },
      place: 'Berlin'
    },
    startDate: new Date('2024-06-12T00:00:00.000Z'),
    endDate: new Date('2024-06-12T00:00:00.000Z'),
    project: travel.project
  }

  const createdResponse = await agent.post('/travel/appliedFor').send(ownCarTravel)
  t.is(createdResponse.status, 200)
  const createdTravel = createdResponse.body.result as Travel

  await loginUser(agent, 'travel')
  const approvedResponse = await agent.post('/approve/travel/approved').send({ _id: createdTravel._id })
  t.is(approvedResponse.status, 200)

  await loginUser(agent, 'user')
  const ownCarStage: Stage = {
    departure: new Date('2024-06-12T08:00:00.000Z'),
    arrival: new Date('2024-06-12T18:00:00.000Z'),
    startLocation: {
      //@ts-expect-error
      country: { _id: 'DE' },
      place: 'Hamburg'
    },
    endLocation: {
      //@ts-expect-error
      country: { _id: 'DE' },
      place: 'Berlin'
    },
    midnightCountries: [],
    transport: { type: 'ownCar', distance: 100, distanceRefundType: 'car' },
    cost: {
      amount: 0, //@ts-ignore
      currency: { _id: 'EUR' }, //@ts-ignore
      receipts: [],
      date: new Date('2024-06-12T00:00:00.000Z')
    },
    purpose: 'professional'
  }

  let stageRequest = agent.post('/travel/stage').query({ parentId: createdTravel._id.toString() })
  for (const entry of objectToFormFields(ownCarStage)) {
    stageRequest = stageRequest.field(entry.field, entry.val)
  }
  const stageResponse = await stageRequest
  t.is(stageResponse.status, 200)

  const reviewResponse = await agent.post('/travel/underExamination').send({ _id: createdTravel._id })
  t.is(reviewResponse.status, 200)
  t.is((reviewResponse.body.result as Travel).state, TravelState.IN_REVIEW)

  if (originalVehicleRegistrationSetting) {
    await setVehicleRegistrationRequirement(originalVehicleRegistrationSetting)
  }
})

// EXAMINE

test.serial('POST /examine/travel/reviewCompleted', async (t) => {
  await loginUser(agent, 'travel')
  t.plan(5)
  const comment = '' // empty string should not create comment
  const res = await agent.post('/examine/travel/reviewCompleted').send({ _id: travel._id, comment })
  if (res.status === 200) {
    t.pass()
    const user: User = (await agent.get('/user')).body.data
    t.is((res.body.result as Travel).log[30]?.by._id, user._id)
  } else {
    console.log(res.body)
    t.fail()
  }
  t.is((res.body.result as Travel).state, TravelState.REVIEW_COMPLETED)
  t.is((res.body.result as Travel).history.length, 5)
  t.is((res.body.result as Travel).comments.length, 2)
})

// REPORT

test.serial('GET /travel/report', async (t) => {
  await loginUser(agent, 'user')
  const res = await agent.get('/travel/report').query({ _id: travel._id })
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
    t.fail()
  }
})

// BOOK

test.serial('POST /book/travel/booked', async (t) => {
  await loginUser(agent, 'travel')
  t.plan(2)
  const res = await agent.post('/book/travel/booked').send([travel._id])
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
    t.fail()
  }
  t.is(res.body.result[0].status, 'fulfilled')
})

// test.after.always('DELETE /travel', async (t) => {
//   await loginUser(agent, 'user')
//   const res = await agent.delete('/travel').query({ _id: travel._id })
//   if (res.status === 200) {
//     t.pass()
//   } else {
//     console.log(res.body)
//     t.fail()
//   }
// })

test.serial.after.always('Restore travel settings and drop DB connection', async () => {
  if (originalVehicleRegistrationSetting) {
    await setVehicleRegistrationRequirement(originalVehicleRegistrationSetting)
  }
  await shutdown()
})
