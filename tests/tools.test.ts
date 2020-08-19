import { MacroWriterTools } from '../src/tools';

describe('parsePythonSignature', () => {
    it('works with a full boat', () => {
        let speedy = new MacroWriterTools(undefined);
        let line = "def solve_puzzle(name: str, puzzle_type: str = 'suduko', max_tries: int = 3) -> str:";
        let info = speedy.parsePythonSignature(line);
        expect(info.functionName).toBe("solve_puzzle");
        expect(info.argumentCount).toBe(3);
        expect(info.argumentNames[0]).toBe("name");
        expect(info.argumentNames[1]).toBe("puzzle_type");
        expect(info.argumentNames[2]).toBe("max_tries");
        expect(info.argumentTypes[0]).toBe("str");
        expect(info.argumentTypes[1]).toBe("str");
        expect(info.argumentTypes[2]).toBe("int");
        expect(info.argumentDefaults[0]).toBe("");
        expect(info.argumentDefaults[1]).toBe("'suduko'");
        expect(info.argumentDefaults[2]).toBe("3");
        expect(info.isClassMember).toBeFalsy();
    });
    it('works with a class method', () => {
        let speedy = new MacroWriterTools(undefined);
        let line = "def solve_puzzle(self, name: str, puzzle_type: str = 'suduko', max_tries: int = 3) -> str:";
        let info = speedy.parsePythonSignature(line);
        expect(info.functionName).toBe("solve_puzzle");
        expect(info.argumentCount).toBe(3);
        expect(info.argumentNames[0]).toBe("name");
        expect(info.argumentNames[1]).toBe("puzzle_type");
        expect(info.argumentNames[2]).toBe("max_tries");
        expect(info.argumentTypes[0]).toBe("str");
        expect(info.argumentTypes[1]).toBe("str");
        expect(info.argumentTypes[2]).toBe("int");
        expect(info.argumentDefaults[0]).toBe("");
        expect(info.argumentDefaults[1]).toBe("'suduko'");
        expect(info.argumentDefaults[2]).toBe("3");
        expect(info.isClassMember).toBeTruthy();
    });
    it('works with a simple sig', () => {
        let speedy = new MacroWriterTools(undefined);
        let line = "def solve_puzzle(name):";
        let info = speedy.parsePythonSignature(line);
        expect(info.functionName).toBe("solve_puzzle");
        expect(info.argumentCount).toBe(1);
        expect(info.argumentNames[0]).toBe("name");
        expect(info.argumentTypes[0]).toBe("");
        expect(info.argumentDefaults[0]).toBe("");
        expect(info.isClassMember).toBeFalsy();
    });

});

