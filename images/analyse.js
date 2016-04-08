var fs = require('fs')
var images = require("./vangogh.json")

//images.forEach(e => e.similarity = e.similarity.map(x => 1-x))

fs.writeFile("vangogh2.json", JSON.stringify(images), function(err) {})
