
// TODO:

// pending white color is white - therefore unclear


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
function dep_getTiddleCoords(canvas, event, cellSize, zoom) {
    let rect   = canvas.getBoundingClientRect();
    let coords = [(event.clientX - rect.left) / zoom,
		  (event.clientY - rect.top)  / zoom]
    // transform real numbered coords into top left corner of cell those coords reside in
    let cell_sz = cellSize * zoom;
    coords = coords.map(t => Math.floor(t));
    coords = coords.map(t => t - (t % cellSize));
    return coords;
}

function getTileCoords(canvas, coords, cellSize, zoom) {
    let rect   = canvas.getBoundingClientRect();
    let tile_coords = [(coords[0] - rect.left) / zoom,
		       (coords[1] - rect.top)  / zoom]
    // transform real numbered coords into top left corner of cell those coords reside in
    let cell_sz = cellSize * zoom;
    tile_coords = coords.map(t => Math.floor(t));
    tile_coords = coords.map(t => t - (t % cellSize));
    return tile_coords;
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
	
	this.canvas         = "UNSET CANVAS";
//	this.canvasOrigin   = [0,0]; don't think anything uses this
	this.cellSize       = 10;
	this.lastHover      = null;
	this.leftButtonDown = false;
	this.cursor_coords          = [0,0];
	
	this.scale              = 1;
	this.center             = [0,0];
	this.translate          = [0,0];
	this.unscaled_translate = [0,0];

	this.queue        = [];
	this.currentTiles = {};
	
	this.description = "A debug configuration dump for Saito";
	this.categories  = "Dev Utilities";

	
	app.keys.addKey( this.appPubKey , {watched: true});

	return this;
    }

    initializeHTML(app) {
	console.log("initializing html...");

	// (cellSize (in pixels), cellsWide, cellsTall);
	// cellSize should be at least 40 to prevent blur
	this.initializeCanvas(10, 400, 400);

	// This is how the browser gets up to date canvas from node on startup
	for (const [key, value] of Object.entries(this.currentTiles)) {
	    console.log(key, value);
	    this.drawTile(key["tile_coords"], value, app);
	}
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
		    coords = JSON.parse(row["tile_coords"]);
		    color  = row["color"];
		    mymod.drawTile(coords, color, app);
		    mymod.currentTiles[coords] = color;
		    if (mymod.lastHover && false) {
			if (String(mymod.lastHover["tile_coords"]) == String(coords)) {
			    console.log("changing lastHover");
			    mymod.lastHover["color"] = color;
			}
		    }
		});
            }
	});
	if (mymod.lastHover) {
	    if (String(mymod.lastHover["tile_coords"]) == String(coords)) {
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
		mymod.drawTile(coords, color, app);
		//
		if (mymod.lastHover) {
		    if (String(mymod.lastHover["tile_coords"]) == String(coords)) {
			console.log("changing lastHover");
			mymod.lastHover["color"] = color;
		    }
		}
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

    getTileCoords() {
	let rect   = this.canvas.getBoundingClientRect();
	let tile_coords = [(this.cursor_coords[0] - rect.left - this.center[0]),
			   (this.cursor_coords[1] - rect.top  - this.center[1])]
	// transform real numbered coords into top left corner of cell those coords reside in
	let cell_sz = this.cellSize * this.scale;
	tile_coords = coords.map(t => Math.floor(t));
	tile_coords = coords.map(t => t - (t % cellSize));
	return tile_coords;
    }

    transformCanvas() {
	
	this.translate[0] = this.unscaled_translate[0] + (this.center[0] / this.scale);
	this.translate[1] = this.unscaled_translate[1] + (this.center[1] / this.scale);

	let x_str = String(this.translate[0]) + "px,";
	let y_str = String(this.translate[1]) + "px)";

	let t   = "translate(" + x_str + y_str;
	let s = "scale(" + this.scale + ") " + t;
	console.log(s);
	this.canvas.style.transform = s;
	this.handleBrush(this.app);
    }
    
    attachEvents(app, mod) {
	
	let mymod = app.modules.returnModule("Graffiti");
  	let canvas = mymod.canvas;
	let ctx = canvas.getContext('2d');
	const width = canvas.width;
	const height = canvas.height;

	const zoom_speed = 1.1;

	document.addEventListener("wheel", function (e) {
	    let x = e.clientX - mymod.center[0]
	    let y = e.clientY - mymod.center[1]
	    
	    if (e.deltaY < 0) {
		mymod.scale *= zoom_speed;
	    }
	    else {
		mymod.scale /= zoom_speed;
	    }

	    mymod.transformCanvas();
	    
	});
	let shift = 40;
	document.addEventListener("keydown", (e) => {

	    switch(e.key) {
	    case "s":
		mymod.unscaled_translate[1] += shift;
//		mymod.cursor_coords[1] -= shift
		break;
	    case "x":
		mymod.unscaled_translate[1] -= shift;
//		mymod.cursor_coords[1] += shift
		break;
	    case "a":
		mymod.unscaled_translate[0] += shift;
//		mymod.cursor_coords[0] -= shift
		break;
	    case "d":
		mymod.unscaled_translate[0] -= shift;
//		mymod.cursor_coords[0] += shift
		break;
	    }
	    mymod.transformCanvas();
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
	canvas.onmouseover = (e) => {
	    //
	    // save the color of the cell the cursor hovers over
	    // as it enters the canvas
	    //
	    let coords = getTileCoords(
		mymod.canvas,
		[e.clientX, e.clientY],
		mymod.tileSize,
		mymod.scale
	    )
	    let color  = document.getElementById("favcolor").value;
	    mymod.lastHover = {'tile_coords': coords,
			       'color' : mymod.getColor(coords)
			      }
	    
	    // then draw the preview
	    // this.handleBrush will use this.lastHover to revert
	    // this preview drawing once cursor moves inside of a new cell
	    //
	    mymod.drawTile(coords, color, app);
	    
	    
	}

	//
	// Cleanly stop showing previews when cursor leaves canvas
	//
	canvas.onmouseout = (e) => {
	    //
	    // restore the cell in lastHover then set it to null
	    // since cursor is leaving the canvas
	    //
	    mymod.drawTile(mymod.lastHover.coords, mymod.lastHover.color, app);
	    mymod.lastHover = null;
	}

	//// Handle mouse movement and click within the canvas
	/// Handles both drawing previews + queuing and sending cell paint actions
	//
	// paints on click and drag
	//
	canvas.onmousemove = (e) => {
	    this.cursor_coords = [e.clientX, e.clientY];
	    this.handleBrush(this.app);
	}
	//
	// paints on stationary click
	//
	canvas.onclick = (e) => {
	    this.handleBrush(this.app, true);
	}

    }
    
    initializeCanvas(tileSize, tilesWide, tilesTall) {
	let canv_div = document.getElementById("canvas-container")

	canv_div.innerHTML += `<canvas id="cnv"></canvas`;
	this.canvas = document.getElementById("cnv")
	
	console.log("canvas ", this.canvas);

	this.tileSize = tileSize;
	
	this.canvas.width = tileSize * tilesWide;
	this.canvas.height = tileSize * tilesTall;

	let x_shift = window.innerWidth  - this.canvas.width;
	let y_shift = window.innerHeight - this.canvas.height;

	this.center             = [x_shift / 2, y_shift / 2];
	this.translate          = [0,0];
	this.unscaled_translate = [0,0];

//	this.unscaled_translate = [this.canvas.offsetLeft, this.canvas.offsetTop];
	
	this.transformCanvas();

	let ctx = this.canvas.getContext('2d');
	ctx.fillStyle = "#ffffff";
	ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

//      grid has bug -- needs to be redrawn after cell is drawn or it dissapears
//	this.drawGrid(tileSize, canvas.width, canvas.height);
    }
    
    // dont use grid
    drawGrid(size, width, height) {
	let canvas = this.canvas;
	let ctx = canvas.getContext('2d');

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

    drawHourGlass(coords) {
	let canvas = this.canvas;
	let ctx = canvas.getContext('2d');

	let pad = 10;
	let x = coords[0] + pad;
	let y = coords[1] + pad;
	let size = this.tileSize - pad;

	ctx.lineWidth = 2;
	ctx.strokeStyle = "black";
	
//	ctx.beginPath();
	ctx.moveTo(x, y);
	ctx.lineTo(x + size, y);
	ctx.lineTo(x, y + size);
	ctx.lineTo(x + size, y + size);
	ctx.lineTo(x, y);
	ctx.stroke();

    }

    setLastHover(coords, color) {
	this.lastHover = {'tile_coords': coords,
			   'color' : mymod.getColor(coords)
			 }
    }

    queueTile(coords, app) {
	// get coordinates of mouse click relative to canvas
	let mymod = app.modules.returnModule("Graffiti");
	let rect = mymod.canvas.getBoundingClientRect();
//	let coords = [event.clientX - rect.left,
//		      event.clientY - rect.top]
	let tile_coords = getTileCoords(
	    mymod.canvas,
	    [coords[0], coords[1]],
	    mymod.cellSize,
	    mymod.scale
	);
	// transform real numbered coords into top left corner of cell those coords reside in
	tile_coords = coords.map(t => Math.floor(t));
	tile_coords = coords.map(t => t - (t % mymod.tileSize));
	
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
	if (color) { // tile color is defined
	    return color;
	}
	else { // return white
	    return "#FFFFFF";
	}
    }

    drawTile(coords, color, app) {
	let mymod = app.modules.returnModule("Graffiti");
	let ctx = this.canvas.getContext('2d');

	// whiteout cell
	ctx.fillStyle = "#ffffff";
	ctx.fillRect(coords[0], coords[1], this.tileSize, this.tileSize);
	// then draw color in
	ctx.fillStyle = color;
	ctx.fillRect(coords[0], coords[1], this.tileSize, this.tileSize);
    }
    
    //
    // draws preview on cursor hover + builds and sends user paint queues
    //
    handleBrush(app, tapped=false) {
	let mymod = app.modules.returnModule("Graffiti");

	/////////////////////////////////////////////////
	// get coordinates of cursor relative to canvas

	

	/*
	let cursor_coords = [mymod.cursor_coords[0] - mymod.unscaled_translate[0] - mymod.center[0],
			     mymod.cursor_coords[1] - mymod.unscaled_translate[1] - mymod.center[1]]
*/
	let cursor_coords = [mymod.cursor_coords[0],
			     mymod.cursor_coords[1]];




	////////////////////////////////////////////////////

//	cursor_coords[0] = this.unscaled_translate[0] + (this.center[0] / this.scale);
//	cursor_coords[1] = this.unscaled_translate[1] + (this.center[1] / this.scale);

	let tile_coords = getTileCoords(
	    mymod.canvas,
	    [cursor_coords[0], cursor_coords[1]],
	    mymod.tileSize,
	    mymod.scale
	);
	console.log("Tile coords: ", tile_coords);
	let color  = document.getElementById("favcolor").value;
	let newTile = false;
	let newColor = false;

	// check to see if non-null lastHover shares color or position with current
	// cell cursor is moving within
	//
	// if lastHover is null or same color and position this function does nothing
	//
	if (mymod.lastHover) {
	    newTile = JSON.stringify(tile_coords) != JSON.stringify(mymod.lastHover['tile_coords']);
	    newColor = color.slice(0, 7) != mymod.lastHover['color'].slice(0, 7);
	}
	else { return; }

	let clicked = mymod.leftButtonDown || tapped;
	//
	// if cursor over new tile, or user is painting currently hovered cell
	//
	if (newTile || (newColor && clicked) ) {

	    // save the old color for later before drawing over it
	    let ctx = mymod.canvas.getContext('2d');
	    let oldColor = mymod.getColor(tile_coords);

	    // if clicked, then paint data will be sent to chain
	    //
	    if (newColor && clicked) {
		// oldColor is now the painted color
		// function queues up cell position and color data
		oldColor = mymod.queueTile(
		    [tile_coords[0], tile_coords[1]],
		    app
		);		


		
		// if mouse was tapped once instead of dragged
		//
		if (tapped) {
		    // then send the queue (single coord+color combo)
		    mymod.sendQueueTx(app);
		    console.log("in tapped");
		}
		// 
		// otherwise the queue is sent when mouse is dragged
		// inside the document.onmouseup event
	    }

	    // if no click, then don't paint, but draw the preview
	    // and restore the true color of the last cell hovered over
	    //
	    else {
		// draw preview over cnurrently hovered cell
		mymod.drawTile(tile_coords, color, mymod.app);
		// replace previous hovered cell's true color
		// mymod.drawTile(mymod.lastHover['tile_coords'], mymod.lastHover['color']);
	    }


	    // replace previous hovered cell's true color
	    if (newTile) {
		mymod.drawTile(mymod.lastHover['tile_coords'], mymod.lastHover['color'], app);
	    }

	    console.log("changing last hover")
	    // Set currently hovered tile as lastHover so we can do it all over again
	    mymod.lastHover = {'tile_coords': tile_coords,
			       'color' : oldColor
			      }
	}
    }

}

module.exports = Graffiti;
