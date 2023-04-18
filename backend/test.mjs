import test from 'ava';
import travelTests from './tests/travel.js'
import app from './app.js'

test('Travel History', travelTests.testHistory);
