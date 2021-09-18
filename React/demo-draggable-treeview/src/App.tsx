
//import styles from './App.css';

import React from "react";
import Row from "./Row";
import TreeView, { ITreeNodeControl } from "./TreeView";

function randomName(root: string) {
  return root + Math.floor(Math.random() * 100);
}

class Employee {
    name: string = randomName("emp")
    knickknacks: string[] = ["tag", "poster", "lanyard"]
}

class Company
{
    name: string = randomName("company")
    employees: Employee[] = [new Employee(),new Employee()]
}



export default class App extends React.Component<{}> {
    nodeControl?: ITreeNodeControl

    render() {
        const items = [new Company(), new Company()];

        const renderCompany = (item: Company) => {
          return <div style={{background: "cyan"}}>Company: {item.name}</div>
        }
        const renderEmployee = (item: Employee) => {
          return <div>Employee: {item.name}</div>
        }
        const renderKnickKnack = (item: string) => {
          return <div>KK: {item}</div>
        }

        const queryItem = (item: any, itemType: string) => {
          switch(itemType)
          {
              case "Company":  
                return {
                  children: (item as Company).employees,
                  renderer: renderCompany,
                  getChildItemType: () => "Employee",
                  getKey: (item: any, index: number) => (item as Company).name
                }
              case "Employee": 
                return {
                  children: (item as Employee).knickknacks,
                  renderer: renderEmployee,
                  getChildItemType: () => "KnickKnack",
                  getKey: (item: any, index: number) => (item as Employee).name
                }
              case "KnickKnack": 
                return {
                  children: null,
                  renderer: renderKnickKnack,
                  getChildItemType: () => "",
                  getKey: (item: any, index: number) => `${index}`
                }
          }
          throw Error(`unknown Item type: ${itemType}`)
        }

        const expandAll = () => {
            items.forEach(i => this.nodeControl?.expandItem!(i))
        }

        const expantToEmployee = () => {
            this.nodeControl?.expandToItem!(items[1].employees[1]);
        }

        const expandToKK = () => {

        }

        const handleConnect = (nodeControl: ITreeNodeControl) => {
            this.nodeControl = nodeControl
        } 

        return <div>
            <div>Hello</div>
            <Row>
              <button onClick={expandAll}>ExpandAll</button> 
              <button onClick={expantToEmployee}>Expand to {items[1].employees[1].name}</button>
              <button onClick={expandToKK}>Expand to {items[1].employees[1].knickknacks[2]}</button>
            </Row>
            <div style={{border: "1px solid green"}}>
              <TreeView
                connector={handleConnect}
                itemsSource={items}
                itemQuery={queryItem}
                getItemType={()=>"Company"}              
              />              
            </div>

        </div>
    }
}