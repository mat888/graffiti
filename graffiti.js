// TODO:

// when onconforimation draws a cell currently hovered over,
// it believes the rightful old color is the pending (lighter color)

// pending white color is white - therefore unclear

// zoom breaks - canvas position is not tracked correctly after zoom

// 

var saito = require('../../lib/saito/saito');
var ModTemplate = require('../../lib/templates/modtemplate');
const GraffitiAppspaceMain = require('./lib/appspace/main');



// These two functions read canvas pixel data and return a HEX color
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

// given any point on the canvas, find the coordinates of
// the CELL those coordinates reside within
function getCellCoords(canvas, event, cellSize) {
    let rect   = canvas.getBoundingClientRect();
    let coords = [event.clientX - rect.left,
		  event.clientY - rect.top]
    // transform real numbered coords into top left corner of cell those coords reside in
    coords = coords.map(t => Math.floor(t));
    coords = coords.map(t => t - (t % cellSize));
    return coords;
    }

function getSQL(app) {
    console.log("in getSQL");
    let mymod = app.modules.returnModule("Graffiti");
    console.log("in getSQL 2");
    let sql = `SELECT * FROM cells`;
    console.log(sql);
    console.log("in getSQL 3");
    mymod.sendPeerDatabaseRequestWithFilter("Graffiti", sql, async (res) => {
	console.log("in getSQL 4");
	console.log(res.rows);
        if (res.rows) {
	    res.rows.map((row) => {
		// each row here
		// row.status
		// row.id 
                console.log((JSON.parse(row.tx)));
            });
        }
    });
}

function makeSQL(app) {
    console.log("makeSQL");
    let sql = `INSERT OR IGNORE INTO cells (
               test_1 ,
               test_2
             ) VALUES (
               $test_1 ,
               $test_2
             )`;
    let params = {
	$test_1: "this is test_1 data",
	$test_2: "this is test_2 data"
    };
    app.storage.executeDatabase(sql, params, "Graffiti");
}

class Graffiti extends ModTemplate {

    constructor(app) {
	super(app);
	
	this.app            = app;
	this.name           = "Graffiti";
	this.appname        = "Graffiti";
	this.appPubKey      = "zEC6dxU9P1LFsHpc3BANqaPdRu4njmqbouCqgRQwFa6J"
	this.description    = "Email plugin that allows visual exploration and debugging of the Saito wallet.";
	this.categories     = "Utilities Core";
	this.icon	    = "fas fa-code";
	
	this.canvas         = "UNSET CANVAS";
	this.cellSize       = 10;
	this.lastHover      = null;
	this.leftButtonDown = false;

	this.queue = [];
	this.currentCells = {};
	
	this.description = "A debug configuration dump for Saito";
	this.categories  = "Dev Utilities";

	app.keys.addKey( this.appPubKey , {watched: true});
	return this;
    }

    initializeHTML(app) {
	console.log("initializing html...");
	makeSQL(app);
	getSQL(app);
	console.log("past sql ..........................................");
	// (cellSize (in pixels), cellsWide, cellsTall);
	this.initializeCanvas(30, 30, 30);

	// draw from full node's currentCells to get up to date
	console.log("this.currentCells:");
	console.log(this.currentCells);
	for (const [key, value] of Object.entries(this.currentCells)) {
	    console.log(key, value);
	    this.drawCell(key["coords"], value);
	}
    }
    
