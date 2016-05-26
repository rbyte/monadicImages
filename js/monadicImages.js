//var d3 = require("d3")
//var PIXI = require("pixi.js")

const τ = Math.PI*2
const availableImageSizesByArea = [1000, 10000, 100000, 1000000]
const availableImageSizesByAreaToPreload = [true, false, false, false]
const jsons = ["images/vangogh.json"]
const distortCircleIntoCanvasRectangle = true

var canvasContainer
var pixiRenderer
var stage
var transition = false

// relative values
var w = 1500, h = 800
var rStart = 0.1
var rEnd = 1.00
// the center of mass needs to remain ~1!
var scaleStart = 0.7
var scaleEnd = 1.8
var powerSimilarity = 1
var powerScale = 0.5
var titelKeilAngle = τ*0.1 // 360° * 10%
// alpha = 0 is EAST
var initalAlpha = τ*0.5+titelKeilAngle*0.5

var lastMouseOverSprite

var images
var centeredImage

function init() {
	withLoadedJSONfiles(jsons, function([imgs]) {
		images = imgs
		// retain indices for later referencing (after sort reordered array)
		// important for similarity indices
		images.forEach((e,i) => e.index = i)
		images.forEach(e => e.areaIdxUsed = 0) // default is smallest
		images.forEach(e => e.textures = new Array(availableImageSizesByArea.length).fill(false))
		images.forEach(e => e.getPath = function(areaIdx = this.areaIdxUsed) {
			return "images/area"+availableImageSizesByArea[areaIdx]+"/"+this.file
		})
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
		
		//images = images.slice(0, 500)
		canvasContainer = document.getElementById("canvasContainer")
		pixiRenderer = new PIXI.WebGLRenderer(w, h, {transparent: true})
		canvasContainer.appendChild(pixiRenderer.view)
		stage = new PIXI.Container()
		centeredImage = images[0]
		
		loadAllImages(() => { // then:
			updateImages()
			renderLoop()
			document.querySelector("#loading").style.display = "none"
			
			window.onresize = function(event) { updateScreenElemsSize() }
			window.onresize()
			
			// IE9, Chrome, Safari, Opera
			canvasContainer.addEventListener("mousewheel", wheelMove, false)
			// Firefox
			canvasContainer.addEventListener("DOMMouseScroll", wheelMove, false)
			
			initSlider("scaleStart")
			initSlider("scaleEnd")
			initSlider("rStart")
			initSlider("rEnd")
		})
		
	})
}

function initSlider(s) {
	// is a top level variable
	console.assert(window[s])
	var slider = document.querySelector("#"+s)
	slider.value = window[s]
	var label = document.querySelector("label[for="+s+"")
	var setLabel = () => label.innerHTML = s+" "+window[s].toFixed(2)
	setLabel()
	slider.oninput = function(e) {
		window[s] = Number(this.value)
		setLabel()
		updateImages()
	}
}

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
	var exponent = powerScale < 0
		? 1/(Math.abs(powerScale)+1) // root: will conform scales
		: powerScale+1 // power: will spread scales
	
	if (r < rStart) {
		var rampFrom0up = 1 - r/rStart
		// https://rechneronline.de/funktionsgraphen/
		// decreases size of center image by suppressing the growth of the exponent
		var centerFn = x => 0.8/(x-0.6)
		scale *= 1 + centerFn(exponent) * rampFrom0up
		// console.log(scale, exponent, centerFn(exponent), absoluteScale)
	}
	
	// has scale=1 as center
	var poweredScale = Math.pow(scale, exponent)
	var circleDiameterPX = Math.min(w,h)
	var absoluteScale = poweredScale / Math.sqrt(availableImageSizesByArea[image.areaIdxUsed]) / Math.sqrt(images.length) * circleDiameterPX
	
	r *= circleDiameterPX*0.5
	
	var p = polarCoordinates(w, h, alpha, r)
	
	if (distortCircleIntoCanvasRectangle) {
		if (w > h) {
			p.x = (p.x - w/2) * w/h + w/2
		} else {
			p.y = (p.y - h/2) * h/w + h/2
		}
	}
	
	image.sprite.position.x = p.x
	image.sprite.position.y = p.y
	image.sprite.scale.x = absoluteScale
	image.sprite.scale.y = absoluteScale
	
	// wait before we update the texture (if areaIdxUsed changed) until next round to avoid stutter
	image.sprite.texture = image.textures[image.areaIdxUsed]
	
	// areas delta is x10, flattened to one dimension: sqrt(10) ~= 3
	if (absoluteScale < 0.3 && 0 > image.areaIdxUsed-1)
		switchToThisAreaAndLoadIfNecessary(image, image.areaIdxUsed-1)
	if (absoluteScale > 1.5 && image.areaIdxUsed+1 < availableImageSizesByArea.length)
		switchToThisAreaAndLoadIfNecessary(image, image.areaIdxUsed+1)
}

