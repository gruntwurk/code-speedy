import { VariableDefs } from '../src/variables';

describe('findAllVariablePlaceholders', () => {
    it('works', () => {
        let varDefs = new VariableDefs();
        let lines = ["foo bar $baz bing $baz/${bang} boing ${baz} $booze113(17)"];
        let list = varDefs.findAllVariablePlaceholders(lines);
        expect(list).toHaveLength(4);
    });
});
