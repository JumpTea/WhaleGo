//#region src/index.ts
/** Host half of the settings page. The browser half is `./client`. */
/** Cordis plugin name. The patch id matches this. */
const name = "ui-settings-orb";
/** No host services. The page talks to `/.dsh-orb` from the browser. */
const inject = [];
/** The browser plugin registers the settings section. */
function apply() {}
//#endregion
export { apply, inject, name };