function switchToThisAreaAndLoadIfNecessary(image, areaToSetTo) {
	if (image.textures[areaToSetTo] === false) {
		image.textures[areaToSetTo] = true // loading
		var loader = new PIXI.loaders.Loader()
		loader.add(image.file, image.getPath(areaToSetTo))
		loader.once('complete', () => {
			image.areaIdxUsed = areaToSetTo
			image.textures[image.areaIdxUsed] = new PIXI.Texture.fromImage(image.getPath())
		})
		loader.load()
	}
	// this should be necessary, but produces errors. hum.
	// else if (image.textures[areaToSetTo] !== true) {
	// 	image.areaIdxUsed = areaToSetTo
	// }
}

function updateScreenElemsSize() {
	var bb = canvasContainer.getBoundingClientRect()
	if (bb.width <= 0 || bb.height <= 0)
		return
	w = bb.width
	h = bb.height
	pixiRenderer.resize(w, h)
}


function wheelMove(e) {
	e.preventDefault()
	var wheelMovement = Math.max(-1, Math.min(1, (e.wheelDelta || -e.detail)))
	// altKey, ctrlKey, shiftKey
	
	if (e.shiftKey) {
		// Firefox: shift + mouseWheel down => go back in history ...
		powerSimilarity += wheelMovement*0.05
	} else {
		zoom(wheelMovement)
	}
	updateImages()
}


function zoom(sign) {
	if ((sign > 0 && powerScale < 7) || (sign < 0 && powerScale > 0.1)) {
		powerSimilarity += sign*0.05
		powerScale += sign*0.15
		rStart += sign*0.01
		rEnd += sign*0.02
	}
	updateImages()
}


function loadAllImages(callback) {
	// image loading is not synchronous in PIXI.Texture and PIXI.Sprite.
	// make sure everything is cached before continuing
	var loader = new PIXI.loaders.Loader()
	
	availableImageSizesByAreaToPreload.forEach((e,i) => {
		if (e)
			images.forEach(image => loader.add(image.file+i, image.getPath(i)))
	})
	loader.once('complete', () => {
		console.log("all done loading!")
		images.forEach(image => initImage(image))
		console.assert(images.every(e => e.sprite))
		callback()
	})
	loader.load()
}

function initImage(image) {
	availableImageSizesByAreaToPreload.forEach((e,i) => {
		if (e)
			image.textures[i] = new PIXI.Texture.fromImage(image.getPath(i))
	})
	
	var sprite = new PIXI.Sprite(image.textures[image.areaIdxUsed])
	console.assert(sprite)
	image.sprite = sprite
	
	image.alpha = initalAlpha
	initalAlpha += 1/images.length*(τ-titelKeilAngle)
	
	sprite.interactive = true
	// turns pointer to hand on mouseover
	//sprite.buttonMode = true
	
	sprite.on("mousedown", function(e) {
		if (image === centeredImage) {
			console.log(e.data.originalEvent)
			if (e.data.originalEvent.buttons === 1)
				zoom(1)
			if (e.data.originalEvent.buttons === 2)
				zoom(-1)
		} else {
			updateImages(image)
		}
	})
	sprite.on("mouseover", function(e) {
		var that = this
		lastMouseOverSprite = this
		setTimeout(function() {
			if (that === lastMouseOverSprite) {
				moveToFront(that)
				if (that !== centeredImage.sprite)
					moveToBack(centeredImage.sprite)
			}
		}, 300 /*ms*/)
	})
	
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

function moveToFront(sprite) {
	// z-Index is determined by the order of the stage.children array. rearmost are on top
	// stage.children.sort((a,b) => ...)
	// move to front
	stage.removeChild(sprite)
	stage.addChild(sprite)
}

function moveToBack(sprite) {
	stage.setChildIndex(sprite, 0)
	// stage.removeChild(sprite)
	// stage.addChild(sprite)
}

function updateImages(newCenter = centeredImage) {
	centeredImage = newCenter
	
	var infoBox = document.querySelector("#detailedInfo")
	while (infoBox.firstChild) {
		infoBox.removeChild(infoBox.firstChild)
	}
	function addPoint(string) {
		var li = infoBox.appendChild(document.createElement("li"))
		li.appendChild(document.createTextNode(string))
	}
	addPoint(centeredImage.description)
	addPoint(centeredImage.yearDrawn)
	addPoint(centeredImage.keywords)
	addPoint(centeredImage.material)
	
	
	startTransition()
	images.forEach(img => {
		var similarity = centeredImage.similarity[img.index]
		similarity = Math.pow(similarity, powerSimilarity)
		
		img.r = linearInterpolation(rStart, (1-similarity), rEnd)
		img.scale = linearInterpolation(scaleStart, similarity, scaleEnd)
	})
	centeredImage.r = 0
	//centeredImage.scale = centerImageScale
	moveToFront(centeredImage.sprite)
}

function renderLoop() {
	images.forEach(img => positionImage(w, h, img))
	pixiRenderer.render(stage)
	requestAnimationFrame(renderLoop)
}

// default: Generate a Bates distribution of 10 random variables.
function createHistogram(values = d3.range(1000).map(d3.random.bates(10))) {
	var formatCount = d3.format(",.0f");
	
	var margin = {top: 10, right: 30, bottom: 30, left: 30},
		width = 1500 - margin.left - margin.right,
		height = 500 - margin.top - margin.bottom;
	
	var x = d3.scale.linear()
		.domain([0, 1])
		.range([0, width]);

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




init()
