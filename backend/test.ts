import test from 'ava'
import { testLogin, testGetUser, testGetUserToken, testPostUserToken, testDeleteUserToken } from './tests/user.js'

test('Login', testLogin)
test('GET /user', testGetUser)
test('GET /user/token', testGetUserToken)
test('POST /user/token', testPostUserToken)
test('DELETE /user/token', testDeleteUserToken)
