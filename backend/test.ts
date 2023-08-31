import test from 'ava'
import {
  testLogin,
  testGetUser,
  testGetUserToken,
  testPostUserToken,
  testDeleteUserToken,
  testPostUserSettings,
  testPostUserVehicleRegistration
} from './tests/user.js'

test('Login', testLogin)
test('GET /user', testGetUser)
test('GET /user/token', testGetUserToken)
test('POST /user/token', testPostUserToken)
test('DELETE /user/token', testDeleteUserToken)
test('POST /user/settings', testPostUserSettings)
test('POST /user/vehicleRegistration', testPostUserVehicleRegistration)
