var fs = require('fs')
var threadPool = require('./threadPool.js')

var originalPath = "original/"

console.assert(fs.statSync(originalPath).isDirectory())

var images = fs.readdirSync(originalPath).map(e => ({file: e}))
images.forEach(e => e.similarity = new Array(images.length).fill(false))
images.forEach(e => console.assert(e.file.endsWith(".jpg")))

var areasToCreate = [1000,10000,100000,1000000]
areasToCreate.forEach(area => {
	var dir = "area"+area+"/"
	if (!fs.statSync(dir).isDirectory()) {
		fs.mkdirSync(dir)
		images.forEach(img => {
			var cmd = "convert '"+img.file+"' -resize "+area+"@ '"+dir+img1.file+"'"
			threadPool.add(cmd)
		})
	}
})
threadPool.run(() => console.log("done resizing"))

images.forEach((img1, i) => {
	// get date of creation of image
	var cmd = "identify -format '%[exif:DateTimeOriginal]' "+originalPath+img1.file
	threadPool.add(cmd, function(error, stdout, stderr) {
		// some images may not have EXIF data, e.g. panoramas
		// "2008:10:11 16:42:31"
		var match = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(stdout)
		if (match) {
			var n = match.map(e => Number(e))
			// new Date(year, month, day, hour, minute, second, millisecond)
			var date = new Date(n[1], n[2]-1/*!*/, n[3], n[4], n[5], n[6])
			img1.date = date.getTime() // number ... better for JSON
		} else {
			img1.date = null // "undefined" is not taken into JSON
		}
	})
	
	// use smallest images for comparision, because this is time-consuming
	var pathForSimilarity = "area"+areasToCreate[0]+"/"
	images.forEach((img2, j) => {
		// we only need to compare on half of the 2D matrix
		if (j >= i) {
			var cmd = "compare -metric PHASH "+pathForSimilarity+img1.file+" "+pathForSimilarity+img2.file+" /dev/null 2>&1"
			threadPool.add(cmd, function(error, stdout, stderr) {
				images[i].similarity[j] = Number(stdout)
				images[j].similarity[i] = Number(stdout)
			})
		}
	})
})

if (false)
threadPool.run(function() {
	console.log("thread run done")
	
	// high value is low similarity
	// normalise into [0,1]
	var max = Math.max(...images.map(e => Math.max(...e.similarity)))
	images.forEach(e => e.similarity = e.similarity.map(e => e/max))
	
	fs.writeFile("images.json", JSON.stringify(images), function(err) {})
})

console.log("script done")