    attachEvents(app, mod) {
	
	let mymod = app.modules.returnModule("Graffiti");
  	let canvas = mymod.canvas;
	let ctx = canvas.getContext('2d');

	let zoom = 1;
	const ZOOM_SPEED = 0.1;
	
	canvas.addEventListener("wheel", function (e) {
	    if (e.deltaY > 0) {
		mymod.canvas.style.transform = `scale(${(zoom += ZOOM_SPEED)})`;
	    } else {
		mymod.canvas.style.transform = `scale(${(zoom -= ZOOM_SPEED)})`;
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
	    mymod.sendQueue(app);
	    
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
	    let coords = getCellCoords(mymod.canvas, e, mymod.cellSize)
	    let color  = document.getElementById("favcolor").value;
	    mymod.lastHover = {'coords': coords,
			       'color' : getPixel(ctx, coords[0], coords[1])
			      }
	    
	    // then draw the preview
	    // this.handleBrush will use this.lastHover to revert
	    // this preview drawing once cursor moves inside of a new cell
	    //
	    mymod.drawCell(coords, color);
	    
	    
	}

	//
	// Cleanly stop showing previews when cursor leaves canvas
	//
	canvas.onmouseout = (e) => {
	    //
	    // restore the cell in lastHover then set it to null
	    // since cursor is leaving the canvas
	    //
	    mymod.drawCell(mymod.lastHover.coords, mymod.lastHover.color);
	    mymod.lastHover = null;
	}

	//// Handle mouse movement and click within the canvas
	/// Handles both drawing previews + queuing and sending cell paint actions
	//
	// paints on click and drag
	//
	canvas.onmousemove = (e) => {
	    this.handleBrush(e, app);
	}
	//
	// paints on stationary click
	//
	canvas.onclick = (e) => {
	    this.handleBrush(e, app, true);
	}

    }

    onConnectionStable(app, peer) {
	console.log("Connection Stable");
	let mymod = app.modules.returnModule("Graffiti");
	console.log(mymod.currentCells);
    }
    
    // Browser
    // fill in cells with recieved color + coord data
    //
    // Full Node
    // TODO: save current state of canvas to catch new lite clients up
    //
    async onConfirmation(blk, tx, conf, app) {
//	if (app.BROWSER == 0) { return; }

	if (conf == 0) {

	    let txmsg = tx.returnMessage();
	    let queue = txmsg.cells;
	    let mymod = app.modules.returnModule("Graffiti");

	    // TODO
	    // check if coords and color are valid before saving or drawing

	    for (let i = 0; i < queue.length; i++) {

		// full node
		if (app.BROWSER == 0) {
		    mymod.currentCells[ {"coords": [coords]} ] = color;

		}
		// lite node
		else {
		    let coords = queue[i][0];
		    let color  = queue[i][1];
		    mymod.drawCell(coords, color);
		}

	    }
	}
    }

    /*
    // get info and update page in here
    async onConfirmation(blk, tx, conf, app) {

    //    let mymod = app.modules.returnModule(txmsg.module);
    //    if (mymod.browser_active == 0) {return;}

    attachEventsEmail(app, mod) {
    Console.log("attaching events");
    }
    */

    initializeCanvas(cellSize, cellsWide, cellsTall) {
	document.body.appendChild(document.createElement('canvas'));
	let canvas = document.getElementsByTagName('canvas')[0];
	this.canvas = canvas;
	this.cellSize = cellSize;
	
	canvas.width = cellSize * cellsWide;
	canvas.height = cellSize * cellsTall;
	canvas.style.display = 'block';
	canvas.style.margin  = ' 0 auto';

	let ctx = canvas.getContext('2d');
	ctx.fillStyle = "#ffffff";
	ctx.fillRect(0, 0, canvas.width, canvas.height);

//	don't use GRID* except for testing - it breaks the color hover preview
//	this.drawGrid(cellSize, canvas.width, canvas.height);
    }
//  don't use the GRID*
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
    
    queueCell(event, app) {
	// get coordinates of mouse click relative to canvas
	let mymod = app.modules.returnModule("Graffiti");
	let rect = mymod.canvas.getBoundingClientRect();
	let coords = [event.clientX - rect.left,
		      event.clientY - rect.top]
	
	// transform real numbered coords into top left corner of cell those coords reside in
	coords = coords.map(t => Math.floor(t));
	coords = coords.map(t => t - (t % mymod.cellSize));
	
	// get color then pre-draw cell
	let color = document.getElementById("favcolor").value;
	let semiColor = color + "80"
	mymod.drawCell(coords, semiColor);

	this.queue.push([coords, color]);
	return semiColor;
    }

    sendQueue(app) {
	// send data to chain
	let newtx = app.wallet.createUnsignedTransaction(this.appPubKey);
	
	newtx.msg.module = "Graffiti";
	newtx.msg.cells = this.queue;
	newtx = app.wallet.signTransaction(newtx);
	app.network.propagateTransaction(newtx);
    }

    drawCell(coords, color) {
	let ctx = this.canvas.getContext('2d');
	// whiteout cell
	ctx.fillStyle = "#ffffff";
	ctx.fillRect(coords[0], coords[1], this.cellSize, this.cellSize);
	// then draw color in
	ctx.fillStyle = color;
	ctx.fillRect(coords[0], coords[1], this.cellSize, this.cellSize);
    }
    
    //
    // draws preview on cursor hover + builds and sends user paint queues
    //
    handleBrush(event, app, tapped=false) {
	let mymod = app.modules.returnModule("Graffiti");
	// get coordinates of cursor relative to canvas
	let coords = getCellCoords(mymod.canvas, event, mymod.cellSize)
	let color  = document.getElementById("favcolor").value;
	let newTile = false;
	let newColor = false;

	// check to see if non-null lastHover shares color or position with current
	// cell cursor is moving within
	//
	// if lastHover is null or same color and position this function does nothing
	//
	if (mymod.lastHover) {
	    newTile = JSON.stringify(coords) != JSON.stringify(mymod.lastHover['coords']);
	    newColor = color.slice(0, 7) != mymod.lastHover['color'].slice(0, 7);
	}

	let clicked = mymod.leftButtonDown || tapped;
	
	//
	// if cursor over new tile, or user is painting currently hovered cell
	//
	if (newTile || (newColor && clicked) ) {
	    
	    // save the old color for later before drawing over it
	    let ctx = mymod.canvas.getContext('2d');
	    let oldColor = getPixel(ctx, coords[0], coords[1]);

	    // if clicked, then paint data will be sent to chain
	    //
	    if (clicked) {
		// oldColor is now the painted color
		// function queues up cell position and color data
		oldColor = mymod.queueCell(event, app);
		
		// if mouse was tapped once instead of dragged
		//
		if (tapped) {
		    // then send the queue (single coord+color combo)
		    mymod.sendQueue(app);
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
		mymod.drawCell(coords, color);
		// replace previous hovered cell's true color
		mymod.drawCell(mymod.lastHover['coords'], mymod.lastHover['color']);
	    }
	    // Set currently hovered cell as lastHover so we can do it all over again
	    mymod.lastHover = {'coords': coords,
			       'color' : oldColor
			      }
	}
    }

}


module.exports = Graffiti;
