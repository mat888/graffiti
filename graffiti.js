// TODO:

// pending white color is white - therefore unclear

// moving image left,right,up,down while holding paint button down may be glitchy

// don't use keydown to check if heys are held, do it manually

// remove any subpixel scaling on zoom ? 

var saito = require('../../lib/saito/saito');
var ModTemplate = require('../../lib/templates/modtemplate');
const GraffitiAppspaceMain = require('./lib/appspace/main');


// These two functions read canvas pixel data and return a HEX color
// not necessary anymore but leaving for now just in case
function getPixel(context, x, y) {
    var p = context.getImageData(x+5, y+5, 1, 1).data;
    var hex = "#" + ("000000" + rgbToHex(p[0], p[1], p[2])).slice(-6);  
    return hex;
}
function rgbToHex(r, g, b) {
    if (r > 255 || g > 255 || b > 255)
        throw "Invalid color component";
    return ((r << 16) | (g << 8) | b).toString(16);
}

// takes hex color
function tooWhite(color) {
    
}

// given any point on the canvas, find the coordinates of
// the tile those coordinates reside within
function getTileCoords(canvas, event, cellSize, zoom) {
    let rect   = canvas.getBoundingClientRect();
//    let coords = [(event.clientX - rect.left) / zoom,
//		  (event.clientY - rect.top)  / zoom]
    // transform real numbered coords into top left corner of cell those coords reside in
    let coords = [(event[0] - rect.left) / zoom,
		  (event[1] - rect.top ) / zoom];
    let cell_sz = cellSize * zoom;
    coords = coords.map(t => Math.floor(t));
    coords = coords.map(t => t - (t % cellSize));
    return coords;
    
//    coords = coords.map(t => t / zoom);
//    coords = coords.map(t => Math.floor(t));

//    return coords;
    }

class Graffiti extends ModTemplate {

    constructor(app) {
	super(app);
	super.initialize(app);
	
	this.app         = app;
	this.name        = "Graffiti";
	this.appname     = "Graffiti";
	this.appPubKey   = "zEC6dxU9P1LFsHpc3BANqaPdRu4njmqbouCqgRQwFa6J"
	this.description = "Graffiti description"
	this.categories  = "Utilities Core";
	this.icon	 = "fas fa-code";
	
	this.canvas         = null;
	this.ctx            = null;
	this.cellSize       = 10;
	this.leftButtonDown = false;
	this.mouseCoords    = [0,0];

	this.moveLeft  = false;
	this.moveUp    = false;
	this.moveright = false;
	this.moveDown  = false;
	
	this.zoom_factor        = 30;
	this.canvas_offset      = [0,0];

	this.queue        = [];
	this.currentTiles = {};
	this.reDrawing = false;

	this.renderQueue  = [];
	
	this.description = "A debug configuration dump for Saito";
	this.categories  = "Dev Utilities";

	
	app.keys.addKey( this.appPubKey , {watched: true});

	return this;
    }

    initializeHTML(app) {
	console.log("initializing html...");

	this.initializeCanvas(1200, 1200);

	// This is how the browser gets up to date canvas from node on startup
	for (const [key, value] of Object.entries(this.currentTiles)) {
	    console.log(key, value);
	    this.drawTile(key["coords"], value, app);
	}
	for (var i = 1; i < 2; i++) {
	    setTimeout(function timer() {
		let mymod = app.modules.returnModule("Graffiti");
		console.log(mymod.moveUp);
	    }, i * 3000);
	}
	

	//////////////////////////////////////////////////////////////////////////////
	// HTML EVENTS ///////////////////////////////////////////////////////////////

	let mymod = app.modules.returnModule("Graffiti");
	
	// RESIZE EVENT	
	window.onresize = function resize() {
	    
	    mymod.canvas.width = Math.floor(window.innerWidth * 0.5);
	    mymod.canvas.height = Math.floor(window.innerHeight * 0.5);
	    
	    mymod.reDrawing = true;
	}
	
	// MOUSEMOVE EVENT
	this.canvas.addEventListener("mousemove", function (e) {
	    mymod.mouseCoords = [e.clientX - mymod.canvas.offsetLeft,
				 e.clientY - mymod.canvas.offsetTop]
	});

	// CLICK EVENT
	this.canvas.addEventListener("click", function (e) {
	    let c = mymod.get_tile_corner(mymod.mouseCoords[0], mymod.mouseCoords[1]);

	    var coords = c
	    var color =  "#00ff00";
	    var tile_coords = coords.map(t => Math.floor(t / mymod.zoom_factor));
	    mymod.currentTiles[tile_coords] = color;
	    mymod.renderQueue.push(tile_coords);
	    console.log("CLICK EVENT COORDS: ", tile_coords);
	    /*
	    var ctx = mymod.ctx;
	    ctx.fillStyle = color;
	    ctx.fillRect(coords[0], coords[1], mymod.zoom_factor, mymod.zoom_factor);

	    console.log(c);
	    console.log(mymod.zoom_factor);
	    console.log(tile_coords);
	    console.log(mymod.currentTiles);
	    */
	});

	document.addEventListener("wheel", function (e) {
	    if (e.deltaY < 0) {
		mymod.zoom_factor++;
	    }
	    else {
		mymod.zoom_factor--;
	    }
	    mymod.reDrawing = true;;
	});

	// END HTML EVENTS ////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	
	
	this.canvas_loop();
	
    }

