// scripts/webhook-listener.js
const express = require('express')
const app = express()
app.use(express.json())
app.post('/', (req, res) => {
  console.log('=== HEADERS ===')
  console.log(req.headers)
  console.log('=== BODY ===')
  console.log(JSON.stringify(req.body))
  res.sendStatus(200)
})
app.listen(4001, () => console.log('listener @ http://localhost:4001'))
