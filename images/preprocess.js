var fs = require('fs')
var child_process = require('child_process')
var exec = child_process.exec

//var originalPath = "original/"
var originalPath = "original/"
var pathForSimilarity = "area1000/"
console.assert(fs.statSync(originalPath).isDirectory())

var images = fs.readdirSync(originalPath).map(e => ({file: e}))
images.forEach(e => e.similarity = new Array(images.length).fill(false))
images.forEach(e => console.assert(e.file.endsWith(".jpg")))


var threadQueue = {
	numberOfThreadsToRunInParallel: 4,
	showProgress: true,
	queue: [],
	add: function(cmd, callback) {
		this.queue.push({cmd: cmd, callback: callback, done: false})
	},
	run: function(runCallback) {
		var position = 0
		var percent = "0"
		var nextInLine = function() {
			if (position < threadQueue.queue.length) {
				//console.log(position)
				var e = threadQueue.queue[position]
				child_process.exec(e.cmd, function(error, stdout, stderr) {
					e.callback(error, stdout, stderr)
					e.done = true
					nextInLine()
					position++
					//console.log("left", threadQueue.queue.filter(e => !e.done).length)
					var newPercent = Number(position/threadQueue.queue.length*100).toFixed(0)
					console.log(position)
					if (threadQueue.showProgress && newPercent !== percent) {
						percent = newPercent
						console.log(percent+"%")
					}
					if (threadQueue.queue.every(e => e.done)) {
						threadQueue.queue = []
						runCallback()
					}
				})
			}
		}
		
		// do x times
		new Array(this.numberOfThreadsToRunInParallel).fill(true).forEach((e, i) => {
			nextInLine()
		})
		
	}
}



images.forEach((img1, i) => {
	// get date of creation of image
	var cmd = "identify -format '%[exif:DateTimeOriginal]' "+originalPath+img1.file
	threadQueue.add(cmd, function(error, stdout, stderr) {
		// some images may not have EXIF data, e.g. panoramas
		// "2008:10:11 16:42:31"
		var match = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(stdout)
		if (match) {
			// new Date(year, month, day, hour, minute, second, millisecond);
			var date = new Date(
				Number(match[1]),
				Number(match[2]) - 1, // month
				Number(match[3]),
				Number(match[4]),
				Number(match[5]),
				Number(match[6])
			)
			img1.date = date.getTime() // number ... better for JSON
		} else {
			img1.date = null // "undefined" is not taken into JSON
		}
	})
	
	// compute entire 2D similarity matrix, although we would only need one half of it
	images.forEach((img2, j) => {
		var cmd = "compare -metric PHASH "+pathForSimilarity+img1.file+" "+pathForSimilarity+img2.file+" /dev/null 2>&1"
		threadQueue.add(cmd, function(error, stdout, stderr) {
			img1.similarity[j] = Number(stdout)
		})
	})
	
})

threadQueue.run(function() {
	console.log("thread run done")
	
	// high value is low similarity
	// normalise into [0,1]
	var max = Math.max(...images.map(e => Math.max(...e.similarity)))
	images.forEach(e => {
		e.similarity = e.similarity.map(e => e/max)
	})
	
	fs.writeFile("images.json", JSON.stringify(images), function(err) {})
})



console.log("script done")
