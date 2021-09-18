
//import styles from './App.css';
// https://github.com/nebosite/Learning

import { action, makeObservable, observable } from "mobx";
import { observer } from "mobx-react";
import React from "react";
import {GoTriangleRight, GoTriangleDown, GoPrimitiveDot} from 'react-icons/go'
import Row from "./Row";


interface TreeViewItemInfo {
    children: any[] | null,
    renderer: (item: any) => JSX.Element | null | string | number
    getChildItemType: (item: any) => string
    getKey:(item: any, index: number) => string
    // parent
    // parenttype
}

export interface ITreeNodeControl {
    expandItem(item: any):ITreeNodeControl | null
    expandToItem(item: any):ITreeNodeControl | null
}

interface TreeViewProps {
    root?: ExpandableNode
    itemsSource?: any[]
    itemQuery: (item: any, itemType: string) => TreeViewItemInfo
    getItemType: (item: any) => string
    connector?: (nodeControl: ITreeNodeControl) => void 
}


// -----------------------------------------------------------------------------------------
// ExpandableNode
// -----------------------------------------------------------------------------------------
class ExpandableNode implements ITreeNodeControl {
    @observable _expanded: boolean = false;  
    get expanded() { return this._expanded}
    set expanded(value: boolean) {
        if(value) console.log(`Expanding ${this.item?.name}`)
        action(()=> this._expanded = value)()
    }
    item: any 
    itemType: string

    queryItem: (item: any, itemType: string) => TreeViewItemInfo

    private _info?: TreeViewItemInfo;
    get info() {
        if(!this._info) {
            this._info = this.queryItem(this.item, this.itemType)
        }
        return this._info;
    }

    private _children?: ExpandableNode[] 
    private _nodeMap = new Map<any, ExpandableNode>();
    get children() {
        if(!this._children) {
            const info = this.info;
            this._children = info.children?.map(c => {
                const newNode = new ExpandableNode(c, this.queryItem, info.getChildItemType(c) )
                this._nodeMap.set(c, newNode);
                return newNode;
            }) ?? []       
        }
        return this._children;
    }
    get renderer() {return (item: any) => <div></div>}
    get getItemType() {return this.info.getChildItemType}
    get getKey() { return this.info.getKey}

    // -----------------------------------------------------------------------------------------
    // ctor
    // -----------------------------------------------------------------------------------------
    constructor(
        item: any, 
        queryItem: (item: any, itemType: string) => TreeViewItemInfo,
        itemType: string,
        itemInfo: TreeViewItemInfo | undefined = undefined) 
    {
        makeObservable(this)
        this.itemType = itemType;
        this.queryItem = queryItem
        this.item = item; 
        this._info = itemInfo;
    }

    // -----------------------------------------------------------------------------------------
    // expandItem
    // -----------------------------------------------------------------------------------------
    expandItem = (item: any): ITreeNodeControl | null => {
        if(this.item === item) {
            this.expanded = true;
            return this as ITreeNodeControl;
        }
        else {
            this.children!.forEach(n =>{
                if(n.expandItem(item)) {
                    this.expanded = true;
                    return n;
                }
            })
        }
        return null;
    }

    // -----------------------------------------------------------------------------------------
    // expandToItem
    // -----------------------------------------------------------------------------------------
    expandToItem = (item: any): ITreeNodeControl | null => {
        const foundNode = this._nodeMap.get(item) 
        if(foundNode)  {
            this.expanded = true;
            return foundNode;
        }
        else {
            this.children!.forEach(n =>{
                const foundChildNode = n.expandToItem(item)
                if(foundChildNode) {
                    this.expanded = true;
                    return foundChildNode;
                }
            })
        }
        return null;
    }



    // -----------------------------------------------------------------------------------------
    // render
    // -----------------------------------------------------------------------------------------
    render() {
        return this.queryItem(this.item, this.itemType).renderer(this.item);
    }
}

// -----------------------------------------------------------------------------------------
// TreeView
// -----------------------------------------------------------------------------------------
@observer
export default class TreeView 
    extends React.Component<TreeViewProps> {

    private _root:ExpandableNode

    // -----------------------------------------------------------------------------------------
    // ctor
    // -----------------------------------------------------------------------------------------
    constructor(props: TreeViewProps) {
        super(props);

        if(props.root) { 
            this._root = props.root;
        }
        else if(props.itemsSource) {
            this._root = new ExpandableNode(
                null, 
                props.itemQuery,
                "__root__",
                {
                    children: props.itemsSource!,
                    renderer: (item: any) => null,
                    getChildItemType: this.props.getItemType,
                    getKey:(item: any, index: number) => {throw Error(`on item ${JSON.stringify(item)}: Should never call getKey Treeview root`) }               
                }
                );
        }
        else {
            throw Error("Must provide a root or itemsSource")
        }
    }

    // -----------------------------------------------------------------------------------------
    // componentDidMount
    // -----------------------------------------------------------------------------------------
    componentDidMount() {
        if(this.props.connector) {
            this.props.connector(this._root);
        }
    }

    // -----------------------------------------------------------------------------------------
    // renderChildren
    // -----------------------------------------------------------------------------------------
    renderChildren(node: ExpandableNode) {
        const children = node.children;
        if(!children) return null;
        return <TreeView 
            root={node}
            itemQuery={node.queryItem}
            getItemType={node.getItemType} 
        />
    }

    // -----------------------------------------------------------------------------------------
    // renderNode
    // -----------------------------------------------------------------------------------------
    renderNode(node: ExpandableNode) {

        const handleExpanderClick = (e: any) => {
            e.stopPropagation()
            console.log(`Click: ${node.expanded}`)
            node.expanded = !node.expanded;    
        }

        return <div>
            <Row style={{padding: '5px', background: "red"}}>
                    <div onClick={handleExpanderClick}>
                        { 
                            node.children
                                ? node.expanded   
                                    ? <GoTriangleDown />
                                    : <GoTriangleRight />
                                : <GoPrimitiveDot />
                        }
                        
                    </div>
                {
                    node.render()
                }

            </Row>
            { node.expanded
                ? <div  style={{marginLeft: "20px"}}>{this.renderChildren(node)}</div>
                : null
            }
        </div>
    }

    // -----------------------------------------------------------------------------------------
    // render
    // -----------------------------------------------------------------------------------------
    render() {
        return <div>
            {
                this._root.children.map((node,i) => (
                    <div key={node.getKey(node.item, i)}>
                        {
                            this.renderNode(node)
                        }
                    </div>
                ))
            }
        </div>
    }
}