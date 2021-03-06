import * as ts from 'typescript';
import { navigate, getFlatChildren } from './nodeUtils';


const defaultOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.Latest,
    module: ts.ModuleKind.CommonJS
};

export interface ClassDoc {
    name: string;
    extends: string;
    propInterface: string;
    comment: string;
}

export interface InterfaceDoc {
    name: string;
    members: MemberDoc[];
    comment: string;
}

export interface MemberDoc {
    name: string;
    text: string;
    type: string;
    values?: string[];
    isRequired: boolean;
    comment: string;
}

export interface FileDoc {
    classes: ClassDoc[];
    interfaces: InterfaceDoc[];
    defaultProps: String[];
}
/** Generate documention for all classes in a set of .ts files */
export function getDocumentation(fileName: string, options: ts.CompilerOptions = defaultOptions): FileDoc {

    let program = ts.createProgram([fileName], options);
    //noinspection TypeScriptUnresolvedFunction
    let checker = program.getTypeChecker();

    const classes: ClassDoc[] = [];
    const interfaces: InterfaceDoc[] = [];
    const defaultProps: String[] = [];
    //noinspection TypeScriptUnresolvedFunction
    const sourceFile = program.getSourceFile(fileName);
    const sourceText = sourceFile.text;
    ts.forEachChild(sourceFile, visit);

    /** visit nodes finding exported classes */
    function visit(node: ts.Node) {
        // Only consider exported nodes
        // if (!isNodeExported(node)) {
        //     return;
        // }

        if (node.kind === ts.SyntaxKind.VariableStatement) {
            const classNode: any = (node as ts.VariableStatement).declarationList.declarations[0];
            const symbol = classNode.symbol;
            if(!(classNode.initializer && classNode.initializer.parameters && classNode.initializer.parameters[0].type)) {
                return
            }
            const intf = classNode.initializer.parameters[0].type.typeName.getText();
            const classObj = {
                name: symbol.name,
                comment: ts.displayPartsToString(symbol.getDocumentationComment()),
                extends: 'StatelessComponent',
                propInterface: intf,
            };
            classes.push(classObj);
        }

        if (node.kind === ts.SyntaxKind.ClassDeclaration) {
            const classNode = node as ts.ClassDeclaration;
            const symbol = checker.getSymbolAtLocation(classNode.name);

            const typeArguments = navigate(classNode,
                ts.SyntaxKind.HeritageClause,
                ts.SyntaxKind.ExpressionWithTypeArguments);

            const list = getFlatChildren(typeArguments)
                .filter(i => i.kind === ts.SyntaxKind.Identifier)
                .map((i: ts.Identifier) => i.text);

            const symbols = symbol.exports.get('defaultProps')

            if(symbols) {

                symbols.declarations.map(function(obj: any) {
                    obj.initializer.properties.map(function(o) {
                        var defaultValue = null;
                        if(o.initializer && o.initializer.text !== undefined) {
                            defaultValue = o.initializer.text.trim();
                        }
                        else if(o.initializer && o.initializer.body !== undefined) {
                            defaultValue = sourceText.substring(o.initializer.body.statements.pos,o.initializer.body.statements.end).trim();
                        }
                        else if(o.initializer !== undefined) {
                            defaultValue = sourceText.substring(o.initializer.pos, o.initializer.end).trim();
                        }

                        if(defaultValue !== null && defaultValue != 'undefined') {
                            defaultProps[o.name.text] = defaultValue;
                        }

                    })

                })
            }

            const extend = list.length > 0 && list.indexOf('Component') > -1 ? 'Component' : null

            // check React namespace
            if(list.length > 0 && list[0] === 'React') {
                list.shift();
                list[0] = 'React.' + list[0];
            }
            // check MUK namespace
            if(list.length > 0 && list[0] === 'MUK') {
                list.shift();
                list[0] = 'MUK.' + list[0];
            }

            classes.push({
                name: symbol.name,
                comment: ts.displayPartsToString(symbol.getDocumentationComment()),
                extends: 'Component',
                propInterface: 'Props',
            });
        }

        if (node.kind === ts.SyntaxKind.InterfaceDeclaration) {
            const interfaceDeclaration = node as ts.InterfaceDeclaration;
            if (interfaceDeclaration.parent === sourceFile) {

                const symbol = checker.getSymbolAtLocation(interfaceDeclaration.name);
                const type = checker.getTypeAtLocation(interfaceDeclaration.name);

                const members = type.getProperties()
                    .filter(i => {
                        const s = i as any;
                        return s.parent && s.parent.name && symbol.name === s.parent.name;
                    })
                    .map(i => {
                        const declaration: any = i.valueDeclaration
                        const symbol = checker.getSymbolAtLocation(declaration.name);
                        const prop = declaration as ts.PropertySignature;
                        const typeInfo = getType(prop);
                        return {
                            name: i.getName(),
                            text: declaration.getText(),
                            type: typeInfo.type,
                            values: typeInfo.values,
                            isRequired: !prop.questionToken,
                            comment: ts.displayPartsToString(symbol.getDocumentationComment()).trim(),
                        };
                    });

                const interfaceDoc: InterfaceDoc = {
                    name: symbol.getName(),
                    comment: ts.displayPartsToString(symbol.getDocumentationComment()).trim(),
                    members: members,
                };
                interfaces.push(interfaceDoc);
            }
        }
        else if (node.kind === ts.SyntaxKind.ModuleDeclaration) {
            // This is a namespace, visit its children
            ts.forEachChild(node, visit);
        }
    }

    /** True if this is visible outside this file, false otherwise */
    function isNodeExported(node: ts.Node): boolean {
        // Parse the modifier array for the export keyword. If it is found
        // and the node.parent is a sourcefile, return true
        // This only returns top level exports
        const {modifiers} = node;
        if (modifiers) {
            for (let i = 0; i < (modifiers as Array<any>).length; i++) {
                if (modifiers[i].kind === ts.SyntaxKind.ExportKeyword) {
                    return node.parent.kind === ts.SyntaxKind.SourceFile
                }
            }
        }
        return false;
    }

    return {
        classes,
        interfaces,
        defaultProps
    }
}

function getType(prop: ts.PropertySignature): {type: string, values?: string[]} {
    const unionType = prop.type as ts.UnionTypeNode;
    if (unionType && unionType.types) {
        return {
            type: 'string',
            values: (unionType.types as Array<any>).map(i => i.getText()),
        }
    }
    //noinspection TypeScriptUnresolvedFunction
    return {
        type: prop.type.getText(),
    }
}
// /** Serialize a symbol into a json object */
//     function serializeSymbol(symbol: ts.Symbol): DocEntry {
//         return {
//             name: symbol.getName(),
//             documentation: ts.displayPartsToString(symbol.getDocumentationComment()),
//             type: checker.typeToString(checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration))
//         };
//     }

//     /** Serialize a class symbol infomration */
//     function serializeClass(symbol: ts.Symbol) {
//         //console.log('flags: ', symbol.getFlags(), ' declarations:', symbol.getDeclarations());
//         let details = serializeSymbol(symbol);

//         // Get the construct signatures
//         let constructorType = checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration);
//         details.constructors = constructorType.getConstructSignatures().map(serializeSignature);
//         return details;
//     }

//     /** Serialize a signature (call or construct) */
//     function serializeSignature(signature: ts.Signature) {
//         return {
//             parameters: signature.parameters.map(serializeSymbol),
//             returnType: checker.typeToString(signature.getReturnType()),
//             documentation: ts.displayPartsToString(signature.getDocumentationComment())
//         };
//     }
