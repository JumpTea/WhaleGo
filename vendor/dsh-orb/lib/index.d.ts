//#region src/index.d.ts
/** Host half of the settings page. The browser half is `./client`. */
/** Cordis plugin name. The patch id matches this. */
declare const name = "ui-settings-orb";
/** No host services. The page talks to `/.dsh-orb` from the browser. */
declare const inject: string[];
/** The browser plugin registers the settings section. */
declare function apply(): void;
//#endregion
export { apply, inject, name };