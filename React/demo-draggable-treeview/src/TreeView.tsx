
//import styles from './App.css';

import { makeObservable, observable } from "mobx";
import { observer } from "mobx-react";
import React, { MouseEventHandler } from "react";
import {GoTriangleRight, GoTriangleDown, GoPrimitiveDot} from 'react-icons/go'
import Row from "./Row";


interface TreeViewItemInfo {
    children: any[] | null,
    renderer: (item: any) => JSX.Element
    getChildItemType: (item: any) => string
    // parent
    // parenttype
}

interface TreeViewProps {
    itemsSource: any[]
    itemQuery: (item: any, itemType: string) => TreeViewItemInfo
    getItemType: (item: any) => string
}

// -----------------------------------------------------------------------------------------
// ExpandableNode
// -----------------------------------------------------------------------------------------
class ExpandableNode {
    @observable expanded: boolean = false;  
    item: any
    itemType: string

    queryItem: (item: any, itemType: string) => TreeViewItemInfo

    get children() {return this.queryItem(this.item, this.itemType).children}
    get renderer() {return (item: any) => <div></div>}
    get getItemType() {return this.queryItem(this.item, this.itemType).getChildItemType}

    // -----------------------------------------------------------------------------------------
    // ctor
    // -----------------------------------------------------------------------------------------
    constructor(
        item: any, 
        queryItem: (item: any, itemType: string) => TreeViewItemInfo,
        itemType: string) 
    {
        makeObservable(this)
        this.itemType = itemType;
        this.queryItem = queryItem
        this.item = item; 
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

    nodes = new Array<ExpandableNode>()

    // -----------------------------------------------------------------------------------------
    // ctor
    // -----------------------------------------------------------------------------------------
    constructor(props: TreeViewProps) {
        super(props);

        props.itemsSource.forEach(
            item => this.nodes.push(
                new ExpandableNode(item, this.props.itemQuery, this.props.getItemType(item))
            ))
    }
    // -----------------------------------------------------------------------------------------
    // renderChildren
    // -----------------------------------------------------------------------------------------
    renderChildren(node: ExpandableNode) {
        const children = node.children;
        if(!children) return null;
        return <TreeView 
            itemsSource={children}
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
            <Row>
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
                this.nodes.map(node => (
                    <div>
                        {
                            this.renderNode(node)
                        }
                    </div>
                ))
            }
        </div>
    }
}