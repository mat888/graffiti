const saito = require('../../lib/saito/saito');
const ModTemplate = require('../../lib/templates/modtemplate');
const GraffitiUi = require('./lib/ui/main');

class Graffiti extends ModTemplate {

    constructor(app) {

	super(app);
	
	this.app         = app;
	this.name        = "Graffiti";
	this.appname     = "Graffiti";
	this.appPubKey   = "zEC6dxU9P1LFsHpc3BANqaPdRu4njmqbouCqgRQwFa6J"
	this.description = "Graffiti description"
	this.categories  = "Utilities Core";
	this.icon	 = "fas fa-code";
	
	//
	// UI components
	//
        // the graffiti UI renders HTML to the DOM, and has the functions and 
        // data-vars inside it that are needed to handle writing actions to 
	// the UI and dealing with user interactions with it. it is passed 
	// the application-state and a copy of this module, so it can interact
	// with Saito-level functions.
	//
	this.graffiti_ui = new GraffitiUi(this.app, this, "");

	return this;
    }


    //
    // this function runs the FIRST time that Saito is initialized. here we add the 
    // publickey to which our Graffiti transactions are sent to our keychain so that 
    // peers will send us blocks containing updates.
    //
    installModule(app) {
      //
      // make sure modTemplate can add any hooks its needs for database support, etc.
      //
      super.installModule(app);
      //
      // add the publickey for the graffiti module to our keychain as a "watched" address
      //
      // nb: because we do this on "install" which happens before the network is up, we 
      // do not need to call app.network.propagateKeylist() to update any peers, because
      // we have not yet connected to any peers and informed them of our keylist.
      //
      this.app.keychain.addKey(this.appPubKey, {watched: true});
    }


    //
    // when peers connect to each other, they share an array of "services" they support.
    // implementing this function will allow us to know which peers are running which 
    // version of the graffiti module when they connect.
    //
    returnServices() {
      return [{ service: "graffiti", appPubKey: this.appPubKey}];
    }

    //
    // this replaces initializeHTML
    //
    render() {
      this.graffiti_ui.render();
      this.graffiti_ui.initializeCanvas(10, 400, 400);
    }

    //
    // this function runs whenever we connect to a peer. in this case, if the peer is
    // running a copy of THIS Graffiti application with THIS Graffiti publickey, we want
    // to query it for the current state of the tileset.
    // 
    onPeerServiceUp(app, peer, service) {
      if (service.service === "graffiti") {
	if (service.appPubKey === this.appPubKey) {
	  let mymod = app.modules.returnModule("Graffiti");
	  let sql = `SELECT * FROM tiles;`;
	  let color;
	  let coords;

	  //
	  // we are accessing elements within the graffiti_ui here and doing
	  // somewhat complicated work. it would be better if there was a 
	  // single function in that component that "received" the data we
	  // are expecting so that none of the module code outside the UI
	  // component needs to ever worry about its internals.
	  //
	  this.sendPeerDatabaseRequestWithFilter("Graffiti", sql, (res) => {
	    console.log("fetching initial tiles values from full node");
            if (res.rows) {
	      res.rows.map((row) => {
                //
	        // each row here
                //
	        coords = JSON.parse(row["coords"]);
	        color  = row["color"];
	        this.graffiti_ui.drawTile(coords, color, app);
	        this.graffiti_ui.currentTiles[coords] = color;
	      });
            }
	  });
	  //
	  // we are accessing
	  //
	  if (this.graffiti_ui.lastHover) {
	    if (String(this.graffiti_ui.lastHover["coords"]) == String(coords)) {
	      console.log("changing lastHover");
	      this.graffiti_ui.lastHover["color"] = color;
	    }
	  }
        }
      }
    }



    async onConfirmation(blk, tx, conf, app) {
      let graffiti_mod = app.modules.returnModule("Graffiti");
      let txmsg = tx.returnMessage();
      try {
        if (conf == 0) { 
          if (txmsg.request === "graffiti queue") {
            graffiti_mod.receiveQueueTransaction(blk, tx, conf, app);
          }
        }
      } catch (err) {
        console.log("ERROR in " + this.name + " onConfirmation: " + err);
      }
    }   



    //
    // send queue of tiles to be drawn on-chain
    //
    sendQueueTransaction(queue) {
	
      let newtx = this.app.wallet.createUnsignedTransaction(this.appPubKey);
      newtx.msg.module = "Graffiti";
      newtx.msg.request = "graffiti queue";
      newtx.msg.tiles = queue;
      newtx = this.app.wallet.signTransaction(newtx);

      this.app.network.propagateTransaction(newtx);

    }

    receiveQueueTransaction(blk, tx, conf, app) {

      let txmsg = tx.returnMessage();
      let queue = txmsg.tiles;

      //
      // UI -- this would be better as a function inside the UI
      //
      for (let i = 0; i < queue.length; i++) {
        if (queue[i].length > 1) {

          let coords = queue[i][0];
          let color  = queue[i][1];

	  this.graffiti_ui.currentTiles[String(coords)] = color;
	  this.graffiti_ui.drawTile(coords, color, app);
	  if (this.graffiti_ui.lastHover) {
	    if (String(this.graffiti_ui.lastHover["coords"]) == String(coords)) {
	      this.graffiti_ui.lastHover["color"] = color;
	    }
	  }
	}
      }


      //
      // let anything with DB / storage update itself
      //
      for (let i = 0; i < queue.length; i++) {
        if (queue[i].length > 1) {

          let coords = queue[i][0];
          let color  = queue[i][1];

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

	  //
	  // browsers have this function too, but instantly return, so we aren't
	  // harmed by calling them. only nodes that are able to maintain an off-chain
	  // database will halt here for the update.
	  //
          await this.app.storage.executeDatabase(sql, params, "graffiti");

        }
      }
    }

}

module.exports = Graffiti;

