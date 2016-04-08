

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


var jsons = ["images/vangogh.json"]
var resolutions = ["area1000", "area10000", "area100000", "area1000000"]
var w = 1500, h = 800
var canvasContainer
var pixiRenderer
var transition = false

function prepareVanGoghImages(images) {
	images.forEach(e => e.date = new Date(e.yearDrawn,1,1,1,1,1,1))
	// VANGOGH images width & height !== image resolution, nor proportional
	// to avoid ambiguity
	images.forEach(e => {
		e.physicalHeight = e.height
		delete e.height
		e.physicalWidth = e.width
		delete e.width
	})
	
	// similarity histogram equalization (specific to VANGOGH)
	images.forEach(e => e.similarity = e.similarity.map(x => Math.pow(x, 0.25)))
	
	var spreadCenterToCorners = x => Math.atan((x-0.5)*6)/2.5+0.5 // [0,1] => [0,1]
	images.forEach(e => e.similarity = e.similarity.map(x => spreadCenterToCorners(x)))
	return images
}


withLoadedJSONfiles(jsons, function([images]) {
	// retain indices for later referencing (after sort reordered array)
	// important for similarity indices
	images.forEach((e,i) => e.index = i)
	
	images.forEach(e => e.date = e.date ? undefined : new Date(e.date))
	
	// VAN GOGH ONLY
	images = prepareVanGoghImages(images)
	
	// low value should be low similarity
	images.forEach(e => e.similarity = e.similarity.map(x => 1-x))
	
	images.sort((a,b) => {
		// compare by date, fall back to compare by name if no date available
		if (!a.date || !b.date)
			return a.file < b.file ? -1 : 1
		return a.date < b.date ? -1 : 1
	})
	
	//var flatSim = [].concat(...images.map(e => e.similarity))
	//createHistogram(flatSim)
	
	// firefox: about:config: layers.acceleration.draw-fps
	// ~40 fps with 2260 images
	// ~10 fps with 22600 images
	// reduce number of rendered images
	//images = images.slice(0, 80)
	pixi(images)
})


function polarCoordinates(w, h, alpha, r) {
	var center = {x: w/2, y: h/2}
	var x = Math.cos(alpha)*r
	var y = Math.sin(alpha)*r
	var p = {x: center.x + x, y: center.y + y} 
	return p
}

var linearInterpolation = (low, value, high) => low + value * (high-low)

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
		
		alpha = linearInterpolation(start.alpha, progress, end.alpha)
		r = linearInterpolation(start.r, progress, end.r)
		scale = linearInterpolation(start.scale, progress, end.scale)
	} else {
		alpha = image.alpha
		r = image.r
		scale = image.scale
	}
	var circleDiameterPX = Math.min(w,h)
	var imageAreaPX = 10000
	var averageImageSideLength = Math.sqrt(imageAreaPX)
	var scaleFactor = circleDiameterPX / averageImageSideLength
	
	r *= circleDiameterPX
	
	var p = polarCoordinates(w, h, alpha, r)
	image.sprite.position.x = p.x
	image.sprite.position.y = p.y
	image.sprite.scale.x = scale*scaleFactor
	image.sprite.scale.y = scale*scaleFactor
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
	canvasContainer = document.getElementById("canvasContainer")
	pixiRenderer = new PIXI.WebGLRenderer(w, h)
	canvasContainer.appendChild(pixiRenderer.view)
	var stage = new PIXI.Container()
	
	window.onresize = function(event) { updateScreenElemsSize() }
	window.onresize()
	
	// relative values [0,1]
	var rStart = 0.1
	var rEnd = 0.7
	var scaleStart = 0.03
	var scaleEnd = 0.09
	var centeredImage = images[0]
	
	function zoom(event) {
		var wheelMovement = Math.max(-1, Math.min(1, (event.wheelDelta || -event.detail)))
		scaleEnd += wheelMovement*0.01
		updateImages()
		console.log(scaleEnd)
	}
	
	// IE9, Chrome, Safari, Opera
	canvasContainer.addEventListener("mousewheel", zoom, false)
	// Firefox
	canvasContainer.addEventListener("DOMMouseScroll", zoom, false)
	
	// The ParticleContainer class is a really fast version of the Container built solely for speed, so use when you need a lot of sprites or particles. The tradeoff of the ParticleContainer is that advanced functionality will not work. ParticleContainer implements only the basic object transform (position, scale, rotation). Any other functionality like tinting, masking, etc will not work on sprites in this batch.
	var container = new PIXI.ParticleContainer()
	stage.addChild(container)
	var alpha = 0
	
	function loadAllImages(callback) {
		// image loading so not synchronous in PIXI.Texture and PIXI.Sprite.
		// make sure everything is cached before continuing
		var loader = new PIXI.loaders.Loader()
		images.forEach(image => loader.add(image.file, "images/area10000/"+image.file))
		loader.once('complete', () => {
			console.log("all done loading!")
			images.forEach(image => initImage(image))
			console.assert(images.every(e => e.sprite))
			callback()
		})
		loader.load()
	}
	
	function initImage(image) {
		var texture = new PIXI.Texture.fromImage("images/area10000/"+image.file)
		image.texture = texture
		// PIXI.Sprite width & height refers to the actual on-canvas size, not the resolution of the source image
		image.resolution = {width: texture.width, height: texture.height}
		console.assert(image.resolution.width !== 0 && image.resolution.height !== 0)
		
		var sprite = new PIXI.Sprite(texture)
		//var sprite = new PIXI.Sprite.fromImage("images/area10000/"+image.file)
		console.assert(sprite)
		image.sprite = sprite
		// alpha = 0 is EAST
		image.alpha = alpha
		
		alpha += 1/images.length*2*Math.PI
		sprite.interactive = true
		// turns pointer to hand on mouseover
		//sprite.buttonMode = true
		
		var onButtonDown = function(mouseData) {
			updateImages(image)
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
	
	function updateImages(newCenter = centeredImage) {
		centeredImage = newCenter
		startTransition()
		images.forEach(img => {
			var similarity = centeredImage.similarity[img.index]
			img.r = linearInterpolation(rStart, (1-similarity), rEnd)
			img.scale = linearInterpolation(scaleStart, similarity, scaleEnd)
		})
		centeredImage.r = 0
		centeredImage.scale = scaleEnd*3
	}
	
	function animate() {
		// start the timer for the next animation loop
		requestAnimationFrame(animate)
		images.forEach(img => positionImage(w, h, img))
		pixiRenderer.render(stage)
	}
	
	loadAllImages(() => { // then:
		updateImages()
		animate()
	})
	
}



function createHistogram(values) {
	// Generate a Bates distribution of 10 random variables.
//var values = d3.range(1000).map(d3.random.bates(10));

// A formatter for counts.
	var formatCount = d3.format(",.0f");
	
	var margin = {top: 10, right: 30, bottom: 30, left: 30},
		width = 1500 - margin.left - margin.right,
		height = 500 - margin.top - margin.bottom;
	
	var x = d3.scale.linear()
		.domain([0, 1])
		.range([0, width]);

// Generate a histogram using twenty uniformly-spaced bins.
	var data = d3.layout.histogram()
		.bins(x.ticks(100))
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