    get_tile_corner(x, y) {
	var x_t = Math.floor((x - this.canvas_offset[0]) / this.zoom_factor);
	var y_t = Math.floor((y - this.canvas_offset[1]) / this.zoom_factor);

//	return [x_t, y_t];

	var coords = [x, y];
	coords = coords.map(t => t - (t % this.zoom_factor));

	return coords;
    }
    
    canvas_loop() {

	// function which takes:
	//  scale
	//  offset
	//  position

	// and repaints within a constant sized canvas the cells


	// this should be done outside this loop function


	// if entire canvas must be redraw, clear it first
	if (this.reDrawing) {
	    this.reDraw();
	}

	// if renderQueue empty, do nothing, move on to next
	// loop iteration
	if (this.renderQueue.length == 0) {
	    return requestAnimationFrame(()=>this.canvas_loop());
	}
	console.log("drawing");


	for (var i = 0; i < this.renderQueue.length; i++) {
//	    var coords = this.renderQueue[i][0].map(t => t * this.zoom_factor);
	    //	    var color =  this.renderQueue[i][1];


	    // coords is where the canvas will be painted
	    // but the "real" coords stay unmodified in this.renderQueue
	    var coords = this.renderQueue[i].map(t => t * this.zoom_factor);
	    if (this.reDrawing == false) {
		console.log("LOOP COORDS: ", coords);
		console.log("COLOR: ", this.currentTiles[coords]);
	    }
	    if (this.currentTiles[this.renderQueue[i]] == null) {continue;}
	    var color =  this.currentTiles[this.renderQueue[i]];
	    this.ctx.fillStyle = color;
	    this.ctx.fillRect(coords[0], coords[1], this.zoom_factor, this.zoom_factor);
	    console.log("DRAWING: ----------------------");
	    console.log("(x, y) : ", coords);
	    console.log("Size   : ", this.zoom_factor);
	}

	
	this.reDrawing = false;
	this.renderQueue = [];

	requestAnimationFrame(()=>this.canvas_loop());
    }

    // 
    reDraw() {
	console.log("reDrawing");

	let ctx = this.ctx;
	ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
	this.renderQueue = [];

	// TODO
	// width and height are computed for all redraw events including:
	// * zooming in and out
	// * resizing window
	// * shifting canvas coords
	//  but it only needs to be computed when resizing window (or cnv size changes)
	let width  = Math.ceil(this.canvas.width  / this.zoom_factor);
	let height = Math.ceil(this.canvas.height / this.zoom_factor);
	//
	
	for (var i = 0; i < width; i++) {
	    for (var j = 0; j < height; j++) {
		this.renderQueue.push([i,j]);
	    }
	}
	console.log("Width: ", width);
	console.log("Height: ", height);
	console.log("zoom_factor: ", this.zoom_factor);
	console.log("renderQueue: ", this.renderQueue);
	console.log("currentTiles: ", this.currentTiles);
    }

    draw_tile(coords, color="#ffffff") {
	let x_offset = this.canvas_offeset[0];
	let y_offset = this.canvas_offeset[1];
	ctx.fillStyle = color;
	ctx.fillRect(coords[0] - x_offset, coords[1] - y_offset, this.zoomFactor, this.zoomFactor);
	//
    }



