const GraffitiUiTemplate = require('./main.template');

class GraffitiUi {

  constructor(app, mod, container="") {
    this.app = app;
    this.mod = mod;
    this.container = container;
  }

  render() {

    if (document.querySelector(".graffiti-ui-container")) {
      this.app.browser.replaceElementBySelector(GraffitiUiTemplate(), ".graffiti-ui-container");
    } else {
      //
      // if container is "" (default) it will be added to DOM (i.e. body)
      //
      this.app.browser.addElementToSelector(GraffitiUiTemplate(), this.container);
    }

    this.attachEvents();

  }

  attachEvents() {

  }

}


module.exports = GraffitiUi;

