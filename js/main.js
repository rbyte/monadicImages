

// synchronise xhr onload for all files
function withLoadedJSONfiles(fileNamesArray, callback) {
	var result = new Array(fileNamesArray.length).fill(false)
		
	fileNamesArray.forEach(function (e, i) {
		var xhr = new XMLHttpRequest()
		xhr.open("GET", e)
		xhr.onload = function() {
			result[i] = JSON.parse(xhr.responseText)
			if (result.every(e => e))
				callback(result)
		}
		xhr.send()
	})
}


var jsons = ["images/original/fileList.json", "images/compMatrix.json"]
var resolutions = ["area10000", "area100000", "area1000000"]


withLoadedJSONfiles(jsons, function([fileList, similarity]) {
	console.log(fileList)
	// similarity[i][j] refers to fileList[i] & fileList[j]
	// high value is low similarity
	similarity.forEach((e, i) => console.assert(similarity[i].length === similarity.length))
	similarity.forEach((e, i) => console.assert(similarity[i][i] === 0))
	// normalise into [0,1]
	var max = Math.max(...similarity.map(arr => Math.max(...arr)))
	similarity = similarity.map(arr => arr.map(e => e/max))
	var flatSim = [].concat(...similarity)
	
	
	//createHistogram(flatSim)
	
	pixi(fileList)
})



function pixi(fileList) {
	var w = 2100, h = 1200
	var renderer = new PIXI.WebGLRenderer(w, h)
	document.body.appendChild(renderer.view)
	var stage = new PIXI.Container()
	
	// The ParticleContainer class is a really fast version of the Container built solely for speed, so use when you need a lot of sprites or particles. The tradeoff of the ParticleContainer is that advanced functionality will not work. ParticleContainer implements only the basic object transform (position, scale, rotation). Any other functionality like tinting, masking, etc will not work on sprites in this batch.
	var container = new PIXI.ParticleContainer()
	stage.addChild(container)
	allImages = []
	
	function loadImageInPixi(path) {
		var sprite = new PIXI.Sprite.fromImage(path)
		sprite.position.x = Math.random()*w
		sprite.position.y = Math.random()*h
		//sprite.scale.x = 0.5
		//sprite.scale.y = 0.5
		allImages.push(sprite)
		//container.addChild(sprite)
		stage.addChild(sprite)
	}
	
	// firefox: about:config: layers.acceleration.draw-fps
	// ~40 fps with 2260 images
	// ~10 fps with 22600 images
	new Array(20).fill(0).forEach(() => 
		fileList.forEach(file => loadImageInPixi("images/area1000/"+file))
	)
	
	function animate() {
		// start the timer for the next animation loop
		requestAnimationFrame(animate)
		
		// rotation not slower than moving
		// each frame we spin the image around a bit
		allImages.forEach(img => img.rotation += Math.random()/100)
		
		
		// this is the main render call that makes pixi draw your container and its children.
		renderer.render(stage)
	}
	animate()
}



function createHistogram(values) {
	// Generate a Bates distribution of 10 random variables.
//var values = d3.range(1000).map(d3.random.bates(10));

// A formatter for counts.
	var formatCount = d3.format(",.0f");
	
	var margin = {top: 10, right: 30, bottom: 30, left: 30},
		width = 960 - margin.left - margin.right,
		height = 500 - margin.top - margin.bottom;
	
	var x = d3.scale.linear()
		.domain([0, 1])
		.range([0, width]);

// Generate a histogram using twenty uniformly-spaced bins.
	var data = d3.layout.histogram()
		.bins(x.ticks(20))
		(values);
	
	var y = d3.scale.linear()
		.domain([0, d3.max(data, function(d) { return d.y; })])
		.range([height, 0]);
	
	var xAxis = d3.svg.axis()
		.scale(x)
		.orient("bottom");
	
	var svg = d3.select("body").append("svg")
		.attr("width", width + margin.left + margin.right)
		.attr("height", height + margin.top + margin.bottom)
		.append("g")
		.attr("transform", "translate(" + margin.left + "," + margin.top + ")");
	
	var bar = svg.selectAll(".bar")
		.data(data)
		.enter().append("g")
		.attr("class", "bar")
		.attr("transform", function(d) { return "translate(" + x(d.x) + "," + y(d.y) + ")"; });
	
	bar.append("rect")
		.attr("x", 1)
		.attr("width", x(data[0].dx) - 1)
		.attr("height", function(d) { return height - y(d.y); });
	
	bar.append("text")
		.attr("dy", ".75em")
		.attr("y", 6)
		.attr("x", x(data[0].dx) / 2)
		.attr("text-anchor", "middle")
		.text(function(d) { return formatCount(d.y); });
	
	svg.append("g")
		.attr("class", "x axis")
		.attr("transform", "translate(0," + height + ")")
		.call(xAxis);
}