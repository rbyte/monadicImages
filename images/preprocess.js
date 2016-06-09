var fs = require('fs')
var threadPool = require('./threadPool.js')

var originalPath = "upload/files/"

console.assert(fs.statSync(originalPath).isDirectory())

var images = fs.readdirSync(originalPath).map(e => ({file: e, meta: {}}))
images = images.filter(e => e.file.match(/\.(jpg|gif|bmp|png)$/g) !== null)
console.log("Processing "+images.length+" images.")
// console.log(images.map(e => e.file))
images.forEach(e => e.similarity = new Array(images.length).fill(false))

// TODO is currently resized even if source image is smaller. avoid upscaling
var areasToCreate = [1000,10000,100000,1000000]
areasToCreate.forEach(area => {
	var dir = "area"+area+"/"
	
	try {
		fs.statSync(dir).isDirectory()
		console.log("skipping resize to area: "+area+"px, because is already exists")
	} catch (e) {
		// directory does not exist
		console.log("resizing to area: "+area+"px")
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
				img1.meta.date = date.getTime() // number ... better for JSON
			} else {
				img1.meta.date = null // "undefined" is not taken into JSON
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
		// just in case an error happens after this ...
		fs.writeFileSync("images.json", JSON.stringify(images))
		console.assert(images.map(e => e.similarity.every(x => typeof x === "number" && !isNaN(x))).every(x => x))
		
		// high value is low similarity
		// reverse and normalise into [0,1]
		var max = Math.max(...images.map(e => Math.max(...e.similarity)))
		images.forEach(e => e.similarity = e.similarity.map(e => 1-e/max))
		equaliseSimilarity()
		images.forEach(e => e.similarity = e.similarity.map(e => Number(e.toFixed(4))))
		
		fs.writeFileSync("images.json", JSON.stringify(images))
		
		console.log("all done")
	})
	
})




// https://martin-thoma.com/calculate-histogram-equalization/
// assumes values are in [0,1]
function equaliseSimilarity() {
	const numberOfBuckets = 500
	var flatSim = [].concat(...images.map(e => e.similarity))
	var buckets = new Array(numberOfBuckets).fill(1).map((e,i) => (i+1)/numberOfBuckets)
	// accumulated histogram
	var accu = buckets.map(e => flatSim.filter(x => x<=e).length)
	console.assert(accu[accu.length-1] === flatSim.length)
	// into [0,1]
	var normalised = accu.map(e => e/flatSim.length)
	
	// TODO simplify.
	var bucketIndex = function(e) {
		var bucket = 0
		while (e > buckets[bucket])
			bucket++
		return bucket
	}
	
	images.forEach(e => e.similarity = e.similarity.map(e => normalised[bucketIndex(e)]))
	// but ensure that an image retains TO ITSELF the maximum similarity 1
	images.forEach((e,i) => e.similarity[i] = 1)
}
