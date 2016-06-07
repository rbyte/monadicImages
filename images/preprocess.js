var fs = require('fs')
var threadPool = require('./threadPool.js')

var originalPath = "upload/files/"
//var originalPath = "original/"

console.assert(fs.statSync(originalPath).isDirectory())

var images = fs.readdirSync(originalPath).map(e => ({file: e}))
	// exclude hidden files
	// .filter(e => !(/(^|\/)\.[^\/\.]/g).test(e))
images = images.filter(e => e.file.endsWith(".jpg"))
console.log(images)
// images.forEach(e => console.assert(e.file.endsWith(".jpg")))
images.forEach(e => e.similarity = new Array(images.length).fill(false))

var areasToCreate = [1000,10000,100000,1000000]
areasToCreate.forEach(area => {
	var dir = "area"+area+"/"
	
	try {
		fs.statSync(dir).isDirectory()
	} catch (e) {
		// directory does not exist
		fs.mkdirSync(dir)
		images.forEach(img => {
			var cmd = "convert '"+originalPath+img.file+"' -resize "+area+"@ '"+dir+img.file+"'"
			threadPool.add(cmd)
		})
	}
})

threadPool.run(() => {
	console.log("done resizing")
	
	images.forEach((img1, i) => {
		// get date of creation of image
		var cmd = "identify -format '%[exif:DateTimeOriginal]' "+originalPath+img1.file
		// if (false)
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
		
		// use smallest images for comparison, because it is time-consuming
		var pathForSimilarity = "area1000/"
		images.forEach((img2, j) => {
			// we only need to compare one half of the 2D matrix
			if (j >= i) {
				// Perceptual Hash
				var cmd = "compare -metric PHASH "+pathForSimilarity+img1.file+" "+pathForSimilarity+img2.file+" /dev/null 2>&1"
				threadPool.add(cmd, function(error, stdout, stderr) {
					var num = Number(stdout)
					images[i].similarity[j] = num
					images[j].similarity[i] = num
				})
			}
		})
	})
	
	threadPool.run(function() {
		console.log("thread run done")
		fs.writeFileSync("images.json", JSON.stringify(images))
		console.assert(images.map(e => e.similarity.every(x => typeof x === "number" && !isNaN(x))).every(x => x))
		
		// high value is low similarity
		// reverse and normalise into [0,1]
		var max = Math.max(...images.map(e => Math.max(...e.similarity)))
		images.forEach(e => e.similarity = e.similarity.map(e => Number((1-e/max).toFixed(4))))
		
		fs.writeFileSync("images.json", JSON.stringify(images))
		
		console.log("all done")
	})
	
})


