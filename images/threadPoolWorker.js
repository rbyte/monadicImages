var child_process = require('child_process')

process.on('message', (msg) => {
	if (msg.title === "execute") {
		child_process.exec(msg.cmd, function(error, stdout, stderr) {
			process.send({
				title: "task completed",
				position: msg.position,
				error: error,
				stdout: stdout,
				stderr: stderr
			})
		})
	}
})

console.log("thread created.")
