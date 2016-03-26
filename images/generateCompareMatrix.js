fs = require('fs')
var fileList = require('./original/fileList.json')
var compare = require('./area10000/compare.json')


function new2Darray(size) {
	var array = new Array(size)
	for (var i=0; i<array.length; i++)
		array[i] = new Array(size)
	return array
}

var compMatrix = new2Darray(fileList.length)

compare.forEach(function(e) {
	compMatrix[fileList.indexOf(e[0])][fileList.indexOf(e[1])] = e[2]
})

fs.writeFile("compMatrix.json", JSON.stringify(compMatrix), function(err) {})



console.log("done")
