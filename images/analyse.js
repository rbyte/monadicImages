var fs = require('fs')
var images = require("./vangogh.json")

images.forEach(e => delete e.similarity)
images.forEach(e => delete e.date)

fs.writeFile("imagesLean.json", JSON.stringify(images), function(err) {})