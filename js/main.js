

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


var jsons = [
	"images/original/fileList.json",
	"images/compMatrix.json",
	"images/original/created.json"]
var resolutions = ["area10000", "area100000", "area1000000"]
var w = 1500, h = 800
var canvasContainer
var pixiRenderer
var transition = false

withLoadedJSONfiles(jsons, function([fileList, similarity, created]) {
	// indices are the same across input arrays!
	// retain indices for later referencing (after sort reordered array)
	var images = fileList.map((e,i) => ({file: e, index: i}))
	canvasContainer = document.getElementById("canvasContainer")
	
	created = created.forEach(function(e, i) {
		if (e) { // some images may not have EXIF data, e.g. panoramas
			// "2008:10:11 16:42:31"
			var match = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(e)
			// new Date(year, month, day, hour, minute, second, millisecond);
			var date = new Date(
				Number(match[1]),
				Number(match[2]) - 1, // month
				Number(match[3]),
				Number(match[4]),
				Number(match[5]),
				Number(match[6])
			)
			images[i].date = date
		} else {
			images[i].date = undefined
		}
	})
	//console.log(created)
	
	// similarity[i][j] refers to fileList[i] & fileList[j]
	// high value is low similarity
	similarity.forEach((e, i) => console.assert(similarity[i].length === similarity.length))
	similarity.forEach((e, i) => console.assert(similarity[i][i] === 0))
	// normalise into [0,1]
	var max = Math.max(...similarity.map(arr => Math.max(...arr)))
	similarity = similarity.map(arr => arr.map(e => e/max))
	
	similarity.forEach((arr,i) => images[i].similarity = arr)
	var flatSim = [].concat(...similarity)
	
	images.sort((a,b) => {
		// compare by date, fall back to compare by name if no date available
		if (!a.date || !b.date)
			return a.file < b.file ? -1 : 1
		return a.date < b.date ? -1 : 1
	})
	
	images = images.slice(0, 40)
	
	//createHistogram(flatSim)
	pixi(images)
})


function polarCoordinates(w, h, alpha, r) {
	var center = {x: w/2, y: h/2}
	var x = Math.cos(alpha)*r
	var y = Math.sin(alpha)*r
	var p = {x: center.x + x, y: center.y + y} 
	return p
}



function positionImage(w, h, image) {
	var alpha, r, scale
	
	if (transition) {
		var dt = Date.now() - transition.start
		var progress = dt / transition.durationMS
		if (progress > 1) {
			progress = 1
			transition = false
		}
		
		var start = image.transitionStart
		var end = image
		
		alpha = start.alpha + (end.alpha - start.alpha) * progress
		r = start.r + (end.r - start.r) * progress
		scale = start.scale + (end.scale - start.scale) * progress
	} else {
		alpha = image.alpha
		r = image.r
		scale = image.scale
	}
	r *= Math.min(w,h)
	
	var p = polarCoordinates(w, h, alpha, r)
	image.sprite.position.x = p.x
	image.sprite.position.y = p.y
	image.sprite.scale.x = scale
	image.sprite.scale.y = scale
}

function updateScreenElemsSize() {
	var bb = canvasContainer.getBoundingClientRect()
	if (bb.width <= 0 || bb.height <= 0)
		return
	w = bb.width
	h = bb.height
	pixiRenderer.resize(w, h)
}

function pixi(images) {
	pixiRenderer = new PIXI.WebGLRenderer(w, h)
	canvasContainer.appendChild(pixiRenderer.view)
	var stage = new PIXI.Container()
	
	window.onresize = function(event) { updateScreenElemsSize() }
	window.onresize()
	
	// The ParticleContainer class is a really fast version of the Container built solely for speed, so use when you need a lot of sprites or particles. The tradeoff of the ParticleContainer is that advanced functionality will not work. ParticleContainer implements only the basic object transform (position, scale, rotation). Any other functionality like tinting, masking, etc will not work on sprites in this batch.
	var container = new PIXI.ParticleContainer()
	stage.addChild(container)
	
	var alpha = 0
	
	function loadImageInPixi(image) {
		var sprite = new PIXI.Sprite.fromImage("images/area10000/"+image.file)
		image.sprite = sprite
		// alpha = 0 is EAST
		image.alpha = alpha
		image.r = 0.3
		image.scale = 0.7
		
		alpha += 1/images.length*2*Math.PI
		sprite.interactive = true
		// turns pointer to hand on mouseover
		//sprite.buttonMode = true
		
		var onButtonDown = function(mouseData) {
			centerImage(image)
			image.sprite.scale.x += 0.3
			image.sprite.scale.y += 0.3
		}
		
		sprite.on('mousedown', onButtonDown)
		sprite.anchor.x = 0.5
		sprite.anchor.y = 0.5
		stage.addChild(sprite)
	}
	
	function startTransition() {
		transition = {
			start: Date.now(),
			durationMS: 300
		}
		images.forEach(e => {
			e.transitionStart = {
				r: e.r,
				alpha: e.alpha,
				scale: e.scale
			}
		})
	}
	
	function centerImage(image) {
		startTransition()
		images.forEach(img => {
			var similarity = image.similarity[img.index]
			img.r = 0.2 + similarity*1.2
			img.scale = 0.9 - similarity
		})
		
		image.r = 0
		image.scale = 1.3
	}
	
	// firefox: about:config: layers.acceleration.draw-fps
	// ~40 fps with 2260 images
	// ~10 fps with 22600 images
	new Array(1).fill(0).forEach(() =>
		images.forEach(e => loadImageInPixi(e))
	)
	
	centerImage(images[0])
	
		
	function animate() {
		// start the timer for the next animation loop
		requestAnimationFrame(animate)
		images.forEach(img => positionImage(w, h, img))
		pixiRenderer.render(stage)
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