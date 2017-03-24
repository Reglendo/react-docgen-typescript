import { FileDoc } from './parser';

export function convertToDocgen(doc: FileDoc) {
    const reactClasses = doc.classes.filter(i => i.extends === 'Component' || i.extends === 'StatelessComponent' || i.extends === 'React.Component');

    if (reactClasses.length === 0) {
        return {};
    }
    const comp = reactClasses[0];
    const reactInterfaces = doc.interfaces.filter(i => i.name === comp.propInterface);
    if (reactInterfaces.length === 0) {
        return {};
    }
    const props = reactInterfaces[0];
    const defaultProps = doc.defaultProps;

    return {
        description: comp.comment,
        props: props.members.reduce((acc, i) => {
            const item: PropItem = {
                description: i.comment,
                type: {name: i.type},
                defaultValue: printDefaultValue(defaultProps, i.name, i.type),
                required: i.isRequired
            };
            if (i.values) {
                item.description = item.description + ' (one of the following:' + i.values.join(',') + ')';
            }

            acc[i.name] = item;
            return acc;
        }, {})
    }
}

export function printDefaultValue(defaultProps: Array<String>, name: string, type: string) {
    let defaultValue = null;

    let value = defaultProps[name];

    if(defaultProps[name] !== undefined) {
        if(type === 'number') {
            defaultValue =  defaultProps[name];
        } else 
        if(type === 'string') {
            defaultValue =  "“" + defaultProps[name] + "”";
        } else 
        if(type === 'boolean') {
            defaultValue = defaultProps[name];
        } else {
            defaultValue = defaultProps[name];
        }
    }

    if(defaultValue !== null) {
        return { value: defaultValue, computed: false };
    } else {
        return null;
    }
}

export interface PropItemType {
    name: string;
    value?: any;
}

export interface PropItem {
    required: boolean;
    type: PropItemType;
    description: string;
    defaultValue: any;
}

export interface PropsObject {
    [key: string]: PropItem;
}

export interface Docgen {
    description: string;
    props: PropsObject;
}

/*
 {
 "props": {
 "foo": {
 "type": {
 "name": "number"
 },
 "required": false,
 "description": "Description of prop \"foo\".",
 "defaultValue": {
 "value": "42",
 "computed": false
 }
 },
 "bar": {
 "type": {
 "name": "custom"
 },
 "required": false,
 "description": "Description of prop \"bar\" (a custom validation function).",
 "defaultValue": {
 "value": "21",
 "computed": false
 }
 },
 "baz": {
 "type": {
 "name": "union",
 "value": [
 {
 "name": "number"
 },
 {
 "name": "string"
 }
 ]
 },
 "required": false,
 "description": ""
 }
 },
 "description": "General component description."
 }
 */