    onPeerHandshakeComplete(app) {
	let mymod = app.modules.returnModule("Graffiti");
	let sql = `SELECT * FROM tiles;`;
	let color;
	let coords;
	this.sendPeerDatabaseRequestWithFilter("Graffiti", sql, (res) => {
	    console.log("fetching initial tiles values from full node");
            if (res.rows) {
		res.rows.map((row) => {
                    //
		    // each row here
                    //
		    coords = JSON.parse(row["coords"]);
		    color  = row["color"];
		    mymod.drawTile(coords, color, app);
		    mymod.currentTiles[coords] = color;
		});
            }
	});
	if (mymod.lastHover) {
	    if (String(mymod.lastHover["coords"]) == String(coords)) {
		console.log("changing lastHover");
		mymod.lastHover["color"] = color;
	    }
	}
    }
    async onConfirmation(blk, tx, conf, app) {
	if (conf > 0) { return; }
	//	this.receiveQueueTx(tx);
	
	let txmsg = tx.returnMessage();
	let queue = txmsg.tiles;
	let mymod = app.modules.returnModule("Graffiti");
	
	// TODO
	// check if coords and color are valid before saving or drawing
	for (let i = 0; i < queue.length; i++) {
	    let coords = queue[i][0];
	    let color  = queue[i][1];
	    
	    // update tiles dictionary
	    mymod.currentTiles[String(coords)] = color;
	    
	    // full node
	    if (app.BROWSER == 0) {
		// sql handling
		this.receiveQueueTx(queue[i]);
	    }
	    // lite node
	    else {
		console.log("about to draw in browser");

		// only do this (queue to render) if tile is in frame
		mymod.drawTile(coords, color, app);
		//
	    }
	}
    }

    //
    // send queue of tiles to be drawn on-chain
    //
    sendQueueTx(app) {
	
	let newtx = app.wallet.createUnsignedTransaction(this.appPubKey);
	newtx.msg.module = "Graffiti";
	newtx.msg.tiles = this.queue;
	newtx = app.wallet.signTransaction(newtx);
	app.network.propagateTransaction(newtx);

	this.queue = [];
    }

    //
    // and receive it !
    //
    // this will run on the server and on any lite-clients that are also listening
    // for the graffiti transactions. but the lite-clients probably do not have a 
    // database running and so will be running "empty" functions when they try to
    // insert into DB.
    //
    async receiveQueueTx(tile) {
	let coords = JSON.stringify(tile[0]);
	let color  = tile[1];
	//
	// insert into database | overwrite existing tiles
	//
	let sql = `REPLACE INTO tiles (
          coords,
          color
        ) VALUES (
          $coords,
          $color
        )`;
        let params = {
	    $coords: coords,
            $color: color,
        };
        await this.app.storage.executeDatabase(sql, params, "graffiti");
	
    }

    transformElement() {
	
	this.translate[0] = this.unscaled_translate[0] + (this.center[0] / this.scale);
	this.translate[1] = this.unscaled_translate[1] + (this.center[1] / this.scale);

	let x_str = String(this.translate[0]) + "px,";
	let y_str = String(this.translate[1]) + "px)";

	let t   = "translate(" + x_str + y_str;
	let s = "scale(" + this.scale + ") " + t;

	this.canvas.style.transform = s;
    }
    
