let { spawn } = require('child_process')
let path = require('path')
let fs = require('fs')

var isRunning = false

function start() {
  if (isRunning) return
  isRunning = true
  let args = [path.join(__dirname, "src", "main.js"), ...process.argv.slice(2)]
  let p = spawn(process.argv[0], args, {
    stdio: ['inherit', 'inherit', 'inherit', 'ipc']
  })
  p.on('message', data => {
    console.log('[RECEIVED]', data)
    switch (data) {
      case 'reset':
        p.kill()
        break
      case 'uptime':
        p.send(process.uptime())
        break
    }
  })
  p.on('exit', code => {
    isRunning = false
    start()
  })
}

start()