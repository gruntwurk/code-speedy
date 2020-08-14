import { cloneArray, escapeRegExp, isListOfStrings, onlyUnique } from '../src/utils';

describe('cloneArray', () => {
    it('produces a distinct copy of the array, not just another reference to the same array', () => {
        let orig = [1, "abc", { a: "b " }];
        let copy = cloneArray(orig);
        expect(copy).toStrictEqual(orig);
        expect(copy).not.toBe(orig);
    });
});

describe("escapeRegExp", () => {
    it('Escapes all of the special regex symbols with a backslash.', () => {
        expect(escapeRegExp('$')).toBe('\\$');
        expect(escapeRegExp('.')).toBe('\\.');
        expect(escapeRegExp('*')).toBe('\\*');
        expect(escapeRegExp('+')).toBe('\\+');
        expect(escapeRegExp('?')).toBe('\\?');
        expect(escapeRegExp('^')).toBe('\\^');
        expect(escapeRegExp('$')).toBe('\\$');
        expect(escapeRegExp('{')).toBe('\\{');
        expect(escapeRegExp('}')).toBe('\\}');
        expect(escapeRegExp('(')).toBe('\\(');
        expect(escapeRegExp(')')).toBe('\\)');
        expect(escapeRegExp('|')).toBe('\\|');
        expect(escapeRegExp('[')).toBe('\\[');
        expect(escapeRegExp(']')).toBe('\\]');
        expect(escapeRegExp('\\')).toBe('\\\\');
        expect(escapeRegExp('(abc)[123]$0.99')).toBe('\\(abc\\)\\[123\\]\\$0\\.99');
    });
});

describe("onlyUnique", () => {
    it("Callback function to decide if an item already exists in a list that's being copied.", () => {
        let origList = ["foo","bar","baz","bing","baz","bang","boing","baz","booze","bing","foo"];
        expect(origList.filter(onlyUnique)).toHaveLength(7);
        });
});

describe("isListOfStrings", () => {
    it('Returns true if obj is an (un-nested) list of strings; otherwise false.', () => {
        expect(isListOfStrings(['abc','def'])).toBeTruthy();
        expect(isListOfStrings(['abc',3.1415])).not.toBeTruthy();
    });
});



