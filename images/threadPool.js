// runs system commands with multithreading

var child_process = require('child_process')

var showProgress = true
var queue = []

function add(cmd, callback = () => {}) {
	queue.push({cmd: cmd, callback: callback, done: false})
}

function run(runCallback = () => {}, numThreads = 4) {
	if (queue.length === 0)
		return runCallback()
	var threads = []
	var position = 0
	var percent = "0"
	var startTime = Date.now()
	// avoid creating threads that will do nothing
	numThreads = Math.min(numThreads, Math.max(1, queue.length))
	
	function scheduleNextInLine(thread) {
		if (position < queue.length) {
			var e = queue[position]
			// sending functions does not work (will be received as undefined)
			thread.send({title: "execute", cmd: e.cmd, position: position})
			position++
		}
	}
	
	new Array(numThreads).fill(true).forEach((e, i) => {
		var thread = child_process.fork("./threadPoolWorker.js")
		threads.push(thread)
		thread.on('message', function(msg) {
			if (msg.title === "task completed") {
				scheduleNextInLine(thread)
				var newPercent = Number(position/queue.length*100).toFixed(0)
				if (showProgress && newPercent !== percent && Date.now()-startTime > 2000) {
					percent = newPercent
					console.log(percent+"%")
				}
				var e = queue[msg.position]
				e.done = true
				e.callback(msg.error, msg.stdout, msg.stderr)
				
				if (queue.every(e => e.done)) {
					queue = []
					threads.forEach(thread => thread.disconnect())
					threads = []
					runCallback()
				}
			}
		})
		
		// number of items that any one thread is working on at once
		scheduleNextInLine(thread)
		// scheduleNextInLine(thread)
	})
}

exports.add = add
exports.run = run

function test() {
	new Array(8).fill(true).forEach((e,i) => {
		add("echo 'muh"+i+"'", (error, stdout, stderr) => { console.log(stdout) })
	})
	
	run(() => { console.log("done") })
}

//test()
