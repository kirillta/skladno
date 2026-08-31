import assert from "node:assert/strict";
import test from "node:test";
import { electronMessagesFor, KEY_BINDING_COMMAND } from "@skladno/shared";
import { createApplicationMenu } from "./application-menu.js";


// product: application.electron-native-menu
test("application menu routes workspace actions through the allowlisted command IDs", () => {
    const commands: string[] = [];
    let updatesChecked = 0;
    const menu = createApplicationMenu(electronMessagesFor("en"), {
        triggerCommand: (command) => commands.push(command),
        checkForUpdates: () => updatesChecked += 1,
    });
    const file = menu[0]!.submenu! as typeof menu;
    const view = menu[2]!.submenu! as typeof menu;
    const help = menu[4]!.submenu! as typeof menu;

    file[0]!.click?.({} as never, undefined, {} as never);
    view[3]!.click?.({} as never, undefined, {} as never);
    help[0]!.click?.({} as never, undefined, {} as never);

    assert.deepEqual(commands, [KEY_BINDING_COMMAND.NEW_ARTICLE, KEY_BINDING_COMMAND.VIEW_FACT_CHECK]);
    assert.equal(updatesChecked, 1);
});