    attachEvents(app, mod) {

	let mymod = app.modules.returnModule("Graffiti");
  	let canvas = mymod.canvas;
	let ctx = mymod.ctx;
//	const width = canvas.width;
//	const height = canvas.height;

	const zoom_speed = 1.1;



	document.addEventListener("wheel", function (e) {
	    if (e.deltaY < 0) {
		mymod.zoom_factor++;
	    }
	    else {
		mymod.zoom_factor--;
	    }
	    
	});
	let shift = 40;
	let dirKeys = {"s":0, // up
		       "d":1, // right
		       "x":2, // down 
		       "a":3};// left

	function l(m) {console.log(m)};
	document.addEventListener("keydown", (e) => {
	    switch(dirKeys[e.key]) {
	    case 0:
		mymod.unscaled_translate[1] += shift;
		mymod.moveUp = true;
		break;
	    case 2:
		mymod.unscaled_translate[1] -= shift;
		mymod.moveDown = true;
		break;
	    case 3:
		mymod.unscaled_translate[0] += shift;
		mymod.moveLeft = true;
		break;
	    case 1:
		mymod.unscaled_translate[0] -= shift;
		mymod.moveRight = true;
	break;
	    }

	});

	document.addEventListener("keyup", (e) => {
	    switch(dirKeys[e.key]) {
	    case 0:
		console.log("key up: ", e.key, dirKeys[e.key]);
		mymod.moveUp = false;
		break;
	    case 2:
		console.log("key up: ", e.key, dirKeys[e.key]);
		mymod.moveDown = false
		break;
	    case 3:
		console.log("key up: ", e.key, dirKeys[e.key]);
		mymod.moveLeft = false;
		break;
	    case 1:
		console.log("key up: ", e.key, dirKeys[e.key]);
		mymod.moveRight = false;
	break;
	    }

	});

	//
	// Handle leftButtonDown flag
	//
	document.onmousedown = (e) => {
	    if (e.which === 1) {mymod.leftButtonDown = true}
	}

	document.onmouseup = (e) => {
	    // send queue generated by dragging mouse
	    mymod.sendQueueTx(app);
	    
	    if (e.which === 1) {mymod.leftButtonDown = false}
	}
	//

	//
	// initiate color preview when hovering over cell
	//
	canvas.onmouseover = (e) => {	}

	//
	// Cleanly stop showing previews when cursor leaves canvas
	//
	canvas.onmouseout = (e) => {	}

	//// Handle mouse movement and clicking within the canvas.
	/// Handles both drawing previews + queuing and sending cell paint actions.
	// Paints on click and drag.
	//
	canvas.onmousemove = (e) => {	}
	//
	// paints on stationary click
	//
	canvas.onclick = (e) => {	}

    }
    
    initializeCanvas(tilesWide, tilesTall) {
	let canv_div = document.getElementById("canvas-container")

	canv_div.innerHTML += `<canvas id="cnv"></canvas`;
	this.canvas = document.getElementById("cnv")
	
	console.log("canvas ", this.canvas);
	
	this.canvas.width  = Math.floor(window.innerWidth  * (0.5));
	this.canvas.height = Math.floor(window.innerHeight * (0.5));

	this.shift = [0, 0];
	this.zoom_factor = 1;
	
	let ctx = this.canvas.getContext('2d', {alpha: false});
	this.ctx = ctx;
	
	ctx.fillStyle = "#ffffff";
	ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

//      grid has bug -- needs to be redrawn after cell is drawn or it dissapears
//	this.drawGrid(tileSize, canvas.width, canvas.height);
    }
    
    // dont use grid
    drawGrid(size, width, height) {
	let canvas = this.canvas;
	let ctx = this.ctx;

	for (let i = 0; i <= width; i += size) {
	    ctx.moveTo(i, 0);
	    ctx.lineTo(i, height);
	    ctx.lineWidth = 1;
	    ctx.stroke();
	}

	for (let j = 0; j <= height; j += size) {
	    ctx.moveTo(0, j);
	    ctx.lineTo(width, j);
	    ctx.lineWidth = 1;
	    ctx.stroke();
	}
    }


    queueTile(event, app) {
	// get coordinates of mouse click relative to canvas
	let mymod = app.modules.returnModule("Graffiti");
	let rect = mymod.canvas.getBoundingClientRect();
//	let coords = [event.clientX - rect.left,
//		      event.clientY - rect.top]
//	let coords = getTileCoords(mymod.canvas, event, mymod.cellSize, mymod.scale);
	let coords = getTileCoords(mymod.canvas,
				   [event.clientX, event.clientY],
				   mymod.cellSize, mymod.scale);
	// transform real numbered coords into top left corner of cell those coords reside in
	coords = coords.map(t => Math.floor(t));
	coords = coords.map(t => t - (t % mymod.tileSize));
	
	// get color then pre-draw cell
	let color = document.getElementById("favcolor").value;

	// preview color is washed out
	let semiColor = color + "80"

	// if color is too white
	if (color[1] == "f" && color[3] == "f" && color[5] == "f") {
	    // make the preview darker than intended color
	    console.log("too white!")
	    semiColor = color + "b0";
	}

	mymod.drawTile(coords, semiColor, app);
	mymod.currentTiles[String(coords)] = semiColor;

//	mymod.drawHourGlass(coords);

	this.queue.push([coords, color]);
	return semiColor;
    }

    getColor(coords) {
	let color = this.currentTiles[String(coords)];
	if (color) {
	    return color;
	}
	else { // return white
	    return "#FFFFFF";
	}
    }


}

module.exports = Graffiti;

