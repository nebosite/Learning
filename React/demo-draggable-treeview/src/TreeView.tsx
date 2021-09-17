
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

class ExpandableNode {
    @observable expanded: boolean = false;  
    item: any
    itemType: string

    queryItem: (item: any, itemType: string) => TreeViewItemInfo

    get children() {return this.queryItem(this.item, this.itemType).children}
    get renderer() {return (item: any) => <div></div>}
    get getItemType() {return this.queryItem(this.item, this.itemType).getChildItemType}

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

    render() {
        return this.queryItem(this.item, this.itemType).renderer(this.item);
    }
}

@observer
export default class TreeView 
    extends React.Component<TreeViewProps> {

    nodes = new Array<ExpandableNode>()

    constructor(props: TreeViewProps) {
        super(props);

        props.itemsSource.forEach(
            item => this.nodes.push(
                new ExpandableNode(item, this.props.itemQuery, this.props.getItemType(item))
            ))
    }

    renderNode(node: ExpandableNode) {

        const handleExpanderClick = (e: any) => {
            e.stopPropagation()
            console.log(`Click: ${node.expanded}`)
            node.expanded = !node.expanded;    
        }

        const renderChildren = () => {
            const children = node.children;
            if(!children) return null;
            return <TreeView 
                itemsSource={children}
                itemQuery={node.queryItem}
                getItemType={node.getItemType}
            />
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
                ? <div  style={{marginLeft: "20px"}}>{renderChildren()}</div>
                : null
            }
        </div>
    }

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