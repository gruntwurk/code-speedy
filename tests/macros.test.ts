import * as vscode from 'vscode';
import { ActionType } from '../src/actions';
import { MacroDef, SpeedyMacros } from '../src/macros';



describe('parseMacroDefinitions', () => {
    it('works on a single macro of type copmmand without args', () => {
        let speedy = new SpeedyMacros(undefined);
        let text = "[m1]\ncmd:\naCommandWithoutArgs";
        speedy.parseMacroDefinitions(text);
        let names = speedy.getNames();
        expect(names.length).toBe(1);
        expect(names[0]).toBe("m1");
        let actions = speedy.getMacro("m1").actions;
        expect(actions.length).toBe(1);
        expect(actions[0].actionType).toBe(ActionType.command);
        expect(actions[0].steps.length).toBe(1);
        expect(actions[0].steps[0]).toBe("aCommandWithoutArgs");
    });
    it('works on a single macro of type copmmand with args', () => {
        let speedy = new SpeedyMacros(undefined);
        let text = "[m1]\ncmd:\naCommandWithArgs\nname = xxx\nplace = yyy";
        speedy.parseMacroDefinitions(text);
        let names = speedy.getNames();
        expect(names.length).toBe(1);
        expect(names[0]).toBe("m1");
        let actions = speedy.getMacro("m1").actions;
        expect(actions.length).toBe(1);
        expect(actions[0].actionType).toBe(ActionType.command);
        expect(actions[0].steps.length).toBe(3);
        expect(actions[0].steps[0]).toBe("aCommandWithArgs");
        expect(actions[0].steps[1]).toBe("name = xxx");
        expect(actions[0].steps[2]).toBe("place = yyy");
    });
    it('works on single macro with vars and snippet', () => {
        let speedy = new SpeedyMacros(undefined);
        let text = "[m1]\nvars:\ngreeting = Dear Sirs:\nsnip:\n$greeting\nI'm writing to ...";
        speedy.parseMacroDefinitions(text);
        let names = speedy.getNames();
        expect(names.length).toBe(1);
        expect(names[0]).toBe("m1");
        let actions = speedy.getMacro("m1").actions;
        expect(actions.length).toBe(2);
        expect(actions[0].actionType).toBe(ActionType.variables);
        expect(actions[0].steps.length).toBe(1);
        expect(actions[0].steps[0]).toBe("greeting = Dear Sirs:");
        expect(actions[1].actionType).toBe(ActionType.snippet);
        expect(actions[1].steps.length).toBe(2);
        expect(actions[1].steps[0]).toBe("$greeting");
        expect(actions[1].steps[1]).toBe("I'm writing to ...");
    });

});
