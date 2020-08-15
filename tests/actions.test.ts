import { ActionType } from '../src/actions';


// describe('homogenizeMacroDef', () => {
//     it('works on a single array assumed to be one action', () => {
//         let mdef = ["cmd: foo"];
//         expect(homogenizeMacroDef(mdef)).toBeTruthy();
//         expect(mdef).toStrictEqual([['cmd: foo']]);
//     });
//     it('validates on a nested array that contains one string.', () => {
//         let mdef = [["cmd: foo"]];
//         expect(homogenizeMacroDef(mdef)).toBeTruthy();
//         expect(mdef).toStrictEqual([['cmd: foo']]);
//     });
//     it('validates a nested array that contains multiple strings.', () => {
//         let mdef = [["cmd: foo", "vars: standard", "js: foo();"]];
//         expect(homogenizeMacroDef(mdef)).toBeTruthy();
//         expect(mdef).toStrictEqual([["cmd: foo", "vars: standard", "js: foo();"]]);
//     });
//     it('fails to validate a nested array that contains a non-string.', () => {
//         let mdef = [["cmd: foo", 3.1415, "vars: standard", "js: foo();"]];
//         expect(homogenizeMacroDef(mdef)).not.toBeTruthy();
//     });
// });

// describe("extractCommand", () => {
//     it('works', () => {
//         expect(extractCommand(["cmd: foo"])).toBe(ActionType.command);
//         expect(extractCommand(["command: foo"])).toBe(ActionType.command);
//         expect(extractCommand(["js: foo"])).toBe(ActionType.javascript);
//         expect(extractCommand(["javascript: foo"])).toBe(ActionType.javascript);
//         expect(extractCommand(["shell: foo"])).toBe(ActionType.shellscript);
//         expect(extractCommand(["shellscript: foo"])).toBe(ActionType.shellscript);
//         expect(extractCommand(["vars: foo"])).toBe(ActionType.variables);
//         expect(extractCommand(["variables: foo"])).toBe(ActionType.variables);
//         expect(extractCommand(["snip: foo"])).toBe(ActionType.snippet);
//         expect(extractCommand(["snippet: foo"])).toBe(ActionType.snippet);
//         expect(extractCommand(["nosuch: foo"])).toBeUndefined();
//         expect(extractCommand(["SNIP: foo"])).toBe(ActionType.snippet);
//         expect(extractCommand(["Snippet: foo"])).toBe(ActionType.snippet);
//         expect(extractCommand([" snippet: foo"])).toBe(ActionType.snippet);
//         expect(extractCommand(["snippet : foo"])).toBe(ActionType.snippet);
//         expect(extractCommand(["\tsnippet : foo"])).toBe(ActionType.snippet);
//         expect(extractCommand(["\tsnippet : "])).toBe(ActionType.snippet);
//         expect(extractCommand(["\tsnippet"])).toBe(ActionType.snippet);
//     });
// });