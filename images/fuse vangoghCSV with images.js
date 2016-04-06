var images = require("./images.json")

var fs = require('fs')
var parse = require('csv-parse')

var inputFile='vangogh.csv'

var parser = parse({delimiter: ','}, function (err, data) {
	// INTERESSANTE KEYS:
	// [ 'id',
	//	'material',
	//	'hoehe',
	//	'breite',
	//	'jahr', -> one Number: year
	//	'beschreibung',
	//	'index', "; "-seperated keywords
	
	var keys = data.shift()
	var idx = key => keys.indexOf(key)
	var x801 = data.find(e => e[idx("id")] === "801")
	data.splice(data.indexOf(x801), 1)
	
	console.assert(data.length === images.length)
	
	data.forEach(e => {
		var val = e[idx("id")]
		var img = images.find(e => e.file === val+".jpg")
		console.assert(img)
		
		img.height = Number(e[idx("hoehe")])
		img.width = Number(e[idx("breite")])
		img.yearDrawn = Number(e[idx("jahr")])
		
		img.keywords = e[idx("index")].split("; ")
		if (img.keywords[0] === "" && img.keywords.length === 1)
			img.keywords = []
		img.material = e[idx("material")]
		img.description = e[idx("beschreibung")]
	})
	
	images.forEach(e => {
		
	})
	
	fs.writeFile("vangogh.json", JSON.stringify(images), function(err) {})
})





fs.createReadStream(inputFile).pipe(parser)

console.log("done")
