/**
 * Escapes all of the special regex symbols with a backslash.
 */
export function escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Callback function to decide if an item already exists in a list that's being copied.
 */
export function onlyUnique(value: any, index: number, self: any[]) {
    return self.indexOf(value) === index;
}

// /**
//  * Adds a do-nothing function to the BOTTOM of the javascript event stack
//  * and then waits for it to occur.
//  */
// export function flushEventStack() {
//     return new Promise(r => setTimeout(r, 0));
// }

/**
 * Returns true if obj is an (un-nested) list of strings; otherwise false.
 */
export function isListOfStrings(obj: any): boolean {
    let valid = (obj instanceof Array);
    if (valid) {
        for (let element of obj) {
            if (typeof element !== "string") {
                valid = false;
                break;
            }
        }
    }
    return valid;
}


export function cloneArray(originalArray: any[]): any[] {
    return Object.assign([], originalArray);
}