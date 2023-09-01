import request from 'supertest'
import app from '../../app.js'
const agent = request.agent(app)

await agent.post('/login').send({ username: 'professor', password: 'professor' })

export default agent
