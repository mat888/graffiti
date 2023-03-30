module.exports = GraffitiUiTemplate = () => {
  return `
    <div class="graffiti-ui-container">

      <div id="color-bar">
        <label for="favcolor"></label>
        <input type="color" id="favcolor" name="favcolor" value="#f71f3d">
        <input class="color-button" type="button" value="#ffffff">
        <input class="color-button" type="button" value="#ffffff">
        <input class="color-button" type="button" value="#ffffff">
      </div>

      <div id="canvas-container"></div>

    </div>
  `;
}
