var fs = require('fs')
var images = require('./images.json')

// images.forEach((e,i) => e.similarity[i] = 1)
// images.forEach(e => e.similarity = e.similarity.map(e => Number(e.toFixed(4))))

fs.writeFileSync("images.json", JSON.stringify(images